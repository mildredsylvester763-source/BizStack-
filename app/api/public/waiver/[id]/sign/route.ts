// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import crypto from "node:crypto";

export const runtime="nodejs";

export async function POST(req:NextRequest,{params}:{params:{id:string}}){
 const admin=createAdminClient();
 const body=await req.json().catch(()=>({}));
 if(!body.signerName||!body.signatureValue)return NextResponse.json({error:"Signer name and signature are required."},{status:400});
 const {data:waiver,error:we}=await admin.from("waivers").select("id,business_id,title,body,version,status,required").eq("id",params.id).eq("status","published").single();
 if(we||!waiver)return NextResponse.json({error:"Waiver not found or not published."},{status:404});
 const ip=req.headers.get("x-forwarded-for")||"";
 const ua=req.headers.get("user-agent")||"";
 const {data:signature,error:se}=await admin.from("waiver_signatures").insert({
  business_id:waiver.business_id,waiver_id:waiver.id,customer_id:body.customerId||null,
  signer_name:String(body.signerName),signer_email:body.signerEmail||null,
  signature_type:body.signatureType||"typed",signature_value:String(body.signatureValue),
  ip_hash:ip?crypto.createHash("sha256").update(ip).digest("hex"):null,
  user_agent_hash:ua?crypto.createHash("sha256").update(ua).digest("hex"):null,
  metadata:{public_flow:true,waiver_version:waiver.version}
 }).select("id,signed_at,signature_type").single();
 if(se)return NextResponse.json({error:se.message},{status:400});
 await admin.from("events").insert({business_id:waiver.business_id,event_type:"waiver.signed",summary:"Published waiver "+waiver.title+" received a signature.",evidence:{waiver_id:waiver.id,signature_id:signature.id,version:waiver.version},status:"info",priority:"normal",category:"compliance"});
 return NextResponse.json({ok:true,signature});
}
