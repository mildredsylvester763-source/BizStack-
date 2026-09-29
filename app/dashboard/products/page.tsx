import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { BizIcon, BizMetric, BizPanel, BizSection, BizStatus, BizTabs } from "@/components/ui/BizStackVisual";

async function addProduct(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
  if (!business) return;
  await supabase.from("products").insert({
    business_id: business.id,
    name: String(formData.get("name") || ""),
    sku: String(formData.get("sku") || "") || null,
    unit: String(formData.get("unit") || "unit"),
    unit_price: Number(formData.get("unit_price")) || 0,
    cost_price: formData.get("cost_price") ? Number(formData.get("cost_price")) : null,
    stock_quantity: Number(formData.get("stock_quantity")) || 0,
    low_stock_threshold: formData.get("low_stock_threshold") ? Number(formData.get("low_stock_threshold")) : 5
  });
  revalidatePath("/dashboard/products");
}

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id,name,currency").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const { data: products } = await supabase.from("products").select("id,name,sku,unit_price,cost_price,stock_quantity,low_stock_threshold,created_at").eq("business_id", business.id).order("created_at", { ascending: false });
  const rows = products ?? [];
  const low = rows.filter(p => p.low_stock_threshold !== null && Number(p.stock_quantity) <= Number(p.low_stock_threshold));
  const stockUnits = rows.reduce((s,p)=>s+Number(p.stock_quantity||0),0);
  const inventoryValue = rows.reduce((s,p)=>s+(Number(p.cost_price||p.unit_price||0)*Number(p.stock_quantity||0)),0);

  return <div className="biz-content">
    <BizSection number="5.3" title="Inventory & Products" subtitle="Know what you sell, what is in stock and what needs attention.">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3"><BizTabs items={["Products","Stock","Low Stock","Suppliers","Orders"]}/><Link href="/dashboard/ai-builder"><span className="biz-button bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white">Ask AI about inventory</span></Link></div>
      <div className="biz-grid biz-grid-4">
        <BizMetric label="Products" value={String(rows.length)} delta="Current product catalog" tone="blue" icon="▦"/>
        <BizMetric label="Stock units" value={String(stockUnits)} delta="Units across all products" tone="cyan" icon="Σ"/>
        <BizMetric label="Low stock" value={String(low.length)} delta={low.length?"Needs review":"No current alerts"} tone="orange" icon="!"/>
        <BizMetric label="Inventory value" value={inventoryValue.toFixed(2)+" "+business.currency} delta="Cost basis where available" tone="green" icon="¤"/>
      </div>

      <div className="grid xl:grid-cols-[1fr_330px] gap-3 mt-3">
        <BizPanel title="Product register" subtitle="Live product and stock records">
          {rows.length===0?<div className="p-9 text-center"><BizIcon tone="green" size="lg">▦</BizIcon><div className="mt-3 text-[10px] text-white/55">No products yet</div><p className="text-[8px] text-white/22 mt-1">Add the first product and it becomes available to invoicing and inventory workflows.</p></div>:
          <>
            <div className="hidden md:grid grid-cols-[1fr_100px_100px_100px_80px] px-4 py-2 border-b border-white/[.07] text-[7px] uppercase tracking-[.13em] text-white/20"><span>Product</span><span>Price</span><span>Stock</span><span>Value</span><span>Status</span></div>
            {rows.map(p=>{const isLow=p.low_stock_threshold!==null&&Number(p.stock_quantity)<=Number(p.low_stock_threshold);return <Link key={p.id} href={"/dashboard/products/"+p.id} className="grid md:grid-cols-[1fr_100px_100px_100px_80px] px-4 py-4 gap-3 items-center border-t border-white/[.05] hover:bg-white/[.025]"><div className="flex items-center gap-2 min-w-0"><BizIcon tone={isLow?"orange":"green"} size="sm">{String(p.name||"P").slice(0,1).toUpperCase()}</BizIcon><div className="min-w-0"><div className="text-[9px] text-white/65 truncate">{p.name}</div><div className="text-[7px] text-white/18 mt-1 truncate">{p.sku||"No SKU"} · {String(p.created_at).slice(0,10)}</div></div></div><div className="text-[8px] text-white/40">{Number(p.unit_price).toFixed(2)}</div><div className={"text-[8px] "+(isLow?"text-orange-300":"text-white/40")}>{p.stock_quantity}</div><div className="text-[8px] text-white/40">{(Number(p.stock_quantity||0)*Number(p.cost_price||p.unit_price||0)).toFixed(0)}</div><BizStatus tone={isLow?"orange":"green"}>{isLow?"Low":"Healthy"}</BizStatus></Link>})}
          </>}
        </BizPanel>

        <BizPanel title="Add product" subtitle="Create a real inventory record">
          <form action={addProduct} className="p-4 space-y-2.5">
            <input name="name" required placeholder="Product name" className="w-full rounded-xl border border-white/[.08] bg-white/[.025] px-3 py-3 text-[8px] text-white outline-none"/>
            <input name="sku" placeholder="SKU" className="w-full rounded-xl border border-white/[.08] bg-white/[.025] px-3 py-3 text-[8px] text-white outline-none"/>
            <div className="grid grid-cols-2 gap-2"><input name="unit" defaultValue="unit" placeholder="Unit" className="rounded-xl border border-white/[.08] bg-white/[.025] px-3 py-3 text-[8px] text-white"/><input name="unit_price" required type="number" min="0" step="0.01" placeholder="Sell price" className="rounded-xl border border-white/[.08] bg-white/[.025] px-3 py-3 text-[8px] text-white"/></div>
            <div className="grid grid-cols-2 gap-2"><input name="cost_price" type="number" min="0" step="0.01" placeholder="Cost price" className="rounded-xl border border-white/[.08] bg-white/[.025] px-3 py-3 text-[8px] text-white"/><input name="stock_quantity" type="number" min="0" placeholder="Starting stock" defaultValue="0" className="rounded-xl border border-white/[.08] bg-white/[.025] px-3 py-3 text-[8px] text-white"/></div>
            <input name="low_stock_threshold" type="number" min="0" placeholder="Low-stock threshold" defaultValue="5" className="w-full rounded-xl border border-white/[.08] bg-white/[.025] px-3 py-3 text-[8px] text-white"/>
            <button className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 py-3 text-[8px] font-semibold text-white">Add product</button>
          </form>
        </BizPanel>
      </div>
    </BizSection>
  </div>;
}
