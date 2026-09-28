import { createClient } from "@/lib/supabase-server";
import { buildPlan } from "@/lib/ai/build-engine/capabilities";
import { parseAppointmentRequest, parseMenuRequest, parseSmsWalletRequest, parseWaiverRequest } from "@/lib/ai/build-engine/customer-experience-local";
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

export async function runSmsWalletBuild({businessId,userId,prompt,mode="ask_first"}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=createClient(); const {data:business,error}=await supabase.from("businesses").select("id,name,currency,workspace_id").eq("id",businessId).eq("owner_id",userId).single(); if(error||!business)throw new Error("Business context is not available.");
 const draft=parseSmsWalletRequest(prompt,business.currency||"USD"); const started=await start(supabase,business,userId,"sms_wallet",prompt,mode); if(started.existing)return{runId:started.existing.id,status:started.existing.status,result:started.existing.result}; const runId=started.run.id;
 try{
  const {data:wallet,error:we}=await supabase.from("sms_credit_wallets").upsert({business_id:businessId,currency:draft.currency,low_balance_threshold:draft.lowBalance},{onConflict:"business_id"}).select("id,business_id,currency,balance_credits,reserved_credits,low_balance_threshold,status").single();
  if(we||!wallet)throw new Error(we?.message||"Could not initialize SMS credit wallet.");
  const result={wallet,topUpBoundary:"External payment/top-up provider required before credits can be purchased.",spendBoundary:"Provider delivery is required before credits are debited for a real SMS."};
  await finish(supabase,businessId,runId,"sms_wallet",result,"SMS credit wallet initialized.");
  return{runId,status:"succeeded",result};
 }catch(error){const message=error instanceof Error?error.message:"SMS wallet build failed.";await supabase.from("ai_build_runs").update({status:"failed",error_message:message,finished_at:new Date().toISOString()}).eq("id",runId);throw new Error(message);}
}

export async function runAppointmentBuild({businessId,userId,prompt,mode="auto_execute"}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=createClient(); const {data:business,error}=await supabase.from("businesses").select("id,name,currency,workspace_id").eq("id",businessId).eq("owner_id",userId).single(); if(error||!business)throw new Error("Business context is not available.");
 const draft=parseAppointmentRequest(prompt,business.currency||"USD"); const started=await start(supabase,business,userId,"appointment",prompt,mode); if(started.existing)return{runId:started.existing.id,status:started.existing.status,result:started.existing.result}; const runId=started.run.id;
 try{
  let {data:service}=await supabase.from("appointment_services").select("id,name,duration_minutes,price,currency,deposit_type,deposit_value").eq("business_id",businessId).ilike("name","%"+draft.serviceName+"%").eq("active",true).limit(1).maybeSingle();
  if(!service){
   const {data:created,error:se}=await supabase.from("appointment_services").insert({business_id:businessId,name:draft.serviceName,duration_minutes:draft.durationMinutes,price:draft.price,currency:draft.currency,deposit_type:draft.depositType,deposit_value:draft.depositValue}).select("id,name,duration_minutes,price,currency,deposit_type,deposit_value").single();
   if(se||!created)throw new Error(se?.message||"Could not create appointment service."); service=created;
  }
  const {data:customers}=await supabase.from("customers").select("id,name,email").eq("business_id",businessId).ilike("name","%"+draft.customerName+"%").limit(5);
  const customer=customers?.[0]; if(!customer)throw new Error("Customer “"+draft.customerName+"” was not found. Create the customer first.");
  const starts=new Date(draft.startsAt); if(Number.isNaN(starts.getTime()))throw new Error("Invalid appointment time.");
  const ends=new Date(starts.getTime()+Number(service.duration_minutes)*60000);
  const {data:collision}=await supabase.from("appointments").select("id,starts_at,ends_at,status").eq("business_id",businessId).in("status",["pending","confirmed","checked_in"]).lt("starts_at",ends.toISOString()).gt("ends_at",starts.toISOString()).limit(1).maybeSingle();
  if(collision)throw new Error("That time overlaps an existing appointment.");
  const depositRequired=service.deposit_type==="percentage"?Number(service.price)*Number(service.deposit_value)/100:service.deposit_type==="fixed"?Number(service.deposit_value):0;
  const {data:appointment,error:ae}=await supabase.from("appointments").insert({business_id:businessId,service_id:service.id,customer_id:customer.id,starts_at:starts.toISOString(),ends_at:ends.toISOString(),status:"pending",price:Number(service.price),deposit_required:depositRequired,deposit_paid:0,currency:service.currency,notes:draft.notes,created_by:userId}).select("id,starts_at,ends_at,status,price,deposit_required,currency,customer:customers(name,email),service:appointment_services(name,duration_minutes)").single();
  if(ae||!appointment)throw new Error(ae?.message||"Could not create appointment.");
  const result={appointment,depositBoundary:depositRequired>0?"Payment provider is required to collect the deposit.":"No deposit required."};
  await finish(supabase,businessId,runId,"appointment",result,"Appointment created with collision checking.");
  return{runId,status:"succeeded",result};
 }catch(error){const message=error instanceof Error?error.message:"Appointment build failed.";await supabase.from("ai_build_runs").update({status:"failed",error_message:message,finished_at:new Date().toISOString()}).eq("id",runId);throw new Error(message);}
}

