
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { calculateInvoiceTotal } from "@/lib/invoices";

type Customer = { id: string; name: string; email?: string | null; phone?: string | null };
type LineItem = { description: string; quantity: number; unit_price: number };
type MethodKey = "bank_transfer" | "qr" | "card" | "cash";
type InspectorKey = "customization" | "payments" | "options" | "design" | "scheduling";

const METHOD_META: Record<MethodKey, { label: string; detail: string; icon: string }> = {
  bank_transfer: { label: "Bank transfer", detail: "Show bank details and transfer instructions.", icon: "₦" },
  qr: { label: "QR payment", detail: "Provide a scannable payment route.", icon: "▦" },
  card: { label: "Card payment", detail: "Enable card checkout when a processor is connected.", icon: "▣" },
  cash: { label: "Cash", detail: "Record offline settlement.", icon: "◉" }
};

export default function NewInvoicePage() {
  const router = useRouter();
  const supabase = createClient();
  const attachmentRef = useRef<HTMLInputElement>(null);

  const [business, setBusiness] = useState<{
    id: string; name: string; currency: string;
    bank_name?: string | null; bank_account_name?: string | null; bank_account_number?: string | null;
  } | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("1001");
  const [terms, setTerms] = useState("Net 30");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unit_price: 0 }]);
  const [methods, setMethods] = useState<Record<MethodKey, boolean>>({
    bank_transfer: true, qr: true, card: true, cash: false
  });
  const [inspector, setInspector] = useState<Record<InspectorKey, boolean>>({
    customization: false, payments: true, options: true, design: false, scheduling: false
  });
  const [tipEnabled, setTipEnabled] = useState(false);
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [shippingEnabled, setShippingEnabled] = useState(false);
  const [multicurrency, setMulticurrency] = useState(false);
  const [lateFeeEnabled, setLateFeeEnabled] = useState(true);
  const [customerNote, setCustomerNote] = useState("Thank you for your business.");
  const [statementMemo, setStatementMemo] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: b } = await supabase
        .from("businesses")
        .select("id,name,currency,bank_name,bank_account_name,bank_account_number")
        .eq("owner_id", user.id)
        .single();
      if (!b) return;
      setBusiness(b);

      const { data: c } = await supabase
        .from("customers")
        .select("id,name,email,phone")
        .eq("business_id", b.id)
        .order("name");
      setCustomers(c ?? []);

      const { count } = await supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("business_id", b.id);
      setInvoiceNo(String((count ?? 0) + 1).padStart(4, "0"));

      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + 30);
      setDueDate(nextDue.toISOString().slice(0, 10));
    })();
  }, [supabase]);

  const total = useMemo(() => calculateInvoiceTotal(items), [items]);
  const customer = customers.find(c => c.id === customerId);
  const enabledMethods = (Object.entries(methods) as [MethodKey, boolean][]).filter(([, enabled]) => enabled);
  const money = total.toFixed(2) + " " + (business?.currency || "USD");

  function updateItem(index: number, key: keyof LineItem, value: string) {
    setItems(prev => prev.map((item, i) => i === index
      ? { ...item, [key]: key === "description" ? value : Number(value) }
      : item
    ));
  }
  function addLine() {
    setItems(prev => [...prev, { description: "", quantity: 1, unit_price: 0 }]);
  }
  function removeLine(index: number) {
    setItems(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== index));
  }
  function toggle(key: InspectorKey) {
    setInspector(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function saveInvoice() {
    setLoading(true);
    setError("");

    if (!business || !customerId) {
      setError(!business ? "Business not found." : "Select a customer before saving.");
      setLoading(false);
      return;
    }
    if (!items.some(item => item.description.trim())) {
      setError("Add at least one product or service.");
      setLoading(false);
      return;
    }
    if (!enabledMethods.length) {
      setError("Enable at least one payment method.");
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Your session expired. Please log in again.");
      setLoading(false);
      return;
    }

    const { data: invoice, error: invoiceError } = await supabase.from("invoices").insert({
      business_id: business.id,
      customer_id: customerId,
      invoice_number: "INV-" + invoiceNo,
      status: "draft",
      due_date: dueDate || null,
      currency: business.currency,
      payment_methods: enabledMethods.map(([key]) => key)
    }).select().single();

    if (invoiceError || !invoice) {
      setError(invoiceError?.message || "Could not create invoice.");
      setLoading(false);
      return;
    }

    const rows = items.filter(item => item.description.trim()).map(item => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price
    }));
    const { error: itemError } = await supabase.from("invoice_items").insert(rows);
    if (itemError) {
      setError(itemError.message);
      setLoading(false);
      return;
    }

    await supabase.from("events").insert({
      business_id: business.id,
      event_type: "invoice.created",
      summary: "Invoice INV-" + invoiceNo + " created for " + (customer?.name || "customer") + " — " + money,
      evidence: { invoice_id: invoice.id, total, currency: business.currency, payment_methods: enabledMethods.map(([key]) => key) },
      status: "info"
    });

    router.push("/dashboard/invoices/" + invoice.id);
  }

  const labelClass = "block text-[8px] uppercase tracking-[.12em] text-[#7f8a94]";
  const fieldClass = "w-full rounded border border-[#dbe3e9] bg-white px-2.5 py-2 text-[10px] text-[#26313b] outline-none";

  return (
    <main className="invoice-reference min-h-[calc(100vh-57px)] bg-[#eef1f4]">
      <div className="invoice-reference-toolbar sticky top-0 z-40 flex items-center justify-between px-4 md:px-5 py-2">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/invoices" className="text-[9px] text-[#64717d]">←</Link>
          <b className="text-[10px] text-[#27313b]">Invoice {invoiceNo}</b>
          <div className="hidden lg:flex gap-4 text-[8px] text-[#77838d]">
            <button type="button" className="text-[#27313b]">Edit</button>
            <button type="button">Email view</button>
            <button type="button">PDF view</button>
            <button type="button">Payor view</button>
          </div>
        </div>
        <div className="flex gap-3 text-[8px] text-[#77838d]">
          <button type="button">⚙ Manage</button>
          <button type="button">▣ Take a tour</button>
          <button type="button">◌ Feedback</button>
        </div>
      </div>

      <div className="invoice-reference-subbar sticky top-[41px] z-30 flex items-center gap-3 px-4 md:px-5 py-2">
        <span className="text-[8px] text-[#89949e]">Editing</span>
        <span className="text-[#c5cdd3]">/</span>
        <b className="text-[8px] text-[#33404a]">Invoice settings</b>
        <span className="ml-auto text-[8px] text-[#96a0a8]">Draft · Auto-saved layout</span>
      </div>

      <form onSubmit={e => { e.preventDefault(); void saveInvoice(); }} className="invoice-reference-layout grid xl:grid-cols-[minmax(0,1fr)_340px] max-w-[1650px] mx-auto">
        <section className="p-3 md:p-5 overflow-x-auto">
          <div className="invoice-document min-w-[800px] bg-white border border-[#dce3e8] shadow-[0_18px_45px_rgba(18,28,38,.10)]">
            <div className="px-8 pt-7 pb-5 border-b border-[#e4e9ee] flex justify-between gap-8">
              <div>
                <div className="text-[20px] font-semibold tracking-[.08em] text-[#111827]">INVOICE</div>
                <div className="mt-1 text-[9px] text-[#7d8a95]">{business?.name || "Your business"}</div>
                <div className="mt-5 text-[8px] leading-4 text-[#8a969f]">
                  <div>{business?.name || "Business name"}</div>
                  <div>Business address · Contact email · Phone</div>
                  <div>{business?.currency || "USD"} · Professional billing document</div>
                </div>
              </div>
              <div className="flex gap-5 items-start">
                <div className="h-14 w-14 rounded-full border-2 border-[#d6dfe5] grid place-items-center text-[8px] text-[#7d8a94]">LOGO</div>
                <div className="text-right">
                  <label className={labelClass}>Invoice no.</label>
                  <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} className="mt-1 w-28 rounded border border-[#dbe3e9] px-2 py-1.5 text-right text-[10px] text-[#26313b]" />
                  <div className="mt-4 grid grid-cols-[72px_112px] gap-x-2 gap-y-2 items-center text-[8px]">
                    <span className="text-[#87939d]">Terms</span>
                    <input value={terms} onChange={e => setTerms(e.target.value)} className="rounded border border-[#dbe3e9] px-2 py-1.5 text-[#26313b]" />
                    <span className="text-[#87939d]">Invoice date</span>
                    <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="rounded border border-[#dbe3e9] px-2 py-1.5 text-[#26313b]" />
                    <span className="text-[#87939d]">Due date</span>
                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="rounded border border-[#dbe3e9] px-2 py-1.5 text-[#26313b]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#edf5fb] px-8 py-4 border-b border-[#dce7ef] grid md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Bill to</label>
                {customers.length ? (
                  <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="mt-1 w-full rounded border border-[#c9d8e3] bg-white px-2.5 py-2 text-[10px] text-[#26313b]" required>
                    <option value="">Select customer</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                ) : (
                  <p className="mt-2 text-[9px] text-orange-700">No customers yet. <Link href="/dashboard/customers" className="underline">Add customer</Link>.</p>
                )}
                {customer && <div className="mt-2 text-[8px] text-[#70808c]">{customer.email || "No email"} · {customer.phone || "No phone"}</div>}
              </div>
              <div className="md:text-right">
                <label className={labelClass}>Customer payment options <button type="button" className="normal-case tracking-normal text-[#43836f] underline">Edit</button></label>
                <div className="mt-2 flex md:justify-end flex-wrap gap-1.5">
                  {enabledMethods.map(([key]) => <span key={key} className="rounded border border-[#c9dadf] bg-white px-2 py-1 text-[8px] text-[#58737a]">{METHOD_META[key].label}</span>)}
                </div>
              </div>
            </div>

            <div className="px-8 pt-5 pb-8">
              <div className="flex justify-between items-center mb-3">
                <div><div className="text-[11px] font-semibold text-[#27313b]">Product or Service</div><div className="mt-1 text-[8px] text-[#97a1aa]">Add as many rows as this invoice needs.</div></div>
                <button type="button" onClick={addLine} className="rounded border border-[#cfd9df] bg-white px-2.5 py-1.5 text-[8px] text-[#50606a]">+ Add product or service</button>
              </div>

              <div className="border border-[#dce3e8]">
                <div className="grid grid-cols-[20px_minmax(0,1.7fr)_minmax(0,1fr)_62px_86px_92px_24px] bg-[#f7f9fa] px-2 py-2 text-[7px] uppercase tracking-[.12em] text-[#8a96a0]">
                  <span></span><span>Product/service</span><span>Description</span><span className="text-right">Qty</span><span className="text-right">Rate</span><span className="text-right">Amount</span><span></span>
                </div>
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-[20px_minmax(0,1.7fr)_minmax(0,1fr)_62px_86px_92px_24px] items-center gap-1 border-t border-[#edf0f2] px-2 py-2">
                    <span className="text-[#a0acb5] text-[9px]">⋮</span>
                    <input value={item.description} onChange={e => updateItem(index, "description", e.target.value)} placeholder="Product or service" className={fieldClass} />
                    <input placeholder="Optional detail" className={fieldClass} />
                    <input type="number" min="1" value={item.quantity} onChange={e => updateItem(index, "quantity", e.target.value)} className={fieldClass + " text-right"} />
                    <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(index, "unit_price", e.target.value)} className={fieldClass + " text-right"} />
                    <div className="text-right text-[9px] text-[#394650]">{(item.quantity * item.unit_price).toFixed(2)}</div>
                    <button type="button" onClick={() => removeLine(index)} className="text-[#a4afb8] hover:text-red-500">×</button>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid lg:grid-cols-[1fr_285px] gap-7">
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Customer payment options <button type="button" className="normal-case tracking-normal text-[#43836f] underline">Edit</button></label>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {enabledMethods.map(([key]) => <button key={key} type="button" onClick={() => setMethods(prev => ({...prev, [key]: !prev[key]}))} className="rounded border border-[#dce5ea] bg-[#f9fbfc] px-2 py-1 text-[8px] text-[#5a6973]">{METHOD_META[key].label} ×</button>)}
                    </div>
                  </div>
                  <div><label className={labelClass}>Tell your customer</label><textarea value={customerNote} onChange={e => setCustomerNote(e.target.value)} rows={3} className={fieldClass + " mt-1 resize-none"} /></div>
                  <div><label className={labelClass}>Memo on statement (hidden)</label><textarea value={statementMemo} onChange={e => setStatementMemo(e.target.value)} rows={2} placeholder="Internal statement memo" className={fieldClass + " mt-1 resize-none"} /></div>
                  <div>
                    <label className={labelClass}>Attachments</label>
                    <input ref={attachmentRef} type="file" multiple className="hidden" onChange={e => setAttachments(Array.from(e.target.files || []).map(file => file.name))} />
                    <button type="button" onClick={() => attachmentRef.current?.click()} className="mt-1 w-full rounded border border-dashed border-[#cbd6dd] bg-[#fbfcfd] py-5 text-[8px] text-[#7c8993]">Add attachment · PDF, image or document</button>
                    {attachments.length > 0 && <div className="mt-2 space-y-1">{attachments.map(name => <div key={name} className="text-[8px] text-[#5f6e79]">• {name}</div>)}</div>}
                  </div>
                </div>

                <div>
                  <div className="space-y-2 text-[9px] text-[#67737d]">
                    <div className="flex justify-between"><span>Subtotal</span><span>{total.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Shipping</span><span>{shippingEnabled ? "Set" : "0.00"}</span></div>
                    <div className="flex justify-between"><span>Discount</span><span>{discountEnabled ? "Set" : "0.00"}</span></div>
                    <div className="flex justify-between"><span>Sales tax</span><span>0.00</span></div>
                    <div className="h-px bg-[#dfe5ea]"></div>
                    <div className="flex justify-between text-[15px] font-semibold text-[#27313b]"><span>Total</span><span>{money}</span></div>
                  </div>
                  <div className="mt-5 rounded border border-[#d8e4ea] bg-[#f4f8fa] px-3 py-3 text-[8px] text-[#6f7f89]">
                    <b className="text-[#44535d]">Payment details</b>
                    <div className="mt-2">{business?.bank_name || "Bank transfer"} · {business?.bank_account_number || "Set bank details in Business Settings"}</div>
                  </div>
                  <div className="mt-4 rounded border border-[#dce4e9] px-3 py-3 text-[8px] text-[#82909b]">Thanks for your business.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="invoice-reference-inspector bg-white border-l border-[#dfe5ea] min-h-full p-3 md:p-4 xl:sticky xl:top-[76px] self-start">
          <div className="text-[11px] font-semibold text-[#27313b]">Invoice {invoiceNo}</div>
          <div className="mt-1 mb-3 text-[8px] text-[#7d8992]">Edit default settings</div>

          <section className="invoice-setting-card">
            <button type="button" onClick={() => toggle("customization")} className="invoice-setting-head"><span>Customization</span><span>{inspector.customization ? "⌃" : "⌄"}</span></button>
            {inspector.customization && <div className="invoice-setting-body space-y-2"><div className="text-[8px] text-[#7f8b94]">Business identity and customer-facing presentation.</div><div className="grid grid-cols-2 gap-2"><button type="button" className="invoice-setting-choice">Business identity</button><button type="button" className="invoice-setting-choice">Customer copy</button></div></div>}
          </section>

          <section className="invoice-setting-card mt-2">
            <button type="button" onClick={() => toggle("payments")} className="invoice-setting-head"><span>Payments</span><span>{inspector.payments ? "⌃" : "⌄"}</span></button>
            {inspector.payments && <div className="invoice-setting-body">
              <div className="text-[8px] text-[#77848d] mb-3">Your business pays the fee</div>
              {(Object.entries(methods) as [MethodKey, boolean][]).map(([key, on]) => <button key={key} type="button" onClick={() => setMethods(prev => ({...prev,[key]:!prev[key]}))} className="invoice-toggle-row"><span><b>{METHOD_META[key].label}</b><small>{METHOD_META[key].detail}</small></span><span className={"invoice-toggle " + (on ? "on" : "off")}></span></button>)}
              <div className="pt-2 mt-2 border-t border-[#edf0f2] text-[7px] text-[#8d989f]">Real card charging requires a connected processor.</div>
            </div>}
          </section>

          <section className="invoice-setting-card mt-2">
            <button type="button" onClick={() => toggle("options")} className="invoice-setting-head"><span>More options</span><span>{inspector.options ? "⌃" : "⌄"}</span></button>
            {inspector.options && <div className="invoice-setting-body space-y-2">
              <div className="invoice-setting-row"><span>Invoice total</span><span className="text-[9px] font-semibold text-[#27313b]">{money}</span></div>
              <button type="button" onClick={() => setDepositEnabled(v => !v)} className="invoice-setting-row"><span>Deposit</span><span className={"invoice-toggle " + (depositEnabled ? "on" : "off")}></span></button>
              <button type="button" onClick={() => setDiscountEnabled(v => !v)} className="invoice-setting-row"><span>Discount</span><span className={"invoice-toggle " + (discountEnabled ? "on" : "off")}></span></button>
              <button type="button" onClick={() => setShippingEnabled(v => !v)} className="invoice-setting-row"><span>Shipping fee</span><span className={"invoice-toggle " + (shippingEnabled ? "on" : "off")}></span></button>
              <button type="button" onClick={() => setMulticurrency(v => !v)} className="invoice-setting-row"><span>Multi-currency</span><span className={"invoice-toggle " + (multicurrency ? "on" : "off")}></span></button>
              <button type="button" onClick={() => setLateFeeEnabled(v => !v)} className="invoice-setting-row"><span>Late fee</span><span className={"invoice-toggle " + (lateFeeEnabled ? "on" : "off")}></span></button>
              <button type="button" onClick={() => setTipEnabled(v => !v)} className="invoice-setting-row"><span>Tips</span><span className={"invoice-toggle " + (tipEnabled ? "on" : "off")}></span></button>
            </div>}
          </section>

          <section className="invoice-setting-card mt-2">
            <button type="button" onClick={() => toggle("design")} className="invoice-setting-head"><span>Design</span><span>{inspector.design ? "⌃" : "⌄"}</span></button>
            {inspector.design && <div className="invoice-setting-body space-y-2 text-[8px] text-[#71808a]"><div className="invoice-setting-choice">Paper · A4 / Letter</div><div className="invoice-setting-choice">Density · Compact</div><div className="invoice-setting-choice">Logo · Business mark</div><div className="invoice-setting-choice">Accent · Business brand</div></div>}
          </section>

          <section className="invoice-setting-card mt-2">
            <button type="button" onClick={() => toggle("scheduling")} className="invoice-setting-head"><span>Scheduling</span><span>{inspector.scheduling ? "⌃" : "⌄"}</span></button>
            {inspector.scheduling && <div className="invoice-setting-body space-y-2 text-[8px] leading-4 text-[#71808a]"><div>Send on: Manual</div><div>Reminder: 7 days before due</div><div>Follow-up: 1 day after due</div></div>}
          </section>

          <div className="mt-4 border-t border-[#e1e7eb] pt-3 flex items-center justify-between gap-2">
            <span className="text-[8px] text-[#9aa4ad]">Print and download</span>
            <button type="submit" disabled={loading} className="rounded border border-[#49a26f] bg-white px-3 py-2 text-[8px] font-semibold text-[#27754d]">{loading ? "Saving…" : "Save"}</button>
            <button type="button" disabled={loading} onClick={() => void saveInvoice()} className="rounded bg-[#158343] px-3 py-2 text-[8px] font-semibold text-white">{loading ? "Saving…" : "Review and send ▾"}</button>
          </div>

          {error && <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-[8px] leading-4 text-red-700">{error}</div>}
        </aside>
      </form>
    </main>
  );
}
