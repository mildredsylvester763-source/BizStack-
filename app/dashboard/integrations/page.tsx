"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

type Integration = {
  id: string; display_name: string; category: string; connection_type: string;
  status: string; sync_mode: string; error_message?: string | null;
};
type Catalog = { name: string; category: string; methods: string[]; mode: string; description: string };

const catalog: Catalog[] = [
  {name:"Bank account",category:"banking",methods:["OAuth / bank login","Open-banking provider","File import"],mode:"near_realtime",description:"Bring balances and transactions into Money Center through an authorized connection."},
  {name:"Payment processor",category:"payments",methods:["OAuth / provider login","API key","Webhook"],mode:"near_realtime",description:"Connect collections, payouts, refunds and payment events."},
  {name:"Accounting platform",category:"accounting",methods:["OAuth / provider login","API key","File import"],mode:"scheduled",description:"Synchronize accounting records while BizStack keeps its canonical records."},
  {name:"Commerce platform",category:"commerce",methods:["OAuth / store login","API key","Webhook"],mode:"near_realtime",description:"Sync orders, customers, products, inventory and fulfilment events."},
  {name:"CRM",category:"crm",methods:["OAuth / provider login","API key","File import"],mode:"near_realtime",description:"Import customer relationships and preserve source ownership."},
  {name:"Company database",category:"data",methods:["Database connection","File import"],mode:"scheduled",description:"Connect an external database through a controlled server-side workflow."},
  {name:"Custom API",category:"data",methods:["API key","OAuth","Webhook"],mode:"near_realtime",description:"Connect an external API and map its records into BizStack."},
  {name:"Webhook source",category:"data",methods:["Webhook endpoint"],mode:"realtime",description:"Receive external events and turn them into auditable business events."},
  {name:"Communications",category:"communications",methods:["OAuth / provider login","API key"],mode:"near_realtime",description:"Connect email, SMS, WhatsApp or voice providers with consent-aware messaging."}
];

function typeFor(method:string) {
  const m=method.toLowerCase();
  if(m.includes("oauth")) return "oauth";
  if(m.includes("api")) return "api_key";
  if(m.includes("webhook")) return "webhook";
  if(m.includes("database")) return "database";
  if(m.includes("file")) return "file_import";
  return "native";
}
function helpFor(method:string) {
  const m=method.toLowerCase();
  if(m.includes("oauth")) return "Authorization happens through the provider. BizStack receives only the permissions granted.";
  if(m.includes("api")) return "Credentials belong in a protected server-side connection layer, never ordinary notes.";
  if(m.includes("webhook")) return "BizStack provides an endpoint and verification flow; the provider sends events to it.";
  if(m.includes("database")) return "Use a restricted database account. Credentials must never be exposed to the browser.";
  if(m.includes("file")) return "Upload an export, preview mappings and duplicates, then approve the import.";
  return "This connection is configured inside BizStack.";
}

