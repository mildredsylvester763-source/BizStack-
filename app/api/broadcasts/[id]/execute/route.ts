// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { executeBroadcastCampaign } from "@/lib/broadcasts/runtime";
export const runtime="nodejs";
export async function POST(_req:NextRequest,{params}:{params:{id:string}}){
 const supabase=createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {data:business}=await supabase.from("businesses").select("id").eq("owner_id",user.id).single();
 if(!business)return NextResponse.json({error:"Business not found"},{status:404});
 try{
  const result=await executeBroadcastCampaign({supabase,businessId:business.id,campaignId:params.id});
  return NextResponse.json({ok:true,...result});
 }catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:"Broadcast execution failed"},{status:400});
 }
}
