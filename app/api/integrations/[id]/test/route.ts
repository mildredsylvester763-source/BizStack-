// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { loadIntegrationCredential, markIntegrationVerified } from "@/lib/integrations/runtime";

export const runtime="nodejs";

export async function POST(req:NextRequest, props:{params: Promise<{id:string}>}) {
  const params = await props.params;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Unauthorized"},{status:401});
  const {data:integration,error}=await supabase.from("integrations").select("id,business_id,provider,connection_type,config").eq("id",params.id).single();
  if(error || !integration) return NextResponse.json({error:"Integration not found"},{status:404});
  const {data:business}=await supabase.from("businesses").select("id").eq("id",integration.business_id).eq("owner_id",user.id).single();
  if(!business) return NextResponse.json({error:"Forbidden"},{status:403});
  try{
    const {credential}=await loadIntegrationCredential(params.id,integration.business_id);
    let response:Response;
    const cfg=(integration.config||{}) as Record<string,unknown>;
    const base=typeof cfg.test_url==="string"?cfg.test_url:typeof cfg.base_url==="string"?cfg.base_url:null;
    if(base){
      const headers:Record<string,string>={};
      const authType=typeof cfg.auth_type==="string"?cfg.auth_type:"api_key";
      if(authType==="bearer" && credential.apiKey) headers.Authorization=`Bearer ${credential.apiKey}`;
      else if(credential.apiKey) headers["x-api-key"]=credential.apiKey;
      if(credential.bearerToken||credential.accessToken) headers.Authorization=`Bearer ${credential.bearerToken||credential.accessToken}`;
      response=await fetch(base,{headers,cache:"no-store"});
    }else{
      return NextResponse.json({ok:false,status:"needs_test_configuration",message:"Connector has credentials but no test endpoint. Add config.test_url/base_url to the connector definition."});
    }
    const text=await response.text();
    if(!response.ok) return NextResponse.json({ok:false,status:"error",httpStatus:response.status,response:text.slice(0,2000)},{status:502});
    await markIntegrationVerified(params.id,integration.business_id);
    const connectorDefinitionId=typeof cfg.connector_definition_id==="string"?cfg.connector_definition_id:null;
    if(connectorDefinitionId){
      await supabase.from("connector_definitions").update({status:"active",last_tested_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq("id",connectorDefinitionId).eq("business_id",integration.business_id);
    }
    return NextResponse.json({ok:true,status:"connected",httpStatus:response.status,response:text.slice(0,2000)});
  }catch(e){
    await supabase.from("integrations").update({status:"error",error_message:e instanceof Error?e.message:"Verification failed"}).eq("id",params.id);
    const connectorDefinitionId=typeof ((integration.config||{}) as any).connector_definition_id==="string"?((integration.config||{}) as any).connector_definition_id:null;
    if(connectorDefinitionId) await supabase.from("connector_definitions").update({status:"error",last_error:e instanceof Error?e.message:"Verification failed",updated_at:new Date().toISOString()}).eq("id",connectorDefinitionId).eq("business_id",integration.business_id);
    return NextResponse.json({ok:false,status:"error",message:e instanceof Error?e.message:"Verification failed"},{status:502});
  }
}