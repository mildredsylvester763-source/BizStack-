// @ts-nocheck
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

async function createAgent(formData: FormData) {
  "use server";
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const name=String(formData.get("name")||"").trim();
  const rate=Number(formData.get("rate")||0);
  if(!name||!Number.isFinite(rate)||rate<0||rate>100)throw new Error("Agent name and a commission rate from 0 to 100 are required.");
  const {error}=await supabase.from("sales_agents").insert({
    business_id:business.id,name,email:String(formData.get("email")||"").trim()||null,
    phone:String(formData.get("phone")||"").trim()||null,default_rate_percent:rate,
    payout_method:String(formData.get("payoutMethod")||"").trim()||null,payout_reference:String(formData.get("payoutReference")||"").trim()||null,
    notes:String(formData.get("notes")||"").trim()||null,created_by:user.id
  });
  if(error)throw new Error(error.message);
  revalidatePath("/dashboard/commissions");
}

async function preparePayable(formData: FormData){
  "use server";
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
  const {data:business}=await supabase.from("businesses").select("id").eq("owner_id",user.id).single();if(!business)redirect("/onboarding");
  const {error}=await supabase.rpc("prepare_paid_invoice_commissions",{p_business_id:business.id});
  if(error)throw new Error(error.message);
  revalidatePath("/dashboard/commissions");
}

async function createPayout(formData:FormData){
  "use server";
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
  const {data:business}=await supabase.from("businesses").select("id").eq("owner_id",user.id).single();if(!business)redirect("/onboarding");
  const agentId=String(formData.get("agentId")||"");
  const {error}=await supabase.rpc("create_commission_payout",{p_agent_id:agentId});
  if(error)throw new Error(error.message);
  revalidatePath("/dashboard/commissions");
}

async function markPaid(formData:FormData){
  "use server";
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
  const {data:business}=await supabase.from("businesses").select("id").eq("owner_id",user.id).single();if(!business)redirect("/onboarding");
  const payoutId=String(formData.get("payoutId")||"");
  const {error}=await supabase.rpc("mark_commission_payout_paid",{p_payout_id:payoutId});
  if(error)throw new Error(error.message);
  revalidatePath("/dashboard/commissions");
}

