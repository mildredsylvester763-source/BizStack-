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
      const name = text(body.name, 120);
      const email = text(body.email, 254).toLowerCase();
      const phone = text(body.phone, 40);
      const tableLabel = text(body.tableLabel, 80);
      const notes = text(body.notes, 1000);
      const items = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
      if (!name || !items.length) return NextResponse.json({ error: "Name and at least one order item are required." }, { status: 400 });

      const requestedItems = items.map((item: any) => ({
        productId: text(item?.productId, 80),
        quantity: Math.max(1, Math.min(99, Number(item?.quantity) || 1)),
        options: item?.options && typeof item.options === "object" ? item.options : {}
      })).filter((item) => item.productId);

      if (!requestedItems.length || requestedItems.length !== items.length) {
        return NextResponse.json({ error: "Each order item must reference a valid BizStack product." }, { status: 400 });
      }

      const productIds = [...new Set(requestedItems.map((item) => item.productId))];
      const { data: products, error: productError } = await supabase
        .from("products")
        .select("id,name,unit_price,currency,stock_quantity,is_active")
        .eq("business_id", website.business_id)
        .in("id", productIds)
        .eq("is_active", true);

      if (productError) throw productError;

      const productMap = new Map((products ?? []).map((product: any) => [String(product.id), product]));
      if (productMap.size !== productIds.length) {
        return NextResponse.json({ error: "One or more selected products are unavailable." }, { status: 400 });
      }

      const safeItems = requestedItems.map((item) => {
        const product = productMap.get(item.productId);
        if (!product) throw new Error("Selected product is unavailable.");
        const stock = Number(product.stock_quantity ?? 0);
        if (stock < item.quantity) {
          throw new Error(product.name + " does not have enough available stock for this request.");
        }
        return {
          product_id: product.id,
          name: product.name,
          quantity: item.quantity,
          unit_price: Number(product.unit_price ?? 0),
          currency: String(product.currency ?? "").toUpperCase() || null,
          options: item.options
        };
      });

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
          metadata: { source: "website", website_id: websiteId, pricing_source: "business_products" }
        })
        .select("id,order_number,status,payment_status,total,currency,created_at")
        .single();

      if (error || !order) throw new Error("Could not create the order request.");
      const response = { action: "order_request", order };
      await completeActionRequest(supabase, requestId!, "succeeded", response);
      return NextResponse.json(response);
    }

    if (action === "quote_request") {
      const name = text(body.name, 120);
      const email = text(body.email, 254).toLowerCase();
      const phone = text(body.phone, 40);
      const notes = text(body.notes, 2000);
      const items = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
      if (!name || !items.length) return NextResponse.json({ error: "Name and at least one quote item are required." }, { status: 400 });

      const requestedItems = items.map((item: any) => ({
        productId: text(item?.productId, 80),
        quantity: Math.max(1, Math.min(9999, Number(item?.quantity) || 1))
      })).filter((item) => item.productId);

      if (!requestedItems.length || requestedItems.length !== items.length) {
        return NextResponse.json({ error: "Each quote item must reference a valid BizStack product." }, { status: 400 });
      }

      const productIds = [...new Set(requestedItems.map((item) => item.productId))];
      const { data: products, error: productError } = await supabase
        .from("products")
        .select("id,name,unit,unit_price")
        .eq("business_id", website.business_id)
        .in("id", productIds)
        .eq("is_active", true);
      if (productError) throw productError;

      const productMap = new Map((products ?? []).map((product: any) => [String(product.id), product]));
      if (productMap.size !== productIds.length) {
        return NextResponse.json({ error: "One or more requested products are unavailable." }, { status: 400 });
      }

      const safeItems = requestedItems.map((item) => {
        const product = productMap.get(item.productId);
        if (!product) throw new Error("Requested product is unavailable.");
        const unitPrice = Number(product.unit_price ?? 0);
        return {
          product_id: product.id,
          description: product.name,
          quantity: item.quantity,
          unit: product.unit || "unit",
          unit_price: unitPrice,
          line_total: item.quantity * unitPrice
        };
      });

      const customer = await findOrCreateCustomer(supabase, website.business_id, name, email, phone);
      const { data: business } = await supabase.from("businesses").select("currency").eq("id", website.business_id).single();
      const subtotal = safeItems.reduce((sum, item) => sum + item.line_total, 0);
      const quoteNumber = "WEB-Q-" + Date.now().toString(36).toUpperCase();

      const { data: quoteRecord, error: quoteError } = await supabase
        .from("quotes")
        .insert({
          business_id: website.business_id,
          customer_id: customer.id,
          quote_number: quoteNumber,
          status: "draft",
          issue_date: new Date().toISOString().slice(0, 10),
          currency: String(business?.currency ?? "USD"),
          reference: "Website quote request",
          subtotal,
          discount_type: "fixed",
          discount_value: 0,
          discount_amount: 0,
          tax_rate: 0,
          tax_name: null,
          tax_amount: 0,
          total: subtotal,
          notes: notes || null,
          terms: null,
          created_by: null
        })
        .select("id,quote_number,status,currency,subtotal,total,created_at")
        .single();

      if (quoteError || !quoteRecord) throw new Error("Could not create the quote request.");

      const { error: itemsError } = await supabase.from("quote_items").insert(
        safeItems.map((item) => ({ ...item, quote_id: quoteRecord.id }))
      );

      if (itemsError) {
        await supabase.from("quotes").delete().eq("id", quoteRecord.id).eq("business_id", website.business_id);
        throw new Error("Could not save the quote items.");
      }

      const response = { action: "quote_request", quote: quoteRecord };
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
