import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function deliverAccessEmail(args: { to: string; businessName: string; portalName: string; link: string }) {
  const from = process.env.BIZSTACK_PORTAL_EMAIL_FROM || process.env.BIZSTACK_EMAIL_FROM;
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && from) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + resendKey },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: "Your secure access link for " + args.businessName,
        html: "<div style='font-family:Arial,sans-serif;max-width:560px;margin:auto'><h2>" + args.portalName + "</h2><p>Use the secure link below to access your customer portal. It expires in 15 minutes and can only be used once.</p><p><a href='" + args.link + "' style='display:inline-block;padding:12px 18px;background:#111827;color:#fff;text-decoration:none;border-radius:8px'>Open customer portal</a></p><p>If you did not request this, you can ignore this email.</p></div>"
      }),
      cache: "no-store"
    });
    if (!response.ok) throw new Error("Portal access email could not be delivered.");
    return;
  }

  const webhook = process.env.BIZSTACK_PORTAL_EMAIL_WEBHOOK_URL;
  if (webhook) {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: args.to,
        subject: "Your secure access link for " + args.businessName,
        portal: args.portalName,
        link: args.link,
        expires_minutes: 15
      }),
      cache: "no-store"
    });
    if (!response.ok) throw new Error("Portal access email delivery webhook failed.");
    return;
  }

  throw new Error("Customer portal email delivery is not configured. Add RESEND_API_KEY + BIZSTACK_PORTAL_EMAIL_FROM, or BIZSTACK_PORTAL_EMAIL_WEBHOOK_URL.");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slug = String(body?.slug || "").trim().toLowerCase();
  const email = String(body?.email || "").trim().toLowerCase();
  if (!slug || !email || !email.includes("@")) return NextResponse.json({ error: "Enter the portal link and your email address." }, { status: 400 });

  const admin = createAdminClient();
  type PortalAccessRecord = { id: string; business_id: string; name: string; status: string; slug: string; settings: Record<string, unknown> | null };
  type CustomerAccessRecord = { id: string; name: string | null; email: string | null; billing_email: string | null };
  const { data: portalData } = await admin.from("customer_portals").select("id,business_id,name,status,slug,settings").eq("slug", slug).maybeSingle();
  const portal = portalData as PortalAccessRecord | null;
  if (!portal || portal.status !== "published") return NextResponse.json({ message: "If that email is registered for this portal, a secure access link will be sent." });

  const { data: customerData } = await admin.from("customers").select("id,name,email,billing_email").eq("business_id", portal.business_id).or("email.ilike."+email+",billing_email.ilike."+email).limit(1).maybeSingle();
  const customer = customerData as CustomerAccessRecord | null;
  if (!customer) return NextResponse.json({ message: "If that email is registered for this portal, a secure access link will be sent." });

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hash(rawToken);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await admin.from("customer_portal_access_requests").delete().eq("portal_id", portal.id).eq("customer_id", customer.id).is("consumed_at", null);

  // The generated Supabase Database type does not currently expose this table, so the
  // insert builder resolves to `never[]`. Keep the typed admin client everywhere else
  // and cast only this boundary instead of weakening the whole route.
  const accessRequest = {
    portal_id: portal.id,
    customer_id: customer.id,
    email,
    token_hash: tokenHash,
    expires_at: expiresAt
  };
  const { error } = await (admin.from("customer_portal_access_requests") as any).insert(accessRequest);
  if (error) return NextResponse.json({ error: "Could not prepare portal access." }, { status: 500 });

  const origin = new URL(req.url).origin;
  const link = origin + "/portal/" + encodeURIComponent(portal.slug) + "?token=" + encodeURIComponent(rawToken);
  try {
    await deliverAccessEmail({ to: email, businessName: "your business", portalName: portal.name, link });
  } catch (error) {
    await admin.from("customer_portal_access_requests").delete().eq("token_hash", tokenHash);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Portal email delivery is unavailable." }, { status: 503 });
  }

  await admin.from("customer_portal_events").insert({ portal_id: portal.id, customer_id: customer.id, event_type: "access_requested", metadata: { channel: "email" } });
  return NextResponse.json({ message: "If that email is registered for this portal, a secure access link has been sent." });
}
