"use client";
import { useState } from "react";

type Message = { role: "user" | "assistant"; text: string };

const AGENTS = [
  { name:"Business Analyst",  desc:"Market research, reports, insights",    color:"#F5A524", active:true  },
  { name:"Marketing Agent",   desc:"Campaigns, content, social media",        color:"#5B6EF5", active:true  },
  { name:"Sales Agent",       desc:"Leads, follow-ups, proposals",            color:"#22C55E", active:true  },
  { name:"Support Agent",     desc:"Customer support, tickets",               color:"#8B5CF6", active:true  },
  { name:"Developer Agent",   desc:"Code, fix, deploy, maintain",             color:"#06B6D4", active:true  },
];

const WORKFLOWS = [
  { name:"Invoice Reminder",  trigger:"1h: When invoice is overdue",         active:true  },
  { name:"Welcome Email",     trigger:"1st: When new customer is added",       active:true  },
  { name:"Low Stock Alert",   trigger:"1h: When stock is below threshold",     active:true  },
  { name:"Social Media Post", trigger:"Daily at 9:00 AM",                    active:false },
  { name:"Inventory Alert",   trigger:"Weekly stock reconciliation",           active:true  },
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role:"assistant", text:"Hi! I'm your AI business assistant. Ask me to create a marketing plan, write a product description, analyze your sales data, or automate any workflow." }
  ]);
  const [draft, setDraft] = useState("");
  const [agentTab, setAgentTab] = useState("All Agents");
  const [workflowTab, setWorkflowTab] = useState("Workflows");

  function send() {
    if (!draft.trim()) return;
    const newMsgs: Message[] = [...messages, { role:"user", text:draft }];
    setMessages(newMsgs);
    setDraft("");
    setTimeout(() => {
      setMessages(prev => [...prev, { role:"assistant", text:`I'm working on: "${draft}". This is a visual preview — the AI model connection will be wired in the next module.` }]);
    }, 800);
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-white">AI Assistant &amp; Automation</h1>
        <p className="text-sm text-textMuted mt-0.5">Let AI handle the work. Build, plan, and automate your business.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bg-surface border border-line rounded-xl flex flex-col" style={{height:"560px"}}>
          <div className="px-4 py-3 border-b border-line">
            <h2 className="text-sm font-semibold text-white">AI Chat</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role==="user"?"justify-end":"justify-start"}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${m.role==="user"?"text-white rounded-br-sm":"text-text rounded-bl-sm bg-surfaceAlt"}`}
                  style={m.role==="user"?{background:"#5B6EF5"}:{}}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-line">
            <div className="flex gap-2">
              <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key==="Enter" && send()}
                placeholder="Ask anything..." className="flex-1 bg-bg border border-line rounded-xl px-3 py-2 text-sm text-text placeholder:text-textMuted focus:outline-none focus:border-primary"/>
              <button onClick={send} className="px-3 py-2 rounded-xl text-white text-sm" style={{background:"#5B6EF5"}}>↑</button>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <div className="flex gap-1">
              {["Workflows","Templates","History"].map(t => (
                <button key={t} onClick={() => setWorkflowTab(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${workflowTab===t?"text-white":"text-textMuted hover:text-white"}`}
                  style={workflowTab===t?{background:"rgba(91,110,245,0.2)"}:{}}>{t}</button>
              ))}
            </div>
            <button className="text-xs px-2.5 py-1.5 rounded-lg text-white font-medium" style={{background:"#5B6EF5"}}>+ New Workflow</button>
          </div>
          <div className="divide-y divide-line">
            {WORKFLOWS.map(w => (
              <div key={w.name} className="px-4 py-3 flex items-center justify-between hover:bg-white/3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-sm" style={{background:"rgba(91,110,245,0.2)"}}>⚡</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{w.name}</p>
                    <p className="text-[11px] text-textMuted truncate">{w.trigger}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${w.active?"text-success":"text-textMuted"}`} style={w.active?{background:"rgba(34,197,94,0.15)"}:{background:"rgba(139,146,176,0.1)"}}>{w.active?"Active":"Paused"}</span>
                  <div className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${w.active?"bg-success":"bg-surfaceAlt"}`}>
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${w.active?"left-[18px]":"left-0.5"}`}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <div className="flex gap-1">
              {["All Agents","Custom","Templates"].map(t => (
                <button key={t} onClick={() => setAgentTab(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${agentTab===t?"text-white":"text-textMuted hover:text-white"}`}
                  style={agentTab===t?{background:"rgba(91,110,245,0.2)"}:{}}>{t}</button>
              ))}
            </div>
            <button className="text-xs px-2.5 py-1.5 rounded-lg text-white font-medium" style={{background:"#5B6EF5"}}>+ Create Agent</button>
          </div>
          <div className="divide-y divide-line">
            {AGENTS.map(a => (
              <div key={a.name} className="px-4 py-3 flex items-center justify-between hover:bg-white/3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{background:a.color}}>{a.name.charAt(0)}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{a.name}</p>
                    <p className="text-[11px] text-textMuted truncate">{a.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] px-2 py-0.5 rounded-full text-success" style={{background:"rgba(34,197,94,0.15)"}}>Active</span>
                  <div className="w-8 h-4 rounded-full relative cursor-pointer bg-success">
                    <div className="absolute top-0.5 left-[18px] w-3 h-3 rounded-full bg-white shadow"/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
