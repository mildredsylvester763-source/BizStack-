import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { calculateInvoiceTotal, isOverdue } from "@/lib/invoices";

type AnyInv = { status: string; due_date: string | null; invoice_items: { quantity: number; unit_price: number }[] | null };

export default async function DashboardHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id, name, currency").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");

  const [{ data: invoices }, { data: customers }, { data: products }, { data: events }] = await Promise.all([
    supabase.from("invoices").select("id, status, due_date, invoice_items(quantity, unit_price)").eq("business_id", business.id),
    supabase.from("customers").select("id").eq("business_id", business.id),
    supabase.from("products").select("id, stock_quantity, low_stock_threshold").eq("business_id", business.id),
    supabase.from("events").select("id, summary, event_type, created_at").eq("business_id", business.id).order("created_at", { ascending: false }).limit(8)
  ]);

  const rows = (invoices ?? []) as AnyInv[];
  const totalRevenue = rows.reduce((s, inv) => s + calculateInvoiceTotal(inv.invoice_items ?? []), 0);
  const paidRevenue = rows.filter(inv => inv.status === "paid").reduce((s, inv) => s + calculateInvoiceTotal(inv.invoice_items ?? []), 0);
  const expenses = totalRevenue * 0.34;
  const netProfit = totalRevenue - expenses;
  const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
  const lowStock = (products ?? []).filter((p: any) => p.low_stock_threshold !== null && p.stock_quantity <= p.low_stock_threshold).length;

  return (
    <div className="min-h-screen p-5 lg:p-6 relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_55%_0%,rgba(74,95,255,.12),transparent_58%)]" />
      <div className="relative flex items-center justify-between mb-6 pb-5 border-b border-white/[.055]">
        <div>
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl border border-indigo-200/10 bg-gradient-to-br from-indigo-400/20 to-violet-500/10 grid place-items-center text-indigo-100/80 text-sm font-semibold shadow-[0_0_30px_rgba(91,110,245,.12)]">B</div><div><h1 className="text-[19px] font-semibold tracking-[-.02em] text-white">Dashboard Overview</h1>
          <p className="text-[11px] text-slate-500 mt-1">Everything you need to run, track and grow your business.</p></div></div>
        </div>
        <div className="flex gap-2">
          <select className="bg-[#0b1220] border border-white/[.07] text-slate-400 text-[10px] rounded-lg px-3 py-2 focus:outline-none">
            <option>Last 30 days</option><option>Last 7 days</option><option>Last 90 days</option>
          </select>
          <select className="bg-surface border border-line text-textMuted text-xs rounded-lg px-3 py-2 focus:outline-none">
            <option>All Businesses</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 relative">
        {[
          { label: "Total Revenue", value: `${totalRevenue.toFixed(0)} ${business.currency}`, sub: "+13% vs last month", up: true, color: "#5B6EF5" },
          { label: "Total Invoices", value: String(rows.length), sub: "+0% vs last month", up: true, color: "#8B5CF6" },
          { label: "Active Customers", value: String((customers ?? []).length), sub: "+8% vs last month", up: true, color: "#22C55E" },
          { label: "Profit Margin", value: `${profitMargin}%`, sub: "+19% vs last month", up: true, color: "#F5A524" }
        ].map((s) => (
          <div key={s.label} className="group relative overflow-hidden bg-[#0b1220]/90 border border-white/[.065] rounded-xl p-4 hover:border-indigo-300/[.16] transition-all shadow-[0_12px_40px_rgba(0,0,0,.14)]">
            <div className="absolute -right-8 -top-8 w-20 h-20 rounded-full bg-indigo-500/[.06] blur-2xl" /><p className="text-[9px] uppercase tracking-[.12em] text-slate-500 mb-1.5">{s.label}</p>
            <p className="text-[22px] font-semibold tracking-[-.03em] text-white mb-2">{s.value}</p>
            <svg viewBox="0 0 200 40" className="w-full h-8 mb-1">
              <defs>
                <linearGradient id={`grad-${s.label.replace(/ /g,"")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.3"/>
                  <stop offset="100%" stopColor={s.color} stopOpacity="0"/>
                </linearGradient>
              </defs>
              <polygon points={`0,40 0,30 28,22 56,28 84,10 112,20 140,5 168,15 200,8 200,40`} fill={`url(#grad-${s.label.replace(/ /g,"")})`}/>
              <polyline points="0,30 28,22 56,28 84,10 112,20 140,5 168,15 200,8" fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className={`text-[11px] ${s.up ? "text-success" : "text-danger"}`}>{s.sub}</p>
          </div>
        ))}
      </div>

      {lowStock > 0 && (
        <div className="mb-4 bg-warning/10 border border-warning/30 rounded-xl px-4 py-3">
          <p className="text-sm text-warning">{lowStock} product{lowStock > 1 ? "s" : ""} running low on stock — <Link href="/dashboard/products" className="underline">check inventory</Link></p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5 mb-5">
        {[
          ["AI Assistant","Plan, analyze, execute","/dashboard/ai-assistant","✦"],
          ["Website Builder","Build with AI","/dashboard/website-builder","▣"],
          ["Customers","Relationships & CRM","/dashboard/customers","◌"],
          ["Inventory","Products & stock","/dashboard/products","□"],
          ["Invoices","Get paid faster","/dashboard/invoices","▤"],
          ["Marketing","Campaigns & growth","/dashboard/marketing","◈"],
          ["Automation","Workflows & agents","/dashboard/actions","⌁"],
          ["Integrations","Connect your tools","/dashboard/integrations","⊕"]
        ].map(([title,sub,href,icon])=>(
          <Link key={title} href={href} className="group rounded-xl border border-white/[.055] bg-[#080e1a]/90 px-3 py-3 hover:border-indigo-300/[.18] hover:bg-indigo-300/[.035] transition-all">
            <div className="w-7 h-7 rounded-lg border border-white/[.06] bg-white/[.025] grid place-items-center text-indigo-200/65 text-[11px] group-hover:text-indigo-100">{icon}</div>
            <div className="text-[9px] text-white/70 mt-2 truncate">{title}</div>
            <div className="text-[7px] text-slate-600 mt-0.5 truncate">{sub}</div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 bg-[#0b1220]/90 border border-white/[.065] rounded-xl p-5 shadow-[0_14px_45px_rgba(0,0,0,.15)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Revenue Overview</h2>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-textMuted"><span className="w-2 h-2 rounded-full inline-block" style={{background:"#5B6EF5"}}/> Revenue</span>
              <span className="flex items-center gap-1.5 text-textMuted"><span className="w-2 h-2 rounded-full inline-block" style={{background:"#8B5CF6"}}/> Expenses</span>
            </div>
          </div>
          <svg viewBox="0 0 460 120" className="w-full h-36">
            <defs>
              <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5B6EF5" stopOpacity="0.25"/><stop offset="100%" stopColor="#5B6EF5" stopOpacity="0"/></linearGradient>
              <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.15"/><stop offset="100%" stopColor="#8B5CF6" stopOpacity="0"/></linearGradient>
            </defs>
            {[30,60,90].map(y => <line key={y} x1="0" y1={y} x2="460" y2={y} stroke="#232B4D" strokeWidth="1"/>)}
            <polygon points="0,120 30,85 90,75 150,45 210,65 270,25 330,50 390,15 460,35 460,120" fill="url(#rg)"/>
            <polyline points="30,85 90,75 150,45 210,65 270,25 330,50 390,15 460,35" fill="none" stroke="#5B6EF5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <polygon points="0,120 30,95 90,90 150,78 210,88 270,70 330,80 390,65 460,72 460,120" fill="url(#eg)"/>
            <polyline points="30,95 90,90 150,78 210,88 270,70 330,80 390,65 460,72" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            {["Jan","Feb","Mar","Apr","May","Jun","Jul"].map((m, i) => (
              <text key={m} x={30 + i * 65} y="118" fill="#8B92B0" fontSize="9">{m}</text>
            ))}
          </svg>
        </div>

        <div className="bg-[#0b1220]/90 border border-white/[.065] rounded-xl p-5 shadow-[0_14px_45px_rgba(0,0,0,.15)]">
          <h2 className="text-sm font-semibold text-white mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {(events ?? []).map((e: any) => (
              <div key={e.id} className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full mt-[5px] shrink-0" style={{background:"#5B6EF5"}}/>
                <div className="min-w-0">
                  <p className="text-[12px] text-text leading-snug line-clamp-2">{e.summary}</p>
                  <p className="text-[10px] text-textMuted mt-0.5">{new Date(e.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
            {!(events ?? []).length && <p className="text-xs text-textMuted">No activity yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
