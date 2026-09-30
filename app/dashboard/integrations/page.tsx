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
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-xl font-semibold text-white">Integrations &amp; Connectors</h1>
          <p className="text-sm text-textMuted mt-0.5">Connect your favorite tools, apps and services. All in one place.</p>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{background:"#5B6EF5"}}>+ New</button>
      </div>

      <div className="mt-4 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search connectors, apps or services..."
          className="w-full bg-surface border border-line rounded-xl px-4 py-2.5 text-sm text-text placeholder:text-textMuted focus:outline-none focus:border-primary"
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {filtered.map(c => (
          <div key={c.name} className="bg-surface border border-line rounded-xl p-4 hover:border-primary/40 transition-colors">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm mb-3 shadow-glow" style={{background:c.color}}>
              {c.letter.length > 1 ? <span className="text-xs">{c.letter}</span> : c.letter}
            </div>
            <p className="text-sm font-medium text-white truncate">{c.name}</p>
            <p className="text-[10px] text-textMuted mb-3 truncate">{c.cat}</p>
            {c.connected ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{background:"rgba(34,197,94,0.15)",color:"#22C55E"}}>● Connected</span>
            ) : (
              <button className="w-full py-1.5 rounded-lg text-xs font-medium text-white transition-colors hover:opacity-90" style={{background:"rgba(91,110,245,0.25)",color:"#5B6EF5"}}>Connect</button>
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
