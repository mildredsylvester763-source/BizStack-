"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

type Customer = { id: string; name: string; email: string | null; phone: string | null };
type LineItem = { description: string; quantity: number; unit_price: number };

const PAYMENT_TERMS = ["Due on receipt", "Net 7", "Net 15", "Net 30", "Net 45", "Net 60"];

export default function NewInvoicePage() {
  const router = useRouter();
  const supabase = createClient();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Due on receipt");
  const [reference, setReference] = useState("");
  const [purchaseOrder, setPurchaseOrder] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("Payment is due according to the terms stated above.");
  const [discountType, setDiscountType] = useState<"none" | "percentage" | "fixed">("none");
  const [discountValue, setDiscountValue] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxName, setTaxName] = useState("Tax");
  const [taxRate, setTaxRate] = useState(0);
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unit_price: 0 }]);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: business } = await supabase.from("businesses").select("id, currency").eq("owner_id", user.id).single();
      if (!business) return;
      setCurrency(business.currency || "USD");
      const { data: settings } = await supabase.from("business_settings").select("tax_mode, default_tax_rate, default_tax_name, tax_jurisdiction, invoice_settings").eq("business_id", business.id).maybeSingle();
      if (settings) {
        setTaxEnabled(settings.tax_mode !== "disabled" && Boolean(settings.default_tax_rate));
        setTaxRate(Number(settings.default_tax_rate || 0));
        setTaxName(settings.default_tax_name || "Tax");
      }
      const { data } = await supabase.from("customers").select("id, name, email, phone").eq("business_id", business.id).order("name");
      setCustomers(data ?? []);
    }
    load();
  }, [supabase]);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Math.max(0, item.quantity) * Math.max(0, item.unit_price), 0), [items]);
  const discountAmount = discountType === "percentage"
    ? Math.min(subtotal, subtotal * Math.max(0, discountValue) / 100)
    : discountType === "fixed"
      ? Math.min(subtotal, Math.max(0, discountValue))
      : 0;
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxAmount = taxEnabled ? taxable * Math.max(0, taxRate) / 100 : 0;
  const total = taxable + taxAmount;

  function updateItem(index: number, field: keyof LineItem, value: string) {
    setItems(prev => prev.map((item, i) => i === index ? {
      ...item,
      [field]: field === "description" ? value : Number(value)
    } : item));
  }

  function addLine() {
    setItems(prev => [...prev, { description: "", quantity: 1, unit_price: 0 }]);
  }

  function removeLine(index: number) {
    setItems(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Your session expired — please log in again."); setLoading(false); return; }

    const { data: business } = await supabase.from("businesses").select("id, currency, name").eq("owner_id", user.id).single();
    if (!business) { setError("Business not found."); setLoading(false); return; }

    if (!customerId) { setError("Choose a customer."); setLoading(false); return; }
    const validItems = items.filter(i => i.description.trim() && i.quantity > 0 && i.unit_price >= 0);
    if (!validItems.length) { setError("Add at least one valid line item."); setLoading(false); return; }

    const { data: customer } = await supabase.from("customers").select("id, name").eq("id", customerId).eq("business_id", business.id).single();
    if (!customer) { setError("Customer not found."); setLoading(false); return; }

    const { data: generatedInvoiceNumber, error: numberError } = await supabase.rpc("next_invoice_number", { p_business_id: business.id });
    if (numberError || !generatedInvoiceNumber) { setError(numberError?.message ?? "Could not generate an invoice number."); setLoading(false); return; }
    const invoiceNumber = String(generatedInvoiceNumber);

    const { data: invoice, error: invoiceError } = await supabase.from("invoices").insert({
      business_id: business.id,
      customer_id: customerId,
      invoice_number: invoiceNumber,
      status: "draft",
      issue_date: issueDate || new Date().toISOString().slice(0, 10),
      due_date: dueDate || null,
      payment_terms: paymentTerms,
      reference: reference.trim() || null,
      purchase_order: purchaseOrder.trim() || null,
      notes: notes.trim() || null,
      terms_and_conditions: terms.trim() || null,
      discount_type: discountType,
      discount_value: discountValue,
      tax_rate: taxEnabled ? taxRate : 0,
      tax_enabled: taxEnabled,
      tax_name: taxEnabled ? taxName.trim() || "Tax" : null,
      tax_treatment: taxEnabled ? "standard" : "none",
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total,
      currency: business.currency || currency
    }).select("id").single();

    if (invoiceError || !invoice) {
      setError(invoiceError?.message ?? "Could not create invoice.");
      setLoading(false);
      return;
    }

    const { error: itemError } = await supabase.from("invoice_items").insert(validItems.map(item => ({
      invoice_id: invoice.id,
      description: item.description.trim(),
      quantity: item.quantity,
      unit_price: item.unit_price
    })));

    if (itemError) {
      await supabase.from("invoices").delete().eq("id", invoice.id).eq("business_id", business.id);
      setError(itemError.message);
      setLoading(false);
      return;
    }

    await supabase.from("events").insert({
      business_id: business.id,
      event_type: "invoice.created",
      summary: `Invoice ${invoiceNumber} created for ${customer.name} — ${total.toFixed(2)} ${business.currency}`,
      evidence: { invoice_id: invoice.id, invoice_number: invoiceNumber, subtotal, discountAmount, taxAmount, total, currency: business.currency },
      status: "info"
    });

    router.push(`/dashboard/invoices/${invoice.id}`);
  }

  return (
    <main className="min-h-screen bg-[#f4f1ea] text-[#151817]">
      <header className="border-b border-black/10 bg-[#fbfaf7]/95 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/dashboard/invoices" className="text-sm text-ink/50 hover:text-ink">← Back to invoices</Link>
          <span className="text-xs uppercase tracking-[0.16em] text-ink/35">Invoice builder</span>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8"><div className="inline-flex items-center gap-2 rounded-full bg-[#183f38] text-white px-3 py-1.5 text-[10px] uppercase tracking-[.16em] mb-4">BizStack · Commercial Studio</div>
          <p className="text-xs uppercase tracking-[0.18em] text-vault mb-2">Money in</p>
          <h1 className="font-display text-4xl text-ink">Create a professional invoice</h1>
          <p className="text-ink/55 mt-2 max-w-2xl">Capture the full commercial context now so the invoice can later power payments, reminders, accounting, customer history and AI workflows.</p>
        </div>

        <form onSubmit={handleSubmit} className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start"><div className="space-y-6">
          <section className="bg-white border border-rule p-6">
            <h2 className="font-display text-xl text-ink mb-5">Invoice details</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <label className="text-sm text-ink/65">Customer
                <select value={customerId} onChange={e => setCustomerId(e.target.value)} required className="mt-1.5 w-full border border-rule px-3 py-2.5 bg-white text-sm">
                  <option value="">Select customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="text-sm text-ink/65">Issue date
                <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="mt-1.5 w-full border border-rule px-3 py-2.5 text-sm" />
              </label>
              <label className="text-sm text-ink/65">Due date
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="mt-1.5 w-full border border-rule px-3 py-2.5 text-sm" />
              </label>
              <label className="text-sm text-ink/65">Payment terms
                <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} className="mt-1.5 w-full border border-rule px-3 py-2.5 bg-white text-sm">
                  {PAYMENT_TERMS.map(t => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label className="text-sm text-ink/65">Reference
                <input value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. Project / client ref" className="mt-1.5 w-full border border-rule px-3 py-2.5 text-sm" />
              </label>
              <label className="text-sm text-ink/65">Purchase order
                <input value={purchaseOrder} onChange={e => setPurchaseOrder(e.target.value)} placeholder="Optional PO number" className="mt-1.5 w-full border border-rule px-3 py-2.5 text-sm" />
              </label>
            </div>
          </section>

          <section className="bg-white border border-rule p-6">
            <div className="flex items-center justify-between mb-5">
              <div><h2 className="font-display text-xl text-ink">Line items</h2><p className="text-xs text-ink/45 mt-1">Products, services, quantities and unit pricing.</p></div>
              <button type="button" onClick={addLine} className="text-sm text-vault font-medium">+ Add line</button>
            </div>
            <div className="hidden md:grid grid-cols-[1fr_110px_150px_120px_36px] gap-3 text-[11px] uppercase tracking-wider text-ink/35 pb-2">
              <span>Description</span><span>Qty</span><span>Unit price</span><span>Amount</span><span />
            </div>
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="grid md:grid-cols-[1fr_110px_150px_120px_36px] gap-3 items-center">
                  <input value={item.description} onChange={e => updateItem(i, "description", e.target.value)} placeholder="Product or service description" className="border border-rule px-3 py-2.5 text-sm" />
                  <input type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} className="border border-rule px-3 py-2.5 text-sm" />
                  <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(i, "unit_price", e.target.value)} className="border border-rule px-3 py-2.5 text-sm" />
                  <div className="text-sm text-ink font-medium">{(item.quantity * item.unit_price).toFixed(2)} {currency}</div>
                  <button type="button" onClick={() => removeLine(i)} className="text-ink/35 hover:text-alert" aria-label="Remove line">×</button>
                </div>
              ))}
            </div>
          </section>

          <section className="grid lg:grid-cols-[1fr_360px] gap-6">
            <div className="bg-white border border-rule p-6 space-y-5">
              <h2 className="font-display text-xl text-ink">Commercial notes</h2>
              <label className="block text-sm text-ink/65">Customer note
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Thank you for your business..." className="mt-1.5 w-full border border-rule px-3 py-2.5 text-sm resize-y" />
              </label>
              <label className="block text-sm text-ink/65">Terms & conditions
                <textarea value={terms} onChange={e => setTerms(e.target.value)} rows={4} className="mt-1.5 w-full border border-rule px-3 py-2.5 text-sm resize-y" />
              </label>
            </div>

            <div className="bg-white border border-rule p-6">
              <h2 className="font-display text-xl text-ink mb-5">Totals</h2>
              <div className="space-y-4">
                <div className="flex justify-between text-sm"><span className="text-ink/55">Subtotal</span><span>{subtotal.toFixed(2)} {currency}</span></div>
                <div className="grid grid-cols-[1fr_100px] gap-2">
                  <select value={discountType} onChange={e => setDiscountType(e.target.value as typeof discountType)} className="border border-rule px-3 py-2 text-sm">
                    <option value="none">No discount</option><option value="percentage">Discount %</option><option value="fixed">Fixed discount</option>
                  </select>
                  <input type="number" min="0" step="0.01" value={discountValue} onChange={e => setDiscountValue(Number(e.target.value))} disabled={discountType === "none"} className="border border-rule px-3 py-2 text-sm disabled:opacity-40" />
                </div>
                <div className="flex justify-between text-sm"><span className="text-ink/55">Discount</span><span>-{discountAmount.toFixed(2)} {currency}</span></div>
                <label className="flex items-center justify-between gap-4 text-sm"><span className="text-ink/55">Apply tax to this invoice</span><input type="checkbox" checked={taxEnabled} onChange={e => setTaxEnabled(e.target.checked)} /></label>
                {taxEnabled && <div className="grid grid-cols-[1fr_100px] gap-2"><input value={taxName} onChange={e => setTaxName(e.target.value)} placeholder="VAT / GST / Sales tax" className="border border-rule px-3 py-2 text-sm" /><input type="number" min="0" step="0.01" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} className="border border-rule px-3 py-2 text-right" /></div>}
                {taxEnabled && <div className="flex justify-between text-sm"><span className="text-ink/55">{taxName || "Tax"}</span><span>{taxAmount.toFixed(2)} {currency}</span></div>}
                <div className="border-t border-ink pt-4 flex justify-between items-end"><span className="text-ink/60">Total</span><span className="font-display text-2xl text-ink">{total.toFixed(2)} {currency}</span></div>
              </div>
            </div>
          </section>

          {error && <p className="text-sm text-alert bg-alert/5 border border-alert/20 p-3">{error}</p>}
          <div className="flex justify-end gap-3">
            <Link href="/dashboard/invoices" className="px-5 py-3 text-sm text-ink/60">Cancel</Link>
            <button type="submit" disabled={loading || customers.length === 0} className="bg-ink text-mist px-7 py-3 text-sm font-medium hover:bg-vaultDeep transition-colors disabled:opacity-50">
              {loading ? "Creating invoice..." : "Create professional invoice"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
