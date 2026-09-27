"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

type Tab = "agents" | "connectors" | "extensions" | "embeds";
type AgentTemplate = [string, string, string];

const agentTemplates: AgentTemplate[] = [
  ["Collections Agent","receivables","Find overdue invoices, prepare reminders, reconcile responses, and escalate exceptions."],
  ["Customer Agent","customer_success","Monitor customer activity, draft replies, surface churn risks, and create follow-ups."],
  ["Inventory Agent","operations","Watch stock, supplier changes, reorder points, margins, and fulfilment exceptions."],
  ["Growth Agent","growth","Turn business events into campaigns, segments, experiments, and measurable growth actions."],
  ["Finance Agent","finance","Monitor cash, receivables, expenses, reserves, anomalies, and approval-required money actions."],
  ["Operations Agent","operations","Coordinate recurring operational work, exceptions, deadlines, and team handoffs."]
];

const capabilities = [
  ["AI agents","Roles, tools, permissions, triggers, memory, approvals and autonomy modes."],
  ["Universal connectors","OAuth, API keys, bearer auth, webhooks, databases, files, mapping and sync."],
  ["Extension runtime","Private, internal and marketplace-ready apps with manifests and versions."],
  ["Website embeds","Lead forms, checkout, booking, portal login and custom business widgets."],
  ["Agent safety","Approval gates, audit trails, retries, rate limits and scoped permissions."],
  ["Business events","Events can trigger agents, workflows, alerts, communications and analytics."]
];

