import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { encryptSecret } from "@/lib/security/secrets";
import { getOAuthProvider } from "@/lib/integrations/oauth-registry";
export const runtime="nodejs";

const providerEnv:Record<string,string>={github:"GITHUB", "google-drive":"GOOGLE", gmail:"GOOGLE", "google-calendar":"GOOGLE", slack:"SLACK", notion:"NOTION"};
const providerCapabilities:Record<string,{read:boolean;write:boolean;delete:boolean;share:boolean}>={
  github:{read:true,write:true,delete:false,share:false},
  "google-drive":{read:true,write:true,delete:false,share:false},
  gmail:{read:true,write:true,delete:false,share:false},
  "google-calendar":{read:true,write:true,delete:false,share:false},
  slack:{read:true,write:true,delete:false,share:false},
  notion:{read:true,write:true,delete:false,share:false}
};

export async function GET(req:NextRequest){
 const supabase=createClient(); const url=new URL(req.url);
 const state=url.searchParams.get("state"),code=url.searchParams.get("code"),oauthError=url.searchParams.get("error");
 if(!state)return NextResponse.json({error:"Missing OAuth state"},{status:400});
 const {data:s}=await supabase.from("integration_oauth_states").select("id,business_id,integration_id,attempt_id,redirect_uri,status,expires_at,provider").eq("state_token",state).eq("status","pending").single();
 if(!s||new Date(s.expires_at)<new Date())return NextResponse.json({error:"OAuth state is invalid or expired"},{status:400});
 if(oauthError){await supabase.from("integration_oauth_states").update({status:"failed",error_message:oauthError,completed_at:new Date().toISOString()}).eq("id",s.id);await supabase.from("integration_connection_attempts").update({status:"failed",error_message:oauthError,completed_at:new Date().toISOString()}).eq("id",s.attempt_id);return NextResponse.json({error:oauthError},{status:400});}
 if(!code)return NextResponse.json({error:"Missing OAuth authorization code"},{status:400});
 const {data:i}=await supabase.from("integrations").select("provider,config").eq("id",s.integration_id).single();
 const cfg=(i?.config||{}) as Record<string,any>,provider=String(i?.provider||s.provider||"");
 const registry=getOAuthProvider(String(cfg.app_key||provider));
 if(typeof cfg.oauth_token_url!=="string")return NextResponse.json({error:"OAuth token endpoint is not configured for this provider."},{status:409});
 const clientId=String(cfg.oauth_client_id||registry?.client||"").endsWith("_CLIENT_ID") ? process.env[String(cfg.oauth_client_id||registry?.client)] : (cfg.oauth_client_id||null);
 const clientSecret=registry?.client ? process.env[registry.client.replace(/_CLIENT_ID$/,"_CLIENT_SECRET")] : null;
 const body=new URLSearchParams({grant_type:"authorization_code",code,redirect_uri:s.redirect_uri});
 if(cfg.oauth_client_id||clientId)body.set("client_id",cfg.oauth_client_id||clientId as string);
 if(cfg.oauth_client_secret||clientSecret)body.set("client_secret",cfg.oauth_client_secret||clientSecret as string);
 const tokenHeaders:Record<string,string>={"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"};
 if((cfg.oauth_token_auth==="basic" || registry?.tokenAuth==="basic") && clientId && clientSecret){
   tokenHeaders.Authorization="Basic "+Buffer.from(clientId+":"+clientSecret).toString("base64");
   body.delete("client_id"); body.delete("client_secret");
 }
 const response=await fetch(cfg.oauth_token_url,{method:"POST",headers:tokenHeaders,body});
 const token=await response.json().catch(()=>({}));
 if(!response.ok||!token.access_token)return NextResponse.json({error:token?.error_description||token?.error||"OAuth token exchange failed"},{status:502});
 let identity:any={};
 try{
   const identityUrl=cfg.oauth_identity_url || registry?.identity || (provider==="github"?"https://api.github.com/user":"https://www.googleapis.com/oauth2/v2/userinfo");
   const ir=await fetch(identityUrl,{headers:{Authorization:"Bearer "+token.access_token,Accept:"application/json"}});
   if(ir.ok)identity=await ir.json();
 }catch{}
 const encrypted=encryptSecret({accessToken:token.access_token,refreshToken:token.refresh_token,metadata:{token_type:token.token_type,scope:token.scope,expires_in:token.expires_in,provider_metadata:{bot_id:token.bot_id||null,workspace_id:token.team?.id||null,workspace_name:token.team?.name||null,notion_workspace_id:token.workspace_id||null}}});
 const {error:saveError}=await supabase.from("integration_credentials").upsert({business_id:s.business_id,integration_id:s.integration_id,credential_kind:"oauth",encrypted_payload:encrypted,status:"active",expires_at:token.expires_in?new Date(Date.now()+Number(token.expires_in)*1000).toISOString():null,metadata:{scope:token.scope||null}},{onConflict:"integration_id"});
 if(saveError)return NextResponse.json({error:saveError.message},{status:500});
 await supabase.from("integration_oauth_states").update({status:"exchanged",completed_at:new Date().toISOString()}).eq("id",s.id);
 await supabase.from("integration_connection_attempts").update({status:"verified",completed_at:new Date().toISOString()}).eq("id",s.attempt_id);
 await supabase.from("integrations").update({
   status:"connected",error_message:null,last_verified_at:new Date().toISOString(),
   external_account_id:String(identity.id||identity.sub||identity.user_id||token.authed_user?.id||token.bot_id||""),
   external_account_email:identity.email||identity.user?.profile?.email||null,
   external_account_name:identity.name||identity.login||identity.user?.real_name||identity.user?.profile?.real_name||identity.workspace_name||identity.email||null,
   account_label:identity.email||identity.login||identity.user?.profile?.email||identity.workspace_name||null,
   permission_state:{scopes:token.scope||cfg.oauth_scopes||[],authorized:true,provider},
   action_policy:providerCapabilities[provider]||{read:true,write:false,delete:false,share:false},
   config:{...cfg,oauth_authorized_at:new Date().toISOString(),identity:{id:identity.id||identity.sub||null,email:identity.email||null,name:identity.name||identity.login||null}}
 }).eq("id",s.integration_id);
 return NextResponse.redirect(new URL("/dashboard/ai-builder?connected="+encodeURIComponent(provider),req.url));
}