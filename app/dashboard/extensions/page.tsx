"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

type Tab = "agents" | "connectors" | "extensions" | "embeds";
type AgentTemplate = [string, string, string];

type Agent = {
  id: string;
  name: string;
  role: string;
  status: string;
  autonomy_mode: string;
};

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

const agentToolKeys = [
  "business.get_context",
  "customers.list",
  "invoices.list_outstanding",
  "inventory.list_low_stock",
  "money.summary",
  "events.create"
];

export default function ExtensionsPage() {
  const supabase = createClient();
  const [businessId, setBusinessId] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tab, setTab] = useState<Tab>("agents");
  const [busy, setBusy] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [runInput, setRunInput] = useState("");
  const [runBusy, setRunBusy] = useState(false);
  const [runResult, setRunResult] = useState<Record<string, unknown> | null>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (!business) return;

    setBusinessId(business.id);

    const { data } = await supabase
      .from("ai_agents")
      .select("id,name,role,status,autonomy_mode")
      .eq("business_id", business.id)
      .order("created_at");

    const next = data || [];
    setAgents(next);
    if (!selectedAgent && next[0]?.id) setSelectedAgent(next[0].id);
  }

  useEffect(() => {
    load();
  }, []);

  async function createAgent(template: AgentTemplate) {
    if (!businessId) return;
    setBusy(template[0]);

    const slug = template[0]
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const { data: created, error } = await supabase
      .from("ai_agents")
      .insert({
        business_id: businessId,
        name: template[0],
        slug,
        role: template[1],
        description: template[2],
        status: "active",
        autonomy_mode: "ask_first",
        tools: agentToolKeys,
        permissions: [
          "read_business_context",
          "read_customers",
          "read_invoices",
          "read_inventory",
          "read_money",
          "read_events",
          "draft_actions"
        ],
        triggers: ["manual","business_event","scheduled"],
        memory_config: { enabled: true, scope: "business", retention: "configurable" }
      })
      .select("id")
      .single();

    if (error || !created) {
      setBusy("");
      alert(error?.message || "Could not create the agent.");
      return;
    }

    const { data: tools } = await supabase
      .from("ai_tools")
      .select("id,tool_key")
      .in("tool_key", agentToolKeys);

    if (tools?.length) {
      await supabase.from("ai_agent_tool_bindings").upsert(
        tools.map((tool) => ({
          business_id: businessId,
          agent_id: created.id,
          tool_id: tool.id,
          enabled: true,
          configuration: {}
        })),
        { onConflict: "agent_id,tool_id" }
      );
    }

    setBusy("");
    setSelectedAgent(created.id);
    await load();
  }

  async function runAgent() {
    if (!selectedAgent || !runInput.trim()) return;
    setRunBusy(true);
    setRunResult(null);

    try {
      const response = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: selectedAgent, input: runInput.trim() })
      });
      const payload = await response.json();
      setRunResult(payload);
    } catch {
      setRunResult({ error: "Could not reach the agent runtime." });
    } finally {
      setRunBusy(false);
    }
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
        <p className="text-sm text-ink/55 mt-2 max-w-3xl">
          Native features, external systems and AI agents now share one controlled business operating layer.
          Agents can read approved business data, create auditable internal actions and persist every run step.
        </p>

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
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`p-4 text-left border-r border-rule ${tab === item.key ? "bg-mist" : "hover:bg-mist/60"}`}
            >
              <p className="text-xs text-ink/55">{item.label}</p>
              <p className="text-xs text-vault mt-2">Open workspace →</p>
            </button>
          ))}
        </div>

        {tab === "agents" && (
          <section className="bg-white border border-rule p-6 mt-6">
            <div className="flex items-start justify-between gap-5">
              <div>
                <h3 className="font-display text-xl">AI Agent Factory</h3>
                <p className="text-xs text-ink/50 mt-1">
                  Production-safe agents use explicit tools, business ownership, permissions and autonomy controls.
                </p>
              </div>
              <span className="text-[11px] px-2.5 py-1 border border-rule text-ink/50">Runtime active</span>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {agentTemplates.map(template => {
                const exists = agents.some(agent => agent.name === template[0]);
                return (
                  <div key={template[0]} className="border border-rule p-5">
                    <p className="font-medium text-sm">{template[0]}</p>
                    <p className="text-xs text-ink/50 mt-2 leading-5">{template[2]}</p>
                    <button
                      onClick={() => createAgent(template)}
                      disabled={exists || !!busy}
                      className="mt-4 border border-rule px-3 py-2 text-xs hover:border-vault disabled:opacity-40"
                    >
                      {busy === template[0] ? "Creating…" : exists ? "Created" : "Create agent"}
                    </button>
                  </div>
                );
              })}
            </div>

            {agents.length > 0 && (
              <>
                <div className="border-t border-rule mt-8 pt-5 space-y-2">
                  {agents.map(agent => (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent.id)}
                      className={`w-full text-left border p-4 flex justify-between gap-4 transition-colors ${selectedAgent === agent.id ? "border-vault bg-mist" : "border-rule hover:border-vault/50"}`}
                    >
                      <div>
                        <p className="text-sm font-medium">{agent.name}</p>
                        <p className="text-xs text-ink/45 mt-1">{agent.role} · {agent.autonomy_mode}</p>
                      </div>
                      <span className="text-xs text-ink/45">{agent.status}</span>
                    </button>
                  ))}
                </div>

                <div className="border-t border-rule mt-8 pt-6">
                  <p className="text-xs uppercase tracking-[.15em] text-vault">Live runtime test</p>
                  <h4 className="font-display text-xl mt-1">Give the selected agent a business task</h4>
                  <p className="text-xs text-ink/50 mt-2">
                    Try: “Show me overdue invoices and tell me what needs attention” or “Check low stock and summarize the risks.”
                  </p>
                  <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <select
                      value={selectedAgent}
                      onChange={(event) => setSelectedAgent(event.target.value)}
                      className="border border-rule px-3 py-3 text-sm bg-white outline-none"
                    >
                      {agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                    </select>
                    <input
                      value={runInput}
                      onChange={event => setRunInput(event.target.value)}
                      onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) runAgent(); }}
                      placeholder="Ask the agent to inspect something…"
                      className="flex-1 border border-rule px-4 py-3 text-sm outline-none focus:border-vault"
                    />
                    <button
                      onClick={runAgent}
                      disabled={runBusy || !runInput.trim()}
                      className="bg-ink text-white px-5 py-3 text-sm disabled:opacity-40"
                    >
                      {runBusy ? "Running…" : "Run agent"}
                    </button>
                  </div>

                  {runResult && (
                    <div className="mt-5 border border-rule bg-mist p-5">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm font-medium">Run result</p>
                        <span className="text-[11px] uppercase tracking-[.12em] text-vault">
                          {String(runResult.status ?? "completed")}
                        </span>
                      </div>
                      {runResult.output ? (
                        <pre className="mt-4 text-xs text-ink/65 whitespace-pre-wrap overflow-x-auto">
                          {JSON.stringify(runResult.output, null, 2)}
                        </pre>
                      ) : (
                        <p className="mt-3 text-xs text-red-700">{String(runResult.error ?? "No result returned.")}</p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {tab === "connectors" && (
          <section className="bg-white border border-rule p-6 mt-6">
            <h3 className="font-display text-xl">Universal Connector Builder</h3>
            <p className="text-sm text-ink/50 mt-2">Authentication → endpoint discovery → schema → field mapping → test → sync → health monitoring.</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
              {["OAuth","API / bearer","Webhooks","Database / files"].map(x => (
                <div key={x} className="border border-rule p-4 text-xs">
                  <p className="font-medium">{x}</p>
                  <p className="text-ink/45 mt-1">Supported connection path</p>
                </div>
              ))}
            </div>
            <Link href="/dashboard/integrations" className="inline-block mt-6 text-sm text-vault">Open connection setup →</Link>
          </section>
        )}

        {tab === "extensions" && (
          <section className="bg-white border border-rule p-6 mt-6">
            <h3 className="font-display text-xl">Extension Studio</h3>
            <p className="text-sm text-ink/50 mt-2">Private extensions can become internal tools or marketplace packages with versioning, manifests, permissions, settings and installation records.</p>
            <div className="grid md:grid-cols-3 gap-3 mt-6">
              {["Custom app","AI tool","Workflow / report"].map(x => (
                <div key={x} className="border border-rule p-4 text-xs">
                  <p className="font-medium">{x}</p>
                  <p className="text-ink/45 mt-1">Versioned extension type</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "embeds" && (
          <section className="bg-white border border-rule p-6 mt-6">
            <h3 className="font-display text-xl">Website Embed Builder</h3>
            <p className="text-sm text-ink/50 mt-2">Reusable widgets for external websites and storefronts without requiring every visitor to become a BizStack user.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
              {["Lead form","Booking","Checkout","Portal login"].map(x => (
                <div key={x} className="border border-rule p-4 text-xs">
                  <p className="font-medium">{x}</p>
                  <p className="text-ink/45 mt-1">External-site widget</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-8 border border-rule bg-mist p-5 text-xs text-ink/55 leading-5">
          <strong className="text-ink">Runtime status:</strong> agent runs now have a persisted plan, step-level execution records, explicit tool permissions, autonomy modes, internal business-event writes and approval infrastructure. External message sending, live connector credentials and provider-specific actions remain gated behind their respective connector implementations.
        </div>
      </section>
    </main>
  );
}
