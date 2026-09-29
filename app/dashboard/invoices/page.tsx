import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { calculateInvoiceTotal, isOverdue } from "@/lib/invoices";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";

type CustomerRef = { name: string } | null;
type ItemRow = { quantity: number; unit_price: number };

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, currency")
    .eq("owner_id", user.id)
    .single();
  if (!business) redirect("/onboarding");

  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, due_date, currency, created_at, customer:customers(name), invoice_items(quantity, unit_price)"
    )
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  const rows = invoices ?? [];

  return (
    <section className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl text-text mb-1">Invoices</h1>
          <p className="text-textMuted">Create, send, and track what's owed.</p>
        </div>
        <Link href="/dashboard/invoices/new">
          <Button>New invoice</Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No invoices yet — create the first one." />
      ) : (
        <Card className="divide-y divide-line">
          {rows.map((inv) => {
            const customer = inv.customer as unknown as CustomerRef;
            const items = (inv.invoice_items ?? []) as ItemRow[];
            const total = calculateInvoiceTotal(items);
            const overdue = isOverdue(inv.status, inv.due_date);
            const displayStatus = overdue ? "overdue" : inv.status;
            return (
              <Link
                key={inv.id}
                href={`/dashboard/invoices/${inv.id}`}
                className="px-5 py-4 grid sm:grid-cols-[100px_1fr_120px_100px_100px] gap-3 items-center hover:bg-surfaceAlt transition-colors"
              >
                <span className="text-sm text-textMuted">{inv.invoice_number}</span>
                <span className="text-text">{customer?.name ?? "—"}</span>
                <span className="text-sm text-textMuted">
                  {total.toFixed(2)} {inv.currency}
                </span>
                <span className="text-xs text-textMuted">
                  {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                </span>
                <StatusPill status={displayStatus} />
              </Link>
            );
          })}
        </Card>
      )}
    </section>
  );
}
