// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { syncConnectorResource } from "@/lib/connectors/sync-runtime";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function authorized(req:NextRequest){
  const expected=process.env.CRON_SECRET;
  if(!expected)return false;
  const auth=req.headers.get("authorization");
  const supplied=auth?.startsWith("Bearer ")?auth.slice(7):req.headers.get("x-cron-secret");
  return supplied===expected;
}

export async function POST(req:NextRequest){
  if(!authorized(req))return NextResponse.json({error:"Unauthorized"},{status:401});
  const limit=Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")||20),1),100);
  const supabase=createAdminClient();
  const {data:schedules,error}=await supabase.rpc("claim_connector_schedules",{p_limit:limit});
  if(error)return NextResponse.json({error:error.message},{status:500});

  const results=[];
  for(const schedule of schedules||[]){
    const integrationId=schedule.config?.integration_id;
    if(!integrationId){
      await supabase.from("connector_schedules").update({last_status:"failed",updated_at:new Date().toISOString()}).eq("id",schedule.id);
      results.push({scheduleId:schedule.id,status:"failed",error:"Schedule has no integration_id"});
      continue;
    }
    try{
      const result=await syncConnectorResource({
        supabase,
        businessId:schedule.business_id,
        integrationId,
        resourceKey:schedule.resource
      });
      await supabase.from("connector_schedules").update({
        last_status:"succeeded",
        updated_at:new Date().toISOString()
      }).eq("id",schedule.id).eq("business_id",schedule.business_id);
      results.push({scheduleId:schedule.id,status:"succeeded",resource:schedule.resource,records:result.records});
    }catch(error){
      const message=error instanceof Error?error.message:"Scheduled connector sync failed.";
      await supabase.from("connector_schedules").update({
        last_status:"failed",
        updated_at:new Date().toISOString(),
        config:{...(schedule.config||{}),last_error:message}
      }).eq("id",schedule.id).eq("business_id",schedule.business_id);
      results.push({scheduleId:schedule.id,status:"failed",error:message});
    }
  }
  return NextResponse.json({ok:true,processed:results.length,results});
}
