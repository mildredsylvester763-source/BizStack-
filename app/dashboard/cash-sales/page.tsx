import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { runCashSaleBuild } from "@/lib/ai/build-engine/cash-sale-runtime";

async function openSession(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id,currency").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const openingFloat = Number(formData.get("openingFloat") || 0);
  if (!Number.isFinite(openingFloat) || openingFloat < 0) throw new Error("Opening float must be zero or greater.");
  const { data: location } = await supabase.from("business_locations").select("id").eq("business_id", business.id).eq("is_active", true).eq("is_primary", true).maybeSingle();
  const { error } = await supabase.from("cash_register_sessions").insert({
    business_id: business.id,
    location_id: location?.id ?? null,
    opened_by: user.id,
    currency: business.currency || "USD",
    opening_float: openingFloat
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/cash-sales");
}

async function reconcile(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const sessionId = String(formData.get("sessionId") || "");
  const countedCash = Number(formData.get("countedCash") || 0);
  const { error } = await supabase.rpc("reconcile_cash_register_session", {
    p_session_id: sessionId,
    p_counted_cash: countedCash,
    p_notes: String(formData.get("notes") || "").trim() || null
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/cash-sales");
}

async function runSale(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const prompt = String(formData.get("prompt") || "").trim();
  if (!prompt) throw new Error("Describe the sale.");
  await runCashSaleBuild({ businessId: business.id, userId: user.id, prompt, mode: "auto_execute" });
  revalidatePath("/dashboard/cash-sales");
  revalidatePath("/dashboard/ai-builder");
}

export default async function CashSalesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id,name,currency").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const { data: session } = await supabase.from("cash_register_sessions").select("id,status,currency,opening_float,expected_cash,sales_count,cash_sales_total,card_sales_total,transfer_sales_total,other_sales_total,opened_at,closing_cash_counted,cash_variance").eq("business_id", business.id).eq("status","open").maybeSingle();
  const { data: rawSales } = await supabase.from("cash_sales").select("id,sale_number,sale_at,payment_method,total,currency,customer:customers(name)").eq("business_id", business.id).order("sale_at",{ascending:false}).limit(25);
  const sales = (rawSales ?? []).map((sale: any) => ({ ...sale, customerName: Array.isArray(sale.customer) ? sale.customer[0]?.name ?? null : sale.customer?.name ?? null }));
  return <main className="min-h-screen bg-ledger">
    <header className="border-b border-rule bg-white">
      <div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
        <div><Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link><h1 className="font-display text-2xl mt-1">Cash Sales & Reconciliation</h1></div>
        <Link href="/dashboard/ai-builder" className="text-xs text-vault">AI Builder</Link>
      </div>
    </header>
    <section className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {!session ? <form action={openSession} className="bg-white border border-rule p-6">
        <p className="text-xs uppercase tracking-[.16em] text-vault">Open today's register</p>
        <h2 className="font-display text-3xl mt-2">Start a cash session</h2>
        <p className="text-sm text-ink/55 mt-2">The session becomes the accounting boundary for cash sales, inventory movements and end-of-day reconciliation.</p>
        <div className="mt-5 flex flex-wrap gap-3 items-end"><label className="text-sm">Opening float<input name="openingFloat" type="number" min="0" step="0.01" defaultValue="0" className="mt-2 border border-rule px-3 py-2.5 block"/></label><button className="bg-ink text-white px-5 py-2.5 text-sm">Open register</button></div>
      </form> : <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6">
        <div className="bg-ink text-mist p-6">
          <p className="text-xs uppercase tracking-[.16em] text-mist/55">Register open</p>
          <h2 className="font-display text-3xl mt-2">{business.currency} daily register</h2>
          <p className="text-sm text-mist/55 mt-2">Opened {new Date(session.opened_at).toLocaleString()}</p>
          <div className="grid sm:grid-cols-3 gap-3 mt-6">
            <div className="border border-white/10 p-4"><p className="text-xs text-mist/45">Expected cash</p><p className="font-display text-2xl mt-1">{Number(session.expected_cash||0).toLocaleString()}</p></div>
            <div className="border border-white/10 p-4"><p className="text-xs text-mist/45">Sales</p><p className="font-display text-2xl mt-1">{session.sales_count}</p></div>
            <div className="border border-white/10 p-4"><p className="text-xs text-mist/45">Cash sales</p><p className="font-display text-2xl mt-1">{Number(session.cash_sales_total||0).toLocaleString()}</p></div>
          </div>
        </div>
        <form action={reconcile} className="bg-white border border-rule p-6">
          <input type="hidden" name="sessionId" value={session.id}/>
          <p className="text-xs uppercase tracking-[.16em] text-vault">End of day</p>
          <h3 className="font-display text-2xl mt-2">Reconcile the drawer</h3>
          <label className="block text-sm mt-5">Counted cash<input name="countedCash" type="number" min="0" step="0.01" required className="mt-2 w-full border border-rule px-3 py-2.5"/></label>
          <label className="block text-sm mt-4">Notes<textarea name="notes" rows={3} className="mt-2 w-full border border-rule px-3 py-2.5"/></label>
          <button className="mt-4 bg-vault text-white px-5 py-2.5 text-sm">Reconcile & close</button>
        </form>
      </div>}
      {session && <form action={runSale} className="bg-white border border-rule p-6">
        <p className="text-xs uppercase tracking-[.16em] text-vault">AI cash sale</p>
        <h2 className="font-display text-2xl mt-2">Record a sale in plain language</h2>
        <p className="text-sm text-ink/50 mt-2">The engine resolves the real products, checks stock, records the sale, decrements inventory and updates the session totals.</p>
        <textarea name="prompt" required rows={5} className="mt-5 w-full border border-rule px-4 py-3 text-sm" placeholder="Cash sale 2 Premium Hoodie at 25000, cash received 60000."/>
        <button className="mt-4 bg-ink text-white px-5 py-3 text-sm">Record sale</button>
      </form>}
      <div className="bg-white border border-rule">
        <div className="p-5 border-b border-rule"><p className="text-xs uppercase tracking-[.16em] text-vault">Recent sales</p><h3 className="font-display text-xl mt-1">Register activity</h3></div>
        <div className="divide-y divide-rule">{(sales||[]).map(s=><div key={s.id} className="p-4 flex flex-wrap justify-between gap-3"><div><p className="text-sm font-medium">{s.sale_number}</p><p className="text-xs text-ink/45 mt-1">{s.customerName||"Walk-in customer"} · {s.payment_method} · {new Date(s.sale_at).toLocaleString()}</p></div><p className="font-display">{s.currency} {Number(s.total||0).toLocaleString()}</p></div>)}{!(sales||[]).length&&<p className="p-6 text-sm text-ink/45">No sales recorded yet.</p>}</div>
      </div>
    </section>
  </main>;
}