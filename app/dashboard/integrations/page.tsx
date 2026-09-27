"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase-browser";

type Integration={id:string;display_name:string;provider:string;category:string;connection_type:string;status:string;sync_mode:string;last_synced_at:string|null;last_event_at:string|null};
const catalog=[
 ["Bank account","banking","oauth","near_realtime"],["Payment processor","payments","oauth","near_realtime"],["Accounting platform","accounting","oauth","scheduled"],
 ["Commerce platform","commerce","oauth","near_realtime"],["CRM","crm","oauth","near_realtime"],["Company database","data","database","scheduled"],["Custom API","data","api_key","near_realtime"],["Webhook source","data","webhook","realtime"]
];
export default function IntegrationsPage(){
 const supabase=createClient(); const [items,setItems]=useState<Integration[]>([]); const [loading,setLoading]=useState(true); const [businessId,setBusinessId]=useState("");
 async function load(){const {data:{user}}=await supabase.auth.getUser(); if(!user)return; const {data:b}=await supabase.from("businesses").select("id").eq("owner_id",user.id).single(); if(!b)return; setBusinessId(b.id); const {data}=await supabase.from("integrations").select("*").eq("business_id",b.id).order("created_at"); setItems(data||[]); setLoading(false)}
 useEffect(()=>{\n  load();\n},[]);\n useEffect(()=>{\n   if(!businessId) return;\n   const channel=supabase.channel("bizstack-integrations").on("postgres_changes",{event:"*",schema:"public",table:"integrations",filter:"business_id=eq."+businessId},()=>load()).subscribe();\n   return ()=>{supabase.removeChannel(channel)};\n },[businessId]);
 async function add(c:string,category:string,type:string,mode:string){
   const name=c;
   const {data,error}=await supabase.from("integrations").insert({business_id:businessId,provider:c.toLowerCase().replace(/\s+/g,"-"),category,connection_type:type,display_name:name,status:"pending",sync_mode:mode,capabilities:{webhooks:mode==="realtime",incremental_sync:true,manual_sync:true}}).select("*").single();
   if(!error&&data){setItems(v=>[...v,data]);} else if(error){alert(error.message);}
 }
 return <main className="min-h-screen bg-ledger"><header className="border-b border-rule bg-white"><div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center"><div><Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link><h1 className="font-display text-2xl mt-1">Integration Hub</h1></div><Link href="/dashboard/money" className="text-sm text-vault">Money Center</Link></div></header>
 <section className="max-w-6xl mx-auto px-6 py-10"><div className="mb-8"><p className="text-xs uppercase tracking-[.18em] text-vault">Connected business</p><h2 className="font-display text-3xl mt-2">Connect the systems you already use.</h2><p className="text-sm text-ink/55 mt-2 max-w-2xl">BizStack keeps its own canonical records while tracking where synchronized information came from. Real-time is used when a provider supports events; otherwise the integration reports its actual sync mode.</p></div>
 <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">{catalog.map(([name,cat,type,mode])=><button key={name} onClick={()=>add(name,cat,type,mode)} disabled={!businessId} className="text-left bg-white border border-rule p-5 hover:border-vault/50"><p className="font-medium text-sm">{name}</p><p className="text-xs text-ink/45 mt-2">{mode.replace("_"," ")} sync · {type}</p><span className="inline-block mt-4 text-xs text-vault">+ Add connection</span></button>)}</div>
 <section className="bg-white border border-rule p-6"><h3 className="font-display text-xl mb-5">Your connections</h3>{loading?<p className="text-sm text-ink/50">Loading…</p>:items.length===0?<p className="text-sm text-ink/50">Nothing connected yet.</p>:<div className="space-y-3">{items.map(i=><div key={i.id} className="border border-rule p-4 flex justify-between gap-4"><div><p className="text-sm font-medium">{i.display_name}</p><p className="text-xs text-ink/45">{i.category} · {i.connection_type} · {i.sync_mode}</p></div><span className="text-xs text-vault">{i.status}</span></div>)}</div>}</section></section></main>
}