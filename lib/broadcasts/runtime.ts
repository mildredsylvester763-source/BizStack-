// @ts-nocheck
import { sendEmail, sendSms, sendWhatsApp } from "@/lib/integrations/providers";

export async function executeBroadcastCampaign({supabase,businessId,campaignId}:{supabase:any;businessId:string;campaignId:string}){
 const {data:campaign,error:ce}=await supabase.from("broadcast_campaigns").select("id,name,channel,message_template,status,opt_out_policy").eq("id",campaignId).eq("business_id",businessId).single();
 if(ce||!campaign)throw new Error("Campaign not found.");
 if(campaign.status!=="approved"&&campaign.status!=="queued")throw new Error("Campaign must be approved before sending.");
 await supabase.from("broadcast_campaigns").update({status:"sending",updated_at:new Date().toISOString()}).eq("id",campaignId).eq("business_id",businessId);
 const {data:recipients}=await supabase.from("broadcast_recipients").select("id,customer_id,recipient,status").eq("campaign_id",campaignId).in("status",["pending","queued"]).limit(500);
 let sent=0,blocked=0,failed=0;
 for(const recipient of recipients||[]){
  if(!recipient.customer_id){await supabase.from("broadcast_recipients").update({status:"blocked",block_reason:"Recipient has no customer record"}).eq("id",recipient.id);blocked++;continue;}
  const {data:consent}=await supabase.from("communication_consents").select("consent_status").eq("business_id",businessId).eq("customer_id",recipient.customer_id).eq("channel",campaign.channel).maybeSingle();
  if(campaign.opt_out_policy==="strict"&&consent?.consent_status!=="opted_in"){await supabase.from("broadcast_recipients").update({status:"blocked",block_reason:"Channel opt-in missing or revoked"}).eq("id",recipient.id);blocked++;continue;}
  const key="broadcast:"+campaignId+":recipient:"+recipient.id;
  const {data:existingJob}=await supabase.from("communication_delivery_jobs").select("id,status").eq("business_id",businessId).eq("idempotency_key",key).maybeSingle();
  if(existingJob?.status==="sent"){await supabase.from("broadcast_recipients").update({status:"sent"}).eq("id",recipient.id);sent++;continue;}
  const {data:message,error:me}=await supabase.from("communication_messages").insert({business_id:businessId,customer_id:recipient.customer_id,channel:campaign.channel,direction:"outbound",status:"queued",body:campaign.message_template,template_name:"broadcast_campaign",metadata:{campaign_id:campaignId,broadcast_recipient_id:recipient.id}}).select("id").single();
  if(me||!message){failed++;continue;}
  const {data:job}=await supabase.from("communication_delivery_jobs").insert({business_id:businessId,communication_id:message.id,entity_type:"broadcast_campaign",entity_id:campaignId,channel:campaign.channel,recipient:recipient.recipient,subject:campaign.name,body:campaign.message_template,idempotency_key:key,metadata:{campaign_id:campaignId,broadcast_recipient_id:recipient.id}}).select("id").single();
  let result:any;
  if(campaign.channel==="email")result=await sendEmail({to:recipient.recipient,subject:campaign.name,body:campaign.message_template,metadata:{idempotencyKey:key}});
  else if(campaign.channel==="sms")result=await sendSms({to:recipient.recipient,body:campaign.message_template,metadata:{idempotencyKey:key}});
  else result=await sendWhatsApp({to:recipient.recipient,body:campaign.message_template,metadata:{idempotencyKey:key}});
  if(result.ok){
   const now=new Date().toISOString();
   await supabase.from("broadcast_recipients").update({status:"sent",provider_message_id:result.messageId||null,sent_at:now,error_message:null}).eq("id",recipient.id);
   if(job?.id)await supabase.from("communication_delivery_jobs").update({status:"sent",provider:result.provider,provider_status:"accepted",provider_message_id:result.messageId||null,sent_at:now,response_metadata:result.response||{},last_error:null}).eq("id",job.id);
   await supabase.from("communication_messages").update({status:"sent",provider_message_id:result.messageId||null,sent_at:now,error_message:null}).eq("id",message.id);
   sent++;
  }else{
   await supabase.from("broadcast_recipients").update({status:"failed",error_message:result.error||"Provider rejected message"}).eq("id",recipient.id);
   if(job?.id)await supabase.from("communication_delivery_jobs").update({status:"failed",provider:result.provider,provider_status:"provider_error",last_error:result.error,response_metadata:result.response||{}}).eq("id",job.id);
   await supabase.from("communication_messages").update({status:"failed",error_message:result.error||"Provider rejected message"}).eq("id",message.id);
   failed++;
  }
 }
 const finalStatus="completed";
 await supabase.from("broadcast_campaigns").update({status:finalStatus,sent_count:sent,blocked_count:blocked,failed_count:failed,updated_at:new Date().toISOString()}).eq("id",campaignId).eq("business_id",businessId);
 await supabase.from("events").insert({business_id:businessId,event_type:"broadcast.completed",summary:campaign.name+" completed: "+sent+" sent, "+blocked+" blocked, "+failed+" failed.",evidence:{campaign_id:campaignId,sent,blocked,failed},status:"info",priority:"normal",category:"communications"});
 return {sent,blocked,failed,status:finalStatus};
}