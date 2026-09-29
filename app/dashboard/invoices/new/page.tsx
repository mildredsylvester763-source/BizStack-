"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { formatMoney } from "@/lib/invoices";

type Customer = { id: string; name: string; email: string | null; phone: string | null };
type AttachmentMeta = { name: string; size: number; type: string };
type LineItem = { description: string; quantity: number; unit_price: number };

const PAYMENT_TERMS = ["Due on receipt", "Net 7", "Net 15", "Net 30", "Net 45", "Net 60"];

export default function NewInvoicePage() {
  const router = useRouter();
  const supabase = createClient();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [businessName, setBusinessName] = useState("Your business");
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);
  const [documentSettings, setDocumentSettings] = useState({
    show_logo: true, show_customer_address: true, show_tax: true, show_discount: true,
    show_shipping: false, show_reference: true, show_purchase_order: true, show_notes: true,
    show_terms: true, show_product_image: false, show_sku: true, show_payment_details: true,
    show_signature: false, show_qr_payment: false
  });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: business } = await supabase.from("businesses").select("id, currency, name").eq("owner_id", user.id).single();
      if (!business) return;
      setCurrency(business.currency || "USD");
      setBusinessName(business.name || "Your business");
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

  function toggleDocumentSetting(key: keyof typeof documentSettings) {
    setDocumentSettings(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function setFiles(fileList: FileList | null) {
    const next = Array.from(fileList ?? []).map(file => ({ name: file.name, size: file.size, type: file.type }));
    setAttachments(prev => [...prev, ...next]);
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const visibleSettingCount = Object.values(documentSettings).filter(Boolean).length;

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
    <main className="min-h-screen bg-[#f3f0e8] text-[#171918]">
      <header className="sticky top-0 z-30 border-b border-black/[.08] bg-[#f8f6f0]/90 backdrop-blur-xl">
        <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between">
          <Link href="/dashboard/invoices" className="text-xs text-black/45 hover:text-black transition-colors">← Invoices</Link>
          <div className="flex items-center gap-3"><span className="hidden sm:inline text-[10px] uppercase tracking-[.2em] text-black/30">Commercial Studio</span><span className="h-5 w-px bg-black/10" /><span className="text-xs text-black/45">New invoice</span></div>
        </div>
      </header>

      <section className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3"><span className="h-1.5 w-1.5 rounded-full bg-[#806f50]" /><span className="text-[10px] uppercase tracking-[.24em] text-[#806f50]">Create a commercial record</span></div>
          <h1 className="font-display text-[40px] sm:text-[52px] leading-none tracking-[-.035em]">Build the invoice around the work.</h1>
          <p className="text-sm leading-6 text-black/50 mt-4 max-w-2xl">The visual document on the right updates from the information you enter. Nothing here is fake preview data.</p>
        </div>

        <form onSubmit={handleSubmit} className="grid xl:grid-cols-[minmax(0,1fr)_520px] gap-6 items-start">
          <div className="space-y-5">
            <section className="rounded-[28px] border border-black/[.08] bg-[#fcfaf5] shadow-[0_20px_70px_rgba(25,24,20,.05)] overflow-hidden">
              <div className="px-6 sm:px-7 py-5 border-b border-black/[.07] flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[.18em] text-black/30">01 / Context</p><h2 className="font-display text-2xl mt-1">Invoice details</h2></div><span className="text-[11px] text-black/35">Who · when · why</span></div>
              <div className="p-6 sm:p-7 grid sm:grid-cols-2 gap-5">
                {[
                  ["Customer",<select key="customer" value={customerId} onChange={e=>setCustomerId(e.target.value)} required className="field"><option value="">Select customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>],
                  ["Issue date",<input key="issue" type="date" value={issueDate} onChange={e=>setIssueDate(e.target.value)} className="field" />],
                  ["Due date",<input key="due" type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} className="field" />],
                  ["Payment terms",<select key="terms" value={paymentTerms} onChange={e=>setPaymentTerms(e.target.value)} className="field">{PAYMENT_TERMS.map(t=><option key={t}>{t}</option>)}</select>],
                  ["Reference",<input key="ref" value={reference} onChange={e=>setReference(e.target.value)} placeholder="Project or client reference" className="field" />],
                  ["Purchase order",<input key="po" value={purchaseOrder} onChange={e=>setPurchaseOrder(e.target.value)} placeholder="Optional PO number" className="field" />]
                ].map(([label,input])=><label key={String(label)} className="text-[11px] uppercase tracking-[.12em] text-black/40">{label}<span className="block mt-2 normal-case tracking-normal">{input}</span></label>)}
              </div>
            </section>

            <section className="rounded-[28px] border border-black/[.08] bg-[#fcfaf5] shadow-[0_20px_70px_rgba(25,24,20,.05)] overflow-hidden">
              <div className="px-6 sm:px-7 py-5 border-b border-black/[.07] flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[.18em] text-black/30">02 / Work</p><h2 className="font-display text-2xl mt-1">Line items</h2></div><button type="button" onClick={addLine} className="rounded-full border border-black/10 bg-white px-3.5 py-2 text-xs hover:bg-black/[.03]">+ Add line</button></div>
              <div className="p-6 sm:p-7">
                <div className="hidden md:grid grid-cols-[1fr_90px_140px_125px_28px] gap-3 pb-3 text-[9px] uppercase tracking-[.18em] text-black/30"><span>Description</span><span>Qty</span><span>Unit price</span><span>Amount</span><span /></div>
                <div className="space-y-3">
                  {items.map((item,i)=><div key={i} className="grid md:grid-cols-[1fr_90px_140px_125px_28px] gap-3 items-center">
                    <input value={item.description} onChange={e=>updateItem(i,"description",e.target.value)} placeholder="Product or service" className="field" />
                    <input type="number" min="0.01" step="0.01" value={item.quantity} onChange={e=>updateItem(i,"quantity",e.target.value)} className="field" />
                    <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e=>updateItem(i,"unit_price",e.target.value)} className="field" />
                    <div className="text-sm font-medium px-2">{formatMoney(Math.max(0,item.quantity)*Math.max(0,item.unit_price),currency)}</div>
                    <button type="button" onClick={()=>removeLine(i)} className="h-8 w-8 rounded-full text-black/30 hover:bg-black/[.05] hover:text-black" aria-label="Remove line">×</button>
                  </div>)}
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-black/[.08] bg-[#fcfaf5] shadow-[0_20px_70px_rgba(25,24,20,.05)] overflow-hidden">
              <div className="px-6 sm:px-7 py-5 border-b border-black/[.07]"><p className="text-[10px] uppercase tracking-[.18em] text-black/30">03 / Adjustments</p><h2 className="font-display text-2xl mt-1">Discount and tax</h2></div>
              <div className="p-6 sm:p-7 grid sm:grid-cols-2 gap-5">
                <label className="text-[11px] uppercase tracking-[.12em] text-black/40">Discount<span className="mt-2 flex gap-2 normal-case tracking-normal"><select value={discountType} onChange={e=>setDiscountType(e.target.value as "none"|"percentage"|"fixed")} className="field w-32"><option value="none">None</option><option value="percentage">Percent</option><option value="fixed">Fixed</option></select><input type="number" min="0" value={discountValue} onChange={e=>setDiscountValue(Number(e.target.value))} className="field flex-1" /></span></label>
                <label className="text-[11px] uppercase tracking-[.12em] text-black/40">Tax<span className="mt-2 block normal-case tracking-normal"><input type="number" min="0" value={taxRate} onChange={e=>{setTaxRate(Number(e.target.value));setTaxEnabled(Number(e.target.value)>0)}} className="field" placeholder="Tax rate %" /></span></label>
              </div>
            </section>



            <section className="rounded-[28px] border border-black/[.08] bg-[#fcfaf5] shadow-[0_20px_70px_rgba(25,24,20,.05)] overflow-hidden">
              <div className="px-6 sm:px-7 py-5 border-b border-black/[.07]"><p className="text-[10px] uppercase tracking-[.18em] text-black/30">04 / Message</p><h2 className="font-display text-2xl mt-1">Notes and terms</h2></div>
              <div className="p-6 sm:p-7 grid sm:grid-cols-2 gap-5"><label className="text-[11px] uppercase tracking-[.12em] text-black/40">Customer note<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={5} placeholder="A short note for the customer" className="field mt-2 resize-none normal-case tracking-normal" /></label><label className="text-[11px] uppercase tracking-[.12em] text-black/40">Terms<textarea value={terms} onChange={e=>setTerms(e.target.value)} rows={5} className="field mt-2 resize-none normal-case tracking-normal" /></label></div>
            </section>


            <section className="rounded-[28px] border border-black/[.08] bg-[#fcfaf5] shadow-[0_20px_70px_rgba(25,24,20,.05)] overflow-hidden">
              <button type="button" onClick={() => setSettingsOpen(v => !v)} className="w-full px-6 sm:px-7 py-5 flex items-center justify-between text-left hover:bg-black/[.015] transition-colors">
                <div><p className="text-[10px] uppercase tracking-[.18em] text-black/30">05 / Presentation</p><h2 className="font-display text-2xl mt-1">Manage settings</h2><p className="text-xs text-black/40 mt-1">Control what this invoice shows without changing the commercial record.</p></div>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-sm text-black/45">{settingsOpen ? "−" : "+"}</span>
              </button>
              {settingsOpen && <div className="px-6 sm:px-7 pb-7">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {[
                    ["show_logo","Business logo"],["show_customer_address","Customer address"],["show_tax","Tax"],["show_discount","Discount"],["show_shipping","Shipping"],["show_reference","Reference"],["show_purchase_order","Purchase order"],["show_notes","Notes"],["show_terms","Terms & conditions"],["show_product_image","Product images"],["show_sku","SKU"],["show_payment_details","Payment details"],["show_signature","Signature"],["show_qr_payment","QR payment"]
                  ].map(([key,label]) => {
                    const active = documentSettings[key as keyof typeof documentSettings];
                    return <button type="button" key={key} onClick={() => toggleDocumentSetting(key as keyof typeof documentSettings)} className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${active ? "border-[#bccdbf] bg-[#edf4ee]" : "border-black/[.08] bg-white/60"}`}>
                      <span><span className="block text-xs font-medium">{label}</span><span className="block text-[10px] text-black/35 mt-0.5">{active ? "Shown on document" : "Hidden from document"}</span></span>
                      <span className={`h-5 w-9 rounded-full p-0.5 transition-colors ${active ? "bg-[#4f9965]" : "bg-black/15"}`}><span className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${active ? "translate-x-4" : ""}`} /></span>
                    </button>;
                  })}
                </div>
              </div>}
            </section>

            <section className="rounded-[28px] border border-black/[.08] bg-[#fcfaf5] shadow-[0_20px_70px_rgba(25,24,20,.05)] overflow-hidden">
              <div className="px-6 sm:px-7 py-5 border-b border-black/[.07] flex items-center justify-between">
                <div><p className="text-[10px] uppercase tracking-[.18em] text-black/30">06 / Files</p><h2 className="font-display text-2xl mt-1">Attachments</h2><p className="text-xs text-black/40 mt-1">Keep briefs, purchase orders, references and supporting files beside the invoice.</p></div>
                <label className="cursor-pointer rounded-xl border border-black/10 bg-white px-3.5 py-2 text-xs font-medium hover:bg-black/[.03]">
                  + Add attachment
                  <input type="file" multiple className="hidden" onChange={e => setAttachmentNames(Array.from(e.target.files ?? []).map(file => file.name))} />
                </label>
              </div>
              <div className="p-6 sm:p-7">
                {!attachments.length ? (
                  <label className="group flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-[22px] border border-dashed border-black/15 bg-white/50 px-6 text-center hover:bg-white transition-colors">
                    <span className="h-11 w-11 rounded-2xl border border-black/10 bg-[#f4f1e9] flex items-center justify-center text-lg text-black/45">↥</span>
                    <span className="mt-3 text-sm font-medium">Drop files here or choose files</span>
                    <span className="mt-1 text-xs text-black/35">PDF, images, documents and other supporting files</span>
                    <input type="file" multiple className="hidden" onChange={e => setFiles(e.target.files)} />
                  </label>
                ) : (
                  <div className="space-y-2">{attachments.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-2xl border border-black/[.08] bg-white px-4 py-3"><span className="h-9 w-9 shrink-0 rounded-xl bg-[#f1eee5] flex items-center justify-center text-[10px] uppercase tracking-[.08em] text-black/45">{file.type.split("/")[1]?.slice(0,4) || "file"}</span><div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{file.name}</p><p className="text-[10px] uppercase tracking-[.14em] text-black/30 mt-1">Selected · {formatFileSize(file.size)}</p></div><span className="text-xs text-[#52799a]">Ready</span></div>)}</div>
                )}
              </div>
            </section>

            {error && <div className="rounded-2xl border border-[#8a6f55]/25 bg-[#efe5d9] px-4 py-3 text-sm text-[#5e4938]">{error}</div>}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[24px] border border-black/[.08] bg-[#202725] text-white p-5">
              <div><p className="text-[10px] uppercase tracking-[.18em] text-white/40">Ready to create</p><p className="font-display text-xl mt-1">{formatMoney(total,currency)}</p></div>
              <button disabled={loading} className="rounded-xl bg-white text-[#171918] px-6 py-3 text-sm font-medium disabled:opacity-50">{loading ? "Creating…" : "Create invoice"}</button>
            </div>
          </div>

          <aside className="xl:sticky xl:top-[92px]">
            <div className="rounded-[30px] border border-black/[.08] bg-[#fcfaf5] shadow-[0_28px_90px_rgba(25,24,20,.10)] overflow-hidden">
              <div className="px-6 py-5 border-b border-black/[.07] flex items-center justify-between gap-4"><div><p className="text-[9px] uppercase tracking-[.2em] text-black/30">Live document</p><p className="text-sm font-medium mt-1">Invoice preview</p></div><div className="flex items-center gap-2"><span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[9px] uppercase tracking-[.14em] text-black/40">{visibleSettingCount}/14 shown</span><span className="text-[10px] text-black/30">{currency}</span></div></div>
              <div className="p-7 sm:p-8 bg-white min-h-[620px]">
                <div className="flex items-start justify-between gap-5 pb-8 border-b border-black/[.08]"><div>{documentSettings.show_logo && <div className="h-8 w-8 rounded-lg bg-[#202725] mb-4" />}<p className="font-display text-xl">INVOICE</p><p className="text-[10px] uppercase tracking-[.14em] text-black/35 mt-1">{businessName}</p><p className="font-mono text-[9px] text-black/35 mt-2">DRAFT / PREVIEW</p></div><div className="text-right text-[11px] text-black/45"><p>{issueDate || "—"}</p><p className="mt-1">Due {dueDate || "—"}</p></div></div>
                <div className="py-7 grid grid-cols-2 gap-5 border-b border-black/[.08]"><div><p className="text-[9px] uppercase tracking-[.18em] text-black/30">Bill to</p><p className="text-sm font-medium mt-2">{customers.find(c=>c.id===customerId)?.name || "Customer name"}</p>{documentSettings.show_customer_address && <p className="text-[10px] text-black/35 mt-2">Customer contact details shown on the final document.</p>}</div><div className="text-right"><p className="text-[9px] uppercase tracking-[.18em] text-black/30">Reference</p><p className="text-sm mt-2">{documentSettings.show_reference ? (reference || "—") : "Hidden"}</p>{documentSettings.show_purchase_order && purchaseOrder && <p className="text-[10px] text-black/35 mt-1">PO · {purchaseOrder}</p>}</div></div>
                <div className="py-6 border-b border-black/[.08]"><div className="grid grid-cols-[1fr_55px_90px] gap-3 text-[8px] uppercase tracking-[.16em] text-black/30 pb-3"><span>Description</span><span>Qty</span><span className="text-right">Amount</span></div>{items.filter(i=>i.description.trim()||i.unit_price>0).map((item,i)=><div key={i} className="grid grid-cols-[1fr_55px_90px] gap-3 py-3 border-t border-black/[.06] text-[11px]"><span className="truncate">{item.description || "Untitled item"}</span><span>{item.quantity}</span><span className="text-right">{formatMoney(item.quantity*item.unit_price,currency)}</span></div>)}{!items.some(i=>i.description.trim()||i.unit_price>0)&&<p className="text-xs text-black/30 py-5">Your line items will appear here.</p>}</div>
                <div className="ml-auto max-w-[250px] py-6 space-y-2 text-[11px]"><div className="flex justify-between text-black/45"><span>Subtotal</span><span>{formatMoney(subtotal,currency)}</span></div>{documentSettings.show_discount && discountAmount>0&&<div className="flex justify-between text-black/45"><span>Discount</span><span>-{formatMoney(discountAmount,currency)}</span></div>}{documentSettings.show_tax && taxAmount>0&&<div className="flex justify-between text-black/45"><span>{taxName} ({taxRate}%)</span><span>{formatMoney(taxAmount,currency)}</span></div>}<div className="border-t border-black/20 pt-3 flex justify-between items-end"><span className="text-black/50">Total</span><span className="font-display text-xl">{formatMoney(total,currency)}</span></div></div><div className="mt-2 pt-5 border-t border-black/[.07] flex flex-wrap gap-2">{documentSettings.show_payment_details && <span className="rounded-full bg-[#eef2ed] px-2.5 py-1 text-[9px] uppercase tracking-[.12em] text-[#48644f]">Payment details</span>}{documentSettings.show_signature && <span className="rounded-full bg-[#f3eee5] px-2.5 py-1 text-[9px] uppercase tracking-[.12em] text-[#756448]">Signature</span>}{documentSettings.show_qr_payment && <span className="rounded-full bg-[#eef0f3] px-2.5 py-1 text-[9px] uppercase tracking-[.12em] text-[#4d6378]">QR payment</span>}{documentSettings.show_shipping && <span className="rounded-full bg-[#f4ece8] px-2.5 py-1 text-[9px] uppercase tracking-[.12em] text-[#7c5547]">Shipping</span>}{!documentSettings.show_payment_details && !documentSettings.show_signature && !documentSettings.show_qr_payment && !documentSettings.show_shipping && <span className="text-[10px] text-black/30">Optional presentation details are hidden.</span>}</div>
              </div>
            </div>
            <div className="mt-3 rounded-[22px] border border-black/[.08] bg-[#eee8da] p-5"><p className="text-[10px] uppercase tracking-[.18em] text-black/35">Payment layer</p><p className="text-sm text-black/60 mt-2 leading-5">No fake payment rail is shown here. Verified provider capabilities can attach after the invoice exists.</p><Link href="/dashboard/integrations" className="inline-block mt-3 text-xs font-medium underline underline-offset-4">Review integrations</Link></div>
          </aside>
        </form>
      </section>
      <style jsx global>{`.field{width:100%;border:1px solid rgba(0,0,0,.10);background:#fffdf9;border-radius:12px;padding:.72rem .8rem;font-size:.875rem;color:#171918;outline:none;transition:border-color .15s,box-shadow .15s}.field:focus{border-color:rgba(32,39,37,.45);box-shadow:0 0 0 3px rgba(32,39,37,.07)}`}</style>
    </main>
  );
