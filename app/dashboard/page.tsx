import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { calculateInvoiceTotal, isOverdue } from "@/lib/invoices";
import { BizIcon, BizMetric, BizPanel, BizSection, BizStatus, BizTabs } from "@/components/ui/BizStackVisual";

type Invoice = {
  id: string;
  status: string;
  created_at: string;
  due_date: string | null;
  currency: string;
  invoice_items: { quantity: number; unit_price: number }[] | null;
  customer: { name: string } | null;
};

function monthKey(date: Date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

function monthLabels(now: Date) {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: monthKey(d), label: d.toLocaleString(undefined, { month: "short" }) };
  });
}

function Chart({ values, second }: { values: number[]; second?: number[] }) {
  const max = Math.max(...values, ...(second || []), 1);
  const points = values.map((v, i) => {
    const x = 4 + (i * 92) / Math.max(values.length - 1, 1);
    const y = 96 - (v / max) * 78;
    return x + "," + y;
  }).join(" ");
  const points2 = second?.map((v, i) => {
    const x = 4 + (i * 92) / Math.max(second.length - 1, 1);
    const y = 96 - (v / max) * 78;
    return x + "," + y;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="biz-chart" aria-hidden="true">
      <g className="biz-chart-grid">
        <line x1="0" y1="20" x2="100" y2="20" />
        <line x1="0" y1="45" x2="100" y2="45" />
        <line x1="0" y1="70" x2="100" y2="70" />
        <line x1="0" y1="96" x2="100" y2="96" />
      </g>
      <polyline points={points} stroke="#3b82f6" />
      {points2 && <polyline points={points2} stroke="#a855f7" />}
    </svg>
  );
}

export default async function DashboardHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, currency")
    .eq("owner_id", user.id)
    .single();
  if (!business) redirect("/onboarding");

  const [{ data: invoices }, { data: customers }, { data: products }, { data: events }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id,status,created_at,due_date,currency,invoice_items(quantity,unit_price),customer:customers(name)")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false }),
    supabase.from("customers").select("id,name").eq("business_id", business.id),
    supabase.from("products").select("id,name,stock_quantity,low_stock_threshold").eq("business_id", business.id).order("stock_quantity", { ascending: true }).limit(8),
    supabase.from("events").select("id,summary,status,created_at").eq("business_id", business.id).order("created_at", { ascending: false }).limit(8)
  ]);

  const rows = (invoices || []) as unknown as Invoice[];
  const totalInvoiced = rows.reduce((sum, inv) => sum + calculateInvoiceTotal(inv.invoice_items || []), 0);
  const paidTotal = rows.filter(inv => inv.status === "paid").reduce((sum, inv) => sum + calculateInvoiceTotal(inv.invoice_items || []), 0);
  const overdueCount = rows.filter(inv => isOverdue(inv.status, inv.due_date)).length;
  const lowStockCount = (products || []).filter((p: any) => p.low_stock_threshold !== null && Number(p.stock_quantity) <= Number(p.low_stock_threshold)).length;

  const now = new Date();
  const months = monthLabels(now);
  const revenueSeries = months.map(m => rows.filter(i => monthKey(new Date(i.created_at)) === m.key).reduce((s, i) => s + calculateInvoiceTotal(i.invoice_items || []), 0));
  const paidSeries = months.map(m => rows.filter(i => i.status === "paid" && monthKey(new Date(i.created_at)) === m.key).reduce((s, i) => s + calculateInvoiceTotal(i.invoice_items || []), 0));
  const fmt = (n: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);

  return (
    <div className="biz-content">
      <BizSection number="5" title="Business Operations & Analytics" subtitle="Everything you need to run, track and grow your business.">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <BizTabs items={["Overview", "Revenue", "Invoices", "Customers", "Products", "Marketing"]} />
            <span className="biz-chip">Live data</span>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/invoices/new"><span className="biz-button bg-white text-slate-900">+ New invoice</span></Link>
            <Link href="/dashboard/ai-builder"><span className="biz-button border border-white/10 bg-white/[.04] text-white/70">Ask BizStack AI</span></Link>
          </div>
        </div>

        <div className="biz-grid biz-grid-4">
          <BizMetric label="Total Revenue" value={fmt(paidTotal) + " " + (business.currency || "")} delta="Live from paid invoices" tone="cyan" icon="$" />
          <BizMetric label="Total Invoices" value={String(rows.length)} delta={overdueCount ? String(overdueCount) + " overdue" : "No overdue invoices"} tone="blue" icon="▤" />
          <BizMetric label="Customers" value={String((customers || []).length)} delta="Current customer records" tone="purple" icon="◎" />
          <BizMetric label="Stock alerts" value={String(lowStockCount)} delta={lowStockCount ? "Review inventory" : "Inventory healthy"} tone="orange" icon="!" />
        </div>

        <div className="grid xl:grid-cols-[1.45fr_1fr] gap-3 mt-3">
          <BizPanel title="Revenue Overview" subtitle="Invoice volume and collected revenue over the last six months">
            <div className="biz-chart-wrap">
              <Chart values={revenueSeries} second={paidSeries} />
              <div className="flex justify-between text-[7px] text-white/20 px-1">
                {months.map(m => <span key={m.key}>{m.label}</span>)}
              </div>
            </div>
          </BizPanel>

          <BizPanel title="Recent Activity" subtitle="The latest business events captured by BizStack">
            <div>
              {(events || []).length === 0 ? (
                <div className="p-6 text-[9px] text-white/25">No activity yet. Your live events will appear here.</div>
              ) : (events || []).map((e: any) => (
                <div key={e.id} className="biz-list-row">
                  <span className={e.status === "needs_approval" ? "text-orange-300 text-[10px]" : "text-emerald-300 text-[8px]"}>●</span>
                  <div className="min-w-0 flex-1">
                    <p className="biz-small truncate">{e.summary}</p>
                    <p className="biz-mini">{new Date(e.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </BizPanel>
        </div>
      </BizSection>

      <BizSection title="Reports & Analytics" subtitle="Turn operations into measurable business insight.">
        <div className="grid xl:grid-cols-[1.2fr_1.45fr_.9fr] gap-3">
          <BizPanel title="Financial Snapshot" subtitle="Current period">
            <div className="biz-panel-body grid grid-cols-3 gap-2">
              <div className="biz-card-link"><div className="biz-mini">Revenue</div><div className="mt-2 text-sm font-semibold">{fmt(totalInvoiced)} {business.currency}</div></div>
              <div className="biz-card-link"><div className="biz-mini">Collected</div><div className="mt-2 text-sm font-semibold text-emerald-300">{fmt(paidTotal)} {business.currency}</div></div>
              <div className="biz-card-link"><div className="biz-mini">Outstanding</div><div className="mt-2 text-sm font-semibold text-orange-300">{fmt(Math.max(totalInvoiced - paidTotal, 0))} {business.currency}</div></div>
            </div>
            <div className="border-t border-white/[.07] px-3 py-3">
              <div className="flex items-center justify-between"><span className="biz-small">Invoice collection rate</span><span className="text-[9px] text-blue-300">{totalInvoiced ? Math.round((paidTotal / totalInvoiced) * 100) : 0}%</span></div>
              <div className="mt-2 h-1.5 rounded-full bg-white/[.05] overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500" style={{ width: (totalInvoiced ? Math.min(100, (paidTotal / totalInvoiced) * 100) : 0) + "%" }} /></div>
            </div>
          </BizPanel>

          <BizPanel title="Revenue vs Collected" subtitle="Live invoice trend">
            <div className="biz-chart-wrap"><Chart values={revenueSeries} second={paidSeries} /></div>
          </BizPanel>

          <BizPanel title="Top Products" subtitle="Inventory signals">
            {(products || []).length === 0 ? (
              <div className="p-5 text-[9px] text-white/25">No products yet.</div>
            ) : (products || []).slice(0, 6).map((p: any, index: number) => (
              <div className="biz-list-row" key={p.id}>
                <span className="text-[8px] text-white/20">{String(index + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1 truncate biz-small">{p.name}</span>
                <span className="biz-mini">{p.stock_quantity ?? 0} in stock</span>
                {p.low_stock_threshold !== null && Number(p.stock_quantity) <= Number(p.low_stock_threshold) && <BizStatus tone="orange">Low</BizStatus>}
              </div>
            ))}
          </BizPanel>
        </div>
      </BizSection>

      <div className="grid xl:grid-cols-[1fr_1fr_1.1fr] gap-3">
        <BizPanel title="Business Settings" subtitle="Core operating controls">
          <div className="biz-panel-body grid grid-cols-2 gap-2">
            <Link href="/dashboard/settings" className="biz-card-link"><BizIcon tone="blue" size="sm">⚙</BizIcon><div className="biz-small mt-2">Profile & taxes</div></Link>
            <Link href="/dashboard/settings/payments" className="biz-card-link"><BizIcon tone="green" size="sm">₦</BizIcon><div className="biz-small mt-2">Billing & payments</div></Link>
            <Link href="/dashboard/identity" className="biz-card-link"><BizIcon tone="purple" size="sm">✓</BizIcon><div className="biz-small mt-2">Trust & security</div></Link>
            <Link href="/dashboard/integrations" className="biz-card-link"><BizIcon tone="cyan" size="sm">⌁</BizIcon><div className="biz-small mt-2">Integrations</div></Link>
          </div>
        </BizPanel>

        <BizPanel title="Team & Permissions" subtitle="Workspace access and accountability">
          <div className="biz-panel-body">
            {["Owner", "Admin", "Editor", "Viewer"].map((role, i) => (
              <div key={role} className="biz-list-row px-0">
                <BizIcon tone={i === 0 ? "purple" : "slate"} size="sm">{role[0]}</BizIcon>
                <span className="biz-small flex-1">{role}</span>
                <span className="biz-mini">{i === 0 ? "Full access" : i === 1 ? "Manage settings" : i === 2 ? "Build & edit" : "Read only"}</span>
              </div>
            ))}
            <Link href="/dashboard/settings" className="mt-3 inline-flex"><span className="biz-button bg-gradient-to-r from-blue-600 to-violet-600 text-white">Manage access</span></Link>
          </div>
        </BizPanel>

        <BizPanel title="Customer Portal" subtitle="Secure customer-facing workspace" action={<BizStatus tone="green">Ready</BizStatus>}>
          <div className="biz-panel-body">
            <div className="rounded-2xl border border-blue-400/15 bg-gradient-to-br from-[#101b3a] to-[#0b1327] p-4">
              <div className="text-[8px] uppercase tracking-[.18em] text-blue-200/50">Customer workspace</div>
              <div className="mt-2 text-sm font-semibold">Invoices, orders & messages</div>
              <p className="mt-2 text-[8px] leading-4 text-white/30">Scoped, expiring customer sessions keep business data separated from the internal workspace.</p>
              <div className="mt-4 flex gap-2">
                <Link href="/dashboard/portal"><span className="biz-button bg-white text-slate-900">Open portal controls</span></Link>
                <Link href="/dashboard/ai-builder"><span className="biz-button border border-white/10 bg-white/[.05] text-white/55">Ask AI</span></Link>
              </div>
            </div>
          </div>
        </BizPanel>
      </div>

      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
        {[
          ["Invoicing", "/dashboard/invoices", "Create, send, track", "blue"],
          ["Website", "/dashboard/ai-builder", "AI-powered", "purple"],
          ["CRM", "/dashboard/customers", "Customers & leads", "cyan"],
          ["Inventory", "/dashboard/products", "Stock & products", "green"],
          ["Accounting", "/dashboard/accounting", "Track revenue", "orange"],
          ["Marketing", "/dashboard/marketing", "Campaigns", "red"],
          ["AI Agents", "/dashboard/ai-builder", "Work smarter", "purple"],
          ["Analytics", "/dashboard", "Live decisions", "blue"]
        ].map(([label, href, detail, tone]) => (
          <Link href={href} key={label} className="biz-card-link">
            <BizIcon tone={tone as "blue" | "purple" | "cyan" | "green" | "orange" | "red"} size="sm">◆</BizIcon>
            <div className="mt-2 text-[8px] font-medium text-white/70">{label}</div>
            <div className="mt-1 text-[7px] text-white/25">{detail}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
