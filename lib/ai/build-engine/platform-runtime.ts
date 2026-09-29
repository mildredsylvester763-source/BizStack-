import crypto from "node:crypto";
import { createClient } from "@/lib/supabase-server";
import { buildPlan } from "@/lib/ai/build-engine/capabilities";
import { parseFinanceApiRequest, parseMarketplaceListingRequest, parseProductPhotoRequest } from "@/lib/ai/build-engine/platform-local";
import type { BuildMode } from "@/lib/ai/build-engine/types";

function checksum(value:unknown){const json=JSON.stringify(value);let hash=2166136261;for(let i=0;i<json.length;i+=1){hash^=json.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(16);}
async function start(supabase:any,business:any,userId:string,capability:string,prompt:string,mode:BuildMode){
 const plan=buildPlan({capability:capability as any,prompt,mode,context:{business}});
 const key=checksum({capability,prompt:prompt.trim(),mode});
 const {data:existing}=await supabase.from("ai_build_runs").select("id,status,result").eq("business_id",business.id).eq("idempotency_key",key).maybeSingle();
 if(existing?.id&&["succeeded","planning","building","testing","waiting_approval"].includes(existing.status))return{existing,run:null};
 const {data:run,error}=await supabase.from("ai_build_runs").insert({business_id:business.id,workspace_id:business.workspace_id,created_by:userId,capability_key:capability,request_text:prompt.trim(),execution_mode:mode,plan,context:{business},idempotency_key:key,status:"planning",started_at:new Date().toISOString()}).select("id").single();
 if(error||!run)throw new Error(error?.message||"Could not create build run.");
 return{run,existing:null};
}
async function finish(supabase:any,businessId:string,runId:string,artifactType:string,result:any,summary:string){
 await supabase.from("ai_build_artifacts").insert({business_id:businessId,build_run_id:runId,artifact_type:artifactType,artifact_key:artifactType,version:1,status:"validated",content:result,checksum:checksum(result)});
 await supabase.from("ai_build_runs").update({status:"succeeded",provider_key:"local-"+artifactType+"-compiler",provider_status:"fallback",result,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",runId).eq("business_id",businessId);
 await supabase.from("events").insert({business_id:businessId,event_type:"ai.build.completed",summary,evidence:{build_run_id:runId,capability:artifactType},status:"info",priority:"normal",category:"ai_build"});
}

export async function runProductPhotoBuild({businessId,userId,prompt,mode="draft_only"}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=await createClient();const {data:business,error}=await supabase.from("businesses").select("id,name,currency,workspace_id").eq("id",businessId).eq("owner_id",userId).single();if(error||!business)throw new Error("Business context is not available.");
 const draft=parseProductPhotoRequest(prompt),started=await start(supabase,business,userId,"product_photo",prompt,mode);if(started.existing)return{runId:started.existing.id,status:started.existing.status,result:started.existing.result};const runId=started.run.id;
 try{
  const {data:products}=await supabase.from("products").select("id,name,sku,description").eq("business_id",businessId).ilike("name","%"+draft.productName+"%").eq("is_active",true).limit(5);
  const product=products?.[0];if(!product)throw new Error("Product “"+draft.productName+"” was not found.");
  const providerReady=Boolean(process.env.BIZSTACK_IMAGE_API_URL&&process.env.BIZSTACK_IMAGE_API_KEY);
  const {data:job,error:je}=await supabase.from("product_media_assets").insert({business_id:businessId,product_id:product.id,asset_type:draft.assetType,prompt:draft.prompt,style:draft.style,provider:providerReady?"configured-image-provider":"not_configured",status:providerReady?"queued":"draft",source_image_ref:draft.sourceImageRef,metadata:{providerBoundary:providerReady?"configured":"provider_key_required"}}).select("id,product_id,asset_type,prompt,style,provider,status,source_image_ref,output_ref,metadata").single();
  if(je||!job)throw new Error(je?.message||"Could not create product media job.");
  const result={job,product,providerBoundary:providerReady?"Image provider is configured; generation worker can claim this job.":"Add BIZSTACK_IMAGE_API_URL and BIZSTACK_IMAGE_API_KEY to enable generation."};
  await finish(supabase,businessId,runId,"product_photo",result,"Product photo studio job created.");
  return{runId,status:"succeeded",result};
 }catch(error){const message=error instanceof Error?error.message:"Product photo build failed.";await supabase.from("ai_build_runs").update({status:"failed",error_message:message,finished_at:new Date().toISOString()}).eq("id",runId);throw new Error(message);}
}

export async function runMarketplaceListingBuild({businessId,userId,prompt,mode="draft_only"}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=await createClient();const {data:business,error}=await supabase.from("businesses").select("id,name,currency,workspace_id").eq("id",businessId).eq("owner_id",userId).single();if(error||!business)throw new Error("Business context is not available.");
 const draft=parseMarketplaceListingRequest(prompt),started=await start(supabase,business,userId,"marketplace_listing",prompt,mode);if(started.existing)return{runId:started.existing.id,status:started.existing.status,result:started.existing.result};const runId=started.run.id;
 try{
  const {data:listing,error:le}=await supabase.from("marketplace_listings").insert({seller_business_id:businessId,title:draft.title,description:draft.description,listing_type:draft.listingType,category:draft.category,price:draft.price,currency:draft.currency||business.currency,quantity_available:draft.quantityAvailable,location_country:draft.country,location_region:draft.region,status:"draft",tags:draft.tags,created_by:userId}).select("id,title,description,listing_type,category,price,currency,quantity_available,location_country,location_region,status,tags").single();
  if(le||!listing)throw new Error(le?.message||"Could not create marketplace listing.");
  const result={listing,inquiryWorkflow:"Authenticated businesses can submit marketplace inquiries; no direct contact details are exposed by default."};
  await finish(supabase,businessId,runId,"marketplace_listing",result,"B2B marketplace listing drafted.");
  return{runId,status:"succeeded",result};
 }catch(error){const message=error instanceof Error?error.message:"Marketplace listing build failed.";await supabase.from("ai_build_runs").update({status:"failed",error_message:message,finished_at:new Date().toISOString()}).eq("id",runId);throw new Error(message);}
}

export async function runFinanceApiBuild({businessId,userId,prompt,mode="ask_first"}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=await createClient();const {data:business,error}=await supabase.from("businesses").select("id,name,workspace_id").eq("id",businessId).eq("owner_id",userId).single();if(error||!business)throw new Error("Business context is not available.");
 const draft=parseFinanceApiRequest(prompt),started=await start(supabase,business,userId,"finance_api",prompt,mode);if(started.existing)return{runId:started.existing.id,status:started.existing.status,result:{...started.existing.result,apiKey:null}};
 const runId=started.run.id;
 try{
  const rawKey="bs_live_"+crypto.randomBytes(24).toString("base64url");
  const keyHash=crypto.createHash("sha256").update(rawKey).digest("hex");
  const prefix=rawKey.slice(0,16);
  const {data:client,error:ce}=await supabase.from("finance_api_clients").insert({business_id:businessId,client_name:draft.clientName,client_type:draft.clientType,status:"active",scopes:draft.scopes,created_by:userId}).select("id,client_name,client_type,status,scopes").single();
  if(ce||!client)throw new Error(ce?.message||"Could not create finance API client.");
  const {data:key,error:ke}=await supabase.from("finance_api_keys").insert({client_id:client.id,key_prefix:prefix,key_hash:keyHash,scopes:draft.scopes,status:"active"}).select("id,key_prefix,scopes,status,created_at").single();
  if(ke||!key)throw new Error(ke?.message||"Could not create finance API key.");
  const result={client,key,apiKey:rawKey,warning:"This API key is shown once. BizStack stores only a SHA-256 hash, never the plaintext key."};
  const stored={client,key,apiKey:null,warning:result.warning};
  await supabase.from("ai_build_artifacts").insert({business_id:businessId,build_run_id:runId,artifact_type:"finance_api",artifact_key:"finance_api",version:1,status:"validated",content:stored,checksum:checksum(stored)});
  await supabase.from("ai_build_runs").update({status:"succeeded",provider_key:"local-finance-api-key-compiler",provider_status:"fallback",result:stored,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",runId).eq("business_id",businessId);
  await supabase.from("events").insert({business_id:businessId,event_type:"ai.build.finance_api_created",summary:"External finance API client "+draft.clientName+" created.",evidence:{build_run_id:runId,client_id:client.id,scopes:draft.scopes,key_prefix:prefix},status:"needs_approval",priority:"high",category:"platform"});
  return{runId,status:"succeeded",result};
 }catch(error){const message=error instanceof Error?error.message:"Finance API build failed.";await supabase.from("ai_build_runs").update({status:"failed",error_message:message,finished_at:new Date().toISOString()}).eq("id",runId);throw new Error(message);}
}