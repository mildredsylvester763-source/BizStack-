// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { assertAndSyncAsOwner } from "@/lib/connectors/sync-runtime";

export const runtime="nodejs";

export async function POST(req:NextRequest){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await req.json().catch(()=>({}));
  const businessId=String(body.businessId||"");
  const integrationId=String(body.integrationId||"");
  const resourceKey=String(body.resourceKey||"");
  if(!businessId||!integrationId||!resourceKey)return NextResponse.json({error:"businessId, integrationId and resourceKey are required"},{status:400});
  try{
    const result=await assertAndSyncAsOwner({supabase,businessId,integrationId,resourceKey,userId:user.id});
    return NextResponse.json({ok:true,...result});
  }catch(error){
    const message=error instanceof Error?error.message:"Connector sync failed.";
    return NextResponse.json({ok:false,status:"failed",message},{status:400});
  }
}
