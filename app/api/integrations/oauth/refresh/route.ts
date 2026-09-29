import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { decryptSecret, encryptSecret } from "@/lib/security/secrets";

const providerEnv:Record<string,string>={github:"GITHUB","google-drive":"GOOGLE",gmail:"GOOGLE","google-calendar":"GOOGLE",slack:"SLACK",notion:"NOTION"};

export async function POST(req:NextRequest){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await req.json().catch(()=>({}));
  const integrationId=typeof body.integrationId==="string"?body.integrationId:"";
  if(!integrationId)return NextResponse.json({error:"integrationId is required."},{status:400});

  const {data:i,error:ie}=await supabase.from("integrations").select("id,business_id,provider,config").eq("id",integrationId).single();
  if(ie||!i)return NextResponse.json({error:"Integration not found."},{status:404});
  const {data:business}=await supabase.from("businesses").select("id").eq("id",i.business_id).maybeSingle();
  if(!business)return NextResponse.json({error:"Business access denied."},{status:403});
  const prefix=providerEnv[i.provider], cfg=(i.config||{}) as Record<string,any>;
  if(!prefix)return NextResponse.json({error:"This provider does not have a refresh adapter."},{status:409});

  const {data:cred,error:ce}=await supabase.from("integration_credentials").select("encrypted_payload").eq("integration_id",i.id).eq("status","active").maybeSingle();
  if(ce||!cred)return NextResponse.json({error:"Active OAuth credentials were not found."},{status:404});
  const secret=decryptSecret<{accessToken:string;refreshToken?:string;metadata?:any}>(cred.encrypted_payload);
  if(!secret.refreshToken)return NextResponse.json({error:"This provider did not return a refresh token; reconnect is required."},{status:409});
  const clientId=process.env[prefix+"_CLIENT_ID"],clientSecret=process.env[prefix+"_CLIENT_SECRET"];
  const tokenUrl=cfg.oauth_token_url;
  if(!clientId||!clientSecret||typeof tokenUrl!=="string")return NextResponse.json({error:"Provider refresh credentials are not configured on the server."},{status:503});

  const params=new URLSearchParams({grant_type:"refresh_token",refresh_token:secret.refreshToken,client_id:clientId});
  const headers:Record<string,string>={"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"};
  if(i.provider==="notion")headers.Authorization="Basic "+Buffer.from(clientId+":"+clientSecret).toString("base64");
  else params.set("client_secret",clientSecret);
  const response=await fetch(tokenUrl,{method:"POST",headers,body:params});
  const token=await response.json().catch(()=>({}));
  if(!response.ok||!token.access_token){
    await supabase.from("integrations").update({status:"error",error_message:token.error_description||token.error||"OAuth refresh failed"}).eq("id",i.id);
    return NextResponse.json({error:token.error_description||token.error||"OAuth refresh failed",reconnect:true},{status:502});
  }

  const encrypted=encryptSecret({
    accessToken:token.access_token,
    refreshToken:token.refresh_token||secret.refreshToken,
    metadata:{...(secret.metadata||{}),token_type:token.token_type,scope:token.scope,expires_in:token.expires_in,refreshed_at:new Date().toISOString()}
  });
  const expiresAt=token.expires_in?new Date(Date.now()+Number(token.expires_in)*1000).toISOString():null;
  const {error:saveError}=await supabase.from("integration_credentials").update({encrypted_payload:encrypted,expires_at:expiresAt,metadata:{scope:token.scope||null},updated_at:new Date().toISOString()}).eq("integration_id",i.id).eq("status","active");
  if(saveError)throw saveError;
  await supabase.from("integrations").update({status:"connected",last_verified_at:new Date().toISOString(),error_message:null}).eq("id",i.id);
  return NextResponse.json({ok:true,status:"connected",expiresAt});
}