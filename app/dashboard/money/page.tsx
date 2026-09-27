import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { calculateOutstanding, formatMoney } from "@/lib/invoices";

export default async function MoneyPage() {
 const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect("/login");
 const {data:business}=await supabase.from("businesses").select("id,name,currency").eq("owner_id",user.id).single(); if(!business) redirect("/onboarding");
 const [{data:accounts},{data:txs},{data:invoices},{data:buckets},{data:integrations}]=await Promise.all([
  supabase.from("financial_accounts").select("id,display_name,provider,status,currency,last_synced_at").eq("business_id",business.id).order("created_at"),
  supabase.from("financial_transactions").select("direction,amount,currency,occurred_at,counterparty_name,description,reconciled").eq("business_id",business.id).eq("status","posted").order("occurred_at",{ascending:false}).limit(12),
  supabase.from("invoices").select("id,total,paid_amount,status,currency").eq("business_id",business.id),
  supabase.from("money_buckets").select("name,bucket_type,allocated_amount,currency").eq("business_id",business.id).order("created_at"),
  supabase.from("integrations").select("display_name,status,sync_mode,last_synced_at,last_event_at").eq("business_id",business.id).order("created_at")
 ]);
 const posted=(txs??[]).filter(x=>x.currency===business.currency);
 const inflow=posted.filter(x=>x.direction==="inflow").reduce((s,x)=>s+Number(x.amount),0);
 const outflow=posted.filter(x=>x.direction==="outflow").reduce((s,x)=>s+Number(x.amount),0);
 const outstanding=(invoices??[]).filter(x=>x.status!=="paid").reduce((s,x)=>s+calculateOutstanding(Number(x.total),Number(x.paid_amount)),0);
 const money=(n:number)=>formatMoney(n,business.currency);
 return <main className="min-h-screen bg-ledger"><header className="border-b border-rule bg-white"><div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between"><div><Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link><h1 className="font-display text-2xl text-ink mt-1">Money Center</h1></div><Link href="/dashboard/integrations" className="text-sm bg-ink text-mist px-4 py-2">Connect systems</Link></div></header>
 <section className="max-w-6xl mx-auto px-6 py-10"><p className="text-sm text-ink/55 mb-8">One financial view for connected accounts, payments, invoices, reserves and synchronized business activity.</p>
 <div className="grid md:grid-cols-4 gap-px bg-rule border border-rule mb-8">{[["Inflow",money(inflow)],["Outflow",money(outflow)],["Net movement",money(inflow-outflow)],["Receivables",money(outstanding)]].map(([a,b])=><div key={a} className="bg-white p-5"><p className="text-xs uppercase tracking-wider text-ink/40">{a}</p><p className="font-display text-2xl mt-2 text-ink">{b}</p></div>)}</div>
 <div className="grid lg:grid-cols-3 gap-6"><section className="lg:col-span-2 bg-white border border-rule p-6"><div className="flex justify-between items-center mb-5"><div><h2 className="font-display text-xl">Connected financial accounts</h2><p className="text-xs text-ink/45 mt-1">Bank, payment and cash sources. Historical data remains when disconnected.</p></div><Link href="/dashboard/integrations" className="text-sm text-vault">Manage</Link></div>{(accounts??[]).length===0?<div className="border border-dashed border-rule p-8 text-sm text-ink/50">No financial account connected yet.</div>:<div className="space-y-3">{accounts!.map(a=><div key={a.id} className="border border-rule p-4 flex justify-between"><div><p className="text-sm font-medium">{a.display_name}</p><p className="text-xs text-ink/45">{a.provider||"Manual"} · {a.currency}</p></div><span className="text-xs text-vault">{a.status}</span></div>)}</div>}</section>
 <section className="bg-white border border-rule p-6"><h2 className="font-display text-xl mb-5">Money buckets</h2><div className="space-y-3">{(buckets??[]).map(b=><div key={b.name} className="flex justify-between border-b border-rule pb-3"><div><p className="text-sm">{b.name}</p><p className="text-[11px] text-ink/40">{b.bucket_type}</p></div><span className="text-sm">{money(Number(b.allocated_amount))}</span></div>)}</div></section></div>
 <section className="bg-white border border-rule p-6 mt-6"><div className="flex justify-between mb-5"><div><h2 className="font-display text-xl">Recent synchronized activity</h2><p className="text-xs text-ink/45 mt-1">Posted transactions only. Pending or failed movements do not change available movement totals.</p></div><span className="text-xs text-ink/40">{integrations?.length||0} integration(s)</span></div>{(txs??[]).length===0?<p className="text-sm text-ink/50 py-6">No posted financial transactions yet.</p>:<div className="divide-y divide-rule">{txs!.map((x,i)=><div key={i} className="py-3 flex justify-between gap-4"><div><p className="text-sm">{x.counterparty_name||x.description||"Financial transaction"}</p><p className="text-xs text-ink/40">{new Date(x.occurred_at).toLocaleString()} · {x.reconciled?"Reconciled":"Unmatched"}</p></div><span className={x.direction==="inflow"?"text-vault":"text-ink"}>{x.direction==="inflow"?"+":"-"}{money(Number(x.amount))}</span></div>)}</div>}</section>
 </section></main>;
}