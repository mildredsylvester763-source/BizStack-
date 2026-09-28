import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase-server";
import { getOAuthProvider } from "@/lib/integrations/oauth-registry";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await req.json().catch(()=>({}));
  const slug=String(body?.app||"github").toLowerCase();
  const def=getOAuthProvider(slug);
  if(!def)return NextResponse.json({error:"This app has no compatible live OAuth adapter yet. Use the Universal Connector for this provider."},{status:409});
  const clientId=process.env[def.client];
  if(!clientId)return NextResponse.json({error:def.name+" is listed in the App Directory, but its server OAuth credentials are not configured yet."},{status:503});
  const requestedBusinessId=typeof body?.businessId==="string" ? body.businessId : "";
  const businessQuery=supabase.from("businesses").select("id").limit(1);
  const {data:business}=requestedBusinessId ? await businessQuery.eq("id",requestedBusinessId).maybeSingle() : await businessQuery.maybeSingle();
  if(!business)return NextResponse.json({error:"Business context is not available."},{status:404});
  const config={setup_stage:"awaiting_authorization",oauth_authorize_url:def.authorize,oauth_token_url:def.token,oauth_client_id:clientId,oauth_scopes:def.scopes,app_key:slug,provider_adapter:def.provider,oauth_identity_url:def.identity||null,oauth_token_auth:def.tokenAuth||"body",oauth_extra:def.extra||{}};
  const {data:existing}=await supabase.from("integrations").select("id").eq("business_id",business.id).eq("provider",def.provider).eq("connection_type","oauth").maybeSingle();
  let integrationId=existing?.id;
  if(!integrationId){
    const {data:i,error}=await supabase.from("integrations").insert({business_id:business.id,provider:def.provider,category:def.category,connection_type:"oauth",display_name:def.name,status:"pending",sync_mode:"near_realtime",capabilities:{app:slug,scopes:def.scopes},config}).select("id").single();
    if(error||!i)return NextResponse.json({error:error?.message||"Could not create app connection."},{status:500});
    integrationId=i.id;
  }else await supabase.from("integrations").update({config,status:"pending",error_message:null}).eq("id",integrationId);
  const state=crypto.randomBytes(32).toString("hex"),redirectUri=new URL("/api/integrations/oauth/callback",req.url).toString(),expires=new Date(Date.now()+600000).toISOString();
  const {data:attempt,error:ae}=await supabase.from("integration_connection_attempts").insert({business_id:business.id,integration_id:integrationId,attempt_type:"oauth",status:"awaiting_authorization",state_token:state,redirect_uri:redirectUri,expires_at:expires,metadata:{app:slug}}).select("id").single();
  if(ae||!attempt)return NextResponse.json({error:ae?.message||"Could not start authorization."},{status:500});
  const {error:se}=await supabase.from("integration_oauth_states").insert({business_id:business.id,integration_id:integrationId,attempt_id:attempt.id,state_token:state,provider:def.provider,redirect_uri:redirectUri,scopes:def.scopes,expires_at:expires});
  if(se)return NextResponse.json({error:se.message},{status:500});
  const auth=new URL(def.authorize);
  auth.searchParams.set("client_id",clientId);
  auth.searchParams.set("redirect_uri",redirectUri);
  auth.searchParams.set("response_type","code");
  auth.searchParams.set("state",state);
  if(def.scopes.length)auth.searchParams.set("scope",def.scopes.join(" "));
  if(slug.startsWith("google-")||slug==="gmail"){auth.searchParams.set("access_type","offline");auth.searchParams.set("prompt","consent");}
  if(slug==="slack")auth.searchParams.set("user_scope","identity.basic,identity.email");
  if(slug==="notion")auth.searchParams.set("owner","user");
  return NextResponse.json({ok:true,authorizationUrl:auth.toString(),app:slug});
}
