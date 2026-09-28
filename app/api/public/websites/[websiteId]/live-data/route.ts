import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_PRODUCT_FIELDS = new Set(["id", "name", "sku", "unit", "unit_price", "is_active"]);
const PUBLIC_PROFILE_FIELDS = new Set(["name", "industry", "currency", "address", "contact_email", "contact_phone"]);
const PUBLIC_INVENTORY_FIELDS = new Set(["id", "name", "sku", "unit", "stock_quantity", "is_active"]);

function pick(row: Record<string, unknown>, fields: string[], allowed: Set<string>) {
  const output: Record<string, unknown> = {};
  for (const field of fields) {
    if (allowed.has(field)) output[field] = row[field];
  }
  return output;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  const { websiteId } = await params;
  const supabase = createAdminClient();

  const { data: website, error } = await supabase
    .from("websites")
    .select("id,business_id,status")
    .eq("id", websiteId)
    .eq("status", "published")
    .single();

  if (error || !website) {
    return NextResponse.json({ error: "Published website not found." }, { status: 404 });
  }

  const { data: bindings, error: bindingError } = await supabase
    .from("website_business_bindings")
    .select("source_key,enabled,exposure,fields,sync_mode")
    .eq("website_id", website.id)
    .eq("business_id", website.business_id)
    .eq("enabled", true)
    .eq("exposure", "public");

  if (bindingError) {
    return NextResponse.json({ error: "Website data binding unavailable." }, { status: 500 });
  }

  const result: Record<string, unknown> = {};

  for (const binding of bindings ?? []) {
    const key = String(binding.source_key);
    const requestedFields = Array.isArray(binding.fields)
      ? binding.fields.map(String).slice(0, 30)
      : [];

    if (key === "business_profile") {
      const { data } = await supabase
        .from("businesses")
        .select("name,industry,currency,address,contact_email,contact_phone")
        .eq("id", website.business_id)
        .single();

      result.business_profile = data
        ? pick(data, requestedFields.length ? requestedFields : [...PUBLIC_PROFILE_FIELDS], PUBLIC_PROFILE_FIELDS)
        : null;
      continue;
    }

    if (key === "products") {
      const { data } = await supabase
        .from("products")
        .select("id,name,sku,unit,unit_price,is_active")
        .eq("business_id", website.business_id)
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(500);

      result.products = (data ?? []).map((row: Record<string, unknown>) =>
        pick(row, requestedFields.length ? requestedFields : [...PUBLIC_PRODUCT_FIELDS], PUBLIC_PRODUCT_FIELDS)
      );
      continue;
    }

    if (key === "inventory_availability") {
      const { data } = await supabase
        .from("products")
        .select("id,name,sku,unit,stock_quantity,is_active")
        .eq("business_id", website.business_id)
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(500);

      result.inventory_availability = (data ?? []).map((row: Record<string, unknown>) => {
        const safe = pick(
          row,
          requestedFields.length ? requestedFields : [...PUBLIC_INVENTORY_FIELDS],
          PUBLIC_INVENTORY_FIELDS
        );
        const quantity = Number(row.stock_quantity ?? 0);
        return {
          ...safe,
          availability: quantity > 0 ? "in_stock" : "out_of_stock"
        };
      });
    }
  }


    if (key === "services") {
      const { data } = await supabase
        .from("appointment_services")
        .select("id,name,description,duration_minutes,price,currency,active")
        .eq("business_id", website.business_id)
        .eq("active", true)
        .order("name", { ascending: true })
        .limit(200);

      const allowed = new Set(["id","name","description","duration_minutes","price","currency","active"]);
      result.services = (data ?? []).map((row: Record<string, unknown>) =>
        pick(row, requestedFields.length ? requestedFields : [...allowed], allowed)
      );
      continue;
    }

    if (key === "locations") {
      const { data } = await supabase
        .from("business_locations")
        .select("id,name,code,address,city,state_region,country,postal_code,phone,email,timezone,is_primary,is_active")
        .eq("business_id", website.business_id)
        .eq("is_active", true)
        .order("is_primary", { ascending: false })
        .order("name", { ascending: true })
        .limit(100);

      const allowed = new Set(["id","name","code","address","city","state_region","country","postal_code","phone","email","timezone","is_primary","is_active"]);
      result.locations = (data ?? []).map((row: Record<string, unknown>) =>
        pick(row, requestedFields.length ? requestedFields : [...allowed], allowed)
      );
      continue;
    }

    if (key === "bookings") {
      const { data } = await supabase
        .from("appointments")
        .select("id,service_id,starts_at,ends_at,status,price,deposit_required,deposit_paid,currency")
        .eq("business_id", website.business_id)
        .in("status", ["pending","confirmed"])
        .order("starts_at", { ascending: true })
        .limit(200);

      const allowed = new Set(["id","service_id","starts_at","ends_at","status","price","deposit_required","deposit_paid","currency"]);
      result.bookings = (data ?? []).map((row: Record<string, unknown>) =>
        pick(row, requestedFields.length ? requestedFields : [...allowed], allowed)
      );
      continue;
    }

    if (key === "public_reviews") {
      const { data } = await supabase
        .from("customer_feedback")
        .select("id,channel,rating,message,sentiment,created_at")
        .eq("business_id", website.business_id)
        .not("rating", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);

      const allowed = new Set(["id","channel","rating","message","sentiment","created_at"]);
      result.public_reviews = (data ?? []).map((row: Record<string, unknown>) =>
        pick(row, requestedFields.length ? requestedFields : [...allowed], allowed)
      );
      continue;
    }

    if (key === "opening_hours") {
      const { data } = await supabase
        .from("business_settings")
        .select("module_settings")
        .eq("business_id", website.business_id)
        .maybeSingle();

      const settings = data?.module_settings;
      const hours =
        settings && typeof settings === "object" && !Array.isArray(settings)
          ? (settings as Record<string, unknown>).opening_hours ?? null
          : null;
      result.opening_hours = hours;
      continue;
    }

  return NextResponse.json(
    { websiteId: website.id, updatedAt: new Date().toISOString(), data: result },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*"
      }
    }
  );
}
