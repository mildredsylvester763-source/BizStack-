import { createClient } from '@/lib/supabase-server';
import { buildPlan } from '@/lib/ai/build-engine/capabilities';
import { parseQuoteRequest } from '@/lib/ai/build-engine/quote-local';
import type { BuildMode } from '@/lib/ai/build-engine/types';

function checksum(value:unknown){const json=JSON.stringify(value);let hash=2166136261;for(let i=0;i<json.length;i+=1){hash^=json.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(16);}

export async function runQuoteBuild({businessId,userId,prompt,mode='draft_only'}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=createClient();
 const {data:business,error:be}=await supabase.from('businesses').select('id,name,currency,workspace_id').eq('id',businessId).eq('owner_id',userId).single();
 if(be||!business)throw new Error('Business context is not available.');
 const plan=buildPlan({capability:'quote',prompt,mode,context:{business:{id:business.id,name:business.name,currency:business.currency}}});
 const idempotencyKey=checksum({capability:'quote',prompt:prompt.trim(),mode});
 const {data:existing}=await supabase.from('ai_build_runs').select('id,status,result').eq('business_id',businessId).eq('idempotency_key',idempotencyKey).maybeSingle();
 if(existing?.id&&['succeeded','building','testing','planning'].includes(existing.status))return{runId:existing.id,status:existing.status,result:existing.result};
 const {data:run,error:runError}=await supabase.from('ai_build_runs').insert({business_id:businessId,workspace_id:business.workspace_id,created_by:userId,capability_key:'quote',request_text:prompt.trim(),execution_mode:mode,plan,context:{business},idempotency_key:idempotencyKey,status:'planning',started_at:new Date().toISOString()}).select('id').single();
 if(runError||!run)throw new Error(runError?.message||'Could not create quote build run.');
 try{
   const draft=parseQuoteRequest(prompt,business.currency||'USD');
   await supabase.from('ai_build_steps').insert({business_id:businessId,build_run_id:run.id,sequence_no:1,step_key:'resolve_customer',step_type:'compiler',status:'running',input:{customerName:draft.customerName}});
   const {data:customers}=await supabase.from('customers').select('id,name,email').eq('business_id',businessId).or('name.ilike.%'+draft.customerName+'%,email.ilike.%'+(draft.customerEmail||'__none__')+'%').limit(10);
   const customer=customers?.[0];
   if(!customer)throw new Error('No existing customer matched “'+draft.customerName+'”. Create that customer first so the quote cannot be attached to the wrong record.');
   await supabase.from('ai_build_steps').update({status:'succeeded',output:{customerId:customer.id,customerName:customer.name},finished_at:new Date().toISOString()}).eq('build_run_id',run.id).eq('sequence_no',1);
   await supabase.from('ai_build_steps').insert({business_id:businessId,build_run_id:run.id,sequence_no:2,step_key:'parse_line_items',step_type:'compiler',status:'succeeded',input:{prompt},output:{lines:draft.lines},finished_at:new Date().toISOString()});
   const {data:quoteNumber}=await supabase.rpc('next_quote_number',{p_business_id:businessId});
   if(!quoteNumber)throw new Error('Quote numbering service did not return a number.');
   const {data:quote,error:qe}=await supabase.from('quotes').insert({
     business_id:businessId,customer_id:customer.id,quote_number:quoteNumber,status:'draft',
     issue_date:new Date().toISOString().slice(0,10),expiry_date:draft.expiryDate,currency:draft.currency,payment_terms:draft.paymentTerms,
     reference:draft.reference,purchase_order:draft.purchaseOrder,discount_type:draft.discountType,discount_value:draft.discountValue,
     tax_rate:draft.taxRate,tax_name:draft.taxRate>0?'Tax':null,notes:draft.notes,terms:draft.terms,created_by:userId
   }).select('id,quote_number').single();
   if(qe||!quote)throw new Error(qe?.message||'Could not create quote draft.');
   const {error:ie}=await supabase.from('quote_items').insert(draft.lines.map(line=>({quote_id:quote.id,description:line.description,quantity:line.quantity,unit_price:line.unitPrice})));
   if(ie){await supabase.from('quotes').delete().eq('id',quote.id).eq('business_id',businessId);throw new Error(ie.message);}
   const {data:calculated,error:ce}=await supabase.rpc('recalculate_quote_totals',{p_quote_id:quote.id});
   if(ce||!calculated)throw new Error(ce?.message||'Could not calculate quote totals.');
   const {data:stored}=await supabase.from('quotes').select('id,quote_number,status,issue_date,expiry_date,currency,subtotal,discount_type,discount_value,discount_amount,tax_rate,tax_amount,total,customer:customers(name,email)').eq('id',quote.id).eq('business_id',businessId).single();
   if(!stored)throw new Error('Could not reload the created quote.');
   const tests=[{key:'customer_bound',pass:Boolean(stored.customer)},{key:'line_items_present',pass:draft.lines.length>0},{key:'positive_total',pass:Number(stored.total)>0},{key:'currency_present',pass:Boolean(stored.currency)}];
   for(const test of tests)await supabase.from('ai_build_tests').insert({business_id:businessId,build_run_id:run.id,test_key:test.key,test_type:'quote_integrity',status:test.pass?'passed':'failed',assertion:{expected:true},actual:test.pass,completed_at:new Date().toISOString()});
   const failed=tests.filter(t=>!t.pass);if(failed.length)throw new Error('Quote validation failed: '+failed.map(t=>t.key).join(', '));
   const result={quoteId:stored.id,quoteNumber:stored.quote_number,status:stored.status,total:Number(stored.total),currency:stored.currency,customer:stored.customer,expiryDate:stored.expiry_date,lines:draft.lines,tests,delivery:'draft_only'};
   await supabase.from('ai_build_artifacts').insert({business_id:businessId,build_run_id:run.id,artifact_type:'quote_draft',artifact_key:'quote',version:1,status:'validated',content:result,checksum:checksum(result)});
   await supabase.from('ai_build_steps').insert({business_id:businessId,build_run_id:run.id,sequence_no:3,step_key:'create_draft',step_type:'execution',status:'succeeded',input:{quoteId:stored.id},output:result,finished_at:new Date().toISOString()});
   await supabase.from('ai_build_runs').update({status:'succeeded',provider_key:'local-quote-compiler',provider_status:'fallback',result,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',run.id).eq('business_id',businessId);
   await supabase.from('events').insert({business_id:businessId,event_type:'ai.build.quote_created',summary:'AI Build Engine created draft '+stored.quote_number+' for '+(stored.customer as any)?.name,evidence:{build_run_id:run.id,quote_id:stored.id},status:'info',priority:'normal',category:'sales'});
   return{runId:run.id,status:'succeeded',result};
 }catch(error){const message=error instanceof Error?error.message:'Quote build failed.';await supabase.from('ai_build_runs').update({status:'failed',error_message:message,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',run.id).eq('business_id',businessId);throw new Error(message);}
}
