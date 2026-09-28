// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function auth(req:NextRequest){
 const expected=process.env.CRON_SECRET;
 const supplied=req.headers.get("authorization")?.replace(/^Bearer\s+/,"")||req.headers.get("x-cron-secret");
 return Boolean(expected&&supplied===expected);
}

export async function POST(req:NextRequest){
 if(!auth(req))return NextResponse.json({error:"Unauthorized"},{status:401});
 if(!process.env.BIZSTACK_IMAGE_API_URL||!process.env.BIZSTACK_IMAGE_API_KEY)return NextResponse.json({error:"Image provider not configured."},{status:503});
 const supabase=createAdminClient();
 const {data:jobs}=await supabase.from("product_media_assets").select("id,business_id,product_id,asset_type,prompt,style,provider_job_id").eq("status","queued").limit(20);
 const results=[];
 for(const job of jobs||[]){
  await supabase.from("product_media_assets").update({status:"processing",provider:"configured-image-provider",updated_at:new Date().toISOString()}).eq("id",job.id);
  try{
   const response=await fetch(process.env.BIZSTACK_IMAGE_API_URL!,{
    method:"POST",
    headers:{"content-type":"application/json","authorization:"Bearer "+process.env.BIZSTACK_IMAGE_API_KEY!},
    body:JSON.stringify({prompt:job.prompt,style:job.style,assetType:job.asset_type,productId:job.product_id}),
    cache:"no-store"
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data?.error||"Image provider HTTP "+response.status);
   const outputRef=data?.output_url||data?.image_url||data?.output?.url||data?.artifact?.url||null;
   const providerJobId=data?.id||data?.job_id||data?.job?.id||null;
   await supabase.from("product_media_assets").update({status:outputRef?"completed":"processing",provider_job_id:providerJobId,output_ref:outputRef,metadata:{providerResponse:data},updated_at:new Date().toISOString(),error_message:outputRef?null:"Provider accepted job but did not return an output URL."}).eq("id",job.id);
   results.push({id:job.id,status:outputRef?"completed":"processing"});
  }catch(error){
   const message=error instanceof Error?error.message:"Image provider failed.";
   await supabase.from("product_media_assets").update({status:"failed",error_message:message,updated_at:new Date().toISOString()}).eq("id",job.id);
   results.push({id:job.id,status:"failed",error:message});
  }
 }
 return NextResponse.json({ok:true,processed:results.length,results});
}
