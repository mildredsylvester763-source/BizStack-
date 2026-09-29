"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { DEFAULT_INVOICE_SETTINGS, InvoiceSettings } from "@/lib/business-settings";

const labels: Record<keyof InvoiceSettings, string> = {
  show_logo: "Business logo", show_customer_address: "Customer address", show_tax: "Tax line", show_discount: "Discount",
  show_shipping: "Shipping", show_reference: "Reference", show_purchase_order: "Purchase order", show_notes: "Customer note",
  show_terms: "Terms & conditions", show_product_image: "Product image", show_sku: "SKU", show_payment_details: "Payment details",
  show_signature: "Signature", show_qr_payment: "QR payment"
};

export default function SettingsPage() {
  const supabase = createClient();
  const [id, setId] = useState("");
  const [businessName, setBusinessName] = useState("Business");
  const [taxMode, setTaxMode] = useState("auto");
  const [rate, setRate] = useState(0);
  const [taxName, setTaxName] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [invoice, setInvoice] = useState<InvoiceSettings>(DEFAULT_INVOICE_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: b } = await supabase.from("businesses").select("id,name").eq("owner_id", user.id).single();
      if (!b) return;
      setId(b.id);
      setBusinessName(b.name || "Business");
      let { data: s } = await supabase.from("business_settings").select("*").eq("business_id", b.id).maybeSingle();
      if (!s) {
        await supabase.from("business_settings").insert({ business_id: b.id });
        s = (await supabase.from("business_settings").select("*").eq("business_id", b.id).single()).data;
      }
      if (s) {
        setTaxMode(s.tax_mode || "auto");
        setRate(Number(s.default_tax_rate || 0));
        setTaxName(s.default_tax_name || "");
        setJurisdiction(s.tax_jurisdiction || "");
        setInvoice({ ...DEFAULT_INVOICE_SETTINGS, ...(s.invoice_settings || {}) });
      }
    })();
  }, [supabase]);

  async function save() {
    setSaving(true); setSaved(false);
    const { error } = await supabase.from("business_settings").update({
      tax_mode: taxMode, default_tax_rate: rate, default_tax_name: taxName || null,
      tax_jurisdiction: jurisdiction || null, invoice_settings: invoice, updated_at: new Date().toISOString()
    }).eq("business_id", id);
    setSaving(false); setSaved(!error);
  }

  const shown = Object.values(invoice).filter(Boolean).length;
  const fieldClass = "w-full mt-2 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#171918] outline-none focus:border-[#202725]/40 focus:ring-4 focus:ring-black/[.04]";

  return (
    <main className="min-h-screen bg-[#f3f0e8] text-[#171918]">
      <header className="sticky top-0 z-30 border-b border-black/[.08] bg-[#f8f6f0]/90 backdrop-blur-xl">
        <div className="max-w-[1280px] mx-auto h-[72px] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0"><Link href="/dashboard" className="font-display text-xl tracking-tight truncate">{businessName}</Link><span className="hidden sm:block h-5 w-px bg-black/10" /><span className="hidden sm:inline text-[10px] uppercase tracking-[.2em] text-black/35">Workspace / Business settings</span></div>
          <div className="flex gap-2"><Link href="/dashboard/invoices" className="rounded-full border border-black/10 bg-white/60 px-3.5 py-2 text-[11px]">Invoices</Link><Link href="/dashboard/integrations" className="rounded-full bg-[#171918] text-white px-3.5 py-2 text-[11px]">Integrations</Link></div>
        </div>
      </header>

      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid xl:grid-cols-[1fr_auto] gap-8 items-end mb-9">
          <div><div className="flex items-center gap-2 mb-4"><span className="h-1.5 w-1.5 rounded-full bg-[#806f50]" /><span className="text-[10px] uppercase tracking-[.24em] text-[#806f50]">Control room</span></div><h1 className="font-display text-[42px] sm:text-[54px] leading-[.98] tracking-[-.035em]">Set the rules behind the documents.</h1><p className="mt-4 text-[15px] leading-6 text-black/50 max-w-2xl">Business settings change how BizStack presents invoices and calculates tax. Optional fields can be hidden without deleting the underlying commercial data.</p></div>
          <div className="rounded-[22px] border border-black/[.08] bg-[#fcfaf5] px-5 py-4 min-w-[220px]"><p className="text-[9px] uppercase tracking-[.2em] text-black/30">Invoice presentation</p><p className="font-display text-3xl mt-2">{shown}<span className="text-base text-black/30"> / 14 shown</span></p></div>
        </div>

        {saved && <div className="mb-5 rounded-[18px] border border-[#b9dcc5] bg-[#e6f2e9] px-4 py-3 text-sm text-[#2f6b43]">Settings saved.</div>}

        <div className="grid xl:grid-cols-[1fr_390px] gap-5 items-start">
          <div className="space-y-5">
            <section className="rounded-[28px] border border-black/[.08] bg-[#fcfaf5] shadow-[0_20px_70px_rgba(25,24,20,.05)] overflow-hidden">
              <div className="px-6 sm:px-7 py-5 border-b border-black/[.07]"><p className="text-[10px] uppercase tracking-[.18em] text-black/30">01 / Tax</p><h2 className="font-display text-2xl mt-1">Tax configuration</h2><p className="text-xs text-black/40 mt-2">Tax is configurable because not every transaction is taxable. Core invoice identity and totals remain mandatory.</p></div>
              <div className="p-6 sm:p-7 grid sm:grid-cols-2 gap-5">
                <label className="text-[11px] uppercase tracking-[.12em] text-black/40">Tax mode<select value={taxMode} onChange={e => setTaxMode(e.target.value)} className={fieldClass}><option value="auto">Use configured default</option><option value="manual">Manual per invoice</option><option value="disabled">Disabled by default</option></select></label>
                <label className="text-[11px] uppercase tracking-[.12em] text-black/40">Default tax rate %<input type="number" min="0" step=".01" value={rate} onChange={e => setRate(Number(e.target.value))} className={fieldClass} /></label>
                <label className="text-[11px] uppercase tracking-[.12em] text-black/40">Tax name<input value={taxName} onChange={e => setTaxName(e.target.value)} placeholder="VAT / GST / Sales tax" className={fieldClass} /></label>
                <label className="text-[11px] uppercase tracking-[.12em] text-black/40">Tax jurisdiction<input value={jurisdiction} onChange={e => setJurisdiction(e.target.value)} placeholder="Country / region" className={fieldClass} /></label>
              </div>
            </section>

            <section className="rounded-[28px] border border-black/[.08] bg-[#fcfaf5] shadow-[0_20px_70px_rgba(25,24,20,.05)] overflow-hidden">
              <div className="px-6 sm:px-7 py-5 border-b border-black/[.07] flex items-end justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[.18em] text-black/30">02 / Document system</p><h2 className="font-display text-2xl mt-1">Invoice controls</h2><p className="text-xs text-black/40 mt-2">Choose which optional presentation fields are shown by default on new documents.</p></div><span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[9px] uppercase tracking-[.14em] text-black/35">{shown}/14</span></div>
              <div className="p-6 sm:p-7 grid sm:grid-cols-2 gap-2">
                {(Object.keys(labels) as (keyof InvoiceSettings)[]).map(k => { const active = invoice[k]; return <button key={k} type="button" onClick={() => setInvoice(v => ({ ...v, [k]: !v[k] }))} className={"flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors " + (active ? "border-[#bccdbf] bg-[#edf4ee]" : "border-black/[.08] bg-white/60")}><span><span className="block text-xs font-medium">{labels[k]}</span><span className="block text-[10px] text-black/35 mt-0.5">{active ? "Shown on document" : "Hidden from document"}</span></span><span className={"h-5 w-9 rounded-full p-0.5 transition-colors " + (active ? "bg-[#4f9965]" : "bg-black/15")}><span className={"block h-4 w-4 rounded-full bg-white shadow-sm transition-transform " + (active ? "translate-x-4" : "")} /></span></button>; })}
              </div>
            </section>
          </div>

          <aside className="xl:sticky xl:top-[92px] space-y-3">
            <section className="rounded-[28px] bg-[#202725] text-white p-6 shadow-[0_24px_80px_rgba(32,39,37,.16)]"><p className="text-[10px] uppercase tracking-[.18em] text-white/40">Default behavior</p><h2 className="font-display text-2xl mt-2">BizStack keeps data intact.</h2><p className="text-sm text-white/55 leading-6 mt-3">Turning a presentation field off changes what is shown, not what is stored on the invoice record.</p><div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 gap-4"><div><p className="text-[10px] uppercase tracking-[.15em] text-white/35">Tax</p><p className="text-sm mt-1">{taxMode === "disabled" ? "Disabled" : rate ? rate + "%" : "Not configured"}</p></div><div><p className="text-[10px] uppercase tracking-[.15em] text-white/35">Tax name</p><p className="text-sm mt-1">{taxName || "Tax"}</p></div></div></section>
            <section className="rounded-[22px] border border-black/[.08] bg-[#eee8da] p-5"><p className="text-[10px] uppercase tracking-[.18em] text-black/35">Related systems</p><div className="mt-4 space-y-2"><Link href="/dashboard/invoices" className="flex items-center justify-between rounded-xl bg-white/65 border border-black/[.06] px-3.5 py-3 text-xs"><span>Invoices</span><span>↗</span></Link><Link href="/dashboard/integrations" className="flex items-center justify-between rounded-xl bg-white/65 border border-black/[.06] px-3.5 py-3 text-xs"><span>Integration Hub</span><span>↗</span></Link><Link href="/dashboard/settings/automation" className="flex items-center justify-between rounded-xl bg-white/65 border border-black/[.06] px-3.5 py-3 text-xs"><span>Automation</span><span>↗</span></Link></div></section>
            <button onClick={save} disabled={saving || !id} className="w-full rounded-xl bg-[#171918] text-white px-5 py-3 text-sm font-medium disabled:opacity-50">{saving ? "Saving settings…" : "Save settings"}</button>
          </aside>
        </div>
      </section>
    </main>
  );
}