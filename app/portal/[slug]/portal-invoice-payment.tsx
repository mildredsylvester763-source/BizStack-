"use client";

import { useMemo, useState } from "react";

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  currency: string;
  total: number;
  paid_amount: number;
  payment_methods?: string[];
  business?: {
    name?: string;
    bank_name?: string | null;
    bank_account_name?: string | null;
    bank_account_number?: string | null;
  } | null;
};

export default function PortalInvoicePayment({
  invoice,
  cardProcessorConnected
}: {
  invoice: Invoice;
  cardProcessorConnected: boolean;
}) {
  const methods = invoice.payment_methods?.length ? invoice.payment_methods : ["qr"];
  const [method, setMethod] = useState(methods[0]);
  const outstanding = Math.max(Number(invoice.total || 0) - Number(invoice.paid_amount || 0), 0);
  const business = invoice.business || {};
  const qrUrl = useMemo(() => {
    const payload = encodeURIComponent(
      "Pay " + outstanding.toFixed(2) + " " + invoice.currency + " to " + (business.name || "this business") + " — Invoice " + invoice.invoice_number
    );
    return "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" + payload;
  }, [business.name, invoice.currency, invoice.invoice_number, outstanding]);

  return (
    <div className="mt-4 rounded-2xl border border-black/10 bg-[#fafafa] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[9px] uppercase tracking-[.16em] text-black/35">Pay this invoice</div>
          <div className="mt-1 text-sm font-semibold">{new Intl.NumberFormat(undefined, { style: "currency", currency: invoice.currency || "USD" }).format(outstanding)}</div>
        </div>
        <span className="text-[8px] rounded-full bg-black/[.04] px-2 py-1 text-black/40">{methods.length} payment option{methods.length === 1 ? "" : "s"}</span>
      </div>

      <div className="grid sm:grid-cols-3 gap-2 mt-4">
        {methods.map(key => {
          const meta: Record<string, { label: string; icon: string }> = {
            bank_transfer: { label: "Bank transfer", icon: "₦" },
            qr: { label: "QR payment", icon: "▦" },
            card: { label: "Card", icon: "▣" }
          };
          const item = meta[key] || { label: key.replaceAll("_", " "), icon: "•" };
          const selected = method === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setMethod(key)}
              className={"rounded-xl border px-3 py-3 text-left transition " + (selected ? "border-[#5b5cf0] bg-[#5b5cf0]/[.07]" : "border-black/10 bg-white hover:border-black/20")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={"grid h-7 w-7 place-items-center rounded-lg text-[10px] " + (selected ? "bg-[#5b5cf0] text-white" : "bg-black/[.04] text-black/45")}>{item.icon}</span>
                <span className={"h-2 w-2 rounded-full border " + (selected ? "border-[#5b5cf0] bg-[#5b5cf0]" : "border-black/20")} />
              </div>
              <div className="mt-2 text-[9px] font-medium">{item.label}</div>
            </button>
          );
        })}
      </div>

      {method === "bank_transfer" && (
        <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-50 p-4">
          <div className="text-[9px] font-semibold text-cyan-950">Bank transfer details</div>
          {business.bank_name ? (
            <div className="mt-2 space-y-1 text-[8px] text-black/60">
              <div><span className="text-black/35">Bank:</span> {business.bank_name}</div>
              <div><span className="text-black/35">Account name:</span> {business.bank_account_name || "—"}</div>
              <div><span className="text-black/35">Account number:</span> {business.bank_account_number || "—"}</div>
              <div className="pt-2 text-[7px] text-black/35">Use invoice {invoice.invoice_number} as your transfer reference.</div>
            </div>
          ) : (
            <div className="mt-2 text-[8px] text-black/45">The business has not configured bank transfer details for this invoice yet.</div>
          )}
        </div>
      )}

      {method === "qr" && (
        <div className="mt-3 rounded-xl border border-violet-500/20 bg-violet-50 p-4 text-center">
          <div className="text-[9px] font-semibold text-violet-950">Scan to pay</div>
          <div className="text-[7px] text-black/35 mt-1">Invoice-specific QR code</div>
          <div className="inline-flex mt-3 rounded-xl bg-white p-2 shadow-sm">
            <img src={qrUrl} alt="Invoice payment QR code" width={180} height={180} className="rounded-lg" />
          </div>
        </div>
      )}

      {method === "card" && (
        <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-50 p-4">
          <div className="text-[9px] font-semibold text-blue-950">Card payment</div>
          <p className="mt-2 text-[8px] leading-4 text-black/50">
            {cardProcessorConnected
              ? "A payment processor is connected to this business. Card checkout can be enabled here without exposing processor credentials to the customer."
              : "Card is available as a payment choice on this invoice, but the business still needs a verified card payment processor before a real charge can be started."}
          </p>
          <button
            type="button"
            disabled={!cardProcessorConnected}
            className="mt-3 w-full rounded-lg bg-[#111827] px-3 py-2.5 text-[8px] font-medium text-white disabled:opacity-35"
          >
            {cardProcessorConnected ? "Continue to secure card checkout" : "Card checkout not connected"}
          </button>
        </div>
      )}
    </div>
  );
}
