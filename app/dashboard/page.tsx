import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { Card } from "@/components/ui/Card";
import { calculateInvoiceTotal, isOverdue } from "@/lib/invoices";

type ItemRow = { quantity: number; unit_price: number };

export default async function DashboardHome() {
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, currency")
    .eq("owner_id", user.id)
    .single();
  if (!business) redirect("/onboarding");

  const [{ data: invoices }, { data: customers }, { data: products }, { data: events }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("id, status, due_date, currency, invoice_items(quantity, unit_price)")
        .eq("business_id", business.id),
      supabase.from("customers").select("id").eq("business_id", business.id),
      supabase
        .from("products")
        .select("id, stock_quantity, low_stock_threshold")
        .eq("business_id", business.id),
      supabase
        .from("events")
        .select("id, summary, created_at")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(6)
    ]);

  const invoiceRows = invoices ?? [];
  const totalInvoiced = invoiceRows.reduce(
    (sum: number, inv: { invoice_items: ItemRow[] | null }) =>
      sum + calculateInvoiceTotal(inv.invoice_items ?? []),
    0
  );
  const paidTotal = invoiceRows
    .filter((inv: { status: string }) => inv.status === "paid")
    .reduce(
      (sum: number, inv: { invoice_items: ItemRow[] | null }) =>
        sum + calculateInvoiceTotal(inv.invoice_items ?? []),
      0
    );
  const overdueCount = invoiceRows.filter((inv: { status: string; due_date: string | null }) =>
    isOverdue(inv.status, inv.due_date)
  ).length;
  const lowStockCount = (products ?? []).filter(
    (p: { stock_quantity: number; low_stock_threshold: number | null }) =>
      p.low_stock_threshold !== null && p.stock_quantity <= p.low_stock_threshold
  ).length;

  return (
    <section className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl text-text mb-1">Overview</h1>
      <p className="text-textMuted mb-8">{business.name}</p>

      <div className="grid sm:grid-cols-4 gap-4 mb-10">
        <Card className="p-5">
          <p className="text-xs text-textMuted mb-1">Total invoiced</p>
          <p className="font-display text-2xl text-text">
            {totalInvoiced.toFixed(2)} {business.currency}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-textMuted mb-1">Collected</p>
          <p className="font-display text-2xl text-success">
            {paidTotal.toFixed(2)} {business.currency}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-textMuted mb-1">Overdue invoices</p>
          <p className="font-display text-2xl text-danger">{overdueCount}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-textMuted mb-1">Customers</p>
          <p className="font-display text-2xl text-text">{(customers ?? []).length}</p>
        </Card>
      </div>

      {lowStockCount > 0 && (
        <Card className="p-4 mb-8 border-warning/40 bg-warning/5">
          <p className="text-sm text-warning">
            {lowStockCount} product{lowStockCount > 1 ? "s" : ""} running low on stock —
            check the Action Center.
          </p>
        </Card>
      )}

      <h2 className="text-sm text-textMuted font-medium mb-3">Recent activity</h2>
      <Card className="divide-y divide-line">
        {(events ?? []).length === 0 ? (
          <p className="text-sm text-textMuted p-5">Nothing yet — activity will show up here.</p>
        ) : (
          (events ?? []).map((e: { id: string; summary: string; created_at: string }) => (
            <div key={e.id} className="p-4 flex items-center justify-between">
              <p className="text-sm text-text">{e.summary}</p>
              <span className="text-xs text-textMuted">
                {new Date(e.created_at).toLocaleDateString()}
              </span>
            </div>
          ))
        )}
      </Card>
    </section>
  );
}
