import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { calculateInvoiceTotal, isOverdue } from "@/lib/invoices";
import { BizIcon, BizMetric, BizPanel, BizSection, BizStatus, BizTabs } from "@/components/ui/BizStackVisual";

type CustomerRef = { name: string } | null;
type ItemRow = { quantity: number; unit_price: number };

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase.from("businesses").select("id,name,currency").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id,invoice_number,status,due_date,currency,created_at,total,paid_amount,payment_methods,customer:customers(name),invoice_items(quantity,unit_price)")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  const rows = invoices ?? [];
  const totalValue = rows.reduce((s:any, inv:any) => s + (Number(inv.total||0) || calculateInvoiceTotal(inv.invoice_items||[])), 0);
  const collected = rows.reduce((s:any, inv:any) => s + Number(inv.paid_amount||0), 0);
  const overdueCount = rows.filter((x:any)=>isOverdue(x.status,x.due_date)).length;
  const draftCount = rows.filter((x:any)=>x.status==="draft").length;

  return <div className="biz-content">
    <BizSection number="5.1" title="Invoices" subtitle="Create, send, collect and track what the business is owed.">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <BizTabs items={["All invoices","Drafts","Sent","Paid","Overdue"]}/>
        <Link href="/dashboard/invoices/new"><span className="biz-button bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white">+ New invoice</span></Link>
      </div>

      <div className="biz-grid biz-grid-4">
        <BizMetric label="Invoice value" value={totalValue.toFixed(2)+" "+business.currency} delta="Current invoice records" tone="blue" icon="¤"/>
        <BizMetric label="Collected" value={collected.toFixed(2)+" "+business.currency} delta="Recorded payments" tone="green" icon="✓"/>
        <BizMetric label="Outstanding" value={Math.max(totalValue-collected,0).toFixed(2)+" "+business.currency} delta={overdueCount?String(overdueCount)+" overdue":"No overdue invoices"} tone="orange" icon="!"/>
        <BizMetric label="Drafts" value={String(draftCount)} delta="Invoices not sent yet" tone="purple" icon="□"/>
      </div>

      <BizPanel className="mt-3" title="Invoice register" subtitle="Payment methods selected on each invoice stay attached to the record.">
        {rows.length===0 ? (
          <div className="p-10 text-center"><BizIcon tone="blue" size="lg">▤</BizIcon><div className="mt-3 text-[10px] text-white/55">No invoices yet</div><p className="mt-1 text-[8px] text-white/22">Create the first invoice with bank transfer, QR payment, card payment or any combination.</p><Link href="/dashboard/invoices/new" className="mt-3 inline-flex"><span className="biz-button bg-white text-slate-900">Create invoice</span></Link></div>
        ) : (
          <>
            <div className="hidden md:grid grid-cols-[110px_1fr_120px_115px_170px] gap-3 px-4 py-2 border-b border-white/[.07] text-[7px] uppercase tracking-[.13em] text-white/20"><span>Invoice</span><span>Customer</span><span>Amount</span><span>Due</span><span>Payment routes</span></div>
            {rows.map((inv:any)=>{
              const customer=inv.customer as unknown as CustomerRef;
              const items=(inv.invoice_items??[]) as ItemRow[];
              const total=Number(inv.total||0)>0?Number(inv.total):calculateInvoiceTotal(items);
              const overdue=isOverdue(inv.status,inv.due_date);
              const displayStatus=overdue?"overdue":inv.status;
              const methods=Array.isArray(inv.payment_methods)?inv.payment_methods:[];
              return <Link key={inv.id} href={"/dashboard/invoices/"+inv.id} className="grid md:grid-cols-[110px_1fr_120px_115px_170px] gap-3 px-4 py-4 items-center border-t border-white/[.05] hover:bg-white/[.025]">
                <div><div className="text-[9px] font-medium text-white/65">{inv.invoice_number}</div><div className="text-[7px] text-white/18 mt-1">{new Date(inv.created_at).toLocaleDateString()}</div></div>
                <div className="min-w-0"><div className="text-[9px] text-white/55 truncate">{customer?.name||"No customer"}</div><div className="mt-1"><BizStatus tone={displayStatus==="paid"?"green":displayStatus==="overdue"?"red":displayStatus==="sent"?"blue":"slate"}>{displayStatus}</BizStatus></div></div>
                <div className="text-[9px] text-white/65">{total.toFixed(2)} {inv.currency}</div>
                <div className="text-[8px] text-white/30">{inv.due_date?new Date(inv.due_date).toLocaleDateString():"—"}</div>
                <div className="flex flex-wrap gap-1">{methods.length?methods.map((m:string)=><span key={m} className="biz-chip">{m==="bank_transfer"?"Bank":m==="qr"?"QR":m==="card"?"Card":m}</span>):<span className="biz-chip">None</span>}</div>
              </Link>
            })}
          </>
        )}
      </BizPanel>
    </BizSection>
  </div>;
}
