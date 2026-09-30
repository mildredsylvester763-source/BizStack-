"use client";
import { useState } from "react";

const TABS = ["Campaigns","Email","Social","SEO","Analytics"];

export default function MarketingPage() {
  const [tab, setTab] = useState("Campaigns");
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div><h1 className="text-xl font-semibold text-white">Marketing</h1><p className="text-sm text-textMuted mt-0.5">Campaigns, emails, and automation for your business.</p></div>
        <button className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{background:"#5B6EF5"}}>+ New Campaign</button>
      </div>
      <div className="flex gap-1 mb-6 bg-surface border border-line rounded-xl p-1 w-fit">
        {TABS.map(t=><button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab===t?"text-white":"text-textMuted hover:text-white"}`} style={tab===t?{background:"#5B6EF5"}:{}}>{t}</button>)}
      </div>
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {[{label:"Active Campaigns",value:"0"},{label:"Emails Sent",value:"0"},{label:"Open Rate",value:"—"}].map(s=>(
          <div key={s.label} className="bg-surface border border-line rounded-xl p-5"><p className="text-xs text-textMuted mb-1">{s.label}</p><p className="text-2xl font-bold text-white">{s.value}</p></div>
        ))}
      </div>
      <div className="bg-surface border border-line rounded-xl p-8 text-center">
        <p className="text-textMuted text-sm">Email campaigns, social scheduling, and lead generation coming in the next module.</p>
      </div>
    </div>
  );
}