export default function ExtensionsPage() {
  const supabase = createClient();
  const [businessId, setBusinessId] = useState("");
  const [agents, setAgents] = useState<{id:string;name:string;role:string;status:string;autonomy_mode:string}[]>([]);
  const [tab, setTab] = useState<Tab>("agents");
  const [busy, setBusy] = useState("");

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
    if (!business) return;
    setBusinessId(business.id);
    const { data } = await supabase.from("ai_agents").select("id,name,role,status,autonomy_mode").eq("business_id", business.id).order("created_at");
    setAgents(data || []);
  }

  useEffect(() => { load(); }, []);

  async function createAgent(template: AgentTemplate) {
    if (!businessId) return;
    setBusy(template[0]);
    const slug = template[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { error } = await supabase.from("ai_agents").insert({
      business_id: businessId,
      name: template[0],
      slug,
      role: template[1],
      description: template[2],
      status: "active",
      autonomy_mode: "ask_first",
      tools: ["business_context","events","customers","invoices","payments","products","inventory","communications"],
      permissions: ["read_business_context","read_customers","read_invoices","read_events","draft_actions"],
      triggers: ["manual","business_event","scheduled"],
      memory_config: { enabled: true, scope: "business", retention: "configurable" }
    });
    setBusy("");
    if (error) { alert(error.message); return; }
    await load();
  }

  const tabItems: { key: Tab; label: string }[] = [
    { key: "agents", label: "AI Agents" },
    { key: "connectors", label: "Connector Builder" },
    { key: "extensions", label: "Extensions" },
    { key: "embeds", label: "Website Embeds" }
  ];

  return (
    <main className="min-h-screen bg-ledger">
      <header className="border-b border-rule bg-white">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link>
            <h1 className="font-display text-2xl mt-1">BizStack Platform</h1>
          </div>
          <Link href="/dashboard/integrations" className="text-sm text-vault">Integration Hub</Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-10">
        <p className="text-xs uppercase tracking-[.18em] text-vault">Extensibility + AI operating layer</p>
        <h2 className="font-display text-3xl mt-2">Build the systems BizStack does not already have.</h2>
        <p className="text-sm text-ink/55 mt-2 max-w-3xl">BizStack is being structured so native features, external systems and AI agents can share one controlled business operating layer instead of becoming disconnected add-ons.</p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
          {capabilities.map(([title,description]) => (
            <div key={title} className="bg-white border border-rule p-5">
              <p className="font-medium text-sm">{title}</p>
              <p className="text-xs text-ink/50 mt-2 leading-5">{description}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 border border-rule bg-white mt-8">
          {tabItems.map(item => (
            <button key={item.key} onClick={() => setTab(item.key)} className={`p-4 text-left border-r border-rule ${tab === item.key ? "bg-mist" : "hover:bg-mist/60"}`}>
              <p className="text-xs text-ink/55">{item.label}</p>
              <p className="text-xs text-vault mt-2">Open workspace →</p>
            </button>
          ))}
        </div>

        {tab === "agents" && (
          <section className="bg-white border border-rule p-6 mt-6">
            <h3 className="font-display text-xl">AI Agent Factory</h3>
            <p className="text-xs text-ink/50 mt-1">Agents are definitions for controlled operational workers. They do not bypass approvals or permissions.</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {agentTemplates.map(template => {
                const exists = agents.some(agent => agent.name === template[0]);
                return (
                  <div key={template[0]} className="border border-rule p-5">
                    <p className="font-medium text-sm">{template[0]}</p>
                    <p className="text-xs text-ink/50 mt-2 leading-5">{template[2]}</p>
                    <button onClick={() => createAgent(template)} disabled={exists || !!busy} className="mt-4 border border-rule px-3 py-2 text-xs hover:border-vault disabled:opacity-40">
                      {busy === template[0] ? "Creating…" : exists ? "Created" : "Create agent"}
                    </button>
                  </div>
                );
              })}
            </div>
            {agents.length > 0 && (
              <div className="border-t border-rule mt-8 pt-5 space-y-2">
                {agents.map(agent => (
                  <div key={agent.id} className="border border-rule p-4 flex justify-between gap-4">
                    <div><p className="text-sm font-medium">{agent.name}</p><p className="text-xs text-ink/45 mt-1">{agent.role} · {agent.autonomy_mode}</p></div>
                    <span className="text-xs text-ink/45">{agent.status}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "connectors" && <section className="bg-white border border-rule p-6 mt-6"><h3 className="font-display text-xl">Universal Connector Builder</h3><p className="text-sm text-ink/50 mt-2">Authentication → endpoint discovery → schema → field mapping → test → sync → health monitoring.</p><div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">{["OAuth","API / bearer","Webhooks","Database / files"].map(x => <div key={x} className="border border-rule p-4 text-xs"><p className="font-medium">{x}</p><p className="text-ink/45 mt-1">Supported connection path</p></div>)}</div><Link href="/dashboard/integrations" className="inline-block mt-6 text-sm text-vault">Open connection setup →</Link></section>}

        {tab === "extensions" && <section className="bg-white border border-rule p-6 mt-6"><h3 className="font-display text-xl">Extension Studio</h3><p className="text-sm text-ink/50 mt-2">Private extensions can later become internal tools or marketplace packages with versioning, manifests, permissions, settings and installation records.</p><div className="grid md:grid-cols-3 gap-3 mt-6">{["Custom app","AI tool","Workflow / report"].map(x => <div key={x} className="border border-rule p-4 text-xs"><p className="font-medium">{x}</p><p className="text-ink/45 mt-1">Versioned extension type</p></div>)}</div></section>}

        {tab === "embeds" && <section className="bg-white border border-rule p-6 mt-6"><h3 className="font-display text-xl">Website Embed Builder</h3><p className="text-sm text-ink/50 mt-2">Reusable widgets for external websites and storefronts without requiring every visitor to become a BizStack user.</p><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">{["Lead form","Booking","Checkout","Portal login"].map(x => <div key={x} className="border border-rule p-4 text-xs"><p className="font-medium">{x}</p><p className="text-ink/45 mt-1">External-site widget</p></div>)}</div></section>}

        <div className="mt-8 border border-rule bg-mist p-5 text-xs text-ink/55 leading-5">
          <strong className="text-ink">Runtime boundary:</strong> these definitions are intentionally separate from execution. A real agent run will require scoped tools, permission checks, approval rules, audit events, secret handling, retries, rate limits and a worker/runtime layer before it can perform external actions.
        </div>
      </section>
    </main>
  );
}
