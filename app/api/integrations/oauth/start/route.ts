import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase-server";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await req.json().catch(()=>({})); const businessId=String(body.businessId||""),integrationId=String(body.integrationId||"");
 const {data:i}=await supabase.from("integrations").select("id,business_id,provider,connection_type,config").eq("id",integrationId).eq("business_id",businessId).single();
 const {data:b}=await supabase.from("businesses").select("id").eq("id",businessId).eq("owner_id",user.id).single();
 if(!i||!b)return NextResponse.json({error:"Integration not found"},{status:404});
 if(i.connection_type!=="oauth")return NextResponse.json({error:"Integration is not OAuth"} ,{status:400});
 const cfg=(i.config||{}) as Record<string,any>; const authorizationUrl=cfg.oauth_authorize_url; if(typeof authorizationUrl!=="string")return NextResponse.json({error:"OAuth provider authorization URL is not configured for this integration."},{status:409});
 const state=crypto.randomBytes(32).toString("hex"); const redirectUri=cfg.oauth_redirect_uri||new URL("/api/integrations/oauth/callback",req.url).toString();
 const {data:attempt,error:attemptError}=await supabase.from("integration_connection_attempts").insert({business_id:businessId,integration_id:integrationId,attempt_type:"oauth",status:"awaiting_authorization",state_token:state,redirect_uri:redirectUri,expires_at:new Date(Date.now()+10*60*1000).toISOString()}).select("id").single();
 if(attemptError)return NextResponse.json({error:attemptError.message},{status:500});
 const scopes=Array.isArray(cfg.oauth_scopes)?cfg.oauth_scopes:[]; await supabase.from("integration_oauth_states").insert({business_id:businessId,integration_id:integrationId,attempt_id:attempt.id,state_token:state,provider:i.provider,redirect_uri:redirectUri,scopes,expires_at:new Date(Date.now()+10*60*1000).toISOString()});
 const u=new URL(authorizationUrl); u.searchParams.set("response_type","code");u.searchParams.set("state",state);u.searchParams.set("redirect_uri",redirectUri);if(cfg.oauth_client_id)u.searchParams.set("client_id",cfg.oauth_client_id);if(scopes.length)u.searchParams.set("scope",scopes.join(" "));
 return NextResponse.json({ok:true,authorizationUrl:u.toString(),status:"awaiting_authorization"});
}