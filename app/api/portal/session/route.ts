import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
const hash = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

type PortalSessionRecord = {
  id: string;
  portal_id: string;
  customer_id: string;
  expires_at: string;
  revoked_at: string | null;
};

export async function GET(req: NextRequest) {
  const token = req.cookies.get("bizstack_portal_session")?.value;
  if (!token) return NextResponse.json({ authenticated: false });

  const admin = createAdminClient() as any;
  const { data: rawSession } = await admin
    .from("customer_portal_sessions")
    .select("id,portal_id,customer_id,expires_at,revoked_at")
    .eq("session_hash", hash(token))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  const session = rawSession as PortalSessionRecord | null;
  if (!session) return NextResponse.json({ authenticated: false });

  const { data: portal } = await admin
    .from("customer_portals")
    .select("id,business_id,name,slug,status,settings")
    .eq("id", session.portal_id)
    .eq("status", "published")
    .single();

  if (!portal) {
    await admin.from("customer_portal_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", session.id);
    return NextResponse.json({ authenticated: false });
  }

  const [{ data: customer }, { data: invoices }, { data: appointments }, { data: messages }, { data: orders }, { data: processors }] =
    await Promise.all([
      admin.from("customers").select("id,name,email,phone,company_name,preferred_currency").eq("id", session.customer_id).single(),
      admin.from("invoices").select("id,invoice_number,status,issue_date,due_date,currency,total,paid_amount,payment_methods,business:businesses(name,bank_name,bank_account_name,bank_account_number)").eq("customer_id", session.customer_id).order("created_at", { ascending: false }).limit(50),
      admin.from("appointments").select("id,starts_at,ends_at,status,price,deposit_required,deposit_paid,currency,notes,appointment_services(name)").eq("customer_id", session.customer_id).order("starts_at", { ascending: false }).limit(50),
      admin.from("communication_messages").select("id,channel,direction,status,subject,body,sent_at,delivered_at,read_at,created_at").eq("customer_id", session.customer_id).order("created_at", { ascending: false }).limit(50),
      admin.from("cash_sales").select("id,sale_number,sale_at,status,payment_method,currency,total,notes,cash_sale_items(description,quantity,unit_price,line_total)").eq("customer_id", session.customer_id).order("sale_at", { ascending: false }).limit(50),
      admin.from("integrations").select("id,provider,status").eq("business_id", portal.business_id).in("provider", ["stripe", "payment-processor"]).eq("status", "connected")
    ]);

  await admin.from("customer_portal_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", session.id);

  return NextResponse.json({
    authenticated: true,
    portal,
    customer,
    invoices: invoices || [],
    appointments: appointments || [],
    messages: messages || [],
    orders: orders || [],
    cardProcessorConnected: Boolean(processors?.length)
  });
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get("bizstack_portal_session")?.value;
  const response = NextResponse.json({ ok: true });
  response.cookies.set("bizstack_portal_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });

  if (token) {
    const sessions = createAdminClient().from("customer_portal_sessions") as any;
    await sessions.update({ revoked_at: new Date().toISOString() }).eq("session_hash", hash(token)).is("revoked_at", null);
  }
  return response;
}
