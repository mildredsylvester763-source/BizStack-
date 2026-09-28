"use client";

import { useEffect, useRef, useState } from "react";
import VoiceInput from "./voice-input";

type Approval = { id:string; runId:string; action:string; reason:string };

export default function AssistantClient({businessName}:{businessName:string}) {
  const [input,setInput]=useState("");
  const [messages,setMessages]=useState<Array<{role:string;content:string}>>([]);
  const [busy,setBusy]=useState(false);
  const [conversationId,setConversationId]=useState<string|null>(null);
  const [approval,setApproval]=useState<Approval|null>(null);
  const endRef=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[messages,busy,approval]);

  async function send(){
    const text=input.trim();
    if(!text||busy)return;
    setInput("");
    setMessages(v=>[...v,{role:"user",content:text}]);
    setBusy(true);
    try{
      const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input:text,conversationId,clientMessageId:crypto.randomUUID()})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||"Assistant request failed.");
      if(result.conversationId)setConversationId(result.conversationId);
      setApproval(result.approval||null);
      setMessages(v=>[...v,{role:"assistant",content:result.message||"Done."}]);
    }catch(error){
      setMessages(v=>[...v,{role:"assistant",content:error instanceof Error?error.message:"The assistant could not complete that request."}]);
    }finally{setBusy(false);}
  }

  async function approve(){
    if(!approval||busy)return;
    setBusy(true);
    try{
      const response=await fetch("/api/assistant/approve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({runId:approval.runId})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||"Approval failed.");
      setApproval(result.approval||null);
      setMessages(v=>[...v,{role:"assistant",content:result.message||"The approved action has been completed."}]);
    }catch(error){
      setMessages(v=>[...v,{role:"assistant",content:error instanceof Error?error.message:"The approved action could not be completed."}]);
    }finally{setBusy(false);}
  }

  return <div className="bg-white border border-rule rounded-2xl overflow-hidden min-h-[700px] flex flex-col">
    <div className="px-6 py-5 border-b border-rule">
      <p className="text-[11px] uppercase tracking-[.18em] text-vault">Universal operator</p>
      <h2 className="font-display text-2xl mt-1">Tell BizStack what needs to happen.</h2>
      <p className="text-sm text-ink/50 mt-1">{businessName} · one assistant across the business</p>
    </div>
    <div className="flex-1 p-5 md:p-7 space-y-4 overflow-y-auto">
      {!messages.length&&<div className="max-w-2xl mx-auto py-16 text-center">
        <p className="text-xs uppercase tracking-[.18em] text-vault">One assistant</p>
        <h3 className="font-display text-4xl mt-3">Run the business by conversation.</h3>
        <p className="text-sm text-ink/55 leading-7 mt-4">Ask BizStack to inspect real records, create business data, work on a website, inspect connections, or coordinate work across modules.</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-8 text-left">
          {[
            "Check my overdue invoices and tell me what needs attention.",
            "Create a customer for Acme Foods Ltd.",
            "Build me a premium website for my fashion business.",
            "Check my stock and tell me what is running low."
          ].map(x=><button key={x} onClick={()=>setInput(x)} className="border border-rule rounded-xl p-4 text-sm text-left hover:border-vault">{x}</button>)}
        </div>
      </div>}
      {messages.map((m,i)=><div key={i} className={m.role==="user"?"flex justify-end":"flex justify-start"}>
        <div className={m.role==="user"?"max-w-[85%] rounded-2xl bg-ink text-white px-5 py-3.5 text-sm leading-6 whitespace-pre-wrap":"max-w-[85%] rounded-2xl bg-mist border border-rule px-5 py-3.5 text-sm leading-6 whitespace-pre-wrap"}>{m.content}</div>
      </div>)}
      {approval&&<div className="max-w-xl border border-vault/30 bg-vault/5 rounded-2xl p-5">
        <p className="text-[11px] uppercase tracking-[.16em] text-vault">Approval needed</p>
        <p className="font-medium mt-2">{approval.action}</p>
        <p className="text-sm text-ink/55 mt-2">{approval.reason}</p>
        <button onClick={()=>void approve()} disabled={busy} className="mt-4 bg-vault text-white px-5 py-2.5 rounded-lg text-sm disabled:opacity-40">Approve and continue</button>
      </div>}
      {busy&&<div className="text-xs text-ink/45">BizStack is working…</div>}
      <div ref={endRef}/>
    </div>
    <div className="p-4 border-t border-rule bg-ledger">
      <div className="flex items-end gap-3">
        <VoiceInput onTranscript={setInput}/>
        <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send();}}} rows={2} placeholder="Tell BizStack what you want handled…" className="flex-1 resize-none rounded-2xl border border-rule bg-white px-4 py-3 text-sm outline-none focus:border-vault"/>
        <button type="button" onClick={()=>void send()} disabled={!input.trim()||busy} className="rounded-2xl bg-vault text-white px-5 py-3 text-sm disabled:opacity-40">Send</button>
      </div>
      <p className="text-[11px] text-ink/35 mt-2 ml-14">Enter to send · Shift+Enter for a new line · microphone for voice input</p>
    </div>
  </div>;
}
