import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function hash(value: string) { return crypto.createHash("sha256").update(value).digest("hex"); }

type PortalAccessRequestRecord = {
  id:string;
  portal_id:string;
  customer_id:string;
  expires_at:string;
  consumed_at:string|null;
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = String(body?.token || "").trim();
  if (!token) return NextResponse.json({ error: "Missing access token." }, { status: 400 });

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: rawRequest } = await admin.from("customer_portal_access_requests")
    .select("id,portal_id,customer_id,expires_at,consumed_at")
    .eq("token_hash", hash(token))
    .is("consumed_at", null)
    .gt("expires_at", now)
    .maybeSingle();
  const request = rawRequest as PortalAccessRequestRecord|null;

  if (!request) return NextResponse.json({ error: "That secure access link is invalid or has expired." }, { status: 401 });

  const sessionToken = crypto.randomBytes(32).toString("base64url");
  const sessionHash = hash(sessionToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const sessionRecord = {
    portal_id: request.portal_id,
    customer_id: request.customer_id,
    session_hash: sessionHash,
    expires_at: expiresAt
  };
  const { error } = await (admin.from("customer_portal_sessions") as any).insert(sessionRecord);
  if (error) return NextResponse.json({ error: "Could not create the portal session." }, { status: 500 });

  await admin.from("customer_portal_access_requests").update({ consumed_at: now }).eq("id", request.id);
  const accessEvent = { portal_id: request.portal_id, customer_id: request.customer_id, event_type: "access_granted", metadata: {} };
  await (admin.from("customer_portal_events") as any).insert(accessEvent);

  const response = NextResponse.json({ ok: true });
  response.cookies.set("bizstack_portal_session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60
  });
  return response;
}
