import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { calculateOutstanding, displayInvoiceStatus, formatMoney } from "@/lib/invoices";

const STATUS_STYLES: Record<string,string> = {
  draft:"bg-ink/10 text-ink/60", sent:"bg-vault/10 text-vault",
  partially_paid:"bg-brass/15 text-ink", paid:"bg-vault text-mist", overdue:"bg-alert/10 text-alert"
};

export default async function InvoicesPage() {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect("/login");
  const {data:business}=await supabase.from("businesses").select("id,name").eq("owner_id",user.id).single();
  if(!business) redirect("/onboarding");
  const {data:invoices}=await supabase.from("invoices")
    .select("id,invoice_number,status,due_date,currency,total,paid_amount,created_at,customer:customers(name)")
    .eq("business_id",business.id).order("created_at",{ascending:false});
  const rows=invoices??[];
  return <main className="min-h-screen bg-[#f4f1ea] text-[#151817]">
    <header className="border-b border-black/10 bg-[#fbfaf7]/95 backdrop-blur sticky top-0 z-20"><div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
      <Link href="/dashboard" className="font-display text-lg text-ink">{business.name}</Link>
      <Link href="/dashboard" className="text-sm text-ink/45 hover:text-ink">Back to dashboard</Link>
    </div></header>
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-8"><div><p className="text-[10px] uppercase tracking-[.2em] text-[#7c6f58] mb-2">Money in · Commercial Studio</p><h1 className="font-display text-4xl sm:text-5xl tracking-tight text-[#151817] mb-2">Invoices that know what happens next.</h1><p className="text-[#151817]/55 max-w-2xl">Quotes, balances, confirmed payments and customer communication stay connected to the same commercial record.</p></div>
      <Link href="/dashboard/invoices/new" className="rounded-xl bg-[#151817] text-white px-5 py-3 text-sm font-medium shadow-[0_12px_30px_rgba(21,24,23,.16)]">Create invoice</Link></div>
      {!rows.length?<div className="rounded-[28px] border border-black/10 bg-[#fffdf9] p-10 text-center shadow-[0_20px_70px_rgba(20,20,16,.06)]"><p className="text-[10px] uppercase tracking-[.18em] text-black/35">Commercial workspace</p><h2 className="font-display text-2xl mt-2">Your first invoice starts here.</h2><p className="text-sm text-black/45 mt-2 max-w-md mx-auto">Create a real invoice and keep its customer, delivery, payment and balance history together.</p><Link href="/dashboard/invoices/new" className="inline-flex mt-6 rounded-xl bg-[#183f38] text-white px-5 py-3 text-sm">Create first invoice</Link></div>:
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5"><div className="rounded-2xl bg-[#183f38] text-white p-5"><p className="text-[10px] uppercase tracking-[.16em] text-white/45">Total billed</p><p className="font-display text-2xl mt-2">{rows.reduce((s,i)=>s+Number(i.total||0),0).toFixed(2)} {rows[0]?.currency||""}</p></div><div className="rounded-2xl bg-white border border-black/10 p-5"><p className="text-[10px] uppercase tracking-[.16em] text-black/35">Collected</p><p className="font-display text-2xl mt-2">{rows.reduce((s,i)=>s+Number(i.paid_amount||0),0).toFixed(2)} {rows[0]?.currency||""}</p></div><div className="rounded-2xl bg-white border border-black/10 p-5"><p className="text-[10px] uppercase tracking-[.16em] text-black/35">Outstanding</p><p className="font-display text-2xl mt-2">{rows.reduce((s,i)=>s+calculateOutstanding(Number(i.total||0),Number(i.paid_amount||0)),0).toFixed(2)} {rows[0]?.currency||""}</p></div><div className="rounded-2xl bg-[#fff8e9] border border-black/10 p-5"><p className="text-[10px] uppercase tracking-[.16em] text-black/35">Open records</p><p className="font-display text-2xl mt-2">{rows.filter(i=>i.status!=="paid").length}</p></div></div><div className="rounded-[28px] border border-black/10 bg-[#fffdf9] shadow-[0_24px_80px_rgba(20,20,16,.07)] overflow-hidden"><div className="hidden md:grid grid-cols-[120px_1fr_160px_190px_120px] gap-4 px-5 py-3 text-[10px] uppercase tracking-[.16em] text-black/35 border-b border-black/10"><span>Invoice</span><span>Customer</span><span>Total</span><span>Payment position</span><span>Status</span></div><div className="divide-y divide-black/10">{rows.map(inv=>{
        const customer=inv.customer as unknown as {name:string}|null;
        const total=Number(inv.total||0), paid=Number(inv.paid_amount||0), outstanding=calculateOutstanding(total,paid);
        const displayStatus=displayInvoiceStatus(inv.status,inv.due_date);
        return <Link key={inv.id} href={`/dashboard/invoices/${inv.id}`} className="group py-5 grid md:grid-cols-[120px_1fr_160px_190px_120px] gap-4 items-center hover:bg-[#f7f3eb] transition-colors px-5">
          <span className="text-sm text-ink/50">{inv.invoice_number}</span><span className="text-ink">{customer?.name??"—"}</span>
          <span className="text-sm text-ink/70">{formatMoney(total,inv.currency)}</span>
          <span className="text-xs text-ink/55">{paid>0?formatMoney(paid,inv.currency)+" paid · ":""}{formatMoney(outstanding,inv.currency)} due</span>
          <span className={`text-xs px-2.5 py-1 rounded-full text-center capitalize ${STATUS_STYLES[displayStatus]??"bg-ink/10 text-ink/60"}`}>{displayStatus.replace("_"," ")}</span>
        </Link>;
      })}</div></div>}
    </section>
  </main>;
}