"use client";
import { useState } from "react";

const TABS = ["Campaigns","Email","Social","SEO","Analytics"];
const CHANNELS = [
  {label:"Email",value:"0",hint:"campaigns ready",icon:"✉"},
  {label:"Social",value:"0",hint:"scheduled posts",icon:"◈"},
  {label:"SEO",value:"—",hint:"visibility signal",icon:"⌕"},
  {label:"Leads",value:"0",hint:"new this period",icon:"◌"},
];

export default function MarketingPage() {
  const [tab,setTab]=useState("Campaigns");
  return (
    <div className="min-h-screen p-5 lg:p-6 relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_45%_0%,rgba(91,110,245,.16),transparent_62%)]"/>
      <div className="relative max-w-[1500px] mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5 pb-5 border-b border-white/[.055]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400/20 to-cyan-400/10 border border-violet-200/10 grid place-items-center text-violet-100/80 shadow-[0_0_28px_rgba(139,92,246,.08)]">◈</span>
              <div><div className="text-[8px] uppercase tracking-[.2em] text-violet-200/45">Growth engine</div><h1 className="text-[20px] font-semibold tracking-[-.03em] text-white">Marketing</h1></div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 ml-11">Campaigns, content, audience growth and automation in one operating surface.</p>
          </div>
          <button className="px-4 py-2.5 rounded-xl text-[9px] font-medium text-white border border-indigo-200/10 bg-gradient-to-r from-blue-600 to-violet-600 shadow-[0_0_28px_rgba(91,110,245,.16)]">+ New Campaign</button>
        </div>

        <div className="flex gap-1 mb-5 bg-[#0a111e]/90 border border-white/[.06] rounded-xl p-1 w-fit overflow-x-auto">
          {TABS.map(t=><button key={t} onClick={()=>setTab(t)} className={`shrink-0 px-4 py-2 rounded-lg text-[9px] transition-all ${tab===t?"text-white bg-indigo-500/20 border border-indigo-300/15 shadow-[0_0_18px_rgba(91,110,245,.08)]":"text-white/35 border border-transparent hover:text-white/70 hover:bg-white/[.025]"}`}>{t}</button>)}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
          {CHANNELS.map((s,i)=><div key={s.label} className="relative overflow-hidden bg-[#0b1220]/90 border border-white/[.06] rounded-xl p-4 shadow-[0_12px_35px_rgba(0,0,0,.13)] hover:border-violet-300/[.16] transition-all">
            <div className="absolute -right-8 -top-8 w-20 h-20 rounded-full bg-indigo-400/[.06] blur-2xl"/>
            <div className="relative flex items-start justify-between"><span className="w-7 h-7 rounded-lg bg-white/[.03] border border-white/[.06] grid place-items-center text-indigo-200/70 text-[10px]">{s.icon}</span><span className="text-[7px] text-white/20">0{i+1}</span></div>
            <p className="text-[8px] text-slate-500 mt-3">{s.label}</p><p className="text-xl font-semibold text-white mt-0.5">{s.value}</p><p className="text-[7px] text-white/25 mt-1">{s.hint}</p>
          </div>)}
        </div>

        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-3">
          <div className="bg-[#0b1220]/90 border border-white/[.06] rounded-xl overflow-hidden shadow-[0_16px_45px_rgba(0,0,0,.14)]">
            <div className="p-4 border-b border-white/[.055] flex items-center justify-between"><div><h2 className="text-sm font-semibold text-white">Campaign workspace</h2><p className="text-[8px] text-slate-600 mt-1">Build the brief first, then connect delivery channels.</p></div><span className="text-[7px] uppercase tracking-[.15em] text-indigo-200/35">Workspace</span></div>
            <div className="p-4 grid sm:grid-cols-2 gap-2.5">
              {[["Launch campaign","Turn a business goal into audience, message and channel steps.","AI"],["Create email sequence","Draft a multi-step nurture or announcement sequence.","EMAIL"],["Plan social calendar","Prepare platform-specific posts without publishing them.","SOCIAL"],["Optimize landing copy","Generate structured copy suggestions for conversion tests.","SEO"]].map(([t,d,b])=><button key={t} className="text-left rounded-xl border border-white/[.055] bg-white/[.018] p-3.5 hover:border-cyan-300/[.16] hover:bg-cyan-300/[.025] transition-all"><div className="flex justify-between gap-3"><span className="text-[10px] font-medium text-white/80">{t}</span><span className="text-[7px] text-cyan-200/35">{b}</span></div><p className="text-[8px] leading-4 text-white/30 mt-2">{d}</p><span className="inline-block mt-3 text-[8px] text-indigo-200/55">Open workspace →</span></button>)}
            </div>
          </div>
          <div className="bg-[#0b1220]/90 border border-white/[.06] rounded-xl p-4 shadow-[0_16px_45px_rgba(0,0,0,.14)]">
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-white">Automation readiness</h2><span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_9px_rgba(34,211,238,.7)]"/></div>
            <div className="mt-4 space-y-2">
              {[["Audience","Connect CRM or customer source","01"],["Delivery","Connect email/social provider","02"],["Measurement","Define conversion events","03"],["Approval","Review before external publishing","04"]].map(([t,d,n])=><div key={t} className="flex gap-3 rounded-lg border border-white/[.045] bg-white/[.012] p-3"><span className="text-[7px] text-indigo-200/35 mt-0.5">{n}</span><div><p className="text-[9px] text-white/65">{t}</p><p className="text-[7px] text-white/25 mt-1">{d}</p></div></div>)}
            </div>
            <div className="mt-4 rounded-xl border border-amber-300/10 bg-amber-400/[.03] p-3 text-[8px] leading-4 text-amber-100/40">Planning surface: external campaigns are not reported as sent or published until the corresponding provider action is connected and confirmed.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
