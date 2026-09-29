import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { assertBusinessOwner } from "@/lib/integrations/runtime";
import { verifyIntegrationHealth } from "@/lib/integrations/health";
export const runtime="nodejs";

export async function POST(req:NextRequest){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await req.json().catch(()=>({}));
 const businessId=String(body.businessId||""),integrationId=String(body.integrationId||"");
 if(!businessId||!integrationId)return NextResponse.json({error:"businessId and integrationId are required"},{status:400});
 try{
  await assertBusinessOwner(businessId,user.id);
  const {data:integration,error}=await supabase.from("integrations").select("id,business_id,provider,status,config").eq("id",integrationId).eq("business_id",businessId).single();
  if(error||!integration)throw new Error("Integration not found.");
  const result=await verifyIntegrationHealth(supabase,integration,businessId);
  await supabase.from("events").insert({business_id:businessId,event_type:"integration.health_checked",summary:`${integration.provider} connection health check ${result.ok?"succeeded":"failed"}.`,evidence:{integration_id:integrationId,provider:integration.provider,result},status:result.ok?"info":"warning",priority:"normal",category:"integrations"});
  return NextResponse.json(result,{status:result.ok?200:502});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Integration health check failed"},{status:400});}
}
