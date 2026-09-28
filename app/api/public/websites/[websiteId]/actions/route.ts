import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ActionBody = {
  action?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  serviceId?: unknown;
  startsAt?: unknown;
  notes?: unknown;
  items?: unknown;
  tableLabel?: unknown;
  idempotencyKey?: unknown;
};

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function getPublishedWebsite(supabase: any, websiteId: string) {
  const { data, error } = await supabase
    .from("websites")
    .select("id,business_id,status")
    .eq("id", websiteId)
    .eq("status", "published")
    .single();
  if (error || !data) throw new Error("Published website not found.");
  return data;
}

async function getActionBinding(supabase: any, websiteId: string, businessId: string, actionKey: string) {
  const { data } = await supabase
    .from("website_action_bindings")
    .select("id,enabled,auth_mode,rate_limit_per_minute,require_idempotency,config")
    .eq("website_id", websiteId)
    .eq("business_id", businessId)
    .eq("action_key", actionKey)
    .maybeSingle();
  if (!data?.enabled) return null;
  return data;
}

function sourceIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || request.headers.get("x-real-ip") || "unknown").slice(0, 128);
}

function requestHash(body: unknown) {
  return createHash("sha256").update(JSON.stringify(body ?? {})).digest("hex");
}

async function beginActionRequest(
  supabase: any,
  websiteId: string,
  businessId: string,
  actionKey: string,
  binding: any,
  idempotencyKey: string,
  fingerprint: string,
  ip: string
) {
  const windowStart = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("website_action_requests")
    .select("id", { count: "exact", head: true })
    .eq("website_id", websiteId)
    .eq("action_key", actionKey)
    .eq("source_ip", ip)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= Number(binding.rate_limit_per_minute ?? 30)) {
    throw new Error("Website action rate limit exceeded. Please try again shortly.");
  }

  if (binding.require_idempotency && !idempotencyKey) {
    throw new Error("This website action requires an Idempotency-Key.");
  }

  if (idempotencyKey) {
    const { data: prior } = await supabase
      .from("website_action_requests")
      .select("id,status,response,error_message")
      .eq("website_id", websiteId)
      .eq("action_key", actionKey)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (prior) {
      if (prior.status === "succeeded" && prior.response) return { priorResponse: prior.response, requestId: prior.id };
      if (prior.status === "processing") throw new Error("An identical website action is already being processed.");
      if (prior.status === "failed") throw new Error(prior.error_message || "An identical website action already failed.");
    }
  }

  const { data: requestRow, error } = await supabase
    .from("website_action_requests")
    .insert({
      business_id: businessId,
      website_id: websiteId,
      action_key: actionKey,
      idempotency_key: idempotencyKey || null,
      request_fingerprint: fingerprint,
      source_ip: ip,
      status: "processing"
    })
    .select("id")
    .single();

  if (error || !requestRow) {
    if (idempotencyKey) {
      const { data: prior } = await supabase
        .from("website_action_requests")
        .select("id,status,response,error_message")
        .eq("website_id", websiteId)
        .eq("action_key", actionKey)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (prior?.status === "succeeded" && prior.response) return { priorResponse: prior.response, requestId: prior.id };
      if (prior?.status === "processing") throw new Error("An identical website action is already being processed.");
    }
    throw new Error("Could not start website action safely.");
  }

  return { priorResponse: null, requestId: requestRow.id };
}

async function completeActionRequest(supabase: any, requestId: string, status: "succeeded" | "failed", response: unknown, errorMessage?: string) {
  await supabase.from("website_action_requests").update({
    status,
    response: response ?? null,
    error_message: errorMessage ?? null,
    completed_at: new Date().toISOString()
  }).eq("id", requestId);
}

