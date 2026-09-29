import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { calculateOutstanding, displayInvoiceStatus, formatMoney } from "@/lib/invoices";

const STATUS_STYLES: Record<string,string> = {
  draft: "bg-[#eceae5] text-[#5e5b55] border-[#d9d6ce]",
  sent: "bg-[#e8eef4] text-[#31536f] border-[#cbd9e5]",
  partially_paid: "bg-[#f8edc8] text-[#7b611c] border-[#ead89b]",
  paid: "bg-[#dcefe2] text-[#2f6b43] border-[#b9dcc5]",
  overdue: "bg-[#f7dddd] text-[#a04444] border-[#e8bcbc]"
};

const STATUS_DOTS: Record<string,string> = {
  draft: "bg-[#8b887f]",
  sent: "bg-[#52799a]",
  partially_paid: "bg-[#c49a35]",
  paid: "bg-[#4f9965]",
  overdue: "bg-[#c95c5c]"
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
  return <main className="min-h-screen bg-[#f3f0e8] text-[#171918]">
    <header className="sticky top-0 z-30 border-b border-black/[.08] bg-[#f8f6f0]/90 backdrop-blur-xl">
      <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="font-display text-xl tracking-tight">{business.name}</Link>
          <span className="hidden sm:inline-block h-5 w-px bg-black/10" />
          <span className="hidden sm:inline text-[10px] uppercase tracking-[.2em] text-black/35">Commercial / Invoices</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="hidden sm:inline text-xs text-black/45 hover:text-black transition-colors">Dashboard</Link>
          <Link href="/dashboard/invoices/new" className="inline-flex items-center gap-2 rounded-xl bg-[#171918] text-white px-4 py-2.5 text-xs font-medium shadow-[0_8px_24px_rgba(23,25,24,.14)] hover:-translate-y-px transition-transform"><span className="text-base leading-none">+</span> New invoice</Link>
        </div>
      </div>
    </header>
    <section className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-end mb-9">
        <div><div className="flex items-center gap-2 mb-4"><span className="h-1.5 w-1.5 rounded-full bg-[#806f50]" /><span className="text-[10px] uppercase tracking-[.24em] text-[#806f50]">Money in</span></div>
          <h1 className="font-display text-[42px] sm:text-[54px] leading-[.98] tracking-[-.035em] max-w-3xl">Invoices, without the clutter.</h1>
          <p className="mt-4 text-[15px] leading-6 text-black/50 max-w-2xl">Every invoice is a commercial record: customer, work, payment position, delivery and what needs to happen next.</p>
        </div>
        <div className="lg:text-right"><p className="text-[10px] uppercase tracking-[.2em] text-black/30">Live workspace</p><p className="font-display text-xl mt-1">${rows.length} invoice{rows.length === 1 ? "" : "s"}</p></div>
      </div>
      {!rows.length ? (
        <div className="rounded-[32px] border border-black/[.08] bg-[#fcfaf5] shadow-[0_28px_90px_rgba(25,24,20,.07)] overflow-hidden">
          <div className="grid lg:grid-cols-[1.15fr_.85fr]">
            <div className="p-7 sm:p-12 border-b lg:border-b-0 lg:border-r border-black/[.08]">
              <span className="inline-flex rounded-full border border-black/10 bg-white px-3 py-1.5 text-[10px] uppercase tracking-[.16em] text-black/45">Commercial studio</span>
              <h2 className="font-display text-3xl sm:text-4xl tracking-tight mt-6 max-w-xl">Turn a customer agreement into a clear financial record.</h2>
              <p className="text-sm leading-6 text-black/50 mt-4 max-w-lg">Create the invoice first. Payment providers, delivery channels and verified payment events can attach to it later without changing the record itself.</p>
              <Link href="/dashboard/invoices/new" className="inline-flex mt-8 rounded-xl bg-[#171918] text-white px-5 py-3 text-sm font-medium">Create your first invoice</Link>
            </div>
            <div className="p-7 sm:p-12 bg-[#f1eee5]"><p className="text-[10px] uppercase tracking-[.2em] text-black/35">The record follows</p><div className="mt-6 space-y-4">{["Customer relationship","Work and line items","Amount and balance","Delivery and payment","Receipt and history"].map((item, i) => (<div key={item} className="flex items-center gap-4"><span className="h-8 w-8 rounded-full border border-black/10 bg-white flex items-center justify-center text-[11px] text-black/45">{String(i + 1).padStart(2,"0")}</span><span className="text-sm text-black/65">{item}</span></div>))}</div></div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
            {[["Billed", rows.reduce((s,i)=>s+Number(i.total||0),0), "primary"],["Collected", rows.reduce((s,i)=>s+Number(i.paid_amount||0),0), "light"],["Outstanding", rows.reduce((s,i)=>s+calculateOutstanding(Number(i.total||0),Number(i.paid_amount||0)),0), "light"],["Needs attention", rows.filter(i=>i.status!=="paid").length, "sand"]].map(([label,value,tone]) => (
              <div key={String(label)} className={`rounded-[22px] border border-black/[.08] p-5 sm:p-6 ${tone==="primary" ? "bg-[#202725] text-white border-[#202725]" : tone==="sand" ? "bg-[#eee8da]" : "bg-[#fcfaf5]"}`}>
                <p className={`text-[10px] uppercase tracking-[.18em] ${tone==="primary" ? "text-white/45" : "text-black/35"}`}>{label}</p>
                <p className="font-display text-[25px] sm:text-[28px] tracking-tight mt-2">{label==="Needs attention" ? String(value) : formatMoney(Number(value), rows[0]?.currency || "")}</p>
              </div>
            ))}
          </div>
          <div className="mb-4 rounded-[24px] border border-black/[.08] bg-[#fcfaf5] px-5 sm:px-7 py-4 flex flex-wrap items-center gap-x-5 gap-y-3"><span className="text-[9px] uppercase tracking-[.2em] text-black/30 mr-1">Status key</span>{[["paid","Paid"],["partially_paid","Partial"],["overdue","Overdue"],["sent","Sent"],["draft","Draft"]].map(([key,label])=><span key={key} className="inline-flex items-center gap-2 text-[11px] text-black/55"><i className={`h-2 w-2 rounded-full ${STATUS_DOTS[key]}`} />{label}</span>)}</div><div className="rounded-[30px] border border-black/[.08] bg-[#fcfaf5] shadow-[0_24px_80px_rgba(25,24,20,.06)] overflow-hidden">
            <div className="px-5 sm:px-7 py-5 border-b border-black/[.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[.2em] text-black/30">Invoice register</p><p className="text-sm text-black/55 mt-1">A visual view of every commercial record.</p></div><div className="flex items-center gap-2"><span className="rounded-full border border-black/10 px-3 py-1.5 text-[10px] uppercase tracking-[.12em] text-black/40">All records</span><Link href="/dashboard/invoices/new" className="rounded-full bg-[#171918] text-white px-3.5 py-1.5 text-[11px]">Create</Link></div></div>
            <div className="hidden lg:grid grid-cols-[130px_minmax(180px,1fr)_170px_230px_125px] gap-5 px-7 py-3 text-[9px] uppercase tracking-[.2em] text-black/30 border-b border-black/[.06]"><span>Record</span><span>Customer</span><span>Value</span><span>Payment position</span><span>State</span></div>
            <div className="divide-y divide-black/[.07]">{rows.map(inv=>{const customer=inv.customer as unknown as {name:string}|null;const total=Number(inv.total||0),paid=Number(inv.paid_amount||0),outstanding=calculateOutstanding(total,paid);const displayStatus=displayInvoiceStatus(inv.status,inv.due_date);const progress=total>0?Math.min(100,(paid/total)*100):0;return <Link key={inv.id} href={`/dashboard/invoices/${inv.id}`} className="group block px-5 sm:px-7 py-5 hover:bg-[#f5f1e9] transition-colors"><div className="lg:grid lg:grid-cols-[130px_minmax(180px,1fr)_170px_230px_125px] lg:gap-5 lg:items-center"><div className="flex items-center justify-between lg:block"><span className="font-mono text-[11px] text-black/40">{inv.invoice_number}</span><span className={`lg:hidden inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] capitalize ${STATUS_STYLES[displayStatus] || STATUS_STYLES.draft}`}><i className={`h-1.5 w-1.5 rounded-full ${STATUS_DOTS[displayStatus] || STATUS_DOTS.draft}`} />{displayStatus === "partially_paid" ? "Partial" : displayStatus.replace("_"," ")}</span></div><div className="mt-3 lg:mt-0 min-w-0"><p className="text-[15px] font-medium truncate">{customer?.name ?? "Unnamed customer"}</p><p className="text-xs text-black/35 mt-1">{inv.due_date ? `Due ${new Date(inv.due_date).toLocaleDateString()}` : "No due date"}</p></div><div className="mt-4 lg:mt-0"><p className="text-sm font-medium">{formatMoney(total,inv.currency)}</p><p className="text-[11px] text-black/35 mt-1">{paid ? `${formatMoney(paid,inv.currency)} collected` : "Nothing collected yet"}</p></div><div className="mt-4 lg:mt-0"><div className="flex items-center justify-between text-[11px] mb-2"><span className="text-black/45">{paid ? `${formatMoney(outstanding,inv.currency)} remaining` : "Awaiting payment"}</span><span className="text-black/30">{Math.round(progress)}%</span></div><div className="h-1.5 rounded-full bg-black/[.07] overflow-hidden"><div className="h-full rounded-full bg-[#6d746f] transition-all" style={{width:`${progress}%`}} /></div></div><div className="hidden lg:flex items-center justify-between gap-3"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] capitalize ${STATUS_STYLES[displayStatus] || STATUS_STYLES.draft}`}><i className={`h-1.5 w-1.5 rounded-full ${STATUS_DOTS[displayStatus] || STATUS_DOTS.draft}`} />{displayStatus === "partially_paid" ? "Partial" : displayStatus.replace("_"," ")}</span><span className="text-black/20 group-hover:text-black/55 transition-colors">↗</span></div></div></Link>})}</div>
          </div>
        </>
      )}
    </section>
  </main>;
}
