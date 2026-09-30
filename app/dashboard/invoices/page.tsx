import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { calculateInvoiceTotal, isOverdue } from "@/lib/invoices";

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  paid:    { bg: "rgba(34,197,94,0.15)",  text: "#22C55E", label: "Paid" },
  sent:    { bg: "rgba(91,110,245,0.15)",  text: "#5B6EF5", label: "Sent" },
  draft:   { bg: "rgba(139,146,176,0.15)", text: "#8B92B0", label: "Draft" },
  overdue: { bg: "rgba(239,68,68,0.15)",   text: "#EF4444", label: "Overdue" },
  partial: { bg: "rgba(245,165,36,0.15)",  text: "#F5A524", label: "Partial" }
};

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id, name, currency").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, due_date, currency, created_at, customer:customers(name), invoice_items(quantity, unit_price)")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  const rows = invoices ?? [];
  type InvRow = { status: string; due_date: string | null; invoice_items: {quantity:number;unit_price:number}[]|null };
  const getTotal = (inv: InvRow) => calculateInvoiceTotal(inv.invoice_items ?? []);
  const totalAmt  = rows.reduce((s: number, inv: any) => s + getTotal(inv), 0);
  const paidAmt   = rows.filter((inv: any) => inv.status === "paid").reduce((s: number, inv: any) => s + getTotal(inv), 0);
  const overdueAmt = rows.filter((inv: any) => isOverdue(inv.status, inv.due_date)).reduce((s: number, inv: any) => s + getTotal(inv), 0);
  const pendingAmt = rows.filter((inv: any) => inv.status === "sent" && !isOverdue(inv.status, inv.due_date)).reduce((s: number, inv: any) => s + getTotal(inv), 0);

  const stats = [
    { label: "Total Invoices", value: `$${totalAmt.toFixed(0)}`, trend: "+13%", up: true },
    { label: "Paid",           value: `$${paidAmt.toFixed(0)}`,   trend: "+18%", up: true },
    { label: "Pending",        value: `$${pendingAmt.toFixed(0)}`, trend: "-2%",  up: false },
    { label: "Overdue",        value: `$${overdueAmt.toFixed(0)}`, trend: "-5%",  up: false }
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-white">Invoices</h1>
          <p className="text-sm text-textMuted mt-0.5">Create, manage and track your invoices. Get paid faster.</p>
        </div>
        <Link href="/dashboard/invoices/new">
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{background:"#5B6EF5"}}>
            + New Invoice
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface border border-line rounded-xl p-4">
            <p className="text-xs text-textMuted mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className={`text-xs mt-1.5 ${s.up ? "text-success" : "text-danger"}`}>{s.trend} vs last 30 days</p>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-line">
          <input placeholder="Search invoices..." className="flex-1 bg-bg border border-line rounded-lg px-3 py-2 text-sm text-text placeholder:text-textMuted focus:outline-none focus:border-primary"/>
          <select className="bg-bg border border-line text-textMuted text-sm rounded-lg px-3 py-2 focus:outline-none"><option>All Status</option><option>Paid</option><option>Sent</option><option>Draft</option><option>Overdue</option></select>
          <select className="bg-bg border border-line text-textMuted text-sm rounded-lg px-3 py-2 focus:outline-none"><option>This Month</option><option>Last Month</option><option>All Time</option></select>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-line">
              <th className="px-4 py-3 text-left"><input type="checkbox" className="rounded"/></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-textMuted">Invoice #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-textMuted">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-textMuted">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-textMuted">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-textMuted">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-textMuted">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-textMuted">No invoices yet — create the first one.</td></tr>
            )}
            {rows.map((inv: any) => {
              const customer = inv.customer as { name: string } | null;
              const total = calculateInvoiceTotal(inv.invoice_items ?? []);
              const overdue = isOverdue(inv.status, inv.due_date);
              const statusKey = overdue ? "overdue" : inv.status;
              const sc = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.draft;
              return (
                <tr key={inv.id} className="hover:bg-white/3 cursor-pointer" onClick={undefined}>
                  <td className="px-4 py-3"><input type="checkbox" className="rounded"/></td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/invoices/${inv.id}`} className="text-sm font-medium text-primary hover:underline">{inv.invoice_number}</Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-text">{customer?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-textMuted">{new Date(inv.created_at).toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric"})}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-white">${total.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{background:sc.bg,color:sc.text}}>{sc.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-textMuted hover:text-white text-lg leading-none">...</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
