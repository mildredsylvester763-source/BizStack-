"use client";
import { useEffect, useMemo, useState } from "react";
import PortalInvoicePayment from "./portal-invoice-payment";

type Data={
  authenticated:boolean;
  portal?:any;
  customer?:any;
  invoices?:any[];
  appointments?:any[];
  messages?:any[];
  orders?:any[];
  cardProcessorConnected?:boolean;
};

const tabs=["Overview","Invoices","Orders","Appointments","Messages"] as const;
type Tab=typeof tabs[number];

export default function PortalClient({slug,initial}:{slug:string;initial:Data}){
 const [data,setData]=useState<Data>(initial),[email,setEmail]=useState(""),[token,setToken]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[tab,setTab]=useState<Tab>("Overview");

 useEffect(()=>{
   const t=new URLSearchParams(location.search).get("token");
   if(t){setToken(t);void verify(t);return;}
   (async()=>{try{const r=await fetch("/api/portal/session",{cache:"no-store"});const x=await r.json();if(x.authenticated)setData(x);}catch{}})();
 },[]);

 async function verify(raw:string){
  setBusy(true);setNotice("");
  try{
   const r=await fetch("/api/portal/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:raw})});
   const x=await r.json();if(!r.ok)throw new Error(x.error||"Access link failed.");
   const s=await fetch("/api/portal/session",{cache:"no-store"});setData(await s.json());
   history.replaceState({}, "", "/portal/"+encodeURIComponent(slug));
  }catch(e){setNotice(e instanceof Error?e.message:"Access verification failed.");}
  finally{setBusy(false)}
 }
 async function requestAccess(e:React.FormEvent){
  e.preventDefault();setBusy(true);setNotice("");
  try{
   const r=await fetch("/api/portal/request-access",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug,email})});
   const x=await r.json();if(!r.ok)throw new Error(x.error||"Could not request access.");
   setNotice(x.message||"Check your email for a secure access link.");
  }catch(e){setNotice(e instanceof Error?e.message:"Could not request access.");}
  finally{setBusy(false)}
 }
 async function logout(){await fetch("/api/portal/session",{method:"DELETE"});setData({authenticated:false});setTab("Overview");}

 const invoices=data.invoices||[],appointments=data.appointments||[],messages=data.messages||[],orders=data.orders||[];
 const cardProcessorConnected=Boolean(data.cardProcessorConnected);
 const outstanding=useMemo(()=>invoices.reduce((n,i)=>n+Math.max(Number(i.total||0)-Number(i.paid_amount||0),0),0),[invoices]);
 const currency=data.customer?.preferred_currency||invoices[0]?.currency||orders[0]?.currency||"";
 const fmt=(v:number,c=currency)=>new Intl.NumberFormat(undefined,{style:"currency",currency:c||"USD"}).format(v);

 if(!data.authenticated)return <main className="min-h-screen bg-[#f5f4ef] text-[#151515] flex items-center justify-center p-5"><div className="w-full max-w-md bg-white border border-black/10 rounded-3xl p-7 shadow-sm"><div className="text-[10px] uppercase tracking-[.2em] text-black/40">Customer portal</div><h1 className="text-2xl font-semibold mt-2">Secure customer access</h1><p className="text-sm text-black/50 leading-6 mt-3">Enter the email address your business uses for your customer account. We’ll send a one-time secure access link.</p><form onSubmit={requestAccess} className="mt-6 space-y-3"><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-black/10 px-3 py-3 outline-none"/><button disabled={busy} className="w-full rounded-xl bg-[#151515] text-white py-3 text-sm disabled:opacity-40">{busy?"Sending…":"Send secure access link"}</button></form>{notice&&<p className="text-xs mt-4 text-black/55">{notice}</p>}</div></main>;

 const content=()=>{
  if(tab==="Invoices")return <section className="bg-white rounded-2xl border border-black/10 overflow-hidden"><div className="px-5 py-4 border-b border-black/10"><h2 className="font-semibold">Invoices</h2><p className="text-xs text-black/40 mt-1">Only invoices belonging to this customer account are shown.</p></div>{invoices.length?invoices.map(i=><div key={i.id} className="px-5 py-4 border-b border-black/5 flex flex-wrap items-center gap-3"><div><div className="text-sm font-medium">{i.invoice_number}</div><div className="text-xs text-black/40 mt-1">{i.issue_date} · due {i.due_date||"—"}</div></div><span className="text-xs rounded-full bg-black/[.04] px-2 py-1">{i.status}</span><div className="ml-auto text-sm font-medium">{fmt(Number(i.total||0),i.currency)}</div><div className="w-full text-xs text-black/45">Paid {fmt(Number(i.paid_amount||0),i.currency)} · Outstanding {fmt(Math.max(Number(i.total||0)-Number(i.paid_amount||0),0),i.currency)}</div></div>):<div className="p-8 text-sm text-black/40">No invoices are available for this account yet.</div>}</section>;

  if(tab==="Orders")return <section className="bg-white rounded-2xl border border-black/10 overflow-hidden"><div className="px-5 py-4 border-b border-black/10"><h2 className="font-semibold">Orders & purchases</h2><p className="text-xs text-black/40 mt-1">Purchase history connected to your customer account.</p></div>{orders.length?orders.map(o=><div key={o.id} className="px-5 py-4 border-b border-black/5"><div className="flex items-center gap-3"><div><div className="text-sm font-medium">{o.sale_number}</div><div className="text-xs text-black/40 mt-1">{o.sale_at?new Date(o.sale_at).toLocaleString():"—"} · {o.payment_method||"payment"}</div></div><span className="ml-auto text-xs rounded-full bg-black/[.04] px-2 py-1">{o.status}</span><strong className="text-sm">{fmt(Number(o.total||0),o.currency)}</strong></div>{Array.isArray(o.cash_sale_items)&&o.cash_sale_items.length>0&&<div className="mt-3 flex flex-wrap gap-2">{o.cash_sale_items.map((it:any)=><span key={it.description+String(it.quantity)} className="text-xs border border-black/10 rounded-lg px-2 py-1">{it.description} × {it.quantity}</span>)}</div>}</div>):<div className="p-8 text-sm text-black/40">No purchases are available yet.</div>}</section>;

  if(tab==="Appointments")return <section className="bg-white rounded-2xl border border-black/10 overflow-hidden"><div className="px-5 py-4 border-b border-black/10"><h2 className="font-semibold">Appointments</h2><p className="text-xs text-black/40 mt-1">Your scheduled services and appointment status.</p></div>{appointments.length?appointments.map(a=><div key={a.id} className="px-5 py-4 border-b border-black/5 flex flex-wrap items-center gap-3"><div><div className="text-sm font-medium">{a.appointment_services?.name||"Appointment"}</div><div className="text-xs text-black/40 mt-1">{a.starts_at?new Date(a.starts_at).toLocaleString():"—"}{a.ends_at?" · "+new Date(a.ends_at).toLocaleTimeString():""}</div></div><span className="ml-auto text-xs rounded-full bg-black/[.04] px-2 py-1">{a.status}</span><div className="text-sm font-medium">{fmt(Number(a.price||0),a.currency)}</div></div>):<div className="p-8 text-sm text-black/40">No appointments are available yet.</div>}</section>;

  if(tab==="Messages")return <section className="bg-white rounded-2xl border border-black/10 overflow-hidden"><div className="px-5 py-4 border-b border-black/10"><h2 className="font-semibold">Messages</h2><p className="text-xs text-black/40 mt-1">Business communications associated with your customer account.</p></div>{messages.length?messages.map(m=><article key={m.id} className="px-5 py-4 border-b border-black/5"><div className="flex items-center gap-2"><span className="text-xs uppercase tracking-wide text-black/35">{m.channel}</span><span className="text-xs text-black/35">·</span><span className="text-xs text-black/35">{m.direction}</span><span className="ml-auto text-xs text-black/35">{m.created_at?new Date(m.created_at).toLocaleString():""}</span></div>{m.subject&&<h3 className="text-sm font-medium mt-2">{m.subject}</h3>}<p className="text-sm text-black/60 leading-6 mt-1 whitespace-pre-wrap">{m.body}</p></article>):<div className="p-8 text-sm text-black/40">No messages are available yet.</div>}</section>;

  return <><div className="grid md:grid-cols-3 gap-4"><div className="md:col-span-2 bg-white rounded-2xl border border-black/10 p-5"><div className="text-[10px] uppercase tracking-[.15em] text-black/35">Account</div><h2 className="text-lg font-semibold mt-2">{data.customer?.name}</h2><p className="text-sm text-black/45 mt-1">{data.customer?.company_name||data.customer?.phone||data.customer?.email}</p><div className="grid sm:grid-cols-4 gap-3 mt-6"><div className="rounded-xl bg-black/[.03] p-3"><div className="text-[9px] text-black/35">Invoices</div><div className="text-xl mt-1">{invoices.length}</div></div><div className="rounded-xl bg-black/[.03] p-3"><div className="text-[9px] text-black/35">Outstanding</div><div className="text-xl mt-1">{fmt(outstanding)}</div></div><div className="rounded-xl bg-black/[.03] p-3"><div className="text-[9px] text-black/35">Orders</div><div className="text-xl mt-1">{orders.length}</div></div><div className="rounded-xl bg-black/[.03] p-3"><div className="text-[9px] text-black/35">Appointments</div><div className="text-xl mt-1">{appointments.length}</div></div></div></div><div className="bg-[#151515] text-white rounded-2xl p-5"><div className="text-[9px] uppercase tracking-[.15em] text-white/40">Portal services</div><p className="text-sm text-white/70 leading-6 mt-3">Invoices, purchase history, appointments and business communications are available from this secure account space.</p></div></div><div className="mt-6 grid md:grid-cols-3 gap-3"><button onClick={()=>setTab("Invoices")} className="text-left bg-white border border-black/10 rounded-xl p-4 hover:border-black/25"><b className="text-sm">View invoices</b><p className="text-xs text-black/45 mt-1">Review balances and payment status.</p></button><button onClick={()=>setTab("Orders")} className="text-left bg-white border border-black/10 rounded-xl p-4 hover:border-black/25"><b className="text-sm">Purchase history</b><p className="text-xs text-black/45 mt-1">See previous orders and line items.</p></button><button onClick={()=>setTab("Messages")} className="text-left bg-white border border-black/10 rounded-xl p-4 hover:border-black/25"><b className="text-sm">Messages</b><p className="text-xs text-black/45 mt-1">Review business communications.</p></button></div></>;
 };

 return <main className="min-h-screen bg-[#f5f4ef] text-[#151515]"><header className="border-b border-black/10 bg-white sticky top-0 z-10"><div className="max-w-6xl mx-auto px-5 py-5 flex items-center gap-4"><div><div className="text-[10px] uppercase tracking-[.2em] text-black/35">Customer portal</div><h1 className="text-xl font-semibold mt-1">{data.portal?.name||"Your account"}</h1></div><div className="ml-auto flex items-center gap-3"><span className="hidden sm:inline text-xs text-black/45">{data.customer?.email}</span><button onClick={logout} className="text-xs border border-black/10 rounded-lg px-3 py-2">Sign out</button></div></div></header><section className="max-w-6xl mx-auto p-5 md:p-8"><div className="flex gap-2 overflow-x-auto pb-3 mb-5">{tabs.map(t=><button key={t} onClick={()=>setTab(t)} className={"whitespace-nowrap rounded-lg px-3 py-2 text-xs border "+(tab===t?"bg-[#151515] text-white border-[#151515]":"bg-white border-black/10 text-black/55")}>{t}</button>)}</div>{content()}</section></main>;
}
