import { createClient } from "@/lib/supabase-server";
import { buildPlan } from "@/lib/ai/build-engine/capabilities";
import { parseDualCurrencyRequest, parseLoanReadinessRequest, parseObligationRequest, parsePayrollAdvanceRequest } from "@/lib/ai/build-engine/finance-ops-local";
import type { BuildMode } from "@/lib/ai/build-engine/types";

function checksum(value: unknown) {
  const json = JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < json.length; i += 1) { hash ^= json.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16);
}

async function startRun(supabase: any, business: any, userId: string, capability: string, prompt: string, mode: BuildMode) {
  const plan = buildPlan({ capability: capability as any, prompt, mode, context: { business } });
  const idempotencyKey = checksum({ capability, prompt: prompt.trim(), mode });
  const { data: existing } = await supabase.from("ai_build_runs").select("id,status,result").eq("business_id", business.id).eq("idempotency_key", idempotencyKey).maybeSingle();
  if (existing?.id && ["succeeded","building","testing","planning","waiting_approval"].includes(existing.status)) return { existing, plan, idempotencyKey };
  const { data: run, error } = await supabase.from("ai_build_runs").insert({
    business_id: business.id, workspace_id: business.workspace_id, created_by: userId,
    capability_key: capability, request_text: prompt.trim(), execution_mode: mode,
    plan, context: { business }, idempotency_key: idempotencyKey,
    status: "planning", started_at: new Date().toISOString()
  }).select("id").single();
  if (error || !run) throw new Error(error?.message || "Could not create build run.");
  return { run, plan, idempotencyKey };
}

