import { createClient } from '@/lib/supabase-server';
import { buildPlan } from '@/lib/ai/build-engine/capabilities';
import { parseCommissionRequest } from '@/lib/ai/build-engine/commission-local';
import type { BuildMode } from '@/lib/ai/build-engine/types';

function checksum(value:unknown){const json=JSON.stringify(value);let hash=2166136261;for(let i=0;i<json.length;i+=1){hash^=json.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(16);}

export async function runCommissionBuild({businessId,userId,prompt,mode='auto_execute'}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
  const supabase=await createClient();
  const {data:business,error}=await supabase.from('businesses').select('id,name,currency,workspace_id').eq('id',businessId).eq('owner_id',userId).single();
  if(error||!business)throw new Error('Business context is not available.');
  const plan=buildPlan({capability:'commission',prompt,mode,context:{business:{id:business.id,name:business.name,currency:business.currency}}});
  const idempotencyKey=checksum({capability:'commission',prompt:prompt.trim(),mode});
  const {data:existing}=await supabase.from('ai_build_runs').select('id,status,result').eq('business_id',businessId).eq('idempotency_key',idempotencyKey).maybeSingle();
  if(existing?.id&&['succeeded','building','testing','planning'].includes(existing.status))return{runId:existing.id,status:existing.status,result:existing.result};
  const {data:run,error:runError}=await supabase.from('ai_build_runs').insert({business_id:businessId,workspace_id:business.workspace_id,created_by:userId,capability_key:'commission',request_text:prompt.trim(),execution_mode:mode,plan,context:{business},idempotency_key:idempotencyKey,status:'planning',started_at:new Date().toISOString()}).select('id').single();
  if(runError||!run)throw new Error(runError?.message||'Could not create commission build run.');
  try{
    const draft=parseCommissionRequest(prompt);
    const {data:agent}=await supabase.from('sales_agents').select('id,name,default_rate_percent,status').eq('business_id',businessId).ilike('name','%'+draft.agentName+'%').eq('status','active').limit(5).maybeSingle();
    if(!agent)throw new Error('Sales agent or broker “'+draft.agentName+'” was not found.');
    const {data:invoice}=await supabase.from('invoices').select('id,invoice_number,total,currency,status,customer_id').eq('business_id',businessId).eq('invoice_number',draft.invoiceNumber).single();
    if(!invoice)throw new Error('Invoice '+draft.invoiceNumber+' was not found.');
    const {data:entry,error:entryError}=await supabase.rpc('calculate_invoice_commission',{p_invoice_id:invoice.id,p_agent_id:agent.id,p_rate_percent:draft.ratePercent});
    if(entryError||!entry)throw new Error(entryError?.message||'Could not calculate commission.');
    const tests=[{key:'agent_bound',pass:Boolean(agent.id)},{key:'invoice_bound',pass:Boolean(invoice.id)},{key:'commission_non_negative',pass:Number(entry.commission_amount)>=0}];
    for(const test of tests)await supabase.from('ai_build_tests').insert({business_id:businessId,build_run_id:run.id,test_key:test.key,test_type:'commission_integrity',status:test.pass?'passed':'failed',assertion:{expected:true},actual:test.pass,completed_at:new Date().toISOString()});
    const result={agent,invoice,commission:entry,tests};
    await supabase.from('ai_build_artifacts').insert({business_id:businessId,build_run_id:run.id,artifact_type:'commission_entry',artifact_key:'commission',version:1,status:'validated',content:result,checksum:checksum(result)});
    await supabase.from('ai_build_runs').update({status:'succeeded',provider_key:'local-commission-compiler',provider_status:'fallback',result,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',run.id).eq('business_id',businessId);
    return{runId:run.id,status:'succeeded',result};
  }catch(error){const message=error instanceof Error?error.message:'Commission build failed.';await supabase.from('ai_build_runs').update({status:'failed',error_message:message,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',run.id).eq('business_id',businessId);throw new Error(message);}
}