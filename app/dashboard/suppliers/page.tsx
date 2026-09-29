// @ts-nocheck
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

async function createSupplier(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id,currency").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Supplier name is required.");
  const { error } = await supabase.from("suppliers").insert({
    business_id: business.id,
    name,
    email: String(formData.get("email") || "").trim() || null,
    phone: String(formData.get("phone") || "").trim() || null,
    currency: String(formData.get("currency") || business.currency || "USD").trim().toUpperCase(),
    notes: String(formData.get("notes") || "").trim() || null,
    created_by: user.id
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/suppliers");
}

async function recordPrice(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const supplierId = String(formData.get("supplierId") || "");
  const productId = String(formData.get("productId") || "");
  const cost = Number(formData.get("cost") || 0);
  const currency = String(formData.get("currency") || "USD").trim().toUpperCase();
  if (!supplierId || !productId || !Number.isFinite(cost) || cost < 0) throw new Error("Supplier, product and non-negative cost are required.");

  const { error } = await supabase.rpc("record_supplier_price", {
    p_business_id: business.id,
    p_supplier_id: supplierId,
    p_product_id: productId,
    p_new_cost: cost,
    p_currency: currency,
    p_source: "manual"
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/suppliers");
  revalidatePath("/dashboard/actions");
}

async function acknowledgeAlert(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  await supabase.from("supplier_price_alerts").update({ status: "acknowledged" }).eq("id", String(formData.get("alertId") || "")).eq("business_id", business.id);
  revalidatePath("/dashboard/suppliers");
}

export default async function SuppliersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id,name,currency").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const [{ data: suppliers }, { data: products }, { data: links }, { data: alerts }] = await Promise.all([
    supabase.from("suppliers").select("id,name,email,phone,currency,status").eq("business_id", business.id).order("name"),
    supabase.from("products").select("id,name,sku,unit_price,cost_price,stock_quantity").eq("business_id", business.id).eq("is_active", true).order("name"),
    supabase.from("supplier_products").select("id,supplier_id,product_id,unit_cost,currency,alert_threshold_percent,is_preferred,last_seen_at").eq("business_id", business.id).order("updated_at",{ascending:false}),
    supabase.from("supplier_price_alerts").select("id,supplier_id,product_id,previous_cost,new_cost,change_percent,currency,severity,status,created_at").eq("business_id", business.id).order("created_at",{ascending:false}).limit(30)
  ]);
  const supplierById = new Map((suppliers || []).map((s:any)=>[s.id,s]));
  const productById = new Map((products || []).map((p:any)=>[p.id,p]));

  return <main className="min-h-screen bg-ledger">
    <header className="border-b border-rule bg-white"><div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center"><div><Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link><h1 className="font-display text-2xl mt-1">Suppliers & Cost Alerts</h1></div><Link href="/dashboard/ai-builder" className="text-xs text-vault">AI Builder</Link></div></header>
    <section className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div className="bg-ink text-mist p-6"><p className="text-xs uppercase tracking-[.16em] text-mist/50">Procurement intelligence</p><h2 className="font-display text-3xl mt-2">Know when supplier costs move before your margin disappears.</h2><p className="text-sm text-mist/55 mt-2">Supplier price changes are stored as historical events, compared against your configured threshold and surfaced as actionable alerts.</p></div>

      <div className="grid lg:grid-cols-2 gap-6">
        <form action={createSupplier} className="bg-white border border-rule p-6"><p className="text-xs uppercase tracking-[.16em] text-vault">New supplier</p><div className="grid md:grid-cols-2 gap-4 mt-4"><label className="text-sm">Supplier name<input name="name" required className="mt-2 w-full border border-rule px-3 py-2.5"/></label><label className="text-sm">Currency<input name="currency" maxLength={3} defaultValue={business.currency||"USD"} className="mt-2 w-full border border-rule px-3 py-2.5 uppercase"/></label><label className="text-sm">Email<input name="email" type="email" className="mt-2 w-full border border-rule px-3 py-2.5"/></label><label className="text-sm">Phone<input name="phone" className="mt-2 w-full border border-rule px-3 py-2.5"/></label></div><label className="block text-sm mt-4">Notes<textarea name="notes" rows={3} className="mt-2 w-full border border-rule px-3 py-2.5"/></label><button className="mt-4 bg-ink text-white px-5 py-2.5 text-sm">Add supplier</button></form>

        <form action={recordPrice} className="bg-white border border-rule p-6"><p className="text-xs uppercase tracking-[.16em] text-vault">Record supplier cost</p><div className="grid md:grid-cols-2 gap-4 mt-4"><label className="text-sm">Supplier<select name="supplierId" required className="mt-2 w-full border border-rule px-3 py-2.5"><option value="">Select supplier</option>{(suppliers||[]).map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="text-sm">Product<select name="productId" required className="mt-2 w-full border border-rule px-3 py-2.5"><option value="">Select product</option>{(products||[]).map((p:any)=><option key={p.id} value={p.id}>{p.name}{p.sku?" · "+p.sku:""}</option>)}</select></label><label className="text-sm">New unit cost<input name="cost" required type="number" min="0" step="0.01" className="mt-2 w-full border border-rule px-3 py-2.5"/></label><label className="text-sm">Currency<input name="currency" maxLength={3} defaultValue={business.currency||"USD"} className="mt-2 w-full border border-rule px-3 py-2.5 uppercase"/></label></div><button className="mt-4 bg-vault text-white px-5 py-2.5 text-sm">Record cost</button></form>
      </div>

      <div className="bg-white border border-rule"><div className="p-5 border-b border-rule"><p className="text-xs uppercase tracking-[.16em] text-alert">Actionable alerts</p><h3 className="font-display text-xl mt-1">Supplier price increases</h3></div><div className="divide-y divide-rule">{(alerts||[]).map((a:any)=><div key={a.id} className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"><div><p className="font-medium">{supplierById.get(a.supplier_id)?.name||"Supplier"} · {productById.get(a.product_id)?.name||"Product"}</p><p className="text-sm text-ink/55 mt-1">{Number(a.previous_cost||0).toLocaleString()} → {Number(a.new_cost||0).toLocaleString()} {a.currency} · +{Number(a.change_percent||0).toFixed(2)}%</p><p className="text-xs text-ink/35 mt-1">{new Date(a.created_at).toLocaleString()} · {a.severity}</p></div><div className="flex gap-2 items-center"><span className="text-xs uppercase text-alert">{a.status}</span>{a.status==="pending"&&<form action={acknowledgeAlert}><input type="hidden" name="alertId" value={a.id}/><button className="border border-rule px-3 py-2 text-xs">Acknowledge</button></form>}</div></div>)}{!(alerts||[]).length&&<p className="p-8 text-sm text-ink/45">No supplier price alerts yet.</p>}</div></div>

      <div className="bg-white border border-rule"><div className="p-5 border-b border-rule"><p className="text-xs uppercase tracking-[.16em] text-vault">Supplier-product links</p><h3 className="font-display text-xl mt-1">Current supplier costs</h3></div><div className="divide-y divide-rule">{(links||[]).map((l:any)=><div key={l.id} className="p-4 flex flex-wrap justify-between gap-4"><div><p className="text-sm font-medium">{supplierById.get(l.supplier_id)?.name||"Supplier"} · {productById.get(l.product_id)?.name||"Product"}</p><p className="text-xs text-ink/45 mt-1">Alert threshold {l.alert_threshold_percent}% · {l.is_preferred?"preferred supplier":"standard supplier"}</p></div><div className="text-right"><p className="font-display">{l.currency} {Number(l.unit_cost).toLocaleString()}</p><p className="text-xs text-ink/35 mt-1">{l.last_seen_at?new Date(l.last_seen_at).toLocaleString():"—"}</p></div></div>)}{!(links||[]).length&&<p className="p-8 text-sm text-ink/45">No supplier-product relationships yet.</p>}</div></div>
    </section>
  </main>;
}
