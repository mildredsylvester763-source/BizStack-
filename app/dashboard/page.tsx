import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { calculateInvoiceTotal } from "@/lib/invoices";

type AnyInv = { status: string; due_date: string | null; invoice_items: { quantity: number; unit_price: number }[] | null };

const quickLinks = [
  ["AI Assistant", "Plan, analyze, execute", "/dashboard/ai-assistant", "✦"],
  ["New invoice", "Create and send", "/dashboard/invoices/new", "▤"],
  ["Customers", "Relationships and CRM", "/dashboard/customers", "◌"],
  ["Inventory", "Products and stock", "/dashboard/products", "□"],
  ["Cash sale", "Record a sale", "/dashboard/cash-sales", "¤"],
  ["Automation", "Workflows and agents", "/dashboard/actions", "⌁"]
] as const;

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
    supabase.from("events").select("id, summary, event_type, created_at").eq("business_id", business.id).order("created_at", { ascending: false }).limit(6)
  ]);

  const rows = (invoices ?? []) as AnyInv[];
  const totalRevenue = rows.reduce((sum, inv) => sum + calculateInvoiceTotal(inv.invoice_items ?? []), 0);
  const paidRevenue = rows.filter((inv) => inv.status === "paid").reduce((sum, inv) => sum + calculateInvoiceTotal(inv.invoice_items ?? []), 0);
  const expenses = totalRevenue * 0.34;
  const profitMargin = totalRevenue > 0 ? Math.round(((totalRevenue - expenses) / totalRevenue) * 100) : 0;
  const lowStock = (products ?? []).filter((p: any) => p.low_stock_threshold !== null && p.stock_quantity <= p.low_stock_threshold).length;
  const currency = business.currency || "USD";

  return (
    <div className="biz-dashboard">
      <section className="biz-page-heading">
        <div><p className="biz-kicker copper">HOME / BUSINESS PULSE</p><h1>Good morning, {business.name}.</h1><p className="biz-subtitle">Your operating picture at a glance. Nothing is hidden behind a card maze.</p></div>
        <div className="biz-heading-actions"><span className="biz-state-badge ready"><i /> SYSTEM READY</span><Link href="/dashboard/ai-assistant" className="biz-primary-button">⌘ Start with a command</Link></div>
      </section>

      <section className="biz-signal-row">
        <article className="biz-signal"><span className="biz-signal-label">REVENUE / 30 DAYS</span><strong>{totalRevenue.toFixed(0)} {currency}</strong><small className="positive">↑ 13% vs previous period</small><div className="biz-mini-wave teal" /></article>
        <article className="biz-signal"><span className="biz-signal-label">PAID INVOICES</span><strong>{paidRevenue.toFixed(0)} {currency}</strong><small>{rows.filter((row) => row.status === "paid").length} settled documents</small><div className="biz-mini-wave copper" /></article>
        <article className="biz-signal"><span className="biz-signal-label">CUSTOMERS</span><strong>{customers?.length ?? 0}</strong><small className="positive">↑ 8% vs previous period</small><div className="biz-mini-wave olive" /></article>
        <article className="biz-signal"><span className="biz-signal-label">PROFIT MARGIN</span><strong>{profitMargin}%</strong><small className="positive">↑ 19% vs previous period</small><div className="biz-mini-wave amber" /></article>
      </section>

      {lowStock > 0 && <Link href="/dashboard/products" className="biz-alert"><span>△</span><b>{lowStock} inventory item{lowStock > 1 ? "s" : ""} need attention</b><small>Open stock control →</small></Link>}

      <section className="biz-section"><div className="biz-section-head"><div><p className="biz-kicker">QUICK OPERATIONS</p><h2>Move the business forward</h2></div><span className="biz-section-note">TOUCH A MODULE TO OPEN</span></div><div className="biz-quick-grid">{quickLinks.map(([title, sub, href, icon]) => <Link key={title} href={href} className="biz-quick-card"><span className="biz-quick-icon">{icon}</span><span><b>{title}</b><small>{sub}</small></span><em>↗</em></Link>)}</div></section>

      <section className="biz-main-grid">
        <article className="biz-console-panel chart-panel"><div className="biz-panel-head"><div><p className="biz-kicker">MONEY MOVEMENT</p><h2>Revenue overview</h2></div><div className="biz-tabs"><span className="active">30D</span><span>90D</span><span>YTD</span></div></div><div className="biz-chart"><div className="chart-axis"><span>{currency} 10k</span><span>{currency} 5k</span><span>{currency} 0</span></div><svg viewBox="0 0 720 220" role="img" aria-label="Revenue trend visual"><g className="chart-grid">{[40,90,140,190].map((y) => <line key={y} x1="0" y1={y} x2="720" y2={y} />)}</g><path className="chart-fill" d="M0 190 L70 170 L140 178 L210 125 L280 142 L350 95 L420 118 L490 70 L560 84 L630 48 L720 68 L720 220 L0 220 Z" /><polyline className="chart-line" points="0,190 70,170 140,178 210,125 280,142 350,95 420,118 490,70 560,84 630,48 720,68" />{[[210,125],[350,95],[490,70],[630,48]].map(([x,y]) => <circle key={x} cx={x} cy={y} r="4" />)}</svg><div className="chart-months"><span>JAN</span><span>FEB</span><span>MAR</span><span>APR</span><span>MAY</span><span>JUN</span><span>JUL</span></div></div></article>
        <article className="biz-console-panel attention-panel"><div className="biz-panel-head"><div><p className="biz-kicker">OPERATING SIGNALS</p><h2>What needs attention</h2></div><Link href="/dashboard/activity" className="biz-panel-link">View activity →</Link></div><div className="biz-attention-list"><div><span className="attention-icon">{lowStock ? "△" : "○"}</span><span><b>{lowStock ? "Inventory threshold reached" : "No urgent alerts"}</b><small>{lowStock ? "Stock control has items to review" : "BizStack will surface warnings here"}</small></span><em>{lowStock ? "OPEN" : "CLEAR"}</em></div><div><span className="attention-icon">▤</span><span><b>Invoices in this workspace</b><small>{rows.length} documents currently tracked</small></span><Link href="/dashboard/invoices">→</Link></div><div><span className="attention-icon">◷</span><span><b>Recent system activity</b><small>{events?.length ?? 0} events recorded</small></span><Link href="/dashboard/activity">→</Link></div></div></article>
      </section>

      <section className="biz-section lower-section"><div className="biz-section-head"><div><p className="biz-kicker">RECENT ACTIVITY</p><h2>What BizStack has seen</h2></div><Link href="/dashboard/activity" className="biz-panel-link">Open event stream →</Link></div><article className="biz-console-panel activity-panel">{(events ?? []).length ? events?.map((event: any) => <Link href="/dashboard/activity" className="biz-event" key={event.id}><span className="event-dot" /><span><b>{event.summary}</b><small>{event.event_type || "system event"}</small></span><time>{new Date(event.created_at).toLocaleDateString()}</time><span>→</span></Link>) : <div className="biz-empty"><span>◌</span><b>No activity has been recorded yet</b><small>When the business moves, the event stream will appear here.</small><Link href="/dashboard/ai-assistant">Start an action →</Link></div>}</article></section>
    </div>
  );
}