async function finish(supabase:any,businessId:string,runId:string,providerKey:string,result:any,artifactType:string,summary:string){
  await supabase.from("ai_build_artifacts").insert({business_id:businessId,build_run_id:runId,artifact_type:artifactType,artifact_key:artifactType,version:1,status:"validated",content:result,checksum:checksum(result)});
  await supabase.from("ai_build_runs").update({status:"succeeded",provider_key:providerKey,provider_status:"fallback",result,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",runId).eq("business_id",businessId);
  await supabase.from("events").insert({business_id:businessId,event_type:"ai.build.completed",summary,evidence:{build_run_id:runId,capability:artifactType},status:"info",priority:"normal",category:"ai_build"});
}

export async function runDualCurrencyBuild({businessId,userId,prompt,mode="auto_execute"}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=await createClient();
 const {data:business,error}=await supabase.from("businesses").select("id,name,currency,workspace_id").eq("id",businessId).eq("owner_id",userId).single();
 if(error||!business)throw new Error("Business context is not available.");
 const draft=parseDualCurrencyRequest(prompt,business.currency||"USD");
 const started=await startRun(supabase,business,userId,"dual_currency",prompt,mode);
 if(started.existing)return{runId:started.existing.id,status:started.existing.status,result:started.existing.result};
 const runId=started.run.id;
 try{
   await supabase.from("business_currencies").update({is_base:false}).eq("business_id",businessId);
   for(const code of [draft.baseCurrency,...draft.secondaryCurrencies]){
     const {error:upsertError}=await supabase.from("business_currencies").upsert({business_id:businessId,currency_code:code,is_base:code===draft.baseCurrency,enabled:true},{onConflict:"business_id,currency_code"});
     if(upsertError)throw new Error(upsertError.message);
   }
   await supabase.from("businesses").update({currency:draft.baseCurrency}).eq("id",businessId).eq("owner_id",userId);
   const {data:currencies}=await supabase.from("business_currencies").select("currency_code,is_base,enabled,decimal_places").eq("business_id",businessId).order("is_base",{ascending:false}).order("currency_code");
   const result={baseCurrency:draft.baseCurrency,secondaryCurrencies:draft.secondaryCurrencies,currencies};
   await finish(supabase,businessId,runId,"local-dual-currency-compiler",result,"dual_currency","Dual-currency books configured for "+draft.baseCurrency+".");
   return{runId,status:"succeeded",result};
 }catch(error){const message=error instanceof Error?error.message:"Dual-currency build failed.";await supabase.from("ai_build_runs").update({status:"failed",error_message:message,finished_at:new Date().toISOString()}).eq("id",runId);throw new Error(message);}
}

export async function runLoanReadinessBuild({businessId,userId,prompt,mode="draft_only"}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=await createClient();
 const {data:business,error}=await supabase.from("businesses").select("id,name,currency,industry,workspace_id").eq("id",businessId).eq("owner_id",userId).single();
 if(error||!business)throw new Error("Business context is not available.");
 const draft=parseLoanReadinessRequest(prompt,business.currency||"USD");
 const started=await startRun(supabase,business,userId,"loan_readiness",prompt,mode);
 if(started.existing)return{runId:started.existing.id,status:started.existing.status,result:started.existing.result};
 const runId=started.run.id;
 try{
   const {data:score,error:scoreError}=await supabase.rpc("calculate_financing_readiness",{p_business_id:businessId,p_requested_amount:draft.requestedAmount});
   if(scoreError||!score)throw new Error(scoreError?.message||"Could not calculate financing readiness.");
   const lenderPack={
     businessName:business.name,industry:business.industry||null,requestedAmount:draft.requestedAmount,currency:draft.currency,
     termMonths:draft.termMonths||null,purpose:draft.purpose,readiness:score,
     checklist:["Business registration evidence","12-month bank/accounting transaction history","Recent management accounts","Tax/compliance evidence","Identification/ownership evidence","Funding use-of-funds schedule"],
     evidenceBoundary:"Values marked as documented are derived from BizStack records. No external revenue, approvals, collateral or lender decision is invented."
   };
   const profile={purpose:draft.purpose,requested_amount:draft.requestedAmount,currency:draft.currency,term_months:draft.termMonths,score:score.score,score_band:score.band,strengths:score.strengths,gaps:score.gaps,lender_pack:lenderPack,last_scored_at:new Date().toISOString(),updated_at:new Date().toISOString()};
   const {data:saved,error:savedError}=await supabase.from("financing_profiles").upsert({business_id:businessId,...profile},{onConflict:"business_id"}).select("id,requested_amount,currency,term_months,score,score_band,strengths,gaps,lender_pack,last_scored_at").single();
   if(savedError||!saved)throw new Error(savedError?.message||"Could not persist financing profile.");
   const result={profile:saved,lenderPack};
   await finish(supabase,businessId,runId,"local-financing-readiness-compiler",result,"loan_readiness","Loan-readiness profile generated with evidence boundaries.");
   return{runId,status:"succeeded",result};
 }catch(error){const message=error instanceof Error?error.message:"Loan readiness build failed.";await supabase.from("ai_build_runs").update({status:"failed",error_message:message,finished_at:new Date().toISOString()}).eq("id",runId);throw new Error(message);}
}

export async function runObligationBuild({businessId,userId,prompt,mode="auto_execute"}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=await createClient();
 const {data:business,error}=await supabase.from("businesses").select("id,name,currency,workspace_id").eq("id",businessId).eq("owner_id",userId).single();
 if(error||!business)throw new Error("Business context is not available.");
 const draft=parseObligationRequest(prompt,business.currency||"USD");
 const started=await startRun(supabase,business,userId,"obligation",prompt,mode);
 if(started.existing)return{runId:started.existing.id,status:started.existing.status,result:started.existing.result};
 const runId=started.run.id;
 try{
   const {data:obligation,error:oe}=await supabase.from("business_obligations").insert({business_id:businessId,obligation_type:draft.type,title:draft.title,counterparty:draft.counterparty,amount:draft.amount,currency:draft.currency,frequency:draft.frequency,next_due_date:draft.nextDueDate,notes:draft.notes,created_by:userId}).select("id,obligation_type,title,counterparty,amount,currency,frequency,next_due_date,status").single();
   if(oe||!obligation)throw new Error(oe?.message||"Could not create business obligation.");
   const result={obligation};
   await finish(supabase,businessId,runId,"local-obligation-compiler",result,"obligation","Scheduled business obligation created.");
   return{runId,status:"succeeded",result};
 }catch(error){const message=error instanceof Error?error.message:"Obligation build failed.";await supabase.from("ai_build_runs").update({status:"failed",error_message:message,finished_at:new Date().toISOString()}).eq("id",runId);throw new Error(message);}
}

export async function runPayrollAdvanceBuild({businessId,userId,prompt,mode="auto_execute"}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=await createClient();
 const {data:business,error}=await supabase.from("businesses").select("id,name,currency,workspace_id").eq("id",businessId).eq("owner_id",userId).single();
 if(error||!business)throw new Error("Business context is not available.");
 const draft=parsePayrollAdvanceRequest(prompt,business.currency||"USD");
 const started=await startRun(supabase,business,userId,"payroll_advance",prompt,mode);
 if(started.existing)return{runId:started.existing.id,status:started.existing.status,result:started.existing.result};
 const runId=started.run.id;
 try{
   const {data:staff}=await supabase.from("workforce_members").select("id,name,monthly_pay,currency,status").eq("business_id",businessId).ilike("name","%"+draft.employeeName+"%").eq("status","active").limit(5);
   const member=staff?.[0];
   if(!member)throw new Error("Staff member “"+draft.employeeName+"” was not found. Create the workforce member first.");
   if(member.currency!==draft.currency)throw new Error("Advance currency does not match the staff member's payroll currency.");
   const {data:open}=await supabase.from("payroll_advances").select("id,outstanding_amount").eq("business_id",businessId).eq("workforce_member_id",member.id).in("status",["pending","active"]);
   const outstanding=(open||[]).reduce((sum:any,row:any)=>sum+Number(row.outstanding_amount||0),0);
   if(outstanding>0)throw new Error("This staff member already has an outstanding advance of "+outstanding.toLocaleString()+" "+draft.currency+".");
   if(member.monthly_pay>0&&draft.amount>Number(member.monthly_pay))throw new Error("Advance cannot exceed the staff member's monthly pay in the current policy boundary.");
   const {data:advance,error:ae}=await supabase.from("payroll_advances").insert({business_id:businessId,workforce_member_id:member.id,amount:draft.amount,currency:draft.currency,recovery_start_date:draft.startDate,recovery_periods:draft.recoveryPeriods,outstanding_amount:draft.amount,status:"active",notes:draft.notes,created_by:userId}).select("id,amount,currency,recovery_periods,outstanding_amount,status,recovery_start_date").single();
   if(ae||!advance)throw new Error(ae?.message||"Could not create payroll advance.");
   const result={workforceMember:member,advance,recoveryPerPeriod:Number(draft.amount)/draft.recoveryPeriods};
   await finish(supabase,businessId,runId,"local-payroll-advance-compiler",result,"payroll_advance","Payroll advance created with automatic recovery terms.");
   return{runId,status:"succeeded",result};
 }catch(error){const message=error instanceof Error?error.message:"Payroll advance build failed.";await supabase.from("ai_build_runs").update({status:"failed",error_message:message,finished_at:new Date().toISOString()}).eq("id",runId);throw new Error(message);}
}