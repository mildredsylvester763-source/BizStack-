"use client";
import { useState } from "react";

const CATEGORIES = ["All (48)","Popular","Development","Communication","Finance","Marketing","Storage","Productivity","E-commerce"];

const CONNECTORS = [
  { name:"GitHub",       cat:"Development",     color:"#1a1a2e", letter:"G",  connected:false },
  { name:"GitLab",       cat:"Development",     color:"#FC6D26", letter:"GL", connected:false },
  { name:"Bitbucket",    cat:"Development",     color:"#0052CC", letter:"B",  connected:false },
  { name:"Vercel",       cat:"Hosting",         color:"#000000", letter:"▲",  connected:true  },
  { name:"Supabase",     cat:"Database",        color:"#3ECF8E", letter:"S",  connected:true  },
  { name:"Figma",        cat:"Design",          color:"#F24E1E", letter:"F",  connected:false },
  { name:"Linear",       cat:"Project Mgmt",    color:"#5E6AD2", letter:"L",  connected:false },
  { name:"Jira",         cat:"Project Mgmt",    color:"#0052CC", letter:"J",  connected:false },
  { name:"Slack",        cat:"Communication",   color:"#4A154B", letter:"S",  connected:false },
  { name:"Google Drive", cat:"Storage",         color:"#4285F4", letter:"G",  connected:false },
  { name:"AWS",          cat:"Cloud",           color:"#FF9900", letter:"A",  connected:false },
  { name:"Stripe",       cat:"Payments",        color:"#635BFF", letter:"S",  connected:false },
  { name:"PayPal",       cat:"Payments",        color:"#003087", letter:"P",  connected:false },
  { name:"QuickBooks",   cat:"Accounting",      color:"#2CA01C", letter:"Q",  connected:false },
  { name:"Xero",         cat:"Accounting",      color:"#13B5EA", letter:"X",  connected:false },
  { name:"Mailchimp",    cat:"Marketing",       color:"#FFE01B", letter:"M",  connected:false },
  { name:"Twilio",       cat:"Communication",   color:"#F22F46", letter:"T",  connected:false },
  { name:"Notion",       cat:"Productivity",    color:"#ffffff", letter:"N",  connected:false },
  { name:"Dropbox",      cat:"Storage",         color:"#0061FF", letter:"D",  connected:false },
  { name:"Microsoft 365",cat:"Productivity",    color:"#D83B01", letter:"M",  connected:false },
  { name:"Shopify",      cat:"E-commerce",      color:"#96BF48", letter:"S",  connected:false },
  { name:"WooCommerce",  cat:"E-commerce",      color:"#7F54B3", letter:"W",  connected:false },
  { name:"Paystack",     cat:"Payments",        color:"#00C3F7", letter:"P",  connected:false },
  { name:"Flutterwave",  cat:"Payments",        color:"#F5A623", letter:"F",  connected:false },
];

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState("All (48)");
  const [search, setSearch] = useState("");

  const filtered = CONNECTORS.filter(c =>
    (activeTab.startsWith("All") || c.cat.toLowerCase().includes(activeTab.toLowerCase()) || c.name.toLowerCase().includes(activeTab.toLowerCase())) &&
    (c.name.toLowerCase().includes(search.toLowerCase()) || c.cat.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen p-5 lg:p-6 relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-[radial-gradient(circle_at_48%_0%,rgba(37,99,235,.13),transparent_60%)]" />
      <div className="relative flex items-center justify-between mb-1 pb-5 border-b border-white/[.055]">
        <div>
          <div><div className="flex items-center gap-2"><span className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400/20 to-indigo-500/20 border border-cyan-200/10 grid place-items-center text-cyan-100/80 text-xs">⊕</span><h1 className="text-[19px] font-semibold tracking-[-.02em] text-white">Integrations &amp; Connectors</h1></div>
          <p className="text-[11px] text-slate-500 mt-1 ml-10">Connect your favorite tools, apps and services. All in one place.</p></div>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{background:"linear-gradient(135deg,#5267ff,#7c3aed)",boxShadow:"0 0 24px rgba(91,110,245,.18)"}}>+ New</button>
      </div>

      <div className="mt-4 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search connectors, apps or services..."
          className="w-full bg-[#0a111e]/90 border border-white/[.065] rounded-xl px-4 py-3 text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-300/25 shadow-[0_12px_35px_rgba(0,0,0,.12)]"
        />
      </div>

      <div className="flex items-center gap-1 flex-wrap mb-6">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setActiveTab(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab===c?"text-white border border-primary/50":"text-textMuted border border-transparent hover:border-line hover:text-white"}`}
            style={activeTab===c ? {background:"rgba(91,110,245,0.15)"} : {}}>
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
        {filtered.map(c => (
          <div key={c.name} className="group relative overflow-hidden bg-[#0b1220]/90 border border-white/[.06] rounded-xl p-3.5 hover:border-indigo-300/[.18] hover:-translate-y-0.5 transition-all shadow-[0_10px_30px_rgba(0,0,0,.12)]">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm mb-3 border border-white/[.08] shadow-[0_8px_22px_rgba(0,0,0,.25)]" style={{background:c.color}}>
              {c.letter.length > 1 ? <span className="text-xs">{c.letter}</span> : c.letter}
            </div>
            <p className="text-[11px] font-medium text-white truncate">{c.name}</p>
            <p className="text-[8px] text-slate-500 mb-3 truncate">{c.cat}</p>
            {c.connected ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{background:"rgba(34,197,94,0.15)",color:"#22C55E"}}>● Connected</span>
            ) : (
              <button className="w-full py-1.5 rounded-lg text-[9px] font-medium text-white transition-all hover:opacity-90 border border-indigo-200/[.06]" style={{background:"rgba(91,110,245,0.25)",color:"#5B6EF5"}}>Connect</button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-4 text-xs text-textMuted border-t border-line pt-4">
        <button className="hover:text-white">+ Add Custom Connector</button>
        <span>|</span>
        <button className="hover:text-white">Manage Connectors</button>
        <span>|</span>
        <button className="hover:text-white text-primary">View All 48 Integrations</button>
      </div>
    </div>
  );
}
