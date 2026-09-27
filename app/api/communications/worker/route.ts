import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendEmail, sendSms, sendWhatsApp, type ProviderResult } from "@/lib/integrations/providers";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function authorized(req:NextRequest){
  const expected=process.env.CRON_SECRET;
  if(!expected) return false;
  const auth=req.headers.get("authorization");
  const supplied=auth?.startsWith("Bearer ")?auth.slice(7):req.headers.get("x-cron-secret");
  return supplied===expected;
}

export async function POST(req:NextRequest){
  if(!authorized(req)) return NextResponse.json({error:"Unauthorized"},{status:401});
  const limit=Math.min(Number(req.nextUrl.searchParams.get("limit")||10),50);
  const supabase=createAdminClient();
  const {data:jobs,error}=await supabase.rpc("claim_communication_delivery_jobs",{p_limit:limit});
  if(error) return NextResponse.json({error:error.message},{status:500});
  const results=[];
  for(const job of jobs||[]){
    let result:ProviderResult;
    if(job.channel==="email") result=await sendEmail({to:job.recipient,subject:job.subject||undefined,body:job.body||""});
    else if(job.channel==="sms") result=await sendSms({to:job.recipient,body:job.body||""});
    else if(job.channel==="whatsapp") result=await sendWhatsApp({to:job.recipient,body:job.body||""});
    else result={ok:false,provider:"none",error:`Channel ${job.channel} is not enabled by the current provider runtime`};

    if(result.ok){
      const now=new Date().toISOString();
      await supabase.from("communication_delivery_jobs").update({status:"sent",provider:result.provider,provider_status:"accepted",provider_message_id:result.messageId||null,response_metadata:result.response||{},sent_at:now,last_error:null}).eq("id",job.id);
      await supabase.from("communication_messages").update({status:"sent",provider_message_id:result.messageId||null,sent_at:now,error_message:null}).eq("id",job.communication_id);
      results.push({id:job.id,status:"sent",provider:result.provider,messageId:result.messageId});
    }else{
      const terminal=(job.attempts||0)>=((job.max_attempts||5));
      const next=new Date(Date.now()+Math.min(60*60*1000,Math.pow(2,Math.max(0,(job.attempts||1)-1))*15000)).toISOString();
      await supabase.from("communication_delivery_jobs").update({status:terminal?"failed":"queued",provider:result.provider,provider_status:"error",response_metadata:result.response||{},last_error:result.error,next_attempt_at:next}).eq("id",job.id);
      await supabase.from("communication_messages").update({status:terminal?"failed":"queued",error_message:result.error}).eq("id",job.communication_id);
      results.push({id:job.id,status:terminal?"failed":"retry_scheduled",error:result.error});
    }
  }
  return NextResponse.json({processed:results.length,results});
}