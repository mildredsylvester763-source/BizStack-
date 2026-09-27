import { createClient } from '@/lib/supabase-server';
import { buildPlan } from '@/lib/ai/build-engine/capabilities';
import { parseMoneyRequest, parseProductRequest } from '@/lib/ai/build-engine/operations-local';
import type { BuildMode } from '@/lib/ai/build-engine/types';

function checksum(value:unknown){const json=JSON.stringify(value);let hash=2166136261;for(let i=0;i<json.length;i+=1){hash^=json.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(16);}

export async function runProductInventoryBuild(args:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
  const {businessId,userId,prompt,mode='auto_execute'}=args; const supabase=createClient();
  const {data:business,error:be}=await supabase.from('businesses').select('id,name,currency,workspace_id').eq('id',businessId).eq('owner_id',userId).single();
  if(be||!business)throw new Error('Business context is not available.');
  const plan=buildPlan({capability:'product_inventory',prompt,mode,context:{business:{id:business.id,name:business.name,currency:business.currency}}});
  const idempotencyKey=checksum({capability:'product_inventory',prompt:prompt.trim(),mode});
  const {data:existing}=await supabase.from('ai_build_runs').select('id,status,result').eq('business_id',businessId).eq('idempotency_key',idempotencyKey).maybeSingle();
  if(existing?.id&&['succeeded','building','testing','planning'].includes(existing.status))return{runId:existing.id,status:existing.status,result:existing.result};
  const {data:run,error:re}=await supabase.from('ai_build_runs').insert({business_id:businessId,workspace_id:business.workspace_id,created_by:userId,capability_key:'product_inventory',request_text:prompt.trim(),execution_mode:mode,plan,context:{business},idempotency_key:idempotencyKey,status:'planning',started_at:new Date().toISOString()}).select('id').single();
  if(re||!run)throw new Error(re?.message||'Could not create product build run.');
  try{
    const draft=parseProductRequest(prompt,business.currency||'USD');
    await supabase.from('ai_build_steps').insert({business_id:businessId,build_run_id:run.id,sequence_no:1,step_key:'parse_product',step_type:'compiler',status:'succeeded',input:{prompt},output:draft,finished_at:new Date().toISOString()});
    let duplicateQuery=supabase.from('products').select('id,name,sku,stock_quantity').eq('business_id',businessId).ilike('name',draft.name).limit(5);
    if(draft.sku)duplicateQuery=duplicateQuery.or('sku.eq.'+draft.sku+',name.ilike.'+draft.name);
    const {data:duplicates}=await duplicateQuery;
    if(duplicates?.length)throw new Error('A product with this name or SKU already exists. Edit the existing product instead of creating a duplicate.');
    await supabase.from('ai_build_steps').insert({business_id:businessId,build_run_id:run.id,sequence_no:2,step_key:'check_duplicates',step_type:'validation',status:'succeeded',input:{name:draft.name,sku:draft.sku},output:{duplicates:0},finished_at:new Date().toISOString()});
    const {data:product,error:pe}=await supabase.from('products').insert({business_id:businessId,name:draft.name,sku:draft.sku,description:draft.description,unit:draft.unit,unit_price:draft.unitPrice,cost_price:draft.costPrice,stock_quantity:draft.stockQuantity,low_stock_threshold:draft.lowStockThreshold,is_active:true}).select('id,name,sku,unit_price,cost_price,stock_quantity,low_stock_threshold').single();
    if(pe||!product)throw new Error(pe?.message||'Could not create product.');
    if(draft.stockQuantity>0){
      const {error:me}=await supabase.from('stock_movements').insert({product_id:product.id,business_id:businessId,change:draft.stockQuantity,reason:'opening_balance',note:'Created by BizStack AI Build Engine from natural-language request.'});
      if(me){await supabase.from('products').delete().eq('id',product.id).eq('business_id',businessId);throw new Error(me.message);}
    }
    await supabase.from('ai_build_steps').insert({business_id:businessId,build_run_id:run.id,sequence_no:3,step_key:'record_opening_stock',step_type:'execution',status:'succeeded',input:{productId:product.id},output:{stockQuantity:draft.stockQuantity},finished_at:new Date().toISOString()});
    const tests=[{key:'product_created',pass:Boolean(product.id)},{key:'price_positive',pass:Number(product.unit_price)>=0},{key:'stock_not_negative',pass:Number(product.stock_quantity)>=0},{key:'low_stock_rule',pass:Number(product.low_stock_threshold)>=0}];
    for(const test of tests)await supabase.from('ai_build_tests').insert({business_id:businessId,build_run_id:run.id,test_key:test.key,test_type:'product_integrity',status:test.pass?'passed':'failed',assertion:{expected:true},actual:test.pass,completed_at:new Date().toISOString()});
    const failed=tests.filter(t=>!t.pass);if(failed.length)throw new Error('Product validation failed: '+failed.map(t=>t.key).join(', '));
    const result={product,stockMovementRecorded:draft.stockQuantity>0,tests};
    await supabase.from('ai_build_artifacts').insert({business_id:businessId,build_run_id:run.id,artifact_type:'product',artifact_key:'product',version:1,status:'validated',content:result,checksum:checksum(result)});
    await supabase.from('ai_build_runs').update({status:'succeeded',provider_key:'local-product-compiler',provider_status:'fallback',result,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',run.id).eq('business_id',businessId);
    await supabase.from('events').insert({business_id:businessId,event_type:'ai.build.product_created',summary:'AI Build Engine created product '+product.name,evidence:{build_run_id:run.id,product_id:product.id,stock_quantity:draft.stockQuantity},status:'info',priority:'normal',category:'inventory'});
    return{runId:run.id,status:'succeeded',result};
  }catch(error){const message=error instanceof Error?error.message:'Product build failed.';await supabase.from('ai_build_runs').update({status:'failed',error_message:message,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',run.id).eq('business_id',businessId);throw new Error(message);}
}

export async function runMoneyEntryBuild(args:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
  const {businessId,userId,prompt,mode='auto_execute'}=args; const supabase=createClient();
  const {data:business,error:be}=await supabase.from('businesses').select('id,name,currency,workspace_id').eq('id',businessId).eq('owner_id',userId).single();
  if(be||!business)throw new Error('Business context is not available.');
  const plan=buildPlan({capability:'money_transaction',prompt,mode,context:{business:{id:business.id,name:business.name,currency:business.currency}}});
  const idempotencyKey=checksum({capability:'money_transaction',prompt:prompt.trim(),mode});
  const {data:existing}=await supabase.from('ai_build_runs').select('id,status,result').eq('business_id',businessId).eq('idempotency_key',idempotencyKey).maybeSingle();
  if(existing?.id&&['succeeded','building','testing','planning'].includes(existing.status))return{runId:existing.id,status:existing.status,result:existing.result};
  const {data:run,error:re}=await supabase.from('ai_build_runs').insert({business_id:businessId,workspace_id:business.workspace_id,created_by:userId,capability_key:'money_transaction',request_text:prompt.trim(),execution_mode:mode,plan,context:{business},idempotency_key:idempotencyKey,status:'planning',started_at:new Date().toISOString()}).select('id').single();
  if(re||!run)throw new Error(re?.message||'Could not create money build run.');
  try{
    const draft=parseMoneyRequest(prompt,business.currency||'USD');
    await supabase.from('ai_build_steps').insert({business_id:businessId,build_run_id:run.id,sequence_no:1,step_key:'parse_transaction',step_type:'compiler',status:'succeeded',input:{prompt},output:draft,finished_at:new Date().toISOString()});
    let account=null as any;
    if(draft.accountName){
      const {data:accounts}=await supabase.from('financial_accounts').select('id,display_name,currency,status').eq('business_id',businessId).ilike('display_name','%'+draft.accountName+'%').limit(5);
      account=accounts?.[0]??null;
      if(!account)throw new Error('The named financial account could not be found. Connect or create that account first instead of guessing.');
    }
    await supabase.from('ai_build_steps').insert({business_id:businessId,build_run_id:run.id,sequence_no:2,step_key:'resolve_account',step_type:'lookup',status:'succeeded',input:{accountName:draft.accountName},output:{accountId:account?.id??null},finished_at:new Date().toISOString()});
    const externalId='bizstack-ai-'+run.id;
    const {data:tx,error:te}=await supabase.from('financial_transactions').insert({business_id:businessId,financial_account_id:account?.id??null,source_type:'manual',external_id:externalId,direction:draft.direction,amount:draft.amount,currency:draft.currency,status:'posted',occurred_at:draft.occurredAt,counterparty_name:draft.counterpartyName,description:draft.description,tax_amount:0,fee_amount:0,reconciled:false,reconciliation_status:'unmatched',metadata:{created_by:'ai_build_engine',build_run_id:run.id}}).select('id,direction,amount,currency,description,counterparty_name,financial_account_id,reconciled,reconciliation_status').single();
    if(te||!tx)throw new Error(te?.message||'Could not create financial transaction.');
    await supabase.from('ai_build_steps').insert({business_id:businessId,build_run_id:run.id,sequence_no:3,step_key:'create_transaction',step_type:'execution',status:'succeeded',input:{transactionId:tx.id},output:tx,finished_at:new Date().toISOString()});
    const tests=[{key:'positive_amount',pass:Number(tx.amount)>0},{key:'direction_valid',pass:tx.direction==='inflow'||tx.direction==='outflow'},{key:'currency_present',pass:Boolean(tx.currency)}];
    for(const test of tests)await supabase.from('ai_build_tests').insert({business_id:businessId,build_run_id:run.id,test_key:test.key,test_type:'transaction_integrity',status:test.pass?'passed':'failed',assertion:{expected:true},actual:test.pass,completed_at:new Date().toISOString()});
    const failed=tests.filter(t=>!t.pass);if(failed.length)throw new Error('Money entry validation failed.');
    const result={transaction:tx,tests};
    await supabase.from('ai_build_artifacts').insert({business_id:businessId,build_run_id:run.id,artifact_type:'money_transaction',artifact_key:'transaction',version:1,status:'validated',content:result,checksum:checksum(result)});
    await supabase.from('ai_build_runs').update({status:'succeeded',provider_key:'local-money-compiler',provider_status:'fallback',result,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',run.id).eq('business_id',businessId);
    await supabase.from('events').insert({business_id:businessId,event_type:'ai.build.money_recorded',summary:'AI Build Engine recorded a '+draft.direction+' of '+draft.amount+' '+draft.currency,evidence:{build_run_id:run.id,transaction_id:tx.id},status:'info',priority:'normal',category:'money'});
    return{runId:run.id,status:'succeeded',result};
  }catch(error){const message=error instanceof Error?error.message:'Money entry build failed.';await supabase.from('ai_build_runs').update({status:'failed',error_message:message,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',run.id).eq('business_id',businessId);throw new Error(message);}
}
