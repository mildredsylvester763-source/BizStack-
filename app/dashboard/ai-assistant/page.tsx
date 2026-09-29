"use client";

import Link from "next/link";
import { useState } from "react";
import { BizIcon, BizPanel, BizSection, BizStatus } from "@/components/ui/BizStackVisual";

const capabilities = [
  ["Natural language", "Describe the outcome you need", "blue", "NL"],
  ["Business context", "Use the business records already in BizStack", "cyan", "CTX"],
  ["Multi-step planning", "Break a request into executable steps", "purple", "PLAN"],
  ["File analysis", "Read supported files and attachments", "green", "DOC"],
  ["Web search", "Research when a task needs current external information", "blue", "WEB"],
  ["Code generation", "Build or change software through AI Builder", "purple", "CODE"],
  ["Image creation", "Create bespoke visual assets for projects", "orange", "IMG"],
  ["Voice input", "Talk to BizStack instead of typing", "cyan", "MIC"]
];

export default function AIAssistantPage() {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Tell BizStack what you need. For real build, file, runtime and project execution, open AI Builder; this page is your business-facing command desk." }
  ]);

  function submit() {
    const text = draft.trim();
    if (!text) return;
    setMessages(prev => [...prev, { role: "user", text }]);
    setDraft("");
  }

  return (
    <div className="biz-content">
      <BizSection number="3.1" title="AI Chat & Assistant" subtitle="A business-facing command desk for planning, analysis and hand-off into the full AI Builder runtime.">
        <div className="grid xl:grid-cols-[1.15fr_.75fr_.85fr] gap-3">
          <BizPanel title="BizStack AI" subtitle="Natural language workspace">
            <div className="p-3">
              <div className="rounded-2xl border border-blue-400/15 bg-gradient-to-br from-blue-500/[.09] via-indigo-500/[.04] to-violet-500/[.08] p-4 min-h-[390px] flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div><div className="text-[8px] uppercase tracking-[.18em] text-blue-200/45">Business copilot</div><div className="mt-1 text-[11px] font-semibold text-white/80">What should BizStack work on?</div></div>
                  <BizStatus tone="green">Ready</BizStatus>
                </div>
                <div className="flex-1 mt-4 space-y-2 overflow-y-auto pr-1">
                  {messages.map((m, i) => (
                    <div key={i} className={"max-w-[88%] rounded-2xl px-3 py-2.5 text-[8px] leading-4 " + (m.role === "assistant" ? "border border-white/[.07] bg-white/[.035] text-white/55" : "ml-auto bg-gradient-to-r from-blue-600 to-violet-600 text-white")}>
                      {m.text}
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-2xl border border-white/[.08] bg-[#070c18] p-2">
                  <textarea value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submit();}}} rows={2} placeholder="Ask about invoices, customers, marketing, research, software or operations…" className="w-full resize-none bg-transparent outline-none text-[9px] leading-4 text-white/70 placeholder:text-white/20" />
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <button onClick={submit} className="rounded-lg bg-white text-slate-900 px-3 py-2 text-[8px] font-semibold">Send</button>
                    <button onClick={()=>location.href="/dashboard/ai-builder"} className="rounded-lg border border-white/[.07] bg-white/[.035] px-3 py-2 text-[8px] text-white/45">Open AI Builder</button>
                    <span className="ml-auto text-[7px] text-white/15">Enter run · Shift+Enter newline</span>
                  </div>
                </div>
              </div>
            </div>
          </BizPanel>

          <BizPanel title="Assistant actions" subtitle="Fast paths into the business workspace">
            <div className="p-3 space-y-2">
              {[
                ["Create a marketing plan", "/dashboard/marketing", "Plan", "blue"],
                ["Build a customer email", "/dashboard/ai-builder", "Build", "cyan"],
                ["Analyze sales data", "/dashboard", "Analyze", "purple"],
                ["Create an automation workflow", "/dashboard/actions", "Automate", "green"],
                ["Research a business question", "/dashboard/ai-builder", "Research", "orange"],
                ["Work with files", "/dashboard/ai-builder", "Files", "blue"]
              ].map(([label, href, badge, tone]) => (
                <Link key={label} href={href} className="flex items-center gap-2 rounded-2xl border border-white/[.06] bg-white/[.02] p-3 hover:border-blue-400/20">
                  <BizIcon tone={tone as any} size="sm">✦</BizIcon>
                  <div className="min-w-0 flex-1"><div className="text-[9px] text-white/65">{label}</div><div className="text-[7px] text-white/20 mt-1">Open {badge}</div></div>
                  <span className="text-white/15 text-[10px]">›</span>
                </Link>
              ))}
            </div>
          </BizPanel>

          <BizPanel title="AI capability surface" subtitle="The building blocks the command desk can route into.">
            <div className="p-3 grid grid-cols-2 gap-2">
              {capabilities.map(([name, detail, tone, icon]) => (
                <div key={name} className="rounded-2xl border border-white/[.06] bg-white/[.02] p-3">
                  <BizIcon tone={tone as any} size="sm">{icon}</BizIcon>
                  <div className="mt-2 text-[8px] text-white/65">{name}</div>
                  <div className="mt-1 text-[7px] leading-3.5 text-white/20">{detail}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-white/[.07] p-3">
              <Link href="/dashboard/ai-builder" className="block text-center rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 py-2.5 text-[8px] font-semibold text-white">Continue in full AI Builder</Link>
            </div>
          </BizPanel>
        </div>
      </BizSection>
    </div>
  );
}
