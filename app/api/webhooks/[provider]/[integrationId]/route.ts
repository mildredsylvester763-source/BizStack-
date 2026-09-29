// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime="nodejs";

function validSignature(secret:string,raw:string,supplied:string){
  const expected=crypto.createHmac("sha256",secret).update(raw).digest("hex");
  const a=Buffer.from(supplied,"utf8"), b=Buffer.from(expected,"utf8");
  return a.length===b.length && crypto.timingSafeEqual(a,b);
}

async function recordMetaMessages(supabase:any, integration:any, provider:string, payload:any){
  const rows:any[]=[];
  if(provider==="whatsapp" || provider==="meta-whatsapp"){
    for(const entry of payload?.entry||[]){
      for(const change of entry?.changes||[]){
        for(const message of change?.value?.messages||[]){
          const from=String(message?.from||"");
          const body=String(message?.text?.body||message?.button?.text||message?.interactive?.button_reply?.title||message?.interactive?.list_reply?.title||"");
          if(!from) continue;
          let customerId:any=null;
          const {data:customer}=await supabase.from("customers").select("id").eq("business_id",integration.business_id).eq("phone",from).maybeSingle();
          customerId=customer?.id||null;
          rows.push({
            business_id:integration.business_id,customer_id:customerId,integration_id:integration.id,
            channel:"whatsapp",direction:"inbound",status:"received",provider_message_id:String(message?.id||""),
            body,metadata:{provider:"meta-whatsapp",sender_phone:from,timestamp:message?.timestamp||null,contact:change?.value?.contacts?.[0]||null,raw_type:message?.type||null}
          });
        }
      }
    }
  }else if(provider==="facebook-messenger" || provider==="messenger" || provider==="facebook"){
    for(const entry of payload?.entry||[]){
      for(const event of entry?.messaging||[]){
        const senderId=String(event?.sender?.id||"");
        const body=String(event?.message?.text||"");
        if(!senderId || !body) continue;
        rows.push({
          business_id:integration.business_id,customer_id:null,integration_id:integration.id,
          channel:"facebook_messenger",direction:"inbound",status:"received",provider_message_id:String(event?.message?.mid||""),
          body,metadata:{provider:"meta-messenger",sender_id:senderId,recipient_id:event?.recipient?.id||null,timestamp:event?.timestamp||null}
        });
      }
    }
  }
  if(rows.length){
    for(const row of rows){
      await supabase.from("communication_messages").upsert(row,{onConflict:"business_id,provider_message_id"});
    }
  }
  return rows.length;
}

export async function GET(
  req:NextRequest,
  props:{params: Promise<{provider:string;integrationId:string}>}
) {
  const params = await props.params;
  const provider=params.provider;
  if(!["whatsapp","meta-whatsapp","facebook-messenger","messenger","facebook"].includes(provider)) return NextResponse.json({error:"Unsupported webhook provider"},{status:404});
  const supabase=createAdminClient();
  const {data:integration}=await supabase.from("integrations").select("id,business_id,provider,config").eq("id",params.integrationId).single();
  if(!integration) return NextResponse.json({error:"Unknown integration"},{status:404});
  const cfg=(integration.config||{}) as Record<string,unknown>;
  const verifyToken=typeof cfg.webhook_verify_token==="string"?cfg.webhook_verify_token:null;
  const mode=req.nextUrl.searchParams.get("hub.mode");
  const token=req.nextUrl.searchParams.get("hub.verify_token");
  const challenge=req.nextUrl.searchParams.get("hub.challenge");
  if(mode==="subscribe" && verifyToken && token===verifyToken && challenge) return new Response(challenge,{status:200});
  return NextResponse.json({error:"Webhook verification failed"},{status:403});
}

export async function POST(
  req:NextRequest,
  props:{params: Promise<{provider:string;integrationId:string}>}
) {
  const params = await props.params;
  const raw=await req.text();
  const supabase=createAdminClient();
  const {data:integration}=await supabase.from("integrations").select("id,business_id,provider,config").eq("id",params.integrationId).single();
  if(!integration) return NextResponse.json({error:"Unknown integration"},{status:404});
  const cfg=(integration.config||{}) as Record<string,unknown>;
  const provider=params.provider;
  const secret=typeof cfg.webhook_secret==="string"?cfg.webhook_secret:null;
  const supplied=req.headers.get("x-hub-signature-256")?.replace(/^sha256=/,"") || req.headers.get("x-bizstack-signature");
  if(!secret || !supplied || !validSignature(secret,raw,supplied)) return NextResponse.json({error:"Invalid signature"},{status:401});
  let payload:unknown;
  try{payload=JSON.parse(raw||"{}");}catch{return NextResponse.json({error:"Invalid JSON"},{status:400});}

  if(["whatsapp","meta-whatsapp","facebook-messenger","messenger","facebook"].includes(provider)){
    const count=await recordMetaMessages(supabase,integration,provider,payload);
    await supabase.from("integrations").update({last_event_at:new Date().toISOString(),status:"connected"}).eq("id",integration.id);
    return NextResponse.json({ok:true,accepted:true,messagesRecorded:count});
  }

  const connectorDefinitionId=typeof cfg.connector_definition_id==="string"?cfg.connector_definition_id:null;
  if(!connectorDefinitionId) return NextResponse.json({error:"Webhook secret and connector definition are required"},{status:409});
  const externalId=req.headers.get("x-event-id")||req.headers.get("x-webhook-id")||crypto.createHash("sha256").update(raw).digest("hex");
  const {error}=await supabase.from("connector_webhook_events").upsert({
    business_id:integration.business_id,connector_definition_id:connectorDefinitionId,external_event_id:externalId,
    event_type:req.headers.get("x-event-type")||provider,signature_valid:true,
    processing_status:"received",payload_hash:crypto.createHash("sha256").update(raw).digest("hex"),payload
  },{onConflict:"business_id,external_event_id"});
  if(error) return NextResponse.json({error:error.message},{status:500});
  await supabase.from("integrations").update({last_event_at:new Date().toISOString(),status:"connected"}).eq("id",integration.id);
  return NextResponse.json({ok:true,accepted:true,eventId:externalId});
}