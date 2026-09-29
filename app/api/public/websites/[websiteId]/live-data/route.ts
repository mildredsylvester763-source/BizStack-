import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_PRODUCT_FIELDS = new Set(["id","name","sku","unit","unit_price","is_active"]);
const PUBLIC_PROFILE_FIELDS = new Set(["name","industry","currency","address","contact_email","contact_phone"]);
const PUBLIC_INVENTORY_FIELDS = new Set(["id","name","sku","unit","stock_quantity","is_active"]);

type PublishedWebsiteRecord = {
  id:string;
  business_id:string;
  status:string;
};

function pick(row: Record<string, unknown>, fields: string[], allowed: Set<string>) {
  const output: Record<string, unknown> = {};
  for (const field of fields) {
    if (allowed.has(field)) output[field] = row[field];
  }
  return output;
}

export async function GET(
  _req: Request,
  { params }: { params: { websiteId: string } }
) {
  const supabase = createAdminClient();
  const { data: rawWebsite, error } = await supabase
    .from("websites")
    .select("id,business_id,status")
    .eq("id", params.websiteId)
    .eq("status", "published")
    .single();
  const website = rawWebsite as PublishedWebsiteRecord|null;

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
        ? pick(
            data,
            requestedFields.length ? requestedFields : [...PUBLIC_PROFILE_FIELDS],
            PUBLIC_PROFILE_FIELDS
          )
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

      result.products = (data ?? []).map((row) =>
        pick(
          row,
          requestedFields.length ? requestedFields : [...PUBLIC_PRODUCT_FIELDS],
          PUBLIC_PRODUCT_FIELDS
        )
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

      result.inventory_availability = (data ?? []).map((row) => {
        const safe = pick(
          row,
          requestedFields.length ? requestedFields : [...PUBLIC_INVENTORY_FIELDS],
          PUBLIC_INVENTORY_FIELDS
        );
        return {
          ...safe,
          availability: Number(row.stock_quantity ?? 0) > 0 ? "in_stock" : "out_of_stock"
        };
      });
    }
  }

  return NextResponse.json(
    {
      websiteId: website.id,
      updatedAt: new Date().toISOString(),
      data: result
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*"
      }
    }
  );
}
