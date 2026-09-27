import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime="nodejs";

function digest(secret:string,raw:string){return crypto.createHmac("sha256",secret).update(raw).digest("hex");}

export async function POST(req:NextRequest,{params}:{params:{provider:string;integrationId:string}}){
  const raw=await req.text();
  const supabase=createAdminClient();
  const {data:integration}=await supabase.from("integrations").select("id,business_id,provider,config").eq("id",params.integrationId).single();
  if(!integration) return NextResponse.json({error:"Unknown integration"},{status:404});
  const cfg=(integration.config||{}) as Record<string,unknown>;
  const secret=typeof cfg.webhook_secret==="string"?cfg.webhook_secret:null;
  if(!secret) return NextResponse.json({error:"Webhook secret is not configured"},{status:409});
  const supplied=req.headers.get("x-bizstack-signature")||req.headers.get("x-hub-signature-256")?.replace(/^sha256=/,"");
  if(!supplied || !crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(digest(secret,raw)))) return NextResponse.json({error:"Invalid signature"},{status:401});
  const payload=JSON.parse(raw||"{}");
  const externalId=req.headers.get("x-event-id")||req.headers.get("x-webhook-id")||crypto.createHash("sha256").update(raw).digest("hex");
  const {error}=await supabase.from("connector_webhook_events").upsert({business_id:integration.business_id,connector_definition_id:cfg.connector_definition_id||null,external_event_id:externalId,event_type:req.headers.get("x-event-type")||params.provider,signature_valid:true,processing_status:"received",payload_hash:crypto.createHash("sha256").update(raw).digest("hex"),payload},{onConflict:"business_id,external_event_id"});
  if(error) return NextResponse.json({error:error.message},{status:500});
  await supabase.from("integrations").update({last_event_at:new Date().toISOString(),status:"connected"}).eq("id",integration.id);
  return NextResponse.json({ok:true,accepted:true,eventId:externalId});
}