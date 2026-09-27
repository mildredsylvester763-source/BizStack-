import { createClient } from '@/lib/supabase-server';
import { applyWebsiteSpec } from '@/lib/ai/build-engine/runtime';
import type { WebsiteSpec } from '@/lib/ai/build-engine/types';

export type BuildApprovalDecision = 'approve' | 'reject';

export async function decideBuildApproval(args:{
  approvalId:string;
  businessId:string;
  userId:string;
  decision:BuildApprovalDecision;
}){
  const supabase=createClient();
  const {approvalId,businessId,userId,decision}=args;
  const {data:approval,error}=await supabase.from('ai_build_approvals')
    .select('id,build_run_id,status,proposed_payload,requested_action')
    .eq('id',approvalId).eq('business_id',businessId).single();
  if(error||!approval) throw new Error('Build approval not found.');
  if(approval.status!=='pending') throw new Error('Build approval is already decided.');

  if(decision==='reject'){
    await supabase.from('ai_build_approvals').update({status:'rejected',decided_by:userId,decided_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',approval.id).eq('business_id',businessId);
    await supabase.from('ai_build_runs').update({status:'cancelled',error_message:'Publishing was rejected by the business owner.',finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',approval.build_run_id).eq('business_id',businessId);
    await supabase.from('events').insert({business_id:businessId,event_type:'ai.build.approval_rejected',summary:'Website publishing approval was rejected.',evidence:{build_run_id:approval.build_run_id,approval_id:approval.id},status:'dismissed',priority:'normal',category:'ai_build',action_type:'reject_ai_build'});
    return {status:'rejected' as const};
  }

  const payload=(approval.proposed_payload??{}) as {websiteId?:string|null;spec?:WebsiteSpec;metrics?:unknown;tests?:unknown[]};
  if(!payload.spec) throw new Error('The approved build artifact is missing its website specification.');
  const websiteId=await applyWebsiteSpec(supabase,businessId,payload.websiteId,payload.spec,true);
  const result={websiteId,published:true,approved:true,approvalId:approval.id,metrics:payload.metrics??null,tests:payload.tests??[]};
  await supabase.from('ai_build_approvals').update({status:'approved',decided_by:userId,decided_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',approval.id).eq('business_id',businessId);
  await supabase.from('ai_build_runs').update({status:'succeeded',result:{...result,spec:payload.spec},approval_required:false,approved_by:userId,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',approval.build_run_id).eq('business_id',businessId);
  await supabase.from('ai_build_steps').insert({business_id:businessId,build_run_id:approval.build_run_id,sequence_no:99,step_key:'publish_approved',step_type:'approval',status:'succeeded',input:{approvalId:approval.id},output:result,started_at:new Date().toISOString(),finished_at:new Date().toISOString()});
  await supabase.from('events').insert({business_id:businessId,event_type:'ai.build.published',summary:'Approved website build is now published.',evidence:{build_run_id:approval.build_run_id,approval_id:approval.id,website_id:websiteId},status:'auto_handled',priority:'normal',category:'ai_build',action_type:'approve_ai_build'});
  return {status:'approved' as const,result};
}