export async function runDigitalMenuBuild({businessId,userId,prompt,mode="auto_execute"}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=createClient(); const {data:business,error}=await supabase.from("businesses").select("id,name,currency,workspace_id").eq("id",businessId).eq("owner_id",userId).single(); if(error||!business)throw new Error("Business context is not available.");
 const draft=parseMenuRequest(prompt,business.currency||"USD"); const started=await start(supabase,business,userId,"digital_menu",prompt,mode); if(started.existing)return{runId:started.existing.id,status:started.existing.status,result:started.existing.result}; const runId=started.run.id;
 try{
  const {data:menu,error:me}=await supabase.from("digital_menus").upsert({business_id:businessId,name:draft.name,slug:draft.slug,currency:draft.currency,kitchen_flow_enabled:draft.kitchenFlowEnabled,status:"draft"},{onConflict:"business_id,slug"}).select("id,name,slug,status,qr_token,currency,kitchen_flow_enabled").single();
  if(me||!menu)throw new Error(me?.message||"Could not create digital menu.");
  await supabase.from("menu_items").delete().eq("menu_id",menu.id);
  const {data:items,error:ie}=await supabase.from("menu_items").insert(draft.items.map((item,index)=>({menu_id:menu.id,name:item.name,price:item.price,category:item.category,preparation_minutes:item.preparationMinutes||0,sort_order:index}))).select("id,name,price,category,preparation_minutes");
  if(ie)throw new Error(ie.message);
  const result={menu,items:items||[],publicPath:"/menu/"+menu.slug,qrToken:menu.qr_token,kitchenFlow:menu.kitchen_flow_enabled};
  await finish(supabase,businessId,runId,"digital_menu",result,"Digital QR menu and kitchen flow draft created.");
  return{runId,status:"succeeded",result};
 }catch(error){const message=error instanceof Error?error.message:"Digital menu build failed.";await supabase.from("ai_build_runs").update({status:"failed",error_message:message,finished_at:new Date().toISOString()}).eq("id",runId);throw new Error(message);}
}

export async function runWaiverBuild({businessId,userId,prompt,mode="draft_only"}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=createClient(); const {data:business,error}=await supabase.from("businesses").select("id,name,workspace_id").eq("id",businessId).eq("owner_id",userId).single(); if(error||!business)throw new Error("Business context is not available.");
 const draft=parseWaiverRequest(prompt); const started=await start(supabase,business,userId,"waiver",prompt,mode); if(started.existing)return{runId:started.existing.id,status:started.existing.status,result:started.existing.result}; const runId=started.run.id;
 try{
  const {data:previous}=await supabase.from("waivers").select("version").eq("business_id",businessId).eq("name",draft.name).order("version",{ascending:false}).limit(1).maybeSingle();
  const version=(previous?.version||0)+1;
  const {data:waiver,error:we}=await supabase.from("waivers").insert({business_id:businessId,name:draft.name,title:draft.title,body:draft.body,version,status:"draft",required:draft.required,created_by:userId}).select("id,name,title,body,version,status,required").single();
  if(we||!waiver)throw new Error(we?.message||"Could not create waiver.");
  const result={waiver,signatureBoundary:"Signature capture is prepared for typed/drawn/external providers; the system does not claim a signature exists until one is recorded."};
  await finish(supabase,businessId,runId,"waiver",result,"Digital waiver draft created.");
  return{runId,status:"succeeded",result};
 }catch(error){const message=error instanceof Error?error.message:"Waiver build failed.";await supabase.from("ai_build_runs").update({status:"failed",error_message:message,finished_at:new Date().toISOString()}).eq("id",runId);throw new Error(message);}
}
