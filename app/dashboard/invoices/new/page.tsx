"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { calculateInvoiceTotal } from "@/lib/invoices";

type Customer = { id: string; name: string };
type LineItem = { description: string; quantity: number; unit_price: number };
type MethodKey = "bank_transfer" | "qr" | "card";

const METHOD_META: Record<MethodKey, { label: string; detail: string; icon: string; tone: string }> = {
  bank_transfer: { label: "Bank transfer", detail: "Show your business bank details on the invoice.", icon: "₦", tone: "from-cyan-500/20 to-blue-500/10 border-cyan-400/25" },
  qr: { label: "QR payment", detail: "Generate a scannable QR payment block for the customer.", icon: "▦", tone: "from-violet-500/20 to-fuchsia-500/10 border-violet-400/25" },
  card: { label: "Card payment", detail: "Let customers choose card when a payment processor is connected.", icon: "▣", tone: "from-blue-500/20 to-indigo-500/10 border-blue-400/25" }
};

export default function NewInvoicePage() {
  const router = useRouter();
  const supabase = createClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unit_price: 0 }]);
  const [methods, setMethods] = useState<Record<MethodKey, boolean>>({ bank_transfer: true, qr: true, card: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
      if (!business) return;
      const { data } = await supabase.from("customers").select("id, name").eq("business_id", business.id).order("name");
      setCustomers(data ?? []);
    }
    load();
  }, [supabase]);

  function updateItem(index: number, field: keyof LineItem, value: string) {
    setItems(prev => prev.map((item, i) => i === index
      ? { ...item, [field]: field === "description" ? value : Number(value) }
      : item
    ));
  }

  function addLine() {
    setItems(prev => [...prev, { description: "", quantity: 1, unit_price: 0 }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const selectedMethods = (Object.entries(methods) as [MethodKey, boolean][])
      .filter(([, enabled]) => enabled)
      .map(([key]) => key);

    if (selectedMethods.length === 0) {
      setError("Choose at least one payment method.");
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Your session expired — please log in again.");
      setLoading(false);
      return;
    }

    const { data: business } = await supabase.from("businesses").select("id, currency").eq("owner_id", user.id).single();
    if (!business) {
      setError("Business not found.");
      setLoading(false);
      return;
    }

    const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true }).eq("business_id", business.id);
    const invoiceNumber = \`INV-\${String((count ?? 0) + 1).padStart(4, "0")}\`;

    const { data: invoice, error: invoiceError } = await supabase.from("invoices").insert({
      business_id: business.id,
      customer_id: customerId || null,
      invoice_number: invoiceNumber,
      status: "draft",
      due_date: dueDate || null,
      currency: business.currency,
      payment_methods: selectedMethods
    }).select().single();

    if (invoiceError || !invoice) {
      setError(invoiceError?.message ?? "Could not create invoice.");
      setLoading(false);
      return;
    }

    const itemRows = items.filter(i => i.description.trim() !== "").map(i => ({
      invoice_id: invoice.id,
      description: i.description,
      quantity: i.quantity,
      unit_price: i.unit_price
    }));

    if (itemRows.length > 0) {
      const { error: itemsError } = await supabase.from("invoice_items").insert(itemRows);
      if (itemsError) {
        setError(itemsError.message);
        setLoading(false);
        return;
      }
    }

    const total = calculateInvoiceTotal(items);
    const customerName = customers.find(c => c.id === customerId)?.name ?? "a customer";
    await supabase.from("events").insert({
      business_id: business.id,
      event_type: "invoice.created",
      summary: \`Invoice \${invoiceNumber} created for \${customerName} — \${total.toFixed(2)} \${business.currency}\`,
      evidence: { invoice_id: invoice.id, total, currency: business.currency, payment_methods: selectedMethods },
      status: "info"
    });

    router.push(\`/dashboard/invoices/\${invoice.id}\`);
  }

  const total = useMemo(() => calculateInvoiceTotal(items), [items]);
  const enabledMethods = (Object.entries(methods) as [MethodKey, boolean][]).filter(([, value]) => value).map(([key]) => METHOD_META[key].label);

  return (
    <main className="biz-page min-h-screen">
      <section className="biz-content max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-4">
          <Link href="/dashboard/invoices" className="text-[9px] text-white/35 hover:text-white/65">← Invoices</Link>
          <span className="biz-chip">Draft · New invoice</span>
        </div>

        <div className="mb-5">
          <div className="biz-section-kicker">Invoices & Payments</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight text-white">Create a payment-ready invoice</h1>
          <p className="biz-section-subtitle mt-2 max-w-2xl">Choose every payment route the customer can see on the invoice. Bank transfer, QR payment and card payment are independent options.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid xl:grid-cols-[1fr_390px] gap-4 items-start">
            <div className="space-y-4">
              <section className="biz-panel">
                <div className="biz-panel-head">
                  <div>
                    <h2 className="biz-title">Invoice details</h2>
                    <p className="biz-subtitle">Customer, due date and line items</p>
                  </div>
                  <span className="biz-status border-blue-400/20 bg-blue-400/10 text-blue-300">Live records</span>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-[8px] uppercase tracking-[.14em] text-white/28 mb-2">Customer</label>
                    {customers.length === 0 ? (
                      <div className="rounded-xl border border-orange-400/20 bg-orange-400/[.06] px-3 py-3 text-[9px] text-orange-200/70">
                        No customers yet. <Link href="/dashboard/customers" className="text-orange-200 underline">Add a customer</Link> before creating this invoice.
                      </div>
                    ) : (
                      <select value={customerId} onChange={e => setCustomerId(e.target.value)} required className="w-full rounded-xl border border-white/[.09] bg-white/[.035] px-3 py-3 text-[10px] text-white outline-none focus:border-blue-400/35">
                        <option value="">Select a customer</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-[8px] uppercase tracking-[.14em] text-white/28 mb-2">Due date</span>
                      <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full rounded-xl border border-white/[.09] bg-white/[.035] px-3 py-3 text-[10px] text-white outline-none" />
                    </label>
                    <div>
                      <span className="block text-[8px] uppercase tracking-[.14em] text-white/28 mb-2">Selected payment routes</span>
                      <div className="rounded-xl border border-blue-400/15 bg-blue-400/[.05] px-3 py-3 text-[9px] text-blue-100/70">{enabledMethods.join(" · ") || "None"}</div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[8px] uppercase tracking-[.14em] text-white/28">Line items</label>
                      <button type="button" onClick={addLine} className="text-[8px] text-blue-300 hover:text-blue-200">+ Add line</button>
                    </div>
                    <div className="rounded-xl border border-white/[.07] overflow-hidden">
                      <div className="grid grid-cols-[1fr_70px_100px] gap-2 px-3 py-2 bg-white/[.025] text-[7px] uppercase tracking-[.12em] text-white/20">
                        <span>Description</span><span className="text-right">Qty</span><span className="text-right">Unit price</span>
                      </div>
                      {items.map((item, i) => (
                        <div key={i} className="grid grid-cols-[1fr_70px_100px] gap-2 px-3 py-2 border-t border-white/[.06]">
                          <input value={item.description} onChange={e => updateItem(i, "description", e.target.value)} placeholder="Service or product" className="min-w-0 rounded-lg border border-white/[.06] bg-white/[.02] px-2.5 py-2 text-[9px] text-white outline-none" />
                          <input type="number" min={0} value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} className="rounded-lg border border-white/[.06] bg-white/[.02] px-2 py-2 text-[9px] text-white outline-none text-right" />
                          <input type="number" min={0} step="0.01" value={item.unit_price} onChange={e => updateItem(i, "unit_price", e.target.value)} className="rounded-lg border border-white/[.06] bg-white/[.02] px-2 py-2 text-[9px] text-white outline-none text-right" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="biz-panel">
                <div className="biz-panel-head">
                  <div>
                    <h2 className="biz-title">Accept payment via</h2>
                    <p className="biz-subtitle">These choices appear to the customer when they open the invoice.</p>
                  </div>
                  <span className="biz-chip">3 options</span>
                </div>
                <div className="p-4 grid md:grid-cols-3 gap-3">
                  {(Object.keys(METHOD_META) as MethodKey[]).map(key => {
                    const meta = METHOD_META[key];
                    const enabled = methods[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setMethods(prev => ({ ...prev, [key]: !prev[key] }))}
                        className={"text-left rounded-2xl border p-4 transition " + (enabled ? "bg-gradient-to-br " + meta.tone + " shadow-[0_8px_30px_rgba(35,91,255,.08)]" : "border-white/[.07] bg-white/[.02] opacity-55 hover:opacity-85")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.07] text-[11px] text-white/70">{meta.icon}</div>
                          <span className={"biz-status " + (enabled ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/[.04] text-white/30")}>{enabled ? "Enabled" : "Off"}</span>
                        </div>
                        <div className="mt-4 text-[10px] font-semibold text-white/80">{meta.label}</div>
                        <p className="mt-1 text-[8px] leading-4 text-white/32">{meta.detail}</p>
                      </button>
                    );
                  })}
                </div>
                <div className="px-4 pb-4">
                  <div className="rounded-xl border border-indigo-400/15 bg-indigo-400/[.045] px-3 py-3 text-[8px] leading-4 text-indigo-100/50">
                    Card payment is now a selectable invoice method. A real card checkout still requires an active payment processor connection such as Stripe; BizStack will not pretend the charge completed without a verified processor response.
                  </div>
                </div>
              </section>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-16">
              <section className="biz-panel overflow-visible">
                <div className="p-5 bg-gradient-to-br from-blue-500/[.12] via-indigo-500/[.07] to-violet-500/[.12]">
                  <div className="text-[8px] uppercase tracking-[.18em] text-blue-200/50">Invoice preview</div>
                  <div className="mt-3 text-3xl font-semibold tracking-tight text-white">{total.toFixed(2)}</div>
                  <div className="mt-1 text-[8px] text-white/30">Invoice total · live calculation</div>
                  <div className="mt-5 h-px bg-white/[.08]" />
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-[8px]"><span className="text-white/30">Customer</span><span className="text-white/65">{customers.find(c => c.id === customerId)?.name || "Not selected"}</span></div>
                    <div className="flex justify-between text-[8px]"><span className="text-white/30">Due</span><span className="text-white/65">{dueDate || "Not set"}</span></div>
                    <div className="flex justify-between text-[8px]"><span className="text-white/30">Payment routes</span><span className="text-right text-white/65 max-w-[190px]">{enabledMethods.join(", ") || "None"}</span></div>
                  </div>
                </div>
                <div className="p-4 border-t border-white/[.07]">
                  {error && <div className="mb-3 rounded-xl border border-rose-400/20 bg-rose-400/[.07] px-3 py-3 text-[9px] text-rose-200">{error}</div>}
                  <button type="submit" disabled={loading || customers.length === 0} className="w-full rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-3 text-[9px] font-semibold text-white shadow-[0_10px_28px_rgba(57,84,255,.25)] disabled:opacity-30">
                    {loading ? "Creating invoice…" : "Create invoice"}
                  </button>
                </div>
              </section>

              <div className="biz-panel p-4">
                <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-400/10 text-emerald-300 text-[9px]">✓</span><span className="text-[9px] font-medium text-white/70">Payment choices stay on the invoice</span></div>
                <p className="mt-2 text-[8px] leading-4 text-white/25">Your invoice records the selected routes so the customer sees the same options later.</p>
              </div>
            </aside>
          </div>
        </form>
      </section>
    </main>
  );
}
