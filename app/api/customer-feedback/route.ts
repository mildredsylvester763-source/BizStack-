import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { clusterFeedback } from "@/lib/business-intelligence";

export async function GET(){
  const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const {data:b}=await supabase.from("businesses").select("id").eq("owner_id",user.id).single();
  if(!b)return NextResponse.json({error:"Business not found."},{status:404});
  const {data}=await supabase.from("customer_feedback").select("id,message,sentiment,channel,rating,created_at").eq("business_id",b.id).order("created_at",{ascending:false}).limit(500);
  return NextResponse.json({topics:clusterFeedback(data||[]),feedback:data||[]});
}

export async function POST(request:Request){
  const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await request.json(); const message=String(body?.message||"").trim();
  if(!message||message.length>5000)return NextResponse.json({error:"A feedback message up to 5000 characters is required."},{status:400});
  const {data:b}=await supabase.from("businesses").select("id").eq("owner_id",user.id).single();
  if(!b)return NextResponse.json({error:"Business not found."},{status:404});
  const rating=body?.rating==null?null:Number(body.rating);
  const sentiment=rating==null?null:rating<=2?"negative":rating>=4?"positive":"neutral";
  const {data,error}=await supabase.from("customer_feedback").insert({
    business_id:b.id,customer_id:body?.customerId||null,channel:String(body?.channel||"manual"),
    source_ref:body?.sourceRef||null,rating,sentiment,message,metadata:body?.metadata||{}
  }).select("id").single();
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true,id:data.id});
}
