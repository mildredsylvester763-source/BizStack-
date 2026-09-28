import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

async function businessForUser(supabase:any,userId:string){
 const {data}=await supabase.from("businesses").select("id,name").eq("owner_id",userId).limit(1).maybeSingle();
 return data;
}
export async function GET(){
 const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const business=await businessForUser(supabase,user.id); if(!business)return NextResponse.json({error:"Business context is not available."},{status:404});
 const {data,error}=await supabase.from("customer_portals").select("id,name,status,slug,settings,created_at,updated_at").eq("business_id",business.id).order("created_at",{ascending:false});
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({business,portals:data||[]});
}
export async function POST(req:NextRequest){
 const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const business=await businessForUser(supabase,user.id); if(!business)return NextResponse.json({error:"Business context is not available."},{status:404});
 const body=await req.json().catch(()=>({}));
 const name=String(body?.name||"Customer Portal").trim().slice(0,120);
 const slug=(String(body?.slug||name).trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")).slice(0,80);
 if(!slug)return NextResponse.json({error:"A valid portal slug is required."},{status:400});
 const {data:existing}=await supabase.from("customer_portals").select("id").eq("business_id",business.id).eq("slug",slug).maybeSingle();
 if(existing)return NextResponse.json({error:"That portal slug is already in use."},{status:409});
 const {data,error}=await supabase.from("customer_portals").insert({business_id:business.id,name,slug,status:"draft",settings:{modules:{invoices:true,payments:true,documents:true,orders:true,appointments:true,messages:true}}}).select("id,name,status,slug,settings,created_at,updated_at").single();
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({portal:data}, {status:201});
}
export async function PATCH(req:NextRequest){
 const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const business=await businessForUser(supabase,user.id); if(!business)return NextResponse.json({error:"Business context is not available."},{status:404});
 const body=await req.json().catch(()=>({})); const id=String(body?.id||"");
 if(!id)return NextResponse.json({error:"Portal id is required."},{status:400});
 const patch:any={}; if(body?.name!==undefined)patch.name=String(body.name).trim().slice(0,120); if(body?.settings)patch.settings=body.settings;
 if(body?.status!==undefined){const status=String(body.status);if(!["draft","published","disabled"].includes(status))return NextResponse.json({error:"Invalid portal status."},{status:400});patch.status=status;}
 patch.updated_at=new Date().toISOString();
 const {data,error}=await supabase.from("customer_portals").update(patch).eq("id",id).eq("business_id",business.id).select("id,name,status,slug,settings,created_at,updated_at").single();
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({portal:data});
}
