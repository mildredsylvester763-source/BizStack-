import { createClient } from "@/lib/supabase-server";
import { buildPlan } from "@/lib/ai/build-engine/capabilities";
import { parseComplianceRequest, parseSuccessorRequest, parseThriftRequest } from "@/lib/ai/build-engine/continuity-local";
import type { BuildMode } from "@/lib/ai/build-engine/types";

function checksum(value:unknown){const json=JSON.stringify(value);let hash=2166136261;for(let i=0;i<json.length;i+=1){hash^=json.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(16);}
async function start(supabase:any,business:any,userId:string,capability:string,prompt:string,mode:BuildMode){
 const plan=buildPlan({capability:capability as any,prompt,mode,context:{business}});
 const key=checksum({capability,prompt:prompt.trim(),mode});
 const {data:existing}=await supabase.from("ai_build_runs").select("id,status,result").eq("business_id",business.id).eq("idempotency_key",key).maybeSingle();
 if(existing?.id&&["succeeded","planning","building","testing","waiting_approval"].includes(existing.status))return{existing,run:null};
 const {data:run,error}=await supabase.from("ai_build_runs").insert({business_id:business.id,workspace_id:business.workspace_id,created_by:userId,capability_key:capability,request_text:prompt.trim(),execution_mode:mode,plan,context:{business},idempotency_key:key,status:"planning",started_at:new Date().toISOString()}).select("id").single();
 if(error||!run)throw new Error(error?.message||"Could not create build run.");
 return{run,existing:null};
}
async function finish(supabase:any,businessId:string,runId:string,artifactType:string,result:any,summary:string){
 await supabase.from("ai_build_artifacts").insert({business_id:businessId,build_run_id:runId,artifact_type:artifactType,artifact_key:artifactType,version:1,status:"validated",content:result,checksum:checksum(result)});
 await supabase.from("ai_build_runs").update({status:"succeeded",provider_key:"local-"+artifactType+"-compiler",provider_status:"fallback",result,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",runId).eq("business_id",businessId);
 await supabase.from("events").insert({business_id:businessId,event_type:"ai.build.completed",summary,evidence:{build_run_id:runId,capability:artifactType},status:"info",priority:"normal",category:"ai_build"});
}

export async function runThriftBuild({businessId,userId,prompt,mode="auto_execute"}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=await createClient(); const {data:business,error}=await supabase.from("businesses").select("id,name,currency,workspace_id").eq("id",businessId).eq("owner_id",userId).single(); if(error||!business)throw new Error("Business context is not available.");
 const draft=parseThriftRequest(prompt,business.currency||"USD"); const started=await start(supabase,business,userId,"thrift_group",prompt,mode); if(started.existing)return{runId:started.existing.id,status:started.existing.status,result:started.existing.result}; const runId=started.run.id;
 try{
  const {data:group,error:ge}=await supabase.from("thrift_groups").insert({business_id:businessId,name:draft.name,contribution_amount:draft.amount,currency:draft.currency,frequency:draft.frequency,payout_method:draft.payoutMethod,next_contribution_date:draft.nextDate,rules:draft.rules,status:"draft",created_by:userId}).select("id,name,contribution_amount,currency,frequency,payout_method,next_contribution_date,status").single();
  if(ge||!group)throw new Error(ge?.message||"Could not create thrift group.");
  const result={group,membershipBoundary:"Members and contributions are recorded separately; no member payment is claimed until a contribution row is marked paid."};
  await finish(supabase,businessId,runId,"thrift_group",result,"Ajo/thrift savings group created.");
  return{runId,status:"succeeded",result};
 }catch(error){const message=error instanceof Error?error.message:"Thrift build failed.";await supabase.from("ai_build_runs").update({status:"failed",error_message:message,finished_at:new Date().toISOString()}).eq("id",runId);throw new Error(message);}
}

export async function runBusinessCreditBuild({businessId,userId,prompt,mode="draft_only"}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=await createClient(); const {data:business,error}=await supabase.from("businesses").select("id,name,currency,workspace_id").eq("id",businessId).eq("owner_id",userId).single(); if(error||!business)throw new Error("Business context is not available.");
 const started=await start(supabase,business,userId,"business_credit",prompt,mode); if(started.existing)return{runId:started.existing.id,status:started.existing.status,result:started.existing.result}; const runId=started.run.id;
 try{
  const {data:score,error:se}=await supabase.rpc("calculate_business_credit_score",{p_business_id:businessId}); if(se||!score)throw new Error(se?.message||"Could not calculate business credit score.");
  const {data:profile,error:pe}=await supabase.from("business_credit_profiles").upsert({business_id:businessId,score:score.score,score_band:score.band,payment_history_score:score.paymentHistoryScore,cashflow_score:score.cashflowScore,invoice_history_score:score.invoiceHistoryScore,debt_burden_score:score.debtBurdenScore,documentation_score:score.documentationScore,evidence:score.evidence,improvement_actions:score.improvementActions,last_calculated_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:"business_id"}).select("id,score,score_band,payment_history_score,cashflow_score,invoice_history_score,debt_burden_score,documentation_score,evidence,improvement_actions,last_calculated_at").single();
  if(pe||!profile)throw new Error(pe?.message||"Could not persist business credit profile.");
  const result={profile,methodology:"Documented BizStack business-credit profile based only on recorded invoices and posted transactions. It is not an external bureau score or lender approval."};
  await finish(supabase,businessId,runId,"business_credit",result,"Business credit profile calculated from documented records.");
  return{runId,status:"succeeded",result};
 }catch(error){const message=error instanceof Error?error.message:"Business credit build failed.";await supabase.from("ai_build_runs").update({status:"failed",error_message:message,finished_at:new Date().toISOString()}).eq("id",runId);throw new Error(message);}
}

export async function runSuccessorAccessBuild({businessId,userId,prompt,mode="ask_first"}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=await createClient(); const {data:business,error}=await supabase.from("businesses").select("id,name,workspace_id").eq("id",businessId).eq("owner_id",userId).single(); if(error||!business)throw new Error("Business context is not available.");
 const draft=parseSuccessorRequest(prompt); const started=await start(supabase,business,userId,"successor_access",prompt,mode); if(started.existing)return{runId:started.existing.id,status:started.existing.status,result:started.existing.result}; const runId=started.run.id;
 try{
  const {data:grant,error:ge}=await supabase.from("successor_access_grants").insert({business_id:businessId,recipient_email:draft.email,recipient_name:draft.name,role:draft.role,permissions:draft.permissions,activation_delay_hours:draft.delayHours,emergency_reason_required:true,status:"draft",created_by:userId}).select("id,recipient_email,recipient_name,role,permissions,activation_delay_hours,status").single();
  if(ge||!grant)throw new Error(ge?.message||"Could not create successor access grant.");
  const result={grant,activationBoundary:"The grant remains non-active until the explicit activation workflow is completed. No password, session, token or privileged access is created here."};
  await finish(supabase,businessId,runId,"successor_access",result,"Successor/emergency access grant drafted with delayed activation.");
  return{runId,status:"succeeded",result};
 }catch(error){const message=error instanceof Error?error.message:"Successor access build failed.";await supabase.from("ai_build_runs").update({status:"failed",error_message:message,finished_at:new Date().toISOString()}).eq("id",runId);throw new Error(message);}
}

export async function runComplianceBuild({businessId,userId,prompt,mode="auto_execute"}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=await createClient(); const {data:business,error}=await supabase.from("businesses").select("id,name,workspace_id").eq("id",businessId).eq("owner_id",userId).single(); if(error||!business)throw new Error("Business context is not available.");
 const draft=parseComplianceRequest(prompt); const started=await start(supabase,business,userId,"compliance",prompt,mode); if(started.existing)return{runId:started.existing.id,status:started.existing.status,result:started.existing.result}; const runId=started.run.id;
 try{
  const {data:item,error:ie}=await supabase.from("compliance_items").insert({business_id:businessId,name:draft.name,authority:draft.authority,category:draft.category,jurisdiction:draft.jurisdiction,due_date:draft.dueDate,recurrence:draft.recurrence,priority:draft.priority,owner_email:draft.ownerEmail,created_by:userId}).select("id,name,authority,category,jurisdiction,due_date,recurrence,status,priority,owner_email,evidence_required").single();
  if(ie||!item)throw new Error(ie?.message||"Could not create compliance item.");
  const result={item};
  await finish(supabase,businessId,runId,"compliance",result,"Compliance calendar item created.");
  return{runId,status:"succeeded",result};
 }catch(error){const message=error instanceof Error?error.message:"Compliance build failed.";await supabase.from("ai_build_runs").update({status:"failed",error_message:message,finished_at:new Date().toISOString()}).eq("id",runId);throw new Error(message);}
}