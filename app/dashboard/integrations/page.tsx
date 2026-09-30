"use client";

import { useMemo, useState } from "react";

type Connector = {
  name: string;
  cat: string;
  color: string;
  letter: string;
  connected: boolean;
  description: string;
  scopes: string[];
};

const CATEGORIES = ["All (48)", "Popular", "Development", "Communication", "Finance", "Marketing", "Storage", "Productivity", "E-commerce"];

const CONNECTORS: Connector[] = [
  { name:"GitHub", cat:"Development", color:"#151b2b", letter:"G", connected:false, description:"Repositories, commits, issues and pull requests.", scopes:["Read repositories","Write code","Manage issues"] },
  { name:"GitLab", cat:"Development", color:"#FC6D26", letter:"GL", connected:false, description:"Source control, merge requests and CI context.", scopes:["Projects","Merge requests","CI pipelines"] },
  { name:"Bitbucket", cat:"Development", color:"#0052CC", letter:"B", connected:false, description:"Repositories and team development workflows.", scopes:["Repositories","Pull requests","Pipelines"] },
  { name:"Vercel", cat:"Hosting", color:"#080b12", letter:"▲", connected:true, description:"Deployments, previews, domains and build status.", scopes:["Projects","Deployments","Logs"] },
  { name:"Supabase", cat:"Database", color:"#123d33", letter:"S", connected:true, description:"Database, authentication and governed business data.", scopes:["Database","Auth","Storage"] },
  { name:"Figma", cat:"Design", color:"#F24E1E", letter:"F", connected:false, description:"Design files, components and visual references.", scopes:["Files","Comments","Design metadata"] },
  { name:"Linear", cat:"Project Mgmt", color:"#31396b", letter:"L", connected:false, description:"Issues, projects, cycles and team planning.", scopes:["Issues","Projects","Comments"] },
  { name:"Jira", cat:"Project Mgmt", color:"#1648a4", letter:"J", connected:false, description:"Projects, tickets, workflows and delivery context.", scopes:["Projects","Issues","Transitions"] },
  { name:"Slack", cat:"Communication", color:"#4A154B", letter:"S", connected:false, description:"Channels, messages and operational notifications.", scopes:["Channels","Messages","Notifications"] },
  { name:"Google Drive", cat:"Storage", color:"#214f9d", letter:"G", connected:false, description:"Business files and shared knowledge sources.", scopes:["Files","Folders","Shared drives"] },
  { name:"AWS", cat:"Cloud", color:"#6b4508", letter:"A", connected:false, description:"Cloud resources and infrastructure context.", scopes:["Resources","Logs","Deployments"] },
  { name:"Stripe", cat:"Payments", color:"#39316f", letter:"S", connected:false, description:"Payments, customers, invoices and billing events.", scopes:["Customers","Payments","Invoices"] },
  { name:"PayPal", cat:"Payments", color:"#143e79", letter:"P", connected:false, description:"Payment activity and customer transaction context.", scopes:["Transactions","Customers","Reports"] },
  { name:"QuickBooks", cat:"Accounting", color:"#236b24", letter:"Q", connected:false, description:"Accounting, expenses and financial reporting.", scopes:["Accounts","Transactions","Reports"] },
  { name:"Xero", cat:"Accounting", color:"#126c83", letter:"X", connected:false, description:"Accounting records, contacts and financial reports.", scopes:["Contacts","Invoices","Reports"] },
  { name:"Mailchimp", cat:"Marketing", color:"#8a7415", letter:"M", connected:false, description:"Audiences, campaigns and marketing performance.", scopes:["Audiences","Campaigns","Analytics"] },
  { name:"Twilio", cat:"Communication", color:"#7d1e2d", letter:"T", connected:false, description:"SMS, messaging and communication workflows.", scopes:["Messages","Numbers","Delivery status"] },
  { name:"Notion", cat:"Productivity", color:"#151515", letter:"N", connected:false, description:"Knowledge bases, pages and operating notes.", scopes:["Pages","Databases","Comments"] },
  { name:"Dropbox", cat:"Storage", color:"#164e9c", letter:"D", connected:false, description:"Files and shared folders for business context.", scopes:["Files","Folders","Sharing"] },
  { name:"Microsoft 365", cat:"Productivity", color:"#7c2f13", letter:"M", connected:false, description:"Business documents, mail and productivity context.", scopes:["Files","Mail","Calendar"] },
  { name:"Shopify", cat:"E-commerce", color:"#4d6927", letter:"S", connected:false, description:"Products, orders, customers and storefront context.", scopes:["Products","Orders","Customers"] },
  { name:"WooCommerce", cat:"E-commerce", color:"#51346f", letter:"W", connected:false, description:"Store products, orders and customer activity.", scopes:["Products","Orders","Customers"] },
  { name:"Paystack", cat:"Payments", color:"#075f78", letter:"P", connected:false, description:"African payments, transactions and settlements.", scopes:["Transactions","Customers","Transfers"] },
  { name:"Flutterwave", cat:"Payments", color:"#77520d", letter:"F", connected:false, description:"Payments, customers and transaction records.", scopes:["Transactions","Customers","Settlements"] }
];

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState("All (48)");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Connector | null>(null);

  const filtered = useMemo(() => CONNECTORS.filter(c =>
    (activeTab.startsWith("All") || activeTab === "Popular" ? true : c.cat.toLowerCase().includes(activeTab.toLowerCase()) || c.name.toLowerCase().includes(activeTab.toLowerCase())) &&
    (c.name.toLowerCase().includes(search.toLowerCase()) || c.cat.toLowerCase().includes(search.toLowerCase()))
  ), [activeTab, search]);

  const connectedCount = CONNECTORS.filter(c => c.connected).length;

  return (
    <div className="min-h-screen p-5 lg:p-6 relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_48%_0%,rgba(37,99,235,.15),transparent_60%)]" />
      <div className="relative max-w-[1500px] mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5 pb-5 border-b border-white/[.055]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400/20 to-indigo-500/20 border border-cyan-200/10 grid place-items-center text-cyan-100/80 text-sm shadow-[0_0_28px_rgba(24,198,255,.08)]">⊕</span>
              <div>
                <div className="text-[8px] uppercase tracking-[.2em] text-cyan-200/45">Integration fabric</div>
                <h1 className="text-[20px] font-semibold tracking-[-.03em] text-white">Integrations &amp; Connectors</h1>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 ml-11">Connect business systems, development tools and data sources into one governed operating layer.</p>
          </div>
          <div className="flex gap-2">
            <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[.035] px-3 py-2">
              <div className="text-[7px] uppercase tracking-[.16em] text-emerald-200/45">Connected</div>
              <div className="text-[12px] text-emerald-100/75 mt-0.5">{connectedCount} live connectors</div>
            </div>
            <button className="px-4 py-2 rounded-xl text-[9px] font-medium text-white border border-indigo-200/10 bg-gradient-to-r from-blue-600 to-violet-600 shadow-[0_0_25px_rgba(91,110,245,.16)]">+ Custom Connector</button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_auto] gap-3 mb-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-xs">⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search connectors, apps or services..." className="w-full bg-[#0a111e]/90 border border-white/[.065] rounded-xl pl-9 pr-4 py-3 text-[10px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-300/25 shadow-[0_12px_35px_rgba(0,0,0,.12)]" />
          </div>
          <div className="hidden lg:flex items-center gap-2 rounded-xl border border-white/[.055] bg-white/[.018] px-3">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_9px_rgba(34,211,238,.7)]" />
            <span className="text-[8px] text-white/35">Scoped permissions · audit ready</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-5">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setActiveTab(c)} className={`shrink-0 px-3 py-1.5 rounded-lg text-[8px] font-medium transition-all ${activeTab===c ? "text-white border border-indigo-300/25 bg-indigo-500/15 shadow-[0_0_18px_rgba(91,110,245,.08)]" : "text-white/35 border border-transparent hover:border-white/10 hover:text-white/65"}`}>{c}</button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
          {filtered.map(c => (
            <button key={c.name} onClick={() => setSelected(c)} className="text-left group relative overflow-hidden bg-[#0b1220]/90 border border-white/[.06] rounded-xl p-3.5 hover:border-cyan-300/[.22] hover:-translate-y-0.5 transition-all shadow-[0_10px_30px_rgba(0,0,0,.12)]">
              <div className="absolute -right-7 -top-7 w-16 h-16 rounded-full bg-cyan-400/[.05] blur-2xl" />
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm mb-3 border border-white/[.08] shadow-[0_8px_22px_rgba(0,0,0,.25)]" style={{background:c.color}}>{c.letter.length > 1 ? <span className="text-[9px]">{c.letter}</span> : c.letter}</div>
              <p className="text-[10px] font-medium text-white truncate">{c.name}</p>
              <p className="text-[7px] text-slate-500 mb-3 truncate">{c.cat}</p>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[7px] px-2 py-1 rounded-full ${c.connected ? "text-emerald-300 bg-emerald-400/10 border border-emerald-300/10" : "text-indigo-200/55 bg-indigo-400/[.07] border border-indigo-300/10"}`}>{c.connected ? "● Connected" : "Configure"}</span>
                <span className="text-[10px] text-white/15 group-hover:text-white/50">→</span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 grid md:grid-cols-3 gap-2.5">
          {[
            ["Connection control","OAuth, scoped credentials, revocation and connection tests.","AUTH"],
            ["Data & events","Actions, events, retries and execution history per connector.","DATA"],
            ["AI context","Choose what BizStack can read, write and use for reasoning.","AI"]
          ].map(([title,desc,tag]) => (
            <div key={title} className="rounded-xl border border-white/[.055] bg-[#080e1a]/85 p-3.5">
              <div className="flex items-center justify-between"><span className="text-[8px] uppercase tracking-[.16em] text-indigo-200/40">{title}</span><span className="text-[7px] text-white/15">{tag}</span></div>
              <p className="text-[8px] leading-4 text-white/30 mt-2">{desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-white/[.055] flex flex-wrap items-center gap-4 text-[8px] text-white/30">
          <button className="hover:text-white/70">+ Add Custom Connector</button><span className="text-white/10">|</span><button className="hover:text-white/70">Manage Connectors</button><span className="text-white/10">|</span><span>Showing {filtered.length} featured connectors from the 48-connector catalog.</span>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end" onClick={() => setSelected(null)}>
          <aside onClick={e => e.stopPropagation()} className="h-full w-full max-w-md bg-[#07101e] border-l border-cyan-300/10 shadow-[-20px_0_70px_rgba(0,0,0,.45)] overflow-y-auto">
            <div className="p-5 border-b border-white/[.06] flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <div className="w-11 h-11 rounded-xl border border-white/[.08] grid place-items-center text-white font-bold" style={{background:selected.color}}>{selected.letter}</div>
                <div><div className="text-[7px] uppercase tracking-[.18em] text-cyan-200/45">{selected.cat}</div><h2 className="text-base font-semibold text-white mt-1">{selected.name}</h2><p className="text-[8px] text-white/30 mt-1">{selected.description}</p></div>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white text-lg">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-xl border border-indigo-300/10 bg-indigo-500/[.045] p-4">
                <div className="text-[8px] uppercase tracking-[.16em] text-indigo-200/45">Connection flow</div>
                <div className="mt-3 space-y-2">{["Authenticate account","Review requested scopes","Test connection","Enable actions & events"].map((x,i)=><div key={x} className="flex items-center gap-2 text-[8px] text-white/45"><span className="w-5 h-5 rounded-full border border-white/10 grid place-items-center text-[7px] text-indigo-200/60">{i+1}</span>{x}</div>)}</div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-[.16em] text-white/25 mb-2">Requested scope preview</div>
                <div className="space-y-1.5">{selected.scopes.map(s=><div key={s} className="rounded-lg border border-white/[.05] bg-white/[.018] px-3 py-2 text-[8px] text-white/40">{s}</div>)}</div>
              </div>
              <div className="rounded-xl border border-amber-300/10 bg-amber-400/[.035] p-3 text-[8px] leading-4 text-amber-100/45">Visual connector configuration surface. No account authorization is performed from this preview until the provider-specific connection action is wired.</div>
              <button onClick={() => setSelected(null)} className="w-full rounded-xl py-2.5 text-[9px] font-medium text-white border border-indigo-200/10 bg-gradient-to-r from-blue-600 to-violet-600">Close preview</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
