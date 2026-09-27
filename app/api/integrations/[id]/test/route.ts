import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { loadIntegrationCredential, markIntegrationVerified } from "@/lib/integrations/runtime";

export const runtime="nodejs";

export async function POST(req:NextRequest,{params}:{params:{id:string}}){
  const supabase=createClient();
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
      if(credential.apiKey) headers["x-api-key"]=credential.apiKey;
      if(credential.bearerToken||credential.accessToken) headers.Authorization=`Bearer ${credential.bearerToken||credential.accessToken}`;
      response=await fetch(base,{headers,cache:"no-store"});
    }else{
      return NextResponse.json({ok:false,status:"needs_test_configuration",message:"Connector has credentials but no test endpoint. Add config.test_url/base_url to the connector definition."});
    }
    const text=await response.text();
    if(!response.ok) return NextResponse.json({ok:false,status:"error",httpStatus:response.status,response:text.slice(0,2000)},{status:502});
    await markIntegrationVerified(params.id,integration.business_id);
    return NextResponse.json({ok:true,status:"connected",httpStatus:response.status,response:text.slice(0,2000)});
  }catch(e){
    await supabase.from("integrations").update({status:"error",error_message:e instanceof Error?e.message:"Verification failed"}).eq("id",params.id);
    return NextResponse.json({ok:false,status:"error",message:e instanceof Error?e.message:"Verification failed"},{status:502});
  }
}