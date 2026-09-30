"use client";
import { useState } from "react";

type Message={role:"user"|"assistant";text:string};

const FEATURES=["Natural language","Business context","Multi-step planning","File analysis","Web search","Code generation","Image generation","Voice input","Chat history"];
const AGENTS=[
 {name:"Business Analyst",desc:"Market research, reports and insights",icon:"◈",tone:"from-amber-400/25 to-orange-400/10"},
 {name:"Marketing Agent",desc:"Campaigns, content and social media",icon:"✦",tone:"from-indigo-400/25 to-blue-400/10"},
 {name:"Sales Agent",desc:"Leads, follow-ups and proposals",icon:"↗",tone:"from-emerald-400/25 to-cyan-400/10"},
 {name:"Support Agent",desc:"Customer support and tickets",icon:"◌",tone:"from-violet-400/25 to-fuchsia-400/10"},
 {name:"Developer Agent",desc:"Code, fix, deploy and maintain",icon:"⌘",tone:"from-cyan-400/25 to-sky-400/10"}
];
const WORKFLOWS=[
 ["Invoice Reminder","When invoice is overdue","Active"],
 ["Welcome Email","When new customer is added","Active"],
 ["Low Stock Alert","When stock is below threshold","Active"],
 ["Social Media Post","Daily at 9:00 AM","Active"],
 ["Report Generation","Every Monday at 8:00 AM","Active"]
];

