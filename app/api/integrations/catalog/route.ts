import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { assertBusinessOwner } from "@/lib/integrations/runtime";
import { getIntegrationCatalog } from "@/lib/integrations/catalog";
export const runtime="nodejs";

export async function GET(req:NextRequest){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const businessId=String(new URL(req.url).searchParams.get("businessId")||"");
 if(!businessId)return NextResponse.json({error:"businessId is required"},{status:400});
 try{await assertBusinessOwner(businessId,user.id);return NextResponse.json({providers:getIntegrationCatalog()});}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Access denied"},{status:403});}
}