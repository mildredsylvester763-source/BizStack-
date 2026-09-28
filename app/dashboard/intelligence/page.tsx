import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { buildCashflowSnapshot, clusterFeedback, parseWhatsAppOrder } from "@/lib/business-intelligence";
import { revalidatePath } from "next/cache";

async function addFeedback(formData: FormData) {
  "use server";
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const message = String(formData.get("message") || "").trim();
  if (!message) return;
  const ratingRaw = String(formData.get("rating") || "");
  const rating = ratingRaw ? Number(ratingRaw) : null;
  const sentiment = rating == null ? null : rating <= 2 ? "negative" : rating >= 4 ? "positive" : "neutral";
  await supabase.from("customer_feedback").insert({ business_id: business.id, channel: "manual", message, rating, sentiment });
  revalidatePath("/dashboard/intelligence");
}

async function parseOrder(formData: FormData) {
  "use server";
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const message = String(formData.get("message") || "").trim();
  if (!message) return;
  const { data: products } = await supabase.from("products").select("id,name,sku,unit_price,stock_quantity").eq("business_id", business.id);
  const parsed = parseWhatsAppOrder(message, products || []);
  await supabase.from("whatsapp_order_events").insert({
    business_id: business.id, sender: "manual-test", message_text: message,
    parsed_items: parsed.items, status: parsed.unresolved.length ? "needs_review" : "parsed"
  });
  revalidatePath("/dashboard/intelligence");
}