export default function IntegrationsPage(){
  const supabase=createClient();
  const [items,setItems]=useState<Integration[]>([]);
  const [businessId,setBusinessId]=useState("");
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState<Catalog|null>(null);
  const [method,setMethod]=useState("");
  const [label,setLabel]=useState("");
  const [step,setStep]=useState<"method"|"details"|"review">("method");
  const [saving,setSaving]=useState(false);

  async function load(){
    const {data:{user}}=await supabase.auth.getUser(); if(!user)return;
    const {data:b}=await supabase.from("businesses").select("id").eq("owner_id",user.id).single(); if(!b)return;
    setBusinessId(b.id);
    const {data}=await supabase.from("integrations").select("id,display_name,category,connection_type,status,sync_mode,error_message").eq("business_id",b.id).order("created_at");
    setItems(data||[]); setLoading(false);
  }
  useEffect(()=>{load();},[]);
  useEffect(()=>{
    if(!businessId)return;
    const channel=supabase.channel("bizstack-integrations").on("postgres_changes",{event:"*",schema:"public",table:"integrations",filter:"business_id=eq."+businessId},()=>load()).subscribe();
    return ()=>{supabase.removeChannel(channel);};
  },[businessId]);

  function open(c:Catalog){setSelected(c);setMethod(c.methods[0]);setLabel(c.name);setStep("method");}
  function close(){if(saving)return;setSelected(null);setMethod("");setLabel("");setStep("method");}
  async function start(){
    if(!selected||!businessId||!method)return;
    setSaving(true);
    const {data,error}=await supabase.from("integrations").insert({
      business_id:businessId,provider:selected.name.toLowerCase().replace(/\s+/g,"-"),
      category:selected.category,connection_type:typeFor(method),display_name:label.trim()||selected.name,
      status:"pending",sync_mode:selected.mode,
      capabilities:{setup_method:method,authorization_required:method.toLowerCase().includes("oauth"),manual_sync:true,incremental_sync:true,webhooks:selected.mode!=="manual"},
      config:{setup_stage:"awaiting_connection",connection_method:method,setup_started_at:new Date().toISOString()}
    }).select("id,display_name,category,connection_type,status,sync_mode,error_message").single();
    setSaving(false);
    if(error){alert(error.message);return;}
    if(data)setItems(v=>[...v,data]); close();
  }

  return <main className="min-h-screen bg-ledger">
    <header className="border-b border-rule bg-white"><div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center"><div><Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link><h1 className="font-display text-2xl mt-1">Integration Hub</h1></div><Link href="/dashboard/money" className="text-sm text-vault">Money Center</Link></div></header>
    <section className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8"><p className="text-xs uppercase tracking-[.18em] text-vault">Connected business</p><h2 className="font-display text-3xl mt-2">Connect the systems you already use.</h2><p className="text-sm text-ink/55 mt-2 max-w-2xl">Adding a connector is a workflow, not a status toggle. Choose a connection method, review what it will do, then start authorization or setup.</p></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">{catalog.map(c=><button key={c.name} onClick={()=>open(c)} disabled={!businessId} className="text-left bg-white border border-rule p-5 hover:border-vault/50 transition-colors"><div className="flex justify-between gap-3"><p className="font-medium text-sm">{c.name}</p><span className="text-[10px] uppercase text-ink/35">{c.mode.replace("_"," ")}</span></div><p className="text-xs text-ink/45 mt-2 leading-5">{c.description}</p><span className="inline-block mt-4 text-xs text-vault">+ Add connection</span></button>)}</div>
      <section className="bg-white border border-rule p-6"><h3 className="font-display text-xl">Your connections</h3><p className="text-xs text-ink/45 mt-1 mb-5">Pending means setup has started; it does not mean external data is already flowing.</p>{loading?<p className="text-sm text-ink/50">Loading…</p>:items.length===0?<p className="text-sm text-ink/50">Nothing connected yet.</p>:<div className="space-y-3">{items.map(i=><div key={i.id} className="border border-rule p-4 flex justify-between gap-4"><div><p className="text-sm font-medium">{i.display_name}</p><p className="text-xs text-ink/45 mt-1">{i.category} · {i.connection_type} · {i.sync_mode}</p>{i.error_message&&<p className="text-xs text-red-700 mt-2">{i.error_message}</p>}</div><span className="text-xs text-ink/55 border border-rule px-2.5 py-1">{i.status}</span></div>)}</div>}</section>
    </section>
    {selected&&<div className="fixed inset-0 z-50 bg-ink/30 p-4 flex items-center justify-center" role="dialog" aria-modal="true"><div className="w-full max-w-2xl bg-white border border-rule shadow-xl max-h-[90vh] overflow-y-auto">
      <div className="p-6 border-b border-rule flex justify-between gap-4"><div><p className="text-xs uppercase tracking-[.16em] text-vault">Connection setup</p><h3 className="font-display text-2xl mt-1">{selected.name}</h3><p className="text-sm text-ink/50 mt-2">{selected.description}</p></div><button onClick={close} className="text-ink/45 text-xl" aria-label="Close">×</button></div>
      <div className="p-6"><div className="flex gap-4 mb-7 text-xs">{["method","details","review"].map((s,i)=><span key={s} className={step===s?"text-vault font-medium":"text-ink/35"}>{i+1}. {s}</span>)}</div>
      {step==="method"&&<div><h4 className="font-medium">How should this connection be added?</h4><p className="text-sm text-ink/50 mt-1 mb-5">Different providers expose different connection methods.</p><div className="space-y-3">{selected.methods.map(m=><button key={m} onClick={()=>{setMethod(m);setStep("details");}} className="w-full text-left border border-rule p-4 hover:border-vault/50"><p className="text-sm font-medium">{m}</p><p className="text-xs text-ink/45 mt-1">{helpFor(m)}</p></button>)}</div></div>}
      {step==="details"&&<div><h4 className="font-medium">Connection details</h4><p className="text-sm text-ink/50 mt-1 mb-5">{helpFor(method)}</p><label className="block text-xs text-ink/50 mb-2">Connection name</label><input value={label} onChange={e=>setLabel(e.target.value)} className="w-full border border-rule px-4 py-3 text-sm outline-none focus:border-vault" /><div className="mt-5 bg-mist border border-rule p-4 text-xs text-ink/55 leading-5">No credential is stored by this browser step. OAuth tokens, API secrets and database credentials must be handled by the protected connection layer.</div><div className="flex justify-between mt-7"><button onClick={()=>setStep("method")} className="text-sm text-ink/50">Back</button><button onClick={()=>setStep("review")} className="bg-ink text-white px-5 py-2.5 text-sm">Review connection</button></div></div>}
      {step==="review"&&<div><h4 className="font-medium">Review before starting</h4><div className="mt-4 border border-rule divide-y divide-rule text-sm"><div className="p-4 flex justify-between"><span className="text-ink/45">Connection</span><span>{label||selected.name}</span></div><div className="p-4 flex justify-between"><span className="text-ink/45">Method</span><span>{method}</span></div><div className="p-4 flex justify-between"><span className="text-ink/45">Sync capability</span><span>{selected.mode.replace("_"," ")}</span></div></div><p className="text-xs text-ink/45 mt-4">Starting creates a pending setup record. It does not grant access to the external system by itself.</p><div className="flex justify-between mt-7"><button onClick={()=>setStep("details")} className="text-sm text-ink/50">Back</button><button onClick={start} disabled={saving} className="bg-vault text-white px-5 py-2.5 text-sm disabled:opacity-50">{saving?"Starting…":"Start connection"}</button></div></div>}
      </div></div></div>}
  </main>;
}
