import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { calculateInvoiceTotal } from "@/lib/invoices";
import { BizMetric, BizPanel, BizSection, BizStatus, BizTabs } from "@/components/ui/BizStackVisual";

export default async function AccountingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase.from("businesses").select("id,name,currency").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");

  const [{ data: invoices }, { data: customers }, { data: products }, { data: events }] = await Promise.all([
    supabase.from("invoices").select("id,status,currency,created_at,due_date,invoice_items(quantity,unit_price)").eq("business_id", business.id).order("created_at", { ascending: false }).limit(500),
    supabase.from("customers").select("id,name,status,created_at").eq("business_id", business.id),
    supabase.from("products").select("id,name,stock_quantity,low_stock_threshold").eq("business_id", business.id).order("stock_quantity", { ascending: false }).limit(8),
    supabase.from("events").select("id,summary,status,created_at").eq("business_id", business.id).order("created_at", { ascending: false }).limit(8)
  ]);

  const rows = invoices || [];
  const revenue = rows.reduce((sum:any, inv:any) => sum + calculateInvoiceTotal(inv.invoice_items || []), 0);
  const collected = rows.filter((x:any)=>x.status === "paid").reduce((sum:any, inv:any)=>sum + calculateInvoiceTotal(inv.invoice_items || []), 0);
  const outstanding = Math.max(revenue - collected, 0);
  const activeCustomers = (customers || []).filter((x:any)=>x.status === "active").length;

  const months = Array.from({length:6},(_,i)=>{
    const d=new Date(); d.setMonth(d.getMonth()-(5-i)); d.setDate(1);
    const key=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
    const value=rows.filter((x:any)=>{const q=new Date(x.created_at); return q.getFullYear()+"-"+String(q.getMonth()+1).padStart(2,"0")===key;})
      .reduce((s:number,x:any)=>s+calculateInvoiceTotal(x.invoice_items||[]),0);
    return { label:d.toLocaleString(undefined,{month:"short"}), value };
  });
  const max=Math.max(...months.map(x=>x.value),1);

  return <div className="biz-content">
    <BizSection number="5.2" title="Reports & Analytics" subtitle="Turn operations into measurable business insight.">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3"><BizTabs items={["Overview","Revenue","Customers","Expenses","General"]}/><span className="biz-chip">Current business data</span></div>
      <div className="biz-grid biz-grid-4">
        <BizMetric label="Revenue" value={revenue.toFixed(2)+" "+business.currency} delta="Calculated from invoice line items" tone="cyan" icon="$"/>
        <BizMetric label="Expenses" value="—" delta="Expense ledger not configured" tone="orange" icon="−"/>
        <BizMetric label="Net Profit" value="—" delta="Add expense data to calculate" tone="green" icon="↗"/>
        <BizMetric label="Active Customers" value={String(activeCustomers)} delta={String((customers||[]).length)+" customer records"} tone="purple" icon="◎"/>
      </div>

      <div className="grid xl:grid-cols-[1.2fr_1.2fr_.9fr] gap-3 mt-3">
        <BizPanel title="Revenue Overview" subtitle="Monthly invoiced value">
          <div className="p-4">
            <div className="h-44 flex items-end gap-2">{months.map(m=><div key={m.label} className="flex-1 h-full flex flex-col justify-end gap-2"><div className="text-center text-[7px] text-white/20">{m.value ? m.value.toFixed(0) : "0"}</div><div className="rounded-t-lg bg-gradient-to-t from-blue-600 to-cyan-400" style={{height:Math.max(6,(m.value/max)*110)+"px"}}/><div className="text-center text-[7px] text-white/20">{m.label}</div></div>)}</div>
          </div>
        </BizPanel>

        <BizPanel title="Collection Trend" subtitle="Collected versus total invoice value">
          <div className="p-4">
            <div className="rounded-2xl border border-white/[.06] bg-white/[.02] p-4">
              <div className="flex justify-between text-[8px]"><span className="text-white/30">Collected</span><span className="text-emerald-300">{collected.toFixed(2)} {business.currency}</span></div>
              <div className="mt-3 h-2 rounded-full bg-white/[.05] overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400" style={{width:(revenue?Math.min(100,collected/revenue*100):0)+"%"}}/></div>
              <div className="mt-3 flex justify-between text-[8px]"><span className="text-white/25">Outstanding</span><span className="text-orange-300">{outstanding.toFixed(2)} {business.currency}</span></div>
            </div>
          </div>
        </BizPanel>

        <BizPanel title="Top Products" subtitle="Inventory context">
          {(products||[]).length===0?<div className="p-5 text-[9px] text-white/25">No products yet.</div>:(products||[]).map((p:any,i:number)=><div key={p.id} className="biz-list-row"><span className="biz-mini">{String(i+1).padStart(2,"0")}</span><span className="biz-small flex-1 truncate">{p.name}</span><span className="biz-mini">{p.stock_quantity??0}</span>{p.low_stock_threshold!==null&&Number(p.stock_quantity)<=Number(p.low_stock_threshold)&&<BizStatus tone="orange">Low</BizStatus>}</div>)}
        </BizPanel>
      </div>
    </BizSection>

    <BizSection title="Activity & signals" subtitle="Operational context behind the numbers.">
      <div className="grid xl:grid-cols-[1.25fr_.75fr] gap-3">
        <BizPanel title="Recent business events" subtitle="Live event stream">
          {(events||[]).length===0?<div className="p-6 text-[9px] text-white/25">No events yet.</div>:(events||[]).map((e:any)=><div className="biz-list-row" key={e.id}><span className={e.status==="needs_approval"?"text-orange-300":"text-blue-300"}>●</span><span className="biz-small flex-1 truncate">{e.summary}</span><span className="biz-mini">{new Date(e.created_at).toLocaleDateString()}</span></div>)}
        </BizPanel>
        <BizPanel title="Analytics boundaries" subtitle="What the current dataset can support">
          <div className="p-4 space-y-2">
            {["Invoice revenue is directly computed","Collection rate uses paid invoice totals","Expense and profit metrics need expense records","Product view uses current stock state"].map(x=><div key={x} className="rounded-xl border border-white/[.06] bg-white/[.02] p-3 text-[8px] leading-4 text-white/35">{x}</div>)}
          </div>
        </BizPanel>
      </div>
    </BizSection>
  </div>;
}
