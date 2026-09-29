// @ts-nocheck
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

async function saveRate(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const fromCurrency = String(formData.get("fromCurrency") || "").trim().toUpperCase();
  const toCurrency = String(formData.get("toCurrency") || "").trim().toUpperCase();
  const rate = Number(formData.get("rate") || 0);
  if (!fromCurrency || !toCurrency || fromCurrency === toCurrency || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("Enter two different currencies and a positive FX rate.");
  }
  const { error } = await supabase.rpc("set_business_exchange_rate", {
    p_business_id: business.id,
    p_from_currency: fromCurrency,
    p_to_currency: toCurrency,
    p_rate: rate,
    p_source: "manual",
    p_notes: String(formData.get("notes") || "").trim() || null
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/currencies");
}

export default async function CurrenciesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id,name,currency").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const { data: rates } = await supabase
    .from("business_exchange_rates")
    .select("id,from_currency,to_currency,rate,source,effective_at,is_active,notes")
    .eq("business_id", business.id)
    .order("effective_at", { ascending: false })
    .limit(50);

  return (
    <main className="min-h-screen bg-ledger">
      <header className="border-b border-rule bg-white">
        <div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
          <div><Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link><h1 className="font-display text-2xl mt-1">Multi-Currency Books</h1></div>
          <span className="text-xs text-ink/45">Base currency: {business.currency || "USD"}</span>
        </div>
      </header>
      <section className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-ink text-mist p-6">
          <p className="text-xs uppercase tracking-[.16em] text-mist/50">Dual-currency accounting</p>
          <h2 className="font-display text-3xl mt-2">Keep native transaction value and functional value together.</h2>
          <p className="text-sm text-mist/60 mt-2 max-w-3xl">
            Transactions preserve the original currency, the base-currency amount, the exact FX rate used and the rate source. Updating a rate never rewrites historical transaction snapshots.
          </p>
        </div>

        <form action={saveRate} className="bg-white border border-rule p-6">
          <p className="text-xs uppercase tracking-[.16em] text-vault">Add / replace a rate</p>
          <div className="grid md:grid-cols-4 gap-4 mt-5 items-end">
            <label className="text-sm">From currency<input name="fromCurrency" required maxLength={3} placeholder="USD" className="mt-2 w-full border border-rule px-3 py-2.5 uppercase"/></label>
            <label className="text-sm">To currency<input name="toCurrency" required maxLength={3} defaultValue={business.currency || "USD"} className="mt-2 w-full border border-rule px-3 py-2.5 uppercase"/></label>
            <label className="text-sm">Rate<input name="rate" required type="number" min="0.0000000001" step="0.0000000001" placeholder="1500" className="mt-2 w-full border border-rule px-3 py-2.5"/></label>
            <button className="bg-vault text-white px-4 py-2.5 text-sm">Save rate</button>
          </div>
          <label className="block text-sm mt-4">Note<textarea name="notes" rows={2} className="mt-2 w-full border border-rule px-3 py-2.5" placeholder="Manual treasury rate for September 2026"/></label>
        </form>

        <div className="bg-white border border-rule overflow-hidden">
          <div className="p-5 border-b border-rule"><p className="text-xs uppercase tracking-[.16em] text-vault">Rate history</p><h3 className="font-display text-xl mt-1">Current and previous business rates</h3></div>
          <div className="divide-y divide-rule">
            {(rates || []).map((rate) => (
              <div key={rate.id} className="p-4 flex flex-wrap justify-between gap-4">
                <div><p className="font-medium">{rate.from_currency} → {rate.to_currency}</p><p className="text-xs text-ink/45 mt-1">{rate.source} · {new Date(rate.effective_at).toLocaleString()}</p>{rate.notes && <p className="text-xs text-ink/50 mt-1">{rate.notes}</p>}</div>
                <div className="text-right"><p className="font-display text-xl">{Number(rate.rate).toLocaleString(undefined,{maximumFractionDigits:10})}</p><p className={"text-[10px] uppercase tracking-[.12em] mt-1 "+(rate.is_active?"text-vault":"text-ink/30")}>{rate.is_active?"active":"superseded"}</p></div>
              </div>
            ))}
            {!(rates || []).length && <p className="p-8 text-sm text-ink/45">No FX rates yet. Add one to enable foreign-currency AI money entries.</p>}
          </div>
        </div>
      </section>
    </main>
  );
}