export default function AIAssistantPage(){
 const [messages,setMessages]=useState<Message[]>([{role:"assistant",text:"Hi! I'm BizStack AI. Tell me what you want to accomplish and I'll help plan the work, use your business context, and turn it into actions."}]);
 const [draft,setDraft]=useState("");
 const [agentTab,setAgentTab]=useState("All Agents");
 const [workflowTab,setWorkflowTab]=useState("Workflows");
 const [chatTab,setChatTab]=useState("Chat");
 function send(){const value=draft.trim();if(!value)return;setMessages(m=>[...m,{role:"user",text:value},{role:"assistant",text:"I’ve added that to the BizStack workspace. Connect the provider-backed execution layer to run the requested action."}]);setDraft("");}
 return <div className="min-h-screen p-4 lg:p-6 relative">
  <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_35%_0%,rgba(91,110,245,.18),transparent_62%)]"/>
  <div className="relative max-w-[1500px] mx-auto">
   <div className="mb-5 pb-4 border-b border-white/[.055]">
    <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl border border-indigo-200/10 bg-gradient-to-br from-indigo-400/25 to-cyan-400/10 grid place-items-center text-indigo-100">✦</div><div><div className="text-[8px] uppercase tracking-[.2em] text-indigo-200/45">Section 3</div><h1 className="text-[20px] font-semibold tracking-[-.03em] text-white">AI &amp; Automation Ecosystem</h1><p className="text-[10px] text-slate-500 mt-1">AI Agents, tools and automation that work for your business.</p></div></div>
   </div>

   <section className="mb-4">
    <div className="flex items-end justify-between mb-2"><div><h2 className="text-[12px] font-semibold text-white">3.1 AI Chat &amp; Assistant</h2><p className="text-[8px] text-slate-600 mt-1">Your natural-language operating layer for the business.</p></div><div className="text-[7px] text-cyan-200/35">BUSINESS CONTEXT · MULTI-STEP</div></div>
    <div className="grid lg:grid-cols-[180px_minmax(0,1fr)_190px] gap-2.5 min-h-[410px]">
      <aside className="rounded-xl border border-white/[.06] bg-[#080f1b]/95 p-2.5">
       <div className="px-2 py-2 mb-1 text-[9px] font-semibold text-white">BizStack AI</div>
       {["Home","Chat","Projects","Files","Tools","Automations","Settings"].map((x,i)=><button key={x} onClick={()=>setChatTab(x)} className={`w-full text-left px-2.5 py-2 rounded-lg text-[9px] ${chatTab===x?"text-white bg-indigo-500/15 border border-indigo-300/10":"text-slate-500 hover:text-white hover:bg-white/[.03]"}`}><span className="mr-2 opacity-60">{["⌂","◌","□","▱","✦","⚡","⚙"][i]}</span>{x}</button>)}
       <div className="mt-5 px-2 py-2 border-t border-white/[.05]"><div className="text-[7px] uppercase tracking-[.16em] text-white/20">Recent</div><p className="text-[8px] text-white/35 mt-2 truncate">Marketing plan</p><p className="text-[8px] text-white/35 mt-2 truncate">Website redesign</p></div>
      </aside>
      <div className="rounded-xl border border-cyan-300/[.12] bg-[#0a1220]/95 overflow-hidden flex flex-col shadow-[0_18px_50px_rgba(0,0,0,.18)]">
       <div className="h-11 px-4 border-b border-white/[.06] flex items-center justify-between"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_9px_rgba(34,211,238,.8)]"/><span className="text-[10px] font-medium text-white">BizStack AI</span></div><span className="text-[7px] text-white/25">Business-aware assistant</span></div>
       <div className="flex-1 p-4 space-y-3 overflow-y-auto">{messages.map((m,i)=><div key={i} className={`flex ${m.role==="user"?"justify-end":"justify-start"}`}><div className={`max-w-[78%] px-3 py-2.5 rounded-2xl text-[9px] leading-4 ${m.role==="user"?"bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-br-sm":"bg-[#111b2c] border border-white/[.05] text-slate-300 rounded-bl-sm"}`}>{m.text}</div></div>)}<div className="rounded-xl border border-indigo-300/10 bg-indigo-500/[.045] p-3"><div className="text-[8px] text-indigo-100/70">Example request</div><div className="text-[9px] text-white mt-1">“Create a marketing plan for my business”</div><button className="mt-2 text-[8px] px-2.5 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-100 border border-indigo-300/10">Create Plan</button></div></div>
       <div className="p-2.5 border-t border-white/[.06]"><div className="flex items-center gap-2 rounded-xl bg-[#070c15] border border-white/[.07] px-2.5"><button className="text-white/35 text-base">＋</button><input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Ask anything..." className="flex-1 bg-transparent py-2.5 text-[9px] text-white placeholder:text-slate-600 outline-none"/><button className="text-white/30">⌕</button><button onClick={send} className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 text-white text-[10px]">↑</button></div></div>
      </div>
      <aside className="rounded-xl border border-white/[.06] bg-[#080f1b]/95 p-3"><div className="text-[9px] font-semibold text-white mb-3">Capabilities</div>{FEATURES.map(f=><div key={f} className="flex items-center gap-2 py-2 border-b border-white/[.04] last:border-0"><span className="w-1.5 h-1.5 rounded-full bg-cyan-300/60"/><span className="text-[8px] text-white/40">{f}</span></div>)}</aside>
    </div>
   </section>

   <section className="mb-4"><div className="flex items-end justify-between mb-2"><div><h2 className="text-[12px] font-semibold text-white">3.2 AI Agents</h2><p className="text-[8px] text-slate-600 mt-1">Specialized agents that handle repeatable business work.</p></div><button className="text-[8px] px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 text-white">+ Create New Agent</button></div>
    <div className="flex gap-1 mb-2">{["All Agents","Custom","Templates"].map(t=><button key={t} onClick={()=>setAgentTab(t)} className={`px-2.5 py-1.5 rounded-lg text-[8px] ${agentTab===t?"text-white bg-indigo-500/15 border border-indigo-300/10":"text-white/30"}`}>{t}</button>)}</div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2.5">{AGENTS.map(a=><div key={a.name} className="rounded-xl border border-white/[.06] bg-[#0a1220]/90 p-3 hover:border-indigo-300/15 transition-colors"><div className={`w-9 h-9 rounded-xl border border-white/[.08] bg-gradient-to-br ${a.tone} grid place-items-center text-white text-sm`}>{a.icon}</div><div className="text-[10px] font-medium text-white mt-3">{a.name}</div><div className="text-[8px] text-white/30 leading-4 mt-1 min-h-8">{a.desc}</div><div className="flex items-center gap-1.5 mt-3"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"/><span className="text-[7px] text-emerald-300/70">Active</span></div></div>)}</div>
   </section>

   <section><div className="flex items-end justify-between mb-2"><div><h2 className="text-[12px] font-semibold text-white">3.3 Automation Workflows</h2><p className="text-[8px] text-slate-600 mt-1">Triggers, templates and execution history.</p></div><button className="text-[8px] px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 text-white">+ Create Workflow</button></div>
    <div className="rounded-xl border border-white/[.06] bg-[#0a1220]/90 overflow-hidden"><div className="px-3 py-2 border-b border-white/[.05] flex gap-1">{["Workflows","Templates","History"].map(t=><button key={t} onClick={()=>setWorkflowTab(t)} className={`px-2.5 py-1.5 rounded-lg text-[8px] ${workflowTab===t?"text-white bg-indigo-500/15":"text-white/30"}`}>{t}</button>)}</div>{WORKFLOWS.map(([name,trigger,status])=><div key={name} className="px-3 py-2.5 flex items-center justify-between border-b border-white/[.04] last:border-0"><div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-300/10 grid place-items-center text-indigo-200 text-[10px]">⚡</div><div><div className="text-[9px] text-white">{name}</div><div className="text-[7px] text-white/25 mt-0.5">{trigger}</div></div></div><span className="text-[7px] px-2 py-1 rounded-full text-emerald-300 bg-emerald-400/10">{status}</span></div>)}</div>
   </section>
  </div>
 </div>;
}
