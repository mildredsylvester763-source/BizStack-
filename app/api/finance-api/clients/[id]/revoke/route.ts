// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
export async function POST(_req:NextRequest, props:{params: Promise<{id:string}>}) {
 const params = await props.params;
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {data:business}=await supabase.from("businesses").select("id").eq("owner_id",user.id).single();if(!business)return NextResponse.json({error:"Business not found"},{status:404});
 const {data:client}=await supabase.from("finance_api_clients").select("id").eq("id",params.id).eq("business_id",business.id).single();if(!client)return NextResponse.json({error:"API client not found"},{status:404});
 await supabase.from("finance_api_keys").update({status:"revoked",revoked_at:new Date().toISOString()}).eq("client_id",client.id).eq("status","active");
 await supabase.from("finance_api_clients").update({status:"revoked",updated_at:new Date().toISOString()}).eq("id",client.id).eq("business_id",business.id);
 return NextResponse.json({ok:true});
}