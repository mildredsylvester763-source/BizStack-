import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

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

async function hasCustomerBinding(supabase: any, websiteId: string, businessId: string, sourceKey: string) {
  const { data } = await supabase
    .from("website_business_bindings")
    .select("id")
    .eq("website_id", websiteId)
    .eq("business_id", businessId)
    .eq("source_key", sourceKey)
    .eq("enabled", true)
    .in("exposure", ["customer", "public"])
    .maybeSingle();
  return Boolean(data);
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
  try {
    const { websiteId } = await params;
    const supabase = createAdminClient();
    const website = await getPublishedWebsite(supabase, websiteId);
    const body = (await request.json().catch(() => ({}))) as ActionBody;

    const action = text(body.action, 40);
    if (!action) return NextResponse.json({ error: "action is required." }, { status: 400 });

    if (action === "booking_request") {
      if (!(await hasCustomerBinding(supabase, websiteId, website.business_id, "bookings"))) {
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
      return NextResponse.json({ action: "booking_request", appointment });
    }

    if (action === "order_request") {
      if (!(await hasCustomerBinding(supabase, websiteId, website.business_id, "orders"))) {
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
      return NextResponse.json({ action: "order_request", order });
    }

    return NextResponse.json({ error: "Unsupported website action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Website action failed." }, { status: 400 });
  }
}
