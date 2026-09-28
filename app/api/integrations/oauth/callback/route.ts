import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { encryptSecret } from "@/lib/security/secrets";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 const supabase=createClient(); const url=new URL(req.url); const state=url.searchParams.get("state"); const code=url.searchParams.get("code"); const oauthError=url.searchParams.get("error");
 if(!state)return NextResponse.json({error:"Missing OAuth state"},{status:400});
 const {data:s}=await supabase.from("integration_oauth_states").select("id,business_id,integration_id,attempt_id,redirect_uri,status,expires_at").eq("state_token",state).eq("status","pending").single();
 if(!s||new Date(s.expires_at)<new Date())return NextResponse.json({error:"OAuth state is invalid or expired"},{status:400});
 if(oauthError){await supabase.from("integration_oauth_states").update({status:"failed",error_message:oauthError,completed_at:new Date().toISOString()}).eq("id",s.id);await supabase.from("integration_connection_attempts").update({status:"failed",error_message:oauthError,completed_at:new Date().toISOString()}).eq("id",s.attempt_id);return NextResponse.json({error:oauthError},{status:400});}
 if(!code)return NextResponse.json({error:"Missing OAuth authorization code"},{status:400});
 const {data:i}=await supabase.from("integrations").select("provider,config").eq("id",s.integration_id).single(); const cfg=(i?.config||{}) as Record<string,any>;
 if(typeof cfg.oauth_token_url!=="string")return NextResponse.json({error:"OAuth token endpoint is not configured for this provider."},{status:409});
 const body=new URLSearchParams({grant_type:"authorization_code",code,redirect_uri:s.redirect_uri}); if(cfg.oauth_client_id)body.set("client_id",cfg.oauth_client_id);if(cfg.oauth_client_secret)body.set("client_secret",cfg.oauth_client_secret);
 const response=await fetch(cfg.oauth_token_url,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},body});
 const token=await response.json().catch(()=>({})); if(!response.ok)return NextResponse.json({error:token?.error_description||token?.error||"OAuth token exchange failed"},{status:502});
 const encrypted=encryptSecret({accessToken:token.access_token,refreshToken:token.refresh_token,metadata:{token_type:token.token_type,scope:token.scope,expires_in:token.expires_in}});
 const {error:saveError}=await supabase.from("integration_credentials").upsert({business_id:s.business_id,integration_id:s.integration_id,credential_kind:"oauth",encrypted_payload:encrypted,status:"active",expires_at:token.expires_in?new Date(Date.now()+Number(token.expires_in)*1000).toISOString():null,metadata:{scope:token.scope||null}},{onConflict:"integration_id"});
 if(saveError)return NextResponse.json({error:saveError.message},{status:500});
 await supabase.from("integration_oauth_states").update({status:"exchanged",completed_at:new Date().toISOString()}).eq("id",s.id);
 await supabase.from("integration_connection_attempts").update({status:"credential_saved",completed_at:new Date().toISOString()}).eq("id",s.attempt_id);
 await supabase.from("integrations").update({status:"pending",error_message:null,config:{...cfg,oauth_authorized_at:new Date().toISOString()}}).eq("id",s.integration_id);
 return NextResponse.redirect(new URL("/dashboard/integrations?oauth=success",req.url));
}
