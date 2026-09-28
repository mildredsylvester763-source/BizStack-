// @ts-nocheck
export type SendMessageInput = { to:string; subject?:string; body:string; from?:string; replyTo?:string; metadata?:Record<string,unknown> };
export type ProviderResult = { ok:boolean; provider:string; messageId?:string; deliveredAt?:string; response?:unknown; error?:string };

function jsonHeaders(token:string){return {"Content-Type":"application/json","Authorization":`Bearer ${token}`};}

export async function sendEmail(input:SendMessageInput):Promise<ProviderResult>{
  if(process.env.RESEND_API_KEY){
    const from=input.from || process.env.BIZSTACK_EMAIL_FROM || "BizStack <onboarding@resend.dev>";
    const headers={...jsonHeaders(process.env.RESEND_API_KEY),...(typeof input.metadata?.idempotencyKey==="string"?{"Idempotency-Key":input.metadata.idempotencyKey}: {})};
    const res=await fetch("https://api.resend.com/emails",{method:"POST",headers,body:JSON.stringify({from,to:[input.to],subject:input.subject||"BizStack message",html:`<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(input.body)}</div>`,reply_to:input.replyTo})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok) return {ok:false,provider:"resend",error:typeof data?.message==="string"?data.message:`Resend HTTP ${res.status}`,response:data};
    return {ok:true,provider:"resend",messageId:data?.id,response:data};
  }
  return {ok:false,provider:"none",error:"No email provider configured. Add RESEND_API_KEY or connect a provider integration."};
}

export async function sendSms(input:SendMessageInput):Promise<ProviderResult>{
  if(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER){
    const body=new URLSearchParams({To:input.to,From:process.env.TWILIO_FROM_NUMBER,Body:input.body});
    const auth=Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
    const res=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,{method:"POST",headers:{Authorization:`Basic ${auth}`,"Content-Type":"application/x-www-form-urlencoded"},body});
    const data=await res.json().catch(()=>({}));
    if(!res.ok) return {ok:false,provider:"twilio",error:data?.message||`Twilio HTTP ${res.status}`,response:data};
    return {ok:true,provider:"twilio",messageId:data?.sid,response:data};
  }
  return {ok:false,provider:"none",error:"No SMS provider configured. Add Twilio environment variables or connect a provider integration."};
}

export async function sendWhatsApp(input:SendMessageInput):Promise<ProviderResult>{
  const cfg=(input.metadata?.providerConfig && typeof input.metadata.providerConfig==="object"?input.metadata.providerConfig:{}) as Record<string,unknown>;
  const token=String(cfg.access_token||cfg.accessToken||process.env.META_WHATSAPP_ACCESS_TOKEN||"");
  const phoneId=String(cfg.phone_number_id||cfg.phoneNumberId||process.env.META_WHATSAPP_PHONE_NUMBER_ID||"");
  const version=String(cfg.graph_api_version||process.env.META_GRAPH_API_VERSION||"v21.0");
  if(token && phoneId){
    const res=await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`,{method:"POST",headers:jsonHeaders(token),body:JSON.stringify({messaging_product:"whatsapp",to:input.to,type:"text",text:{body:input.body}})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok) return {ok:false,provider:"meta-whatsapp",error:data?.error?.message||`Meta HTTP ${res.status}`,response:data};
    return {ok:true,provider:"meta-whatsapp",messageId:data?.messages?.[0]?.id,response:data};
  }
  return {ok:false,provider:"none",error:"No WhatsApp provider configured. Connect a Meta WhatsApp Business integration or configure the server provider."};
}

export async function sendFacebookMessenger(input:SendMessageInput):Promise<ProviderResult>{
  const cfg=(input.metadata?.providerConfig && typeof input.metadata.providerConfig==="object"?input.metadata.providerConfig:{}) as Record<string,unknown>;
  const token=String(cfg.page_access_token||cfg.pageAccessToken||process.env.META_MESSENGER_PAGE_ACCESS_TOKEN||"");
  const pageId=String(cfg.page_id||cfg.pageId||process.env.META_MESSENGER_PAGE_ID||"");
  const version=String(cfg.graph_api_version||process.env.META_GRAPH_API_VERSION||"v21.0");
  if(token && pageId){
    const res=await fetch(`https://graph.facebook.com/${version}/${pageId}/messages`,{method:"POST",headers:jsonHeaders(token),body:JSON.stringify({recipient:{id:input.to},messaging_type:"RESPONSE",message:{text:input.body}})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok) return {ok:false,provider:"meta-messenger",error:data?.error?.message||`Meta HTTP ${res.status}`,response:data};
    return {ok:true,provider:"meta-messenger",messageId:data?.message_id||data?.messageId,response:data};
  }
  return {ok:false,provider:"none",error:"No Facebook Messenger provider configured. Connect a Meta Page integration or configure the server provider."};
}

function escapeHtml(value:string){return value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));}