import { createClient } from '@/lib/supabase-server';
import { buildPlan } from '@/lib/ai/build-engine/capabilities';
import { parseCustomerRequest } from '@/lib/ai/build-engine/customer-local';
import type { BuildMode } from '@/lib/ai/build-engine/types';

function checksum(value:unknown){const json=JSON.stringify(value);let hash=2166136261;for(let i=0;i<json.length;i+=1){hash^=json.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(16);}

export async function runCustomerBuild({businessId,userId,prompt,mode='auto_execute'}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=await createClient();
 const {data:business,error}=await supabase.from('businesses').select('id,name,currency,workspace_id').eq('id',businessId).eq('owner_id',userId).single();
 if(error||!business)throw new Error('Business context is not available.');
 const plan=buildPlan({capability:'customer',prompt,mode,context:{business:{id:business.id,name:business.name,currency:business.currency}}});
 const idempotencyKey=checksum({capability:'customer',prompt:prompt.trim(),mode});
 const {data:existing}=await supabase.from('ai_build_runs').select('id,status,result').eq('business_id',businessId).eq('idempotency_key',idempotencyKey).maybeSingle();
 if(existing?.id&&['succeeded','building','testing','planning'].includes(existing.status))return{runId:existing.id,status:existing.status,result:existing.result};
 const {data:run,error:runError}=await supabase.from('ai_build_runs').insert({business_id:businessId,workspace_id:business.workspace_id,created_by:userId,capability_key:'customer',request_text:prompt.trim(),execution_mode:mode,plan,context:{business},idempotency_key:idempotencyKey,status:'planning',started_at:new Date().toISOString()}).select('id').single();
 if(runError||!run)throw new Error(runError?.message||'Could not create customer build run.');
 try{
   const draft=parseCustomerRequest(prompt);
   await supabase.from('ai_build_steps').insert({business_id:businessId,build_run_id:run.id,sequence_no:1,step_key:'parse_customer',step_type:'compiler',status:'succeeded',input:{prompt},output:draft,finished_at:new Date().toISOString()});
   const duplicateFilters=[];
   if(draft.email)duplicateFilters.push('email.eq.'+draft.email);
   if(draft.phone)duplicateFilters.push('phone.eq.'+draft.phone);
   if(draft.companyName)duplicateFilters.push('company_name.ilike.'+draft.companyName);
   const {data:byName}=await supabase.from('customers').select('id,name,email,phone,company_name').eq('business_id',businessId).ilike('name',draft.name).limit(5);
   const duplicate=byName?.[0]||null;
   if(duplicate)throw new Error('A customer with this name already exists. Open the existing customer instead of creating a duplicate.');
   if(draft.email){
     const {data:emailMatch}=await supabase.from('customers').select('id,name,email').eq('business_id',businessId).ilike('email',draft.email).limit(1);
     if(emailMatch?.length)throw new Error('A customer with this email already exists.');
   }
   if(draft.phone){
     const {data:phoneMatch}=await supabase.from('customers').select('id,name,phone').eq('business_id',businessId).eq('phone',draft.phone).limit(1);
     if(phoneMatch?.length)throw new Error('A customer with this phone number already exists.');
   }
   await supabase.from('ai_build_steps').insert({business_id:businessId,build_run_id:run.id,sequence_no:2,step_key:'check_duplicates',step_type:'validation',status:'succeeded',input:{name:draft.name,email:draft.email,phone:draft.phone},output:{duplicate:false},finished_at:new Date().toISOString()});
   const {data:customer,error:createError}=await supabase.from('customers').insert({business_id:businessId,name:draft.name,email:draft.email,phone:draft.phone,billing_email:draft.email,customer_type:draft.customerType,company_name:draft.companyName,city:draft.city,state_region:draft.stateRegion,country:draft.country,notes:draft.notes,tags:draft.tags,status:'active',preferred_currency:business.currency,address:{},metadata:{created_by:'ai_build_engine',build_run_id:run.id}}).select('id,name,email,phone,customer_type,company_name,city,state_region,country,tags,status').single();
   if(createError||!customer)throw new Error(createError?.message||'Could not create customer.');
   const tests=[{key:'name_present',pass:Boolean(customer.name)},{key:'customer_active',pass:customer.status==='active'},{key:'business_scoped',pass:Boolean(customer.id)}];
   for(const test of tests)await supabase.from('ai_build_tests').insert({business_id:businessId,build_run_id:run.id,test_key:test.key,test_type:'customer_integrity',status:test.pass?'passed':'failed',assertion:{expected:true},actual:test.pass,completed_at:new Date().toISOString()});
   const failed=tests.filter(t=>!t.pass);if(failed.length)throw new Error('Customer validation failed.');
   const result={customer,tests};
   await supabase.from('ai_build_artifacts').insert({business_id:businessId,build_run_id:run.id,artifact_type:'customer',artifact_key:'customer',version:1,status:'validated',content:result,checksum:checksum(result)});
   await supabase.from('ai_build_runs').update({status:'succeeded',provider_key:'local-customer-compiler',provider_status:'fallback',result,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',run.id).eq('business_id',businessId);
   await supabase.from('events').insert({business_id:businessId,event_type:'ai.build.customer_created',summary:'AI Build Engine created customer '+customer.name,evidence:{build_run_id:run.id,customer_id:customer.id},status:'info',priority:'normal',category:'customers'});
   return{runId:run.id,status:'succeeded',result};
 }catch(error){
   const message=error instanceof Error?error.message:'Customer build failed.';
   await supabase.from('ai_build_runs').update({status:'failed',error_message:message,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',run.id).eq('business_id',businessId);
   throw new Error(message);
 }
}