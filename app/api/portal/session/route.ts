import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
const hash=(v:string)=>crypto.createHash("sha256").update(v).digest("hex");

export async function GET(req:NextRequest){
  const token=req.cookies.get("bizstack_portal_session")?.value;
  if(!token)return NextResponse.json({authenticated:false});
  const admin=createAdminClient();
  const {data:session}=await admin.from("customer_portal_sessions").select("id,portal_id,customer_id,expires_at,revoked_at").eq("session_hash",hash(token)).is("revoked_at",null).gt("expires_at",new Date().toISOString()).maybeSingle();
  if(!session)return NextResponse.json({authenticated:false});
  const [{data:portal},{data:customer},{data:invoices}]=await Promise.all([
    admin.from("customer_portals").select("id,name,slug,status,settings").eq("id",session.portal_id).eq("status","published").single(),
    admin.from("customers").select("id,name,email,phone,company_name,preferred_currency").eq("id",session.customer_id).single(),
    admin.from("invoices").select("id,invoice_number,status,issue_date,due_date,currency,total,paid_amount").eq("customer_id",session.customer_id).order("created_at",{ascending:false}).limit(50)
  ]);
  if(!portal){ await admin.from("customer_portal_sessions").update({revoked_at:new Date().toISOString()}).eq("id",session.id); return NextResponse.json({authenticated:false}); }
  await admin.from("customer_portal_sessions").update({last_seen_at:new Date().toISOString()}).eq("id",session.id);
  return NextResponse.json({authenticated:true,portal,customer,invoices:invoices||[]});
}

export async function DELETE(req:NextRequest){
  const token=req.cookies.get("bizstack_portal_session")?.value;
  const response=NextResponse.json({ok:true});
  response.cookies.set("bizstack_portal_session","",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0});
  if(token) await createAdminClient().from("customer_portal_sessions").update({revoked_at:new Date().toISOString()}).eq("session_hash",hash(token)).is("revoked_at",null);
  return response;
}
