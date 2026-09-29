"use client";

import Link from "next/link";
import { useState } from "react";

const ITEMS = [
  ["Customers", "/dashboard/customers", "Customers, profiles and relationship history"],
  ["Invoices", "/dashboard/invoices", "Invoices and payment status"],
  ["Money", "/dashboard/money", "Cash movement and receivables"],
  ["Connections", "/dashboard/integrations", "Banks, services and integrations"],
  ["Website", "/dashboard/website", "Website creation and publishing"],
  ["AI Builder", "/dashboard/ai-builder", "Build, inspect and automate with AI"],
  ["Quotes", "/dashboard/quotes", "Quotes and conversion"],
  ["Marketplace", "/dashboard/marketplace", "Business marketplace"],
  ["Broadcasts", "/dashboard/broadcasts", "Customer communications"],
  ["Finance API", "/dashboard/finance-api", "Financial API tools"],
  ["Product Studio", "/dashboard/product-studio", "Products and catalog"],
  ["Cash Sales", "/dashboard/cash-sales", "Register and cash reconciliation"],
  ["Currencies", "/dashboard/currencies", "Multi-currency settings"],
  ["Suppliers", "/dashboard/suppliers", "Supplier costs and procurement"],
  ["Commissions", "/dashboard/commissions", "Agent earnings and payouts"],
  ["AI Documents", "/dashboard/documents", "Documents and funding packs"],
  ["Customer Portal", "/dashboard/portal", "Secure customer workspace"],
  ["Trust", "/dashboard/identity", "Identity and security"],
  ["Plans", "/dashboard/billing", "Billing and subscription"],
  ["Action Center", "/dashboard/actions", "Follow-ups and work queue"],
  ["Automation", "/dashboard/settings/automation", "Automation controls"],
];

export default function DashboardMobileMenu({ businessName }: { businessName: string }) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      <div className="sm:hidden flex items-center gap-2">
        <button
          aria-label="Open dashboard menu"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 w-9 flex-col items-center justify-center gap-[3px] rounded-xl border border-rule bg-mist/70 text-ink/60 active:scale-95"
        >
          <span className="h-[1.5px] w-4 rounded-full bg-current" />
          <span className="h-[1.5px] w-4 rounded-full bg-current" />
          <span className="h-[1.5px] w-4 rounded-full bg-current" />
        </button>
        <button
          aria-label="Open business profile"
          onClick={() => { setOpen(true); setProfileOpen(true); }}
          className="grid h-9 w-9 place-items-center rounded-full border border-vault/15 bg-vault/10 text-[10px] font-semibold text-vault"
        >
          {(businessName.trim()[0] || "B").toUpperCase()}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[80] sm:hidden">
          <button aria-label="Close dashboard menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />
          <aside className="absolute inset-y-0 left-0 w-[min(88vw,370px)] overflow-y-auto bg-mist border-r border-rule shadow-[24px_0_60px_rgba(18,24,43,.22)]">
            <div className="sticky top-0 z-10 border-b border-rule bg-white/95 px-4 py-4 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <button onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl border border-rule bg-mist text-ink/45">×</button>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-[.18em] text-vault/70">BizStack</div>
                  <div className="mt-1 truncate font-display text-[16px] text-ink">{businessName}</div>
                </div>
                <button onClick={() => setProfileOpen(v => !v)} className="grid h-9 w-9 place-items-center rounded-full border border-rule bg-mist text-[10px] font-semibold text-ink/65">
                  {(businessName.trim()[0] || "B").toUpperCase()}
                </button>
              </div>
            </div>

            <div className="p-3">
              <div className="mb-2 px-2 text-[9px] uppercase tracking-[.18em] text-ink/35">Workspace</div>
              <div className="space-y-1">
                {ITEMS.map(([label, href, detail]) => (
                  <Link key={href} href={href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-2xl border border-transparent px-3 py-3 hover:border-rule hover:bg-white">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-rule bg-mist text-[10px] text-ink/45">{String(label).slice(0, 1)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-medium text-ink">{label}</span>
                      <span className="mt-0.5 block truncate text-[8px] text-ink/40">{detail}</span>
                    </span>
                    <span className="text-ink/20">›</span>
                  </Link>
                ))}
              </div>

              <div className="my-4 h-px bg-rule" />

              <button onClick={() => setProfileOpen(v => !v)} className="w-full rounded-2xl border border-rule bg-white p-3 text-left">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-mist font-display text-lg">{(businessName.trim()[0] || "B").toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-medium text-ink">{businessName}</span>
                    <span className="block mt-1 text-[8px] text-ink/40">Business profile and workspace controls</span>
                  </span>
                  <span className="text-ink/30">{profileOpen ? "⌃" : "⌄"}</span>
                </div>
              </button>

              {profileOpen && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Link href="/dashboard/settings" onClick={() => setOpen(false)} className="rounded-xl border border-rule bg-white p-3">
                    <div className="text-[8px] uppercase tracking-wider text-ink/35">Settings</div>
                    <div className="mt-1 text-[9px] text-ink/65">Business controls</div>
                  </Link>
                  <Link href="/dashboard/ai-builder" onClick={() => setOpen(false)} className="rounded-xl border border-rule bg-white p-3">
                    <div className="text-[8px] uppercase tracking-wider text-ink/35">AI</div>
                    <div className="mt-1 text-[9px] text-ink/65">Open Builder</div>
                  </Link>
                </div>
              )}

              <form action="/auth/sign-out" method="post" className="mt-3">
                <button className="w-full rounded-xl border border-rule bg-white px-3 py-2.5 text-left text-[9px] text-ink/45 hover:text-ink">
                  Sign out
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