export default async function IntelligencePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id,name,currency").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const { data: rule } = await supabase.from("cashflow_alert_rules").select("*").eq("business_id", business.id).maybeSingle();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: allTx }, { data: tx }, { data: invoices }, { data: feedback }, { data: events }] = await Promise.all([
    supabase.from("financial_transactions").select("direction,amount,status").eq("business_id", business.id).eq("status", "posted"),
    supabase.from("financial_transactions").select("direction,amount,status").eq("business_id", business.id).gte("occurred_at", since).eq("status", "posted"),
    supabase.from("invoices").select("total,paid_amount,due_date,status").eq("business_id", business.id).in("status", ["sent","overdue"]).not("due_date", "is", null),
    supabase.from("customer_feedback").select("id,message,sentiment,channel,rating,created_at").eq("business_id", business.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("whatsapp_order_events").select("id,message_text,status,parsed_items,created_at").eq("business_id", business.id).order("created_at", { ascending: false }).limit(10)
  ]);
  const recentInflows = (tx || []).filter(x => x.direction === "inflow").reduce((s, x) => s + Number(x.amount || 0), 0);
  const recentOutflows = (tx || []).filter(x => x.direction === "outflow").reduce((s, x) => s + Number(x.amount || 0), 0);
  const lifetimeInflows = (allTx || []).filter(x => x.direction === "inflow").reduce((s, x) => s + Number(x.amount || 0), 0);
  const lifetimeOutflows = (allTx || []).filter(x => x.direction === "outflow").reduce((s, x) => s + Number(x.amount || 0), 0);
  const currentBalance = lifetimeInflows - lifetimeOutflows;
  const collections = (invoices || []).reduce((s, x) => s + Math.max(0, Number(x.total || 0) - Number(x.paid_amount || 0)), 0);
  const snapshot = buildCashflowSnapshot({
    currentBalance, recentInflows, recentOutflows,
    expectedInvoiceCollections: collections, expectedObligations: (recentOutflows / 30) * (rule?.horizon_days ?? 14),
    horizonDays: rule?.horizon_days ?? 14, minimumBuffer: Number(rule?.minimum_buffer ?? 0)
  });
  const topics = clusterFeedback(feedback || []);
  return <main className="min-h-screen bg-ledger">
    <header className="border-b border-rule bg-white"><div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
      <div><Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link><h1 className="font-display text-2xl mt-1">Business Intelligence</h1></div>
      <span className="text-xs text-ink/45">{business.name}</span>
    </div></header>
    <section className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-ink text-mist p-6"><p className="text-xs uppercase tracking-[.16em] text-mist/50">Cash-flow radar</p>
          <h2 className="font-display text-3xl mt-2">{snapshot.severity === "critical" ? "Shortfall risk detected" : snapshot.severity === "warning" ? "Buffer warning" : "Cash position looks stable"}</h2>
          <p className="mt-3 text-sm text-mist/65">{snapshot.explanation}</p>
          <div className="grid sm:grid-cols-3 gap-3 mt-6">
            <div className="border border-white/10 p-4"><p className="text-xs text-mist/45">Current</p><p className="font-display text-xl mt-1">{business.currency} {snapshot.currentBalance.toLocaleString(undefined,{maximumFractionDigits:2})}</p></div>
            <div className="border border-white/10 p-4"><p className="text-xs text-mist/45">Projected</p><p className="font-display text-xl mt-1">{business.currency} {snapshot.projectedBalance.toLocaleString(undefined,{maximumFractionDigits:2})}</p></div>
            <div className="border border-white/10 p-4"><p className="text-xs text-mist/45">Receivables</p><p className="font-display text-xl mt-1">{business.currency} {snapshot.expectedInflows.toLocaleString(undefined,{maximumFractionDigits:2})}</p></div>
          </div>
        </div>
        <div className="bg-white border border-rule p-6"><p className="text-xs uppercase tracking-[.16em] text-vault">Voice of customer</p><h3 className="font-display text-2xl mt-2">{feedback?.length || 0} feedback items</h3><p className="text-sm text-ink/55 mt-2">Reviews, chats and support notes become ranked themes.</p></div>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border border-rule p-6"><p className="text-xs uppercase tracking-[.16em] text-vault">Customer themes</p>
          <div className="mt-4 divide-y divide-rule">{topics.slice(0,8).map(t => <div key={t.topic} className="py-3 flex justify-between"><div><p className="font-medium capitalize">{t.topic}</p><p className="text-xs text-ink/45">{t.negativeCount} negative · {t.positiveCount} positive</p></div><span className="font-display">{t.feedbackCount}</span></div>)}{!topics.length && <p className="text-sm text-ink/45 py-4">Add feedback to build the first theme map.</p>}</div>
          <form action={addFeedback} className="mt-5 border-t border-rule pt-5"><textarea name="message" required rows={3} className="w-full border border-rule px-3 py-2.5 text-sm" placeholder="Customer said: delivery was two days late..."/><div className="mt-3 flex gap-3"><select name="rating" className="border border-rule px-3 py-2 text-sm"><option value="">No rating</option><option value="1">1 / 5</option><option value="2">2 / 5</option><option value="3">3 / 5</option><option value="4">4 / 5</option><option value="5">5 / 5</option></select><button className="bg-ink text-white px-4 py-2 text-sm">Add feedback</button></div></form>
        </div>
        <div className="bg-white border border-rule p-6"><p className="text-xs uppercase tracking-[.16em] text-vault">WhatsApp order capture</p><h3 className="font-display text-2xl mt-2">Turn a customer message into an order draft</h3><p className="text-sm text-ink/55 mt-2">Matches product names/SKUs, checks stock and flags unresolved items for review.</p>
          <form action={parseOrder} className="mt-5"><textarea name="message" required rows={4} className="w-full border border-rule px-3 py-2.5 text-sm" placeholder="2 Premium Hoodie, 1 Black Cap"/><button className="mt-3 bg-vault text-white px-4 py-2 text-sm">Parse message</button></form>
          <div className="mt-6 border-t border-rule pt-4 space-y-3">{(events || []).map(e => <div key={e.id} className="text-sm flex justify-between gap-3"><span>{e.message_text}</span><span className="text-xs text-ink/45">{e.status}</span></div>)}{!events?.length && <p className="text-xs text-ink/45">No captured order messages yet.</p>}</div>
        </div>
      </div>
    </section>
  </main>;
}