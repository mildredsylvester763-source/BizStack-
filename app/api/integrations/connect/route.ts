import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { assertBusinessOwner, saveIntegrationCredential } from "@/lib/integrations/runtime";

export const runtime="nodejs";

export async function POST(req:NextRequest){
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await req.json().catch(()=>null);
  if(!body?.businessId || !body?.integrationId || !body?.kind || !body?.credential) return NextResponse.json({error:"businessId, integrationId, kind and credential are required"},{status:400});
  try{
    await assertBusinessOwner(body.businessId,user.id);
    const {data:integration,error}=await supabase.from("integrations").select("id,business_id,connection_type").eq("id",body.integrationId).eq("business_id",body.businessId).single();
    if(error || !integration) throw new Error("Integration not found");
    if(integration.connection_type!==body.kind) return NextResponse.json({error:"Credential type does not match the connection type"},{status:400});
    const saved=await saveIntegrationCredential({businessId:body.businessId,integrationId:body.integrationId,kind:body.kind,credential:body.credential});
    await supabase.from("integrations").update({status:"pending",config:{credentials_saved:true,connected_at:new Date().toISOString()}}).eq("id",body.integrationId).eq("business_id",body.businessId);
    return NextResponse.json({ok:true,credential:saved});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:"Connection failed"},{status:400});
  }
}