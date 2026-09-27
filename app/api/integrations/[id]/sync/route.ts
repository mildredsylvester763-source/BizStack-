import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { loadIntegrationCredential } from "@/lib/integrations/runtime";

export const runtime="nodejs";

export async function POST(req:NextRequest,{params}:{params:{id:string}}){
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Unauthorized"},{status:401});
  const {data:i}=await supabase.from("integrations").select("id,business_id,provider,config,capabilities").eq("id",params.id).single();
  if(!i) return NextResponse.json({error:"Integration not found"},{status:404});
  const {data:b}=await supabase.from("businesses").select("id").eq("id",i.business_id).eq("owner_id",user.id).single();
  if(!b) return NextResponse.json({error:"Forbidden"},{status:403});
  try{
    const {credential}=await loadIntegrationCredential(params.id,i.business_id);
    const config=(i.config||{}) as Record<string,unknown>;
    const syncUrl=typeof config.sync_url==="string"?config.sync_url:null;
    if(!syncUrl) return NextResponse.json({ok:false,status:"needs_sync_configuration",message:"Connector is authenticated. Add a server-side sync_url and mapping rules before pulling external records."});
    const headers:Record<string,string>={};
    if(credential.apiKey) headers["x-api-key"]=credential.apiKey;
    if(credential.bearerToken||credential.accessToken) headers.Authorization=`Bearer ${credential.bearerToken||credential.accessToken}`;
    const response=await fetch(syncUrl,{headers,cache:"no-store"});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(`External sync returned HTTP ${response.status}`);
    await supabase.from("integrations").update({status:"connected",last_synced_at:new Date().toISOString(),error_message:null}).eq("id",params.id);
    return NextResponse.json({ok:true,status:"synced",payload});
  }catch(e){
    const message=e instanceof Error?e.message:"Sync failed";
    await supabase.from("integrations").update({status:"error",error_message:message}).eq("id",params.id);
    return NextResponse.json({ok:false,status:"error",message},{status:502});
  }
}