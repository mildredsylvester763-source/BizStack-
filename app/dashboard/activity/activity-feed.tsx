"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type ActivityEvent = {
  id:string;
  event_type:string;
  summary:string;
  evidence:Record<string,unknown>;
  status:string;
  created_at:string;
  priority:string|null;
  category:string|null;
  action_type:string|null;
  due_at:string|null;
  resolved_at:string|null;
};

function label(v:string|null|undefined){
  return (v||"general").replace(/[._-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase());
}
function tone(event:ActivityEvent){
  if(event.status==="needs_approval" || event.priority==="critical") return "border-amber-200 bg-amber-50";
  if(event.status==="failed" || event.status==="error") return "border-red-200 bg-red-50";
  if(event.status==="auto_handled") return "border-emerald-200 bg-emerald-50";
  return "border-slate-200 bg-white";
}
function dot(event:ActivityEvent){
  if(event.status==="needs_approval" || event.priority==="critical") return "bg-amber-500";
  if(event.status==="failed" || event.status==="error") return "bg-red-500";
  if(event.status==="auto_handled") return "bg-emerald-500";
  return "bg-slate-400";
}

export default function ActivityFeed({events}:{events:ActivityEvent[]}){
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("all");
  const [status,setStatus]=useState("all");
  const [range,setRange]=useState("all");
  const [expanded,setExpanded]=useState<string|null>(null);

  const categories=useMemo(()=>["all",...Array.from(new Set(events.map(e=>e.category||"general")))], [events]);
  const filtered=useMemo(()=>{
    const now=Date.now();
    return events.filter(e=>{
      const hay=[e.summary,e.event_type,e.category,e.action_type].filter(Boolean).join(" ").toLowerCase();
      const q=!query.trim()||hay.includes(query.trim().toLowerCase());
      const c=category==="all"||(e.category||"general")===category;
      const s=status==="all"||e.status===status;
      const age=now-new Date(e.created_at).getTime();
      const r=range==="all"||(range==="24h"&&age<=86400000)||(range==="7d"&&age<=604800000)||(range==="30d"&&age<=2592000000);
      return q&&c&&s&&r;
    });
  },[events,query,category,status,range]);

  const attention=events.filter(e=>e.status==="needs_approval"||e.priority==="critical"||e.priority==="high").length;
  const handled=events.filter(e=>e.status==="auto_handled").length;
  const failed=events.filter(e=>e.status==="failed"||e.status==="error").length;

  const grouped=useMemo(()=>{
    const map=new Map<string,ActivityEvent[]>();
    for(const e of filtered){
      const key=new Date(e.created_at).toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric",year:"numeric"});
      if(!map.has(key)) map.set(key,[]);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries());
  },[filtered]);

  return <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-5">
    <section className="min-w-0">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200">
          <div className="flex flex-col xl:flex-row xl:items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">⌕</span>
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search events, customers, invoices, agents…" className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"/>
            </div>
            <select value={range} onChange={e=>setRange(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-600">
              <option value="all">All time</option><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option>
            </select>
            <select value={status} onChange={e=>setStatus(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-600">
              <option value="all">All status</option><option value="needs_approval">Needs approval</option><option value="auto_handled">Handled</option><option value="failed">Failed</option><option value="open">Open</option>
            </select>
          </div>
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {categories.map(c=><button key={c} onClick={()=>setCategory(c)} className={category===c?"whitespace-nowrap rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white":"whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-500 hover:bg-slate-50"}>{c==="all"?"All activity":label(c)}</button>)}
          </div>
        </div>

        <div className="px-4 sm:px-6 py-5">
          {grouped.length===0?<div className="py-16 text-center"><div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">⌁</div><h3 className="mt-4 text-sm font-semibold text-slate-800">No activity matches these filters</h3><p className="mt-1 text-xs text-slate-400">Try a wider date range or clear the search.</p></div>:
          <div className="space-y-8">{grouped.map(([day,items])=><div key={day}>
            <div className="flex items-center gap-3 mb-4"><span className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">{day}</span><div className="h-px bg-slate-100 flex-1"/><span className="text-[10px] text-slate-300">{items.length} event{items.length===1?"":"s"}</span></div>
            <div className="relative pl-6">
              <div className="absolute left-[5px] top-2 bottom-2 w-px bg-slate-200"/>
              <div className="space-y-3">{items.map(e=>{
                const open=expanded===e.id;
                return <article key={e.id} className="relative">
                  <span className={"absolute -left-[21px] top-5 h-2.5 w-2.5 rounded-full ring-4 ring-white "+dot(e)}/>
                  <div className={"rounded-2xl border p-4 transition-shadow hover:shadow-sm "+tone(e)}>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">{label(e.category)}</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-[10px] text-slate-400">{label(e.event_type)}</span>
                          {e.status==="needs_approval"&&<span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-700">Approval required</span>}
                          {e.status==="auto_handled"&&<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">Handled</span>}
                          {(e.status==="failed"||e.status==="error")&&<span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-semibold text-red-700">Failed</span>}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-800">{e.summary}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400">
                          <span>{new Date(e.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
                          {e.action_type&&<span>Action · {label(e.action_type)}</span>}
                          {e.priority&&e.priority!=="normal"&&<span>Priority · {label(e.priority)}</span>}
                          {e.due_at&&<span>Due · {new Date(e.due_at).toLocaleString()}</span>}
                        </div>
                      </div>
                      <button onClick={()=>setExpanded(open?null:e.id)} className="shrink-0 rounded-lg border border-slate-200/80 bg-white/70 px-2.5 py-1.5 text-[10px] text-slate-500 hover:bg-white">{open?"Hide":"Details"}</button>
                    </div>
                    {open&&<div className="mt-4 border-t border-slate-200/80 pt-4">
                      <p className="text-[9px] font-semibold uppercase tracking-[.14em] text-slate-400 mb-2">Evidence & execution context</p>
                      {Object.keys(e.evidence||{}).length?<div className="grid sm:grid-cols-2 gap-2">{Object.entries(e.evidence||{}).map(([k,v])=><div key={k} className="rounded-xl border border-slate-200 bg-white/70 p-3"><p className="text-[9px] uppercase tracking-[.12em] text-slate-400">{label(k)}</p><p className="mt-1 break-words text-xs text-slate-700">{typeof v==="object"?JSON.stringify(v):String(v)}</p></div>)}</div>:<p className="text-xs text-slate-400">No additional evidence was attached to this event.</p>}
                    </div>}
                  </div>
                </article>;
              })}</div>
            </div>
          </div>)}</div>}
        </div>
      </div>
    </section>

    <aside className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">Operational pulse</p><h2 className="mt-1 text-sm font-semibold text-slate-900">Activity control</h2></div><span className="h-2 w-2 rounded-full bg-emerald-500"/></div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-amber-50 p-3"><p className="text-[9px] uppercase tracking-wide text-amber-700">Attention</p><p className="mt-1 text-xl font-semibold text-amber-900">{attention}</p></div>
          <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[9px] uppercase tracking-wide text-emerald-700">Handled</p><p className="mt-1 text-xl font-semibold text-emerald-900">{handled}</p></div>
          <div className="rounded-xl bg-red-50 p-3"><p className="text-[9px] uppercase tracking-wide text-red-700">Failed</p><p className="mt-1 text-xl font-semibold text-red-900">{failed}</p></div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white">
        <p className="text-[9px] uppercase tracking-[.16em] text-white/40">Operator workspace</p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight">Turn activity into action.</h2>
        <p className="mt-2 text-xs leading-5 text-white/45">The timeline records what happened. The Operator can investigate the evidence, explain the event and take an authorized next step.</p>
        <Link href="/dashboard/ai-builder" className="mt-4 inline-flex items-center rounded-xl bg-white px-3 py-2 text-[11px] font-medium text-slate-900 hover:bg-slate-100">Open Operator →</Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">Workflow</p>
        <div className="mt-3 space-y-3">
          <div><p className="text-xs font-medium text-slate-700">Timeline</p><p className="text-[10px] text-slate-400">Immutable-style source history for business events.</p></div>
          <div><p className="text-xs font-medium text-slate-700">Action Center</p><p className="text-[10px] text-slate-400">Approvals, exceptions and decisions that need attention.</p></div>
          <div><p className="text-xs font-medium text-slate-700">Operator</p><p className="text-[10px] text-slate-400">Conversational investigation and authorized execution.</p></div>
        </div>
      </div>
    </aside>
  </div>;
}
