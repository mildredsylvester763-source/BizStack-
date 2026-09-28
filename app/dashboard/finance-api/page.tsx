"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function FinanceApiPage(){
 const supabase=createClient();
 const [clients,setClients]=useState<any[]>([]);
 const [prompt,setPrompt]=useState("Create a school finance API client named Acme School with scopes customers:read,invoices:read,transactions:read,transactions:write,reports:read.");
 const [loading,setLoading]=useState(false);
 const [secret,setSecret]=useState("");
 const [message,setMessage]=useState("");
 const [businessId,setBusinessId]=useState("");

 async function load(){
  const {data:{user}}=await supabase.auth.getUser();if(!user)return;
  const {data:business}=await supabase.from("businesses").select("id").eq("owner_id",user.id).single();
  if(!business)return;setBusinessId(business.id);
  const {data}=await supabase.from("finance_api_clients").select("id,client_name,client_type,status,scopes,created_at").eq("business_id",business.id).order("created_at",{ascending:false});
  setClients(data||[]);
 }
 useEffect(()=>{load();},[]);

 async function create(){
  setLoading(true);setSecret("");setMessage("");
  const response=await fetch("/api/ai/build",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({capability:"finance_api",prompt,mode:"ask_first"})});
  const result=await response.json().catch(()=>({}));
  setLoading(false);
  if(!response.ok){setMessage(result.error||"Could not create API client.");return;}
  setSecret(result.result?.apiKey||"");
  setMessage(result.result?.apiKey?"API client created. Save this key now; it will not be shown again.":"Client created. No new plaintext key is available for this repeated request.");
  await load();
 }
 async function copy(){if(secret)await navigator.clipboard.writeText(secret);}
 return <main className="min-h-screen bg-ledger"><header className="border-b border-rule bg-white"><div className="max-w-6xl mx-auto px-6 py-5 flex justify-between"><div><Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link><h1 className="font-display text-2xl mt-1">Finance API</h1></div><Link href="/dashboard/ai-builder" className="text-xs text-vault">AI Builder</Link></div></header><section className="max-w-6xl mx-auto px-6 py-8"><div className="bg-white border border-rule p-6 mb-6"><p className="text-xs uppercase tracking-[.16em] text-vault">Institutional access</p><h2 className="font-display text-3xl mt-2">Let schools, churches, cooperatives and partner software run finance operations through scoped API access.</h2><p className="text-sm text-ink/55 mt-2 max-w-3xl">Keys are SHA-256 hashed in BizStack. Each client receives explicit scopes and is isolated to the issuing business.</p><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} rows={5} className="mt-5 w-full border border-rule px-4 py-3 text-sm"/><button onClick={create} disabled={loading} className="mt-4 bg-ink text-white px-5 py-3 text-sm">{loading?"Creating…":"Create API client and issue key"}</button>{message&&<p className="mt-4 text-sm text-ink/60">{message}</p>}{secret&&<div className="mt-5 border border-vault bg-mist p-4"><p className="text-xs uppercase tracking-[.12em] text-vault">One-time secret</p><code className="block mt-2 text-xs break-all">{secret}</code><div className="mt-3 flex gap-2"><button onClick={copy} className="bg-vault text-white px-3 py-2 text-xs">Copy key</button><button onClick={()=>setSecret("")} className="border border-rule px-3 py-2 text-xs">Hide key</button></div></div>}</div><section className="bg-white border border-rule p-5"><h2 className="font-display text-xl">API clients</h2><div className="mt-4 space-y-2">{clients.map(c=><div key={c.id} className="border border-rule p-4 flex flex-col md:flex-row md:justify-between gap-3"><div><p className="font-medium">{c.client_name}</p><p className="text-xs text-ink/45 mt-1">{c.client_type} · {c.status}</p></div><div className="text-xs text-ink/50 md:text-right">{(c.scopes||[]).join(" · ")}</div></div>)}{!clients.length&&<p className="text-sm text-ink/45">No external finance clients yet.</p>}</div></section><section className="bg-ink text-mist p-5 mt-6"><p className="text-xs uppercase tracking-[.14em] text-mist/55">API resources</p><p className="text-sm mt-2">Use <code>/api/v1/finance?resource=summary</code>, <code>customers</code>, <code>invoices</code>, or <code>transactions</code>. POST with <code>resource=customer</code> or <code>resource=transaction</code> for scoped writes.</p></section></section></main>;
}
