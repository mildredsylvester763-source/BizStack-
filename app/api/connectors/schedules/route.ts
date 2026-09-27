// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime="nodejs";

const allowedIntervals=new Set([300,900,1800,3600,21600,43200,86400]);

export async function POST(req:NextRequest){
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await req.json().catch(()=>({}));
  const businessId=String(body.businessId||"");
  const connectorDefinitionId=String(body.connectorDefinitionId||"");
  const resource=String(body.resource||"");
  const intervalSeconds=Number(body.intervalSeconds);
  if(!businessId||!connectorDefinitionId||!resource||!allowedIntervals.has(intervalSeconds))return NextResponse.json({error:"businessId, connectorDefinitionId, resource and a supported interval are required"},{status:400});
  const {data:business}=await supabase.from("businesses").select("id").eq("id",businessId).eq("owner_id",user.id).single();
  if(!business)return NextResponse.json({error:"Forbidden"},{status:403});
  const {data:def}=await supabase.from("connector_definitions").select("id,status,schema_definition").eq("id",connectorDefinitionId).eq("business_id",businessId).single();
  if(!def)return NextResponse.json({error:"Connector definition not found"},{status:404});
  const resourceDef=(def.schema_definition?.resources||[]).find((r:any)=>r.key===resource||r.label===resource);
  if(!resourceDef)return NextResponse.json({error:"Resource not found"},{status:404});
  if(resourceDef.method&&resourceDef.method!=="GET")return NextResponse.json({error:"Only GET resources can be scheduled by the generic sync worker"},{status:400});
  const {data:integration}=await supabase.from("integrations").select("id,status,config").eq("business_id",businessId).eq("config->>connector_definition_id",connectorDefinitionId).maybeSingle();
  if(!integration)return NextResponse.json({error:"Activate this connector in Integration Hub first"},{status:400});
  if(integration.status!=="connected")return NextResponse.json({error:"Verify the connector before scheduling syncs"},{status:400});
  const next=new Date(Date.now()+intervalSeconds*1000).toISOString();
  const {data:schedule,error}=await supabase.from("connector_schedules").insert({
    business_id:businessId,connector_definition_id:connectorDefinitionId,resource,
    schedule_type:"interval",interval_seconds:intervalSeconds,enabled:true,next_run_at:next,
    config:{integration_id:integration.id}
  }).select("id,resource,interval_seconds,enabled,next_run_at,last_run_at,last_status").single();
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true,schedule});
}

export async function DELETE(req:NextRequest){
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await req.json().catch(()=>({}));
  const businessId=String(body.businessId||"");
  const scheduleId=String(body.scheduleId||"");
  if(!businessId||!scheduleId)return NextResponse.json({error:"businessId and scheduleId are required"},{status:400});
  const {data:business}=await supabase.from("businesses").select("id").eq("id",businessId).eq("owner_id",user.id).single();
  if(!business)return NextResponse.json({error:"Forbidden"},{status:403});
  const {error}=await supabase.from("connector_schedules").delete().eq("id",scheduleId).eq("business_id",businessId);
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true});
}