async function findOrCreateCustomer(supabase: any, businessId: string, name: string, email: string, phone: string) {
  if (email) {
    const { data } = await supabase
      .from("customers")
      .select("id,name,email,phone")
      .eq("business_id", businessId)
      .ilike("email", email)
      .maybeSingle();
    if (data) return data;
  }

  if (phone) {
    const { data } = await supabase
      .from("customers")
      .select("id,name,email,phone")
      .eq("business_id", businessId)
      .eq("phone", phone)
      .maybeSingle();
    if (data) return data;
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      business_id: businessId,
      name,
      email: email || null,
      phone: phone || null,
      status: "active",
      customer_type: "individual"
    })
    .select("id,name,email,phone")
    .single();

  if (error || !data) throw new Error("Could not create the customer record.");
  return data;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  let supabase: any = null;
  let requestId: string | null = null;
  try {
    const { websiteId } = await params;
    supabase = createAdminClient();
    const website = await getPublishedWebsite(supabase, websiteId);
    const body = (await request.json().catch(() => ({}))) as ActionBody;

    const action = text(body.action, 40);
    if (!action) return NextResponse.json({ error: "action is required." }, { status: 400 });

    const binding = await getActionBinding(supabase, websiteId, website.business_id, action);
    if (!binding) return NextResponse.json({ error: "This website action is not enabled." }, { status: 403 });

    if (binding.auth_mode === "authenticated") {
      const sessionClient = await createClient();
      const { data: { user } } = await sessionClient.auth.getUser();
      if (!user) return NextResponse.json({ error: "Sign in is required for this website action." }, { status: 401 });
      const { data: allowed } = await sessionClient.rpc("user_can_business", {
        p_business_id: website.business_id,
        p_user_id: user.id,
        p_permission: "read_business_context"
      });
      if (!allowed) return NextResponse.json({ error: "You do not have access to this business." }, { status: 403 });
    } else if (binding.auth_mode !== "public") {
      return NextResponse.json({ error: "This authentication mode is not available through the public website action endpoint yet." }, { status: 403 });
    }

    const headerKey = text(request.headers.get("idempotency-key"), 200);
    const idempotencyKey = headerKey || text(body.idempotencyKey, 200);
    const fingerprint = requestHash({ ...body, idempotencyKey: undefined });
    const started = await beginActionRequest(
      supabase,
      websiteId,
      website.business_id,
      action,
      binding,
      idempotencyKey,
      fingerprint,
      sourceIp(request)
    );
    requestId = started.requestId;
    if (started.priorResponse) return NextResponse.json(started.priorResponse);

    if (action === "booking_request") {
      if (!(await getActionBinding(supabase, websiteId, website.business_id, "booking_request"))) {
        return NextResponse.json({ error: "Booking is not enabled for this website." }, { status: 403 });
      }

      const name = text(body.name, 120);
      const email = text(body.email, 254).toLowerCase();
      const phone = text(body.phone, 40);
      const serviceId = text(body.serviceId, 80);
      const startsAt = text(body.startsAt, 80);
      const notes = text(body.notes, 1000);

      if (!name || !startsAt) return NextResponse.json({ error: "Name and booking time are required." }, { status: 400 });
      const start = new Date(startsAt);
      if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) {
        return NextResponse.json({ error: "Choose a valid future booking time." }, { status: 400 });
      }

      let service: any = null;
      if (serviceId) {
        const { data } = await supabase
          .from("appointment_services")
          .select("id,name,duration_minutes,price,currency,active")
          .eq("id", serviceId)
          .eq("business_id", website.business_id)
          .eq("active", true)
          .single();
        if (!data) return NextResponse.json({ error: "Selected service is unavailable." }, { status: 400 });
        service = data;
      }

      const customer = await findOrCreateCustomer(supabase, website.business_id, name, email, phone);
      const duration = Number(service?.duration_minutes ?? 30);
      const end = new Date(start.getTime() + Math.max(duration, 1) * 60000);

      const { data: conflict } = await supabase
        .from("appointments")
        .select("id")
        .eq("business_id", website.business_id)
        .in("status", ["pending", "confirmed", "checked_in"])
        .lt("starts_at", end.toISOString())
        .gt("ends_at", start.toISOString())
        .limit(1);

      if (conflict?.length) return NextResponse.json({ error: "That time is no longer available." }, { status: 409 });

      const { data: appointment, error } = await supabase
        .from("appointments")
        .insert({
          business_id: website.business_id,
          service_id: service?.id ?? null,
          customer_id: customer.id,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          status: "pending",
          price: Number(service?.price ?? 0),
          deposit_required: 0,
          deposit_paid: 0,
          currency: String(service?.currency ?? "USD"),
          notes: notes || null,
          metadata: { source: "website", website_id: websiteId }
        })
        .select("id,starts_at,ends_at,status,price,currency")
        .single();

      if (error || !appointment) throw new Error("Could not create the booking request.");
      const response = { action: "booking_request", appointment };
      await completeActionRequest(supabase, requestId!, "succeeded", response);
      return NextResponse.json(response);
    }

    if (action === "order_request") {
      if (!(await getActionBinding(supabase, websiteId, website.business_id, "order_request"))) {
        return NextResponse.json({ error: "Orders are not enabled for this website." }, { status: 403 });
      }

      const name = text(body.name, 120);
      const email = text(body.email, 254).toLowerCase();
      const phone = text(body.phone, 40);
      const tableLabel = text(body.tableLabel, 80);
      const notes = text(body.notes, 1000);
      const items = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
      if (!name || !items.length) return NextResponse.json({ error: "Name and at least one order item are required." }, { status: 400 });

      const safeItems = items.map((item: any) => ({
        product_id: text(item?.productId, 80) || null,
        name: text(item?.name, 200),
        quantity: Math.max(1, Math.min(99, Number(item?.quantity) || 1)),
        unit_price: Math.max(0, Number(item?.unitPrice) || 0),
        options: item?.options && typeof item.options === "object" ? item.options : {}
      })).filter((item) => item.name);

      if (!safeItems.length) return NextResponse.json({ error: "Order items are invalid." }, { status: 400 });

      const customer = await findOrCreateCustomer(supabase, website.business_id, name, email, phone);
      const { data: business } = await supabase.from("businesses").select("currency").eq("id", website.business_id).single();
      const total = safeItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
      const orderNumber = "WEB-" + Date.now().toString(36).toUpperCase();

      const { data: order, error } = await supabase
        .from("kitchen_orders")
        .insert({
          business_id: website.business_id,
          customer_id: customer.id,
          order_number: orderNumber,
          status: "queued",
          payment_status: "unpaid",
          total,
          currency: String(business?.currency ?? "USD"),
          table_label: tableLabel || null,
          items: safeItems,
          notes: notes || null,
          metadata: { source: "website", website_id: websiteId }
        })
        .select("id,order_number,status,payment_status,total,currency,created_at")
        .single();

      if (error || !order) throw new Error("Could not create the order request.");
      const response = { action: "order_request", order };
      await completeActionRequest(supabase, requestId!, "succeeded", response);
      return NextResponse.json(response);
    }

    return NextResponse.json({ error: "Unsupported website action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Website action failed.";
    if (supabase && requestId) await completeActionRequest(supabase, requestId, "failed", null, message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
