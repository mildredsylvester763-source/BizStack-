"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

const ACTION_TYPES = [
  { key: "send_payment_reminder", label: "Send payment reminders", description: "Nudge customers when an invoice is overdue." },
  { key: "draft_customer_reply", label: "Draft customer replies", description: "Write a reply to incoming customer messages." },
  { key: "flag_low_stock", label: "Flag low stock", description: "Warn when a product is running low." },
  { key: "draft_invoice_from_message", label: "Draft invoices from messages", description: "Turn a chat message into an invoice draft." }
];

const MODES = [
  { value: "draft_only", label: "Draft only" },
  { value: "ask_first", label: "Ask before doing" },
  { value: "auto_execute", label: "Do automatically" }
];

export default function AutomationSettingsPage() {
  const supabase = createClient();
  const [businessId, setBusinessId] = useState("");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      const { data: business } = await supabase.from("businesses").select("id,name").eq("owner_id", user.id).single();
      if (!business) { window.location.href = "/onboarding"; return; }
      setBusinessId(business.id);
      const { data } = await supabase.from("automation_settings").select("action_type,mode").eq("business_id", business.id);
      const next: Record<string,string> = {};
      (data || []).forEach((row) => { next[row.action_type] = row.mode; });
      setSettings(next);
      setLoading(false);
    }
    load();
  }, []);

  async function changeMode(actionType: string, mode: string) {
    if (!businessId) return;
    setSaving(actionType);
    const { error } = await supabase.from("automation_settings").upsert(
      { business_id: businessId, action_type: actionType, mode },
      { onConflict: "business_id,action_type" }
    );
    if (error) alert(error.message);
    else setSettings((current) => ({ ...current, [actionType]: mode }));
    setSaving("");
  }

  return (
    <main className="min-h-screen bg-ledger">
      <header className="border-b border-rule bg-white">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/dashboard" className="font-display text-lg text-ink">BizStack</Link>
          <Link href="/dashboard" className="text-sm text-ink/45 hover:text-ink">Back to dashboard</Link>
        </div>
      </header>
      <section className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display text-3xl text-ink mb-1">Automation settings</h1>
        <p className="text-ink/60 mb-10">Choose how much BizStack does on its own for each kind of action.</p>
        {loading ? <p className="text-sm text-ink/50">Loading…</p> : (
          <div className="divide-y divide-rule border-t border-b border-rule">
            {ACTION_TYPES.map((action) => (
              <div key={action.key} className="py-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-ink font-medium">{action.label}</p>
                  <p className="text-sm text-ink/55 mt-0.5">{action.description}</p>
                </div>
                <select
                  value={settings[action.key] ?? "ask_first"}
                  onChange={(e) => changeMode(action.key, e.target.value)}
                  disabled={saving === action.key}
                  className="border border-rule px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-vault/25 disabled:opacity-60"
                >
                  {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
