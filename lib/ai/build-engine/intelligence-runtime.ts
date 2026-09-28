import { createClient } from "@/lib/supabase-server";
import { buildPlan } from "@/lib/ai/build-engine/capabilities";
import { parseBroadcastRequest, parseCarbonRequest, parseVoiceAgentRequest } from "@/lib/ai/build-engine/intelligence-local";
import type { BuildMode } from "@/lib/ai/build-engine/types";

function checksum(value:unknown){const json=JSON.stringify(value);let hash=2166136261;for(let i=0;i<json.length;i+=1){hash^=json.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(16);}
async function start(supabase:any,business:any,userId:string,capability:string,prompt:string,mode:BuildMode){
 const plan=buildPlan({capability:capability as any,prompt,mode,context:{business}});
 const key=checksum({capability,prompt:prompt.trim(),mode});
 const {data:existing}=await supabase.from("ai_build_runs").select("id,status,result").eq("business_id",business.id).eq("idempotency_key",key).maybeSingle();
 if(existing?.id&&["succeeded","planning","building","testing","waiting_approval"].includes(existing.status))return{existing,run:null};
 const {data:run,error}=await supabase.from("ai_build_runs").insert({business_id:business.id,workspace_id:business.workspace_id,created_by:userId,capability_key:capability,request_text:prompt.trim(),execution_mode:mode,plan,context:{business},idempotency_key:key,status:"planning",started_at:new Date().toISOString()}).select("id").single();
 if(error||!run)throw new Error(error?.message||"Could not create build run."); return{run,existing:null};
}
async function finish(supabase:any,businessId:string,runId:string,artifactType:string,result:any,summary:string){
 await supabase.from("ai_build_artifacts").insert({business_id:businessId,build_run_id:runId,artifact_type:artifactType,artifact_key:artifactType,version:1,status:"validated",content:result,checksum:checksum(result)});
 await supabase.from("ai_build_runs").update({status:"succeeded",provider_key:"local-"+artifactType+"-compiler",provider_status:"fallback",result,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",runId).eq("business_id",businessId);
 await supabase.from("events").insert({business_id:businessId,event_type:"ai.build.completed",summary,evidence:{build_run_id:runId,capability:artifactType},status:"info",priority:"normal",category:"ai_build"});
}
export async function runVoiceAgentBuild({businessId,userId,prompt,mode="ask_first"}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=createClient();const {data:business,error}=await supabase.from("businesses").select("id,name,workspace_id").eq("id",businessId).eq("owner_id",userId).single();if(error||!business)throw new Error("Business context is not available.");
 const draft=parseVoiceAgentRequest(prompt),started=await start(supabase,business,userId,"voice_agent",prompt,mode);if(started.existing)return{runId:started.existing.id,status:started.existing.status,result:started.existing.result};const runId=started.run.id;
 try{
  const {data:agent,error:ae}=await supabase.from("voice_agents").insert({business_id:businessId,name:draft.name,greeting:draft.greeting,system_instructions:draft.instructions,provider:draft.provider,phone_number:draft.phoneNumber,status:"draft",business_hours:{},escalation_policy:{required_for:"uncertain_or_out_of_scope"},created_by:userId}).select("id,name,status,provider,phone_number,greeting,system_instructions").single();
  if(ae||!agent)throw new Error(ae?.message||"Could not create voice agent.");
  const result={agent,providerBoundary:"A telephony/voice provider and AI provider must be connected before real calls can be placed or answered. The draft contains no fabricated provider identity or credentials."};
  await finish(supabase,businessId,runId,"voice_agent",result,"AI phone agent draft created with provider boundary.");
  return{runId,status:"succeeded",result};
 }catch(error){const message=error instanceof Error?error.message:"Voice agent build failed.";await supabase.from("ai_build_runs").update({status:"failed",error_message:message,finished_at:new Date().toISOString()}).eq("id",runId);throw new Error(message);}
}
export async function runBroadcastBuild({businessId,userId,prompt,mode="ask_first"}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=createClient();const {data:business,error}=await supabase.from("businesses").select("id,name,workspace_id").eq("id",businessId).eq("owner_id",userId).single();if(error||!business)throw new Error("Business context is not available.");
 const draft=parseBroadcastRequest(prompt),started=await start(supabase,business,userId,"broadcast",prompt,mode);if(started.existing)return{runId:started.existing.id,status:started.existing.status,result:started.existing.result};const runId=started.run.id;
 try{
  const {data:campaign,error:ce}=await supabase.from("broadcast_campaigns").insert({business_id:businessId,name:draft.name,channel:draft.channel,message_template:draft.message,status:"review",opt_out_policy:draft.strictConsent?"strict":"allow_if_unknown",scheduled_at:draft.scheduledAt,created_by:userId}).select("id,name,channel,status,opt_out_policy,scheduled_at").single();
  if(ce||!campaign)throw new Error(ce?.message||"Could not create broadcast campaign.");
  const {data:customers}=await supabase.from("customers").select("id,name,email,phone,whatsapp").eq("business_id",businessId).eq("status","active").limit(500);
  let allowed=0,blocked=0;
  for(const customer of customers||[]){
   const recipient=draft.channel==="email"?customer.email:draft.channel==="whatsapp"?customer.whatsapp||customer.phone:customer.phone;
   if(!recipient)continue;
   const {data:consent}=await supabase.from("communication_consents").select("consent_status").eq("business_id",businessId).eq("customer_id",customer.id).eq("channel",draft.channel).maybeSingle();
   const optedIn=consent?.consent_status==="opted_in";
   const status=draft.strictConsent&&!optedIn?"blocked":"pending";
   if(status==="blocked")blocked++;else allowed++;
   await supabase.from("broadcast_recipients").insert({campaign_id:campaign.id,customer_id:customer.id,recipient,status,block_reason:status==="blocked"?"No explicit channel opt-in":null});
  }
  const result={campaign,audience:{allowed,blocked,total:allowed+blocked},providerBoundary:"No messages are sent by the compiler. A verified SMS/WhatsApp/email provider plus approved campaign execution is required."};
  await finish(supabase,businessId,runId,"broadcast",result,"Consent-safe broadcast campaign prepared with opt-out enforcement.");
  return{runId,status:"succeeded",result};
 }catch(error){const message=error instanceof Error?error.message:"Broadcast build failed.";await supabase.from("ai_build_runs").update({status:"failed",error_message:message,finished_at:new Date().toISOString()}).eq("id",runId);throw new Error(message);}
}
export async function runCarbonReportBuild({businessId,userId,prompt,mode="auto_execute"}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=createClient();const {data:business,error}=await supabase.from("businesses").select("id,name,workspace_id").eq("id",businessId).eq("owner_id",userId).single();if(error||!business)throw new Error("Business context is not available.");
 const draft=parseCarbonRequest(prompt),started=await start(supabase,business,userId,"carbon_report",prompt,mode);if(started.existing)return{runId:started.existing.id,status:started.existing.status,result:started.existing.result};const runId=started.run.id;
 try{
  const {data:entry,error:ee}=await supabase.from("carbon_activity_entries").insert({business_id:businessId,activity_type:draft.activityType,quantity:draft.quantity,unit:draft.unit,emission_factor:draft.factor,activity_date:draft.date,notes:draft.notes}).select("id,activity_type,quantity,unit,emission_factor,co2e_kg,activity_date").single();
  if(ee||!entry)throw new Error(ee?.message||"Could not record carbon activity.");
  const {data:summary}=await supabase.from("carbon_activity_entries").select("activity_type,co2e_kg").eq("business_id",businessId);
  const total=(summary||[]).reduce((sum:any,row:any)=>sum+Number(row.co2e_kg||0),0);
  const byType=(summary||[]).reduce((acc:any,row:any)=>{acc[row.activity_type]=(acc[row.activity_type]||0)+Number(row.co2e_kg||0);return acc;},{});
  const result={entry,totalCo2eKg:Number(total.toFixed(6)),byActivityType:byType,methodology:"CO2e = quantity × explicit emission factor. Replace default factors with source-specific factors where available."};
  await finish(supabase,businessId,runId,"carbon_report",result,"Carbon activity recorded and footprint recalculated.");
  return{runId,status:"succeeded",result};
 }catch(error){const message=error instanceof Error?error.message:"Carbon report build failed.";await supabase.from("ai_build_runs").update({status:"failed",error_message:message,finished_at:new Date().toISOString()}).eq("id",runId);throw new Error(message);}
}
export async function runFractionalCfoBuild({businessId,userId,prompt,mode="draft_only"}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=createClient();const {data:business,error}=await supabase.from("businesses").select("id,name,currency,workspace_id").eq("id",businessId).eq("owner_id",userId).single();if(error||!business)throw new Error("Business context is not available.");
 const started=await start(supabase,business,userId,"fractional_cfo",prompt,mode);if(started.existing)return{runId:started.existing.id,status:started.existing.status,result:started.existing.result};const runId=started.run.id;
 try{
  const end=new Date();const startDate=new Date(end.getFullYear(),end.getMonth()-2,1);const periodStart=startDate.toISOString().slice(0,10);const periodEnd=end.toISOString().slice(0,10);
  const {data:tx}=await supabase.from("financial_transactions").select("direction,base_amount,amount,occurred_at").eq("business_id",businessId).eq("status","posted").gte("occurred_at",periodStart);
  const revenue=(tx||[]).filter((r:any)=>r.direction==="inflow").reduce((s:any,r:any)=>s+Number(r.base_amount??r.amount??0),0);
  const expenses=(tx||[]).filter((r:any)=>r.direction==="outflow").reduce((s:any,r:any)=>s+Number(r.base_amount??r.amount??0),0);
  const {data:invoices}=await supabase.from("invoices").select("total,status,due_date").eq("business_id",businessId);
  const receivables=(invoices||[]).filter((i:any)=>i.status!=="paid"&&i.status!=="cancelled").reduce((s:any,i:any)=>s+Number(i.total||0),0);
  const overdue=(invoices||[]).filter((i:any)=>i.status!=="paid"&&i.status!=="cancelled"&&i.due_date&&new Date(i.due_date)<new Date()).reduce((s:any,i:any)=>s+Number(i.total||0),0);
  const net=revenue-expenses;const monthlyExpense=expenses/3;const runway=monthlyExpense>0?Math.max(0,net/monthlyExpense):null;
  const recommendations=[];const risks=[];if(overdue>0)recommendations.push("Prioritize overdue receivables collection.");if(net<0)risks.push("Recorded operating cashflow is negative for the current snapshot.");if(receivables>0)recommendations.push("Review receivables aging and customer payment terms.");if(!tx?.length)risks.push("Insufficient posted transaction history for a strong CFO assessment.");
  const snapshot={periodStart,periodEnd,currency:business.currency||"USD",revenue,expenses,netCashflow:net,receivables,payables:0,overdueReceivables:overdue,runwayMonths:runway,recommendations,risks,assumptions:["Payables are not inferred unless recorded in a payable ledger.","Runway is a simple deterministic snapshot, not a forecast or guarantee."]};
  const {data:saved,error:se}=await supabase.from("cfo_snapshots").insert({business_id:businessId,period_start:periodStart,period_end:periodEnd,currency:business.currency||"USD",revenue,expenses,net_cashflow:net,receivables,payables:0,overdue_receivables:overdue,runway_months:runway,recommendations,risks,assumptions:snapshot.assumptions}).select("id,period_start,period_end,revenue,expenses,net_cashflow,receivables,overdue_receivables,runway_months,recommendations,risks,assumptions").single();
  if(se||!saved)throw new Error(se?.message||"Could not persist CFO snapshot.");
  const result={snapshot:saved};await finish(supabase,businessId,runId,"fractional_cfo",result,"Fractional CFO snapshot generated from recorded business data.");return{runId,status:"succeeded",result};
 }catch(error){const message=error instanceof Error?error.message:"Fractional CFO build failed.";await supabase.from("ai_build_runs").update({status:"failed",error_message:message,finished_at:new Date().toISOString()}).eq("id",runId);throw new Error(message);}
}