export default async function CommissionsPage(){
 const supabase=createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const {data:business}=await supabase.from("businesses").select("id,name,currency").eq("owner_id",user.id).single();if(!business)redirect("/onboarding");
 const [{data:agents},{data:entries},{data:payouts}]=await Promise.all([
  supabase.from("sales_agents").select("id,name,email,phone,status,default_rate_percent,payout_method,payout_reference").eq("business_id",business.id).order("name"),
  supabase.from("commission_entries").select("id,agent_id,source_type,source_id,basis_amount,currency,rate_percent,commission_amount,status,payable_at,paid_at,created_at").eq("business_id",business.id).order("created_at",{ascending:false}).limit(50),
  supabase.from("commission_payouts").select("id,agent_id,payout_number,amount,currency,status,scheduled_at,paid_at,payout_method,payout_reference,created_at").eq("business_id",business.id).order("created_at",{ascending:false}).limit(30)
 ]);
 const agentById=new Map((agents||[]).map((a:any)=>[a.id,a]));
 return <main className="min-h-screen bg-ledger">
  <header className="border-b border-rule bg-white"><div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center"><div><Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link><h1 className="font-display text-2xl mt-1">Agent & Broker Commissions</h1></div><Link href="/dashboard/ai-builder" className="text-xs text-vault">AI Builder</Link></div></header>
  <section className="max-w-6xl mx-auto px-6 py-8 space-y-6">
   <div className="bg-ink text-mist p-6 flex flex-col md:flex-row md:items-end md:justify-between gap-5"><div><p className="text-xs uppercase tracking-[.16em] text-mist/50">Commission OS</p><h2 className="font-display text-3xl mt-2">Track what agents earn, what is payable, and what has been paid.</h2></div><form action={preparePayable}><button className="bg-vault text-white px-5 py-2.5 text-sm">Prepare payable commissions</button></form></div>

   <form action={createAgent} className="bg-white border border-rule p-6"><p className="text-xs uppercase tracking-[.16em] text-vault">Add agent or broker</p><div className="grid md:grid-cols-3 gap-4 mt-4"><label className="text-sm">Name<input name="name" required className="mt-2 w-full border border-rule px-3 py-2.5"/></label><label className="text-sm">Default rate %<input name="rate" required type="number" min="0" max="100" step="0.01" className="mt-2 w-full border border-rule px-3 py-2.5"/></label><label className="text-sm">Email<input name="email" type="email" className="mt-2 w-full border border-rule px-3 py-2.5"/></label><label className="text-sm">Phone<input name="phone" className="mt-2 w-full border border-rule px-3 py-2.5"/></label><label className="text-sm">Payout method<input name="payoutMethod" placeholder="Bank transfer" className="mt-2 w-full border border-rule px-3 py-2.5"/></label><label className="text-sm">Payout reference<input name="payoutReference" placeholder="Account / wallet reference" className="mt-2 w-full border border-rule px-3 py-2.5"/></label></div><button className="mt-4 bg-ink text-white px-5 py-2.5 text-sm">Add agent</button></form>

   <div className="bg-white border border-rule overflow-hidden"><div className="p-5 border-b border-rule"><p className="text-xs uppercase tracking-[.16em] text-vault">Agents</p><h3 className="font-display text-xl mt-1">Active commission recipients</h3></div><div className="divide-y divide-rule">{(agents||[]).map((a:any)=><div key={a.id} className="p-4 flex flex-wrap justify-between gap-4"><div><p className="font-medium">{a.name}</p><p className="text-xs text-ink/45 mt-1">{a.email||a.phone||"No contact"} · default {a.default_rate_percent}% · {a.status}</p></div><form action={createPayout}><input type="hidden" name="agentId" value={a.id}/><button className="border border-vault text-vault px-3 py-2 text-xs">Create payout from payable</button></form></div>)}{!(agents||[]).length&&<p className="p-8 text-sm text-ink/45">No agents yet.</p>}</div></div>

   <div className="bg-white border border-rule overflow-hidden"><div className="p-5 border-b border-rule"><p className="text-xs uppercase tracking-[.16em] text-alert">Commission ledger</p><h3 className="font-display text-xl mt-1">Calculated commissions</h3></div><div className="divide-y divide-rule">{(entries||[]).map((e:any)=><div key={e.id} className="p-4 grid md:grid-cols-[1fr_auto_auto] gap-4 items-center"><div><p className="text-sm font-medium">{agentById.get(e.agent_id)?.name||"Agent"} · {e.source_type}</p><p className="text-xs text-ink/45 mt-1">{e.source_id||"Manual source"} · basis {Number(e.basis_amount).toLocaleString()} {e.currency} · {Number(e.rate_percent).toFixed(2)}%</p></div><p className="font-display">{Number(e.commission_amount).toLocaleString()} {e.currency}</p><span className="text-[10px] uppercase tracking-[.12em] text-vault">{e.status}</span></div>)}{!(entries||[]).length&&<p className="p-8 text-sm text-ink/45">No commissions calculated yet.</p>}</div></div>

   <div className="bg-white border border-rule overflow-hidden"><div className="p-5 border-b border-rule"><p className="text-xs uppercase tracking-[.16em] text-vault">Payouts</p><h3 className="font-display text-xl mt-1">Payout batches</h3></div><div className="divide-y divide-rule">{(payouts||[]).map((p:any)=><div key={p.id} className="p-4 flex flex-wrap justify-between items-center gap-4"><div><p className="font-medium">{p.payout_number} · {agentById.get(p.agent_id)?.name||"Agent"}</p><p className="text-xs text-ink/45 mt-1">{p.payout_method||"Payout method not set"}{p.payout_reference?" · "+p.payout_reference:""}</p></div><div className="flex items-center gap-3"><p className="font-display">{Number(p.amount).toLocaleString()} {p.currency}</p><span className="text-xs uppercase text-vault">{p.status}</span>{p.status!=="paid"&&p.status!=="cancelled"&&<form action={markPaid}><input type="hidden" name="payoutId" value={p.id}/><button className="bg-ink text-white px-3 py-2 text-xs">Mark paid</button></form>}</div></div>)}{!(payouts||[]).length&&<p className="p-8 text-sm text-ink/45">No payout batches yet.</p>}</div></div>
  </section>
 </main>;
}
