"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

type Agent = {
  id: string;
  name: string;
  role: string;
  status: string;
  autonomy_mode: string;
  last_run_at?: string | null;
};

type Connector = {
  id: string;
  name: string;
  category: string;
  auth_type: string;
  status: string;
};

type Extension = {
  id: string;
  name: string;
  extension_type: string;
  status: string;
  current_version: string;
};

type Embed = {
  id: string;
  name: string;
  embed_type: string;
  status: string;
};

const agentTemplates = [
  ["Collections Agent","receivables","Find overdue invoices, prepare reminders, reconcile responses, and escalate exceptions."],
  ["Customer Agent","customer_success","Monitor customer activity, draft replies, surface churn risks, and create follow-ups."],
  ["Inventory Agent","operations","Watch stock, supplier changes, reorder points, margins, and fulfilment exceptions."],
  ["Growth Agent","growth","Turn business events into campaigns, segments, experiments, and measurable growth actions."],
  ["Finance Agent","finance","Monitor cash, receivables, expenses, reserves, anomalies, and approval-required money actions."],
  ["Operations Agent","operations","Coordinate recurring operational work, exceptions, deadlines, and team handoffs."]
];

export default function ExtensionsPage() {
  const supabase = createClient();
  const [businessId,setBusinessId] = useState("");
  const [agents,setAgents] = useState<Agent[]>([]);
  const [connectors,setConnectors] = useState<Connector[]>([]);
  const [extensions,setExtensions] = useState<Extension[]>([]);
  const [embeds,setEmbeds] = useState<Embed[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState("");
  const [tab,setTab] = useState<"agents"|"connectors"|"extensions"|"embeds">("agents");

  async function load() {
    const {data:{user}} = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const {data:b} = await supabase.from("businesses").select("id").eq("owner_id",user.id).single();
    if (!b) { setLoading(false); return; }
    setBusinessId(b.id);
    const [a,c,e,w] = await Promise.all([
      supabase.from("ai_agents").select("id,name,role,status,autonomy_mode,last_run_at").eq("business_id",b.id).order("created_at"),
      supabase.from("connector_definitions").select("id,name,category,auth_type,status").eq("business_id",b.id).order("created_at"),
      supabase.from("extensions").select("id,name,extension_type,status,current_version").eq("business_id",b.id).order("created_at"),
      supabase.from("website_embeds").select("id,name,embed_type,status").eq("business_id",b.id).order("created_at")
    ]);
    setAgents(a.data || []); setConnectors(c.data || []); setExtensions(e.data || []); setEmbeds(w.data || []);
    setLoading(false);
  }

  useEffect(()=>{ load(); },[]);

  async function createAgent(template: typeof agentTemplates[number]) {
    if (!businessId) return;
    setBusy(template[0]);
    const slug = template[0].toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    const {error} = await supabase.from("ai_agents").insert({
      business_id:businessId,name:template[0],slug,role:template[1],
      description:template[2],status:"active",autonomy_mode:"ask_first",
      tools:["business_context","events","customers","invoices","payments","products","inventory","communications"],
      permissions:["read_business_context","read_customers","read_invoices","read_events","draft_actions"],
      triggers:["manual","business_event","scheduled"],
      memory_config:{enabled:true,scope:"business",retention:"configurable"}
    });
    setBusy("");
    if (error) { alert(error.message); return; }
    await load();
  }

  async function createConnector() {
    if (!businessId) return;
    setBusy("connector");
    const n = `Custom Connector ${connectors.length + 1}`;
    const {error} = await supabase.from("connector_definitions").insert({
      business_id:businessId,name:n,slug:n.toLowerCase().replace(/[^a-z0-9]+/g,"-"),
      description:"Custom API connector definition ready for authentication, discovery, mapping and testing.",
      category:"custom",auth_type:"api_key",status:"draft",
      capabilities:{discover:true,test:true,sync:true,webhooks:true,health_checks:true},
      schema_definition:{resources:[],fields:[],relationships:[]},
      config:{setup_stage:"builder"}
    });
    setBusy("");
    if (error) { alert(error.message); return; }
    await load();
  }

  async function createExtension() {
    if (!businessId) return;
    setBusy("extension");
    const n = `Private Extension ${extensions.length + 1}`;
    const {error} = await supabase.from("extensions").insert({
      business_id:businessId,name:n,slug:n.toLowerCase().replace(/[^a-z0-9]+/g,"-"),
      extension_type:"custom_app",visibility:"private",status:"draft",
      description:"Private BizStack extension with versioning, permissions, endpoints and settings.",
      manifest:{runtime:"bizstack-extension",entrypoint:"index",api_version:"1"},
      permissions:["business.read","customers.read","events.read"],
      endpoints:[],settings:{}
    });
    setBusy("");
    if (error) { alert(error.message); return; }
    await load();
  }

  async function createEmbed() {
    if (!businessId) return;
    setBusy("embed");
    const {error} = await supabase.from("website_embeds").insert({
      business_id:businessId,name:`Business Widget ${embeds.length + 1}`,
      embed_type:"widget",provider:"bizstack",status:"draft",
      placement:{location:"page",position:"after_content"},config:{responsive:true,theme:"inherit"}
    });
    setBusy("");
    if (error) { alert(error.message); return; }
    await load();
  }

  const tabs = [
    ["agents","AI Agents",agents.length],
    ["connectors","Connector Builder",connectors.length],
    ["extensions","Extensions",extensions.length],
    ["embeds","Website Embeds",embeds.length]
  ] as const;

  return <main className="min-h-screen bg-ledger">
    <header className="border-b border-rule bg-white">
      <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
        <div><Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link><h1 className="font-display text-2xl mt-1">BizStack Platform</h1></div>
        <Link href="/dashboard/integrations" className="text-sm text-vault">Integration Hub</Link>
      </div>
    </header>

    <section className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[.18em] text-vault">Extensibility + AI operating layer</p>
        <h2 className="font-display text-3xl mt-2">Build the systems BizStack does not already have.</h2>
        <p className="text-sm text-ink/55 mt-2 max-w-3xl">Create business-specific agents, connectors, extensions and website widgets. Definitions are stored separately from execution so credentials, permissions, approvals and runtime workers can be added without changing the business data model.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 border border-rule bg-white mb-8">
        {tabs.map(([key,label,count])=><button key={key} onClick={()=>setTab(key)} className={`p-4 text-left border-r border-rule last:border-r-0 ${tab===key?"bg-mist":"hover:bg-mist/60"}`}><p className="text-xs text-ink/45">{label}</p><p className="font-display text-2xl mt-1">{loading?"—":count}</p></button>)}
      </div>

      {tab==="agents" && <section className="bg-white border border-rule p-6">
        <div className="flex justify-between items-start gap-4 mb-6"><div><h3 className="font-display text-xl">AI Agent Factory</h3><p className="text-xs text-ink/50 mt-1">Agents have roles, tools, permissions, triggers, memory and controlled autonomy.</p></div></div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {agentTemplates.map(t=><div key={t[0]} className="border border-rule p-5"><p className="font-medium text-sm">{t[0]}</p><p className="text-xs text-ink/50 mt-2 leading-5">{t[2]}</p><button onClick={()=>createAgent(t)} disabled={!!busy || agents.some(a=>a.name===t[0])} className="mt-4 border border-rule px-3 py-2 text-xs hover:border-vault disabled:opacity-40">{busy===t[0]?"Creating…":agents.some(a=>a.name===t[0])?"Created":"Create agent"}</button></div>)}
        </div>
        {agents.length>0 && <div className="border-t border-rule pt-5 space-y-2">{agents.map(a=><div key={a.id} className="flex justify-between border border-rule p-4"><div><p className="text-sm font-medium">{a.name}</p><p className="text-xs text-ink/45 mt-1">{a.role} · {a.autonomy_mode} · {a.status}</p></div><span className="text-xs text-ink/40">{a.last_run_at?"Last run recorded":"No runs yet"}</span></div>)}</div>}
      </section>}

      {tab==="connectors" && <section className="bg-white border border-rule p-6">
        <div className="flex justify-between gap-4 mb-6"><div><h3 className="font-display text-xl">Universal Connector Builder</h3><p className="text-xs text-ink/50 mt-1">The builder is designed around authentication → discovery → schema → mapping → test → sync → health.</p></div><button onClick={createConnector} disabled={!!busy} className="bg-ink text-white px-4 py-2 text-xs">{busy==="connector"?"Creating…":"Create connector"}</button></div>
        {connectors.length===0?<p className="text-sm text-ink/45">No custom connector definitions yet.</p>:<div className="space-y-2">{connectors.map(c=><div key={c.id} className="border border-rule p-4 flex justify-between"><div><p className="text-sm font-medium">{c.name}</p><p className="text-xs text-ink/45 mt-1">{c.category} · {c.auth_type}</p></div><span className="text-xs text-ink/45">{c.status}</span></div>)}</div>}
      </section>}

      {tab==="extensions" && <section className="bg-white border border-rule p-6">
        <div className="flex justify-between gap-4 mb-6"><div><h3 className="font-display text-xl">Extension Studio</h3><p className="text-xs text-ink/50 mt-1">Private/internal/marketplace-ready extensions with permissions, manifests and versions.</p></div><button onClick={createExtension} disabled={!!busy} className="bg-ink text-white px-4 py-2 text-xs">{busy==="extension"?"Creating…":"Create extension"}</button></div>
        {extensions.length===0?<p className="text-sm text-ink/45">No extensions created yet.</p>:<div className="space-y-2">{extensions.map(e=><div key={e.id} className="border border-rule p-4 flex justify-between"><div><p className="text-sm font-medium">{e.name}</p><p className="text-xs text-ink/45 mt-1">{e.extension_type} · v{e.current_version}</p></div><span className="text-xs text-ink/45">{e.status}</span></div>)}</div>}
      </section>}

      {tab==="embeds" && <section className="bg-white border border-rule p-6">
        <div className="flex justify-between gap-4 mb-6"><div><h3 className="font-display text-xl">Website Embed Builder</h3><p className="text-xs text-ink/50 mt-1">Prepare reusable BizStack widgets for external websites, storefronts and portals.</p></div><button onClick={createEmbed} disabled={!!busy} className="bg-ink text-white px-4 py-2 text-xs">{busy==="embed"?"Creating…":"Create embed"}</button></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">{["Lead form","Booking","Checkout","Customer portal login"].map(x=><div key={x} className="border border-rule p-4 text-xs"><p className="font-medium">{x}</p><p className="text-ink/45 mt-1">Reusable external-site widget</p></div>)}</div>
        {embeds.length===0?<p className="text-sm text-ink/45">No website embeds created yet.</p>:<div className="space-y-2">{embeds.map(e=><div key={e.id} className="border border-rule p-4 flex justify-between"><div><p className="text-sm font-medium">{e.name}</p><p className="text-xs text-ink/45 mt-1">{e.embed_type} · {e.provider}</p></div><span className="text-xs text-ink/45">{e.status}</span></div>)}</div>}
      </section>}

      <div className="mt-8 border border-rule bg-mist p-5 text-xs text-ink/55 leading-5">
        <strong className="text-ink">Runtime boundary:</strong> creating a definition does not pretend that an external API has already been authenticated or that an AI agent has already executed a business action. Runtime workers will use these definitions with permission checks, approval gates, audit events, secrets management, retries, rate limits and connector health.
      </div>
    </section>
  </main>;
}
