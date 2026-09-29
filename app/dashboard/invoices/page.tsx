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
  return <main className="min-h-screen bg-ledger">
    <header className="border-b border-rule bg-white"><div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
      <Link href="/dashboard" className="font-display text-lg text-ink">{business.name}</Link>
      <Link href="/dashboard" className="text-sm text-ink/45 hover:text-ink">Back to dashboard</Link>
    </div></header>
    <section className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8"><div><h1 className="font-display text-3xl text-ink mb-1">Invoices</h1><p className="text-ink/60">Commercial records, payments and balances from one source of truth.</p></div>
      <Link href="/dashboard/invoices/new" className="bg-ink text-mist px-5 py-2.5 text-sm font-medium hover:bg-vaultDeep transition-colors">New invoice</Link></div>
      {!rows.length?<p className="text-sm text-ink/40">No invoices yet — create the first one.</p>:
      <div className="divide-y divide-rule border-t border-b border-rule">{rows.map(inv=>{
        const customer=inv.customer as unknown as {name:string}|null;
        const total=Number(inv.total||0), paid=Number(inv.paid_amount||0), outstanding=calculateOutstanding(total,paid);
        const displayStatus=displayInvoiceStatus(inv.status,inv.due_date);
        return <Link key={inv.id} href={`/dashboard/invoices/${inv.id}`} className="py-4 grid sm:grid-cols-[100px_1fr_150px_150px_110px] gap-3 items-center hover:bg-white transition-colors -mx-2 px-2">
          <span className="text-sm text-ink/50">{inv.invoice_number}</span><span className="text-ink">{customer?.name??"—"}</span>
          <span className="text-sm text-ink/70">{formatMoney(total,inv.currency)}</span>
          <span className="text-xs text-ink/55">{paid>0?formatMoney(paid,inv.currency)+" paid · ":""}{formatMoney(outstanding,inv.currency)} due</span>
          <span className={`text-xs px-2.5 py-1 rounded-full text-center capitalize ${STATUS_STYLES[displayStatus]??"bg-ink/10 text-ink/60"}`}>{displayStatus.replace("_"," ")}</span>
        </Link>;
      })}</div>}
    </section>
  </main>;
}