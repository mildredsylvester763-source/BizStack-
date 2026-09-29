import { createClient } from '@/lib/supabase-server';
import { buildPlan } from '@/lib/ai/build-engine/capabilities';
import { parseSupplierPriceRequest } from '@/lib/ai/build-engine/supplier-price-local';
import type { BuildMode } from '@/lib/ai/build-engine/types';

function checksum(value:unknown){const json=JSON.stringify(value);let hash=2166136261;for(let i=0;i<json.length;i+=1){hash^=json.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(16);}

export async function runSupplierPriceBuild({businessId,userId,prompt,mode='auto_execute'}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
  const supabase=await createClient();
  const {data:business,error}=await supabase.from('businesses').select('id,name,currency,workspace_id').eq('id',businessId).eq('owner_id',userId).single();
  if(error||!business)throw new Error('Business context is not available.');
  const plan=buildPlan({capability:'supplier_price',prompt,mode,context:{business:{id:business.id,name:business.name,currency:business.currency}}});
  const idempotencyKey=checksum({capability:'supplier_price',prompt:prompt.trim(),mode});
  const {data:existing}=await supabase.from('ai_build_runs').select('id,status,result').eq('business_id',businessId).eq('idempotency_key',idempotencyKey).maybeSingle();
  if(existing?.id&&['succeeded','building','testing','planning'].includes(existing.status))return{runId:existing.id,status:existing.status,result:existing.result};
  const {data:run,error:runError}=await supabase.from('ai_build_runs').insert({business_id:businessId,workspace_id:business.workspace_id,created_by:userId,capability_key:'supplier_price',request_text:prompt.trim(),execution_mode:mode,plan,context:{business},idempotency_key:idempotencyKey,status:'planning',started_at:new Date().toISOString()}).select('id').single();
  if(runError||!run)throw new Error(runError?.message||'Could not create supplier price build run.');
  try{
    const draft=parseSupplierPriceRequest(prompt,business.currency||'USD');
    const {data:suppliers}=await supabase.from('suppliers').select('id,name,currency').eq('business_id',businessId).ilike('name','%'+draft.supplierName+'%').limit(5);
    const supplier=suppliers?.[0];if(!supplier)throw new Error('Supplier “'+draft.supplierName+'” was not found. Create it first.');
    const {data:products}=await supabase.from('products').select('id,name,sku').eq('business_id',businessId).ilike('name','%'+draft.productName+'%').eq('is_active',true).limit(5);
    const product=products?.[0];if(!product)throw new Error('Product “'+draft.productName+'” was not found. Create it first.');
    await supabase.from('ai_build_steps').insert({business_id:businessId,build_run_id:run.id,sequence_no:1,step_key:'resolve_supplier',step_type:'lookup',status:'succeeded',input:{supplierName:draft.supplierName},output:{supplierId:supplier.id},finished_at:new Date().toISOString()});
    await supabase.from('ai_build_steps').insert({business_id:businessId,build_run_id:run.id,sequence_no:2,step_key:'resolve_product',step_type:'lookup',status:'succeeded',input:{productName:draft.productName},output:{productId:product.id},finished_at:new Date().toISOString()});
    const {data:alert,error:priceError}=await supabase.rpc('record_supplier_price',{p_business_id:businessId,p_supplier_id:supplier.id,p_product_id:product.id,p_new_cost:draft.newCost,p_currency:draft.currency,p_source:'ai_build_engine'});
    if(priceError)throw new Error(priceError.message);
    const result={supplier,product,newCost:draft.newCost,currency:draft.currency,alert:alert||null};
    const tests=[{key:'supplier_bound',pass:Boolean(supplier.id)},{key:'product_bound',pass:Boolean(product.id)},{key:'cost_non_negative',pass:draft.newCost>=0}];
    for(const test of tests)await supabase.from('ai_build_tests').insert({business_id:businessId,build_run_id:run.id,test_key:test.key,test_type:'supplier_price_integrity',status:test.pass?'passed':'failed',assertion:{expected:true},actual:test.pass,completed_at:new Date().toISOString()});
    await supabase.from('ai_build_artifacts').insert({business_id:businessId,build_run_id:run.id,artifact_type:'supplier_price_change',artifact_key:'supplier_price',version:1,status:'validated',content:result,checksum:checksum(result)});
    await supabase.from('ai_build_runs').update({status:'succeeded',provider_key:'local-supplier-price-compiler',provider_status:'fallback',result,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',run.id).eq('business_id',businessId);
    return{runId:run.id,status:'succeeded',result};
  }catch(error){const message=error instanceof Error?error.message:'Supplier price build failed.';await supabase.from('ai_build_runs').update({status:'failed',error_message:message,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',run.id).eq('business_id',businessId);throw new Error(message);}
}