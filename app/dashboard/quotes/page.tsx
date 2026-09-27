// @ts-nocheck
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

async function changeQuoteStatus(formData:FormData){
  "use server";
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/login");
  const {data:business}=await supabase.from("businesses").select("id").eq("owner_id",user.id).single(); if(!business)redirect("/onboarding");
  const id=String(formData.get("quoteId")||""),status=String(formData.get("status")||"");
  if(!["sent","accepted","rejected","cancelled"].includes(status))throw new Error("Invalid quote status.");
  const {data:quote}=await supabase.from("quotes").select("id,status").eq("id",id).eq("business_id",business.id).single();
  if(!quote)throw new Error("Quote not found.");
  if(quote.status==="converted")throw new Error("Converted quotes cannot be changed.");
  await supabase.from("quotes").update({status,updated_at:new Date().toISOString()}).eq("id",id).eq("business_id",business.id);
  await supabase.from("events").insert({business_id:business.id,event_type:"quote.status_changed",summary:"Quote status changed to "+status,evidence:{quote_id:id,status},status:"info",priority:"normal",category:"sales"});
  revalidatePath("/dashboard/quotes");
}

async function convertQuote(formData:FormData){
  "use server";
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/login");
  const {data:business}=await supabase.from("businesses").select("id").eq("owner_id",user.id).single(); if(!business)redirect("/onboarding");
  const id=String(formData.get("quoteId")||"");
  const {data:invoiceId,error}=await supabase.rpc("convert_accepted_quote_to_invoice",{p_quote_id:id});
  if(error)throw new Error(error.message);
  revalidatePath("/dashboard/quotes");
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices/"+invoiceId);
}

export default async function QuotesPage(){
 const supabase=createClient();
 const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/login");
 const {data:business}=await supabase.from("businesses").select("id,name,currency").eq("owner_id",user.id).single(); if(!business)redirect("/onboarding");
 const {data:quotes}=await supabase.from("quotes").select("id,quote_number,status,issue_date,expiry_date,currency,total,customer:customers(name,email),converted_invoice_id,created_at").eq("business_id",business.id).order("created_at",{ascending:false});
 return <main className="min-h-screen bg-ledger">
  <header className="border-b border-rule bg-white"><div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center"><div><Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link><h1 className="font-display text-2xl mt-1">Quotes</h1></div><Link href="/dashboard/ai-builder" className="bg-ink text-white px-4 py-2 text-sm">Create with AI Builder</Link></div></header>
  <section className="max-w-7xl mx-auto px-6 py-8">
   <div className="bg-white border border-rule p-5 mb-6"><p className="text-xs uppercase tracking-[.16em] text-vault">Sales pipeline</p><h2 className="font-display text-3xl mt-2">Quotes that can become revenue</h2><p className="text-sm text-ink/55 mt-2">Draft, send, accept or reject a quote. Accepted quotes can be converted into a real invoice without retyping the commercial details.</p></div>
   <div className="bg-white border border-rule overflow-hidden">{(quotes??[]).map(q=><div key={q.id} className="p-5 border-b border-rule last:border-0"><div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"><div><p className="font-medium">{q.quote_number}</p><p className="text-sm text-ink/60 mt-1">{q.customer?.name||"Unknown customer"}{q.customer?.email?" · "+q.customer.email:""}</p><p className="text-xs text-ink/35 mt-1">Issued {q.issue_date}{q.expiry_date?" · Expires "+q.expiry_date:""}</p></div><div className="lg:text-right"><p className="font-display text-xl">{q.currency} {Number(q.total||0).toLocaleString()}</p><p className="text-xs uppercase tracking-[.12em] text-vault mt-1">{q.status}</p></div><div className="flex flex-wrap gap-2">{q.status!=="converted"&&q.status!=="rejected"&&q.status!=="cancelled"&&<form action={changeQuoteStatus}><input type="hidden" name="quoteId" value={q.id}/><input type="hidden" name="status" value="sent"/><button className="border border-rule px-3 py-2 text-xs">Mark sent</button></form>}{q.status!=="accepted"&&q.status!=="converted"&&q.status!=="rejected"&&<form action={changeQuoteStatus}><input type="hidden" name="quoteId" value={q.id}/><input type="hidden" name="status" value="accepted"/><button className="bg-vault text-white px-3 py-2 text-xs">Accept</button></form>}{q.status!=="rejected"&&q.status!=="converted"&&<form action={changeQuoteStatus}><input type="hidden" name="quoteId" value={q.id}/><input type="hidden" name="status" value="rejected"/><button className="border border-rule px-3 py-2 text-xs">Reject</button></form>}{["accepted","sent","viewed"].includes(q.status)&&!q.converted_invoice_id&&<form action={convertQuote}><input type="hidden" name="quoteId" value={q.id}/><button className="bg-ink text-white px-3 py-2 text-xs">Convert to invoice</button></form>}{q.converted_invoice_id&&<Link href={"/dashboard/invoices/"+q.converted_invoice_id} className="border border-vault text-vault px-3 py-2 text-xs">Open invoice</Link>}</div></div></div>)}{!(quotes??[]).length&&<div className="p-10 text-center text-sm text-ink/45">No quotes yet. Create one from the AI Builder.</div>}</div>
  </section>
 </main>;
}
