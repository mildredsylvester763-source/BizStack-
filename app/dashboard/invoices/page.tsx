import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { calculateInvoiceTotal, isOverdue } from "@/lib/invoices";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-ink/10 text-ink/60",
  sent: "bg-vault/10 text-vault",
  paid: "bg-vault text-mist",
  overdue: "bg-alert/10 text-alert"
};

export default async function InvoicesPage() {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
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
    <main className="min-h-screen bg-ledger">
      <header className="border-b border-rule bg-white">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/dashboard" className="font-display text-lg text-ink">
            {business.name}
          </Link>
          <Link href="/dashboard" className="text-sm text-ink/45 hover:text-ink">
            Back to dashboard
          </Link>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl text-ink mb-1">Invoices</h1>
            <p className="text-ink/60">Everything sent, paid, or waiting.</p>
          </div>
          <Link
            href="/dashboard/invoices/new"
            className="bg-ink text-mist px-5 py-2.5 text-sm font-medium hover:bg-vaultDeep transition-colors"
          >
            New invoice
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-ink/40">
            No invoices yet — create the first one.
          </p>
        ) : (
          <div className="divide-y divide-rule border-t border-b border-rule">
            {rows.map((inv) => {
              // Supabase embeds a to-one relation (customer, via customer_id)
              // as a single object, and a to-many relation (invoice_items)
              // as an array — this reflects that shape directly instead of
              // forcing a mismatched cast.
              const customer = inv.customer as unknown as { name: string } | null;
              const items = (inv.invoice_items ?? []) as {
                quantity: number;
                unit_price: number;
              }[];
              const total = calculateInvoiceTotal(items);
              const overdue = isOverdue(inv.status, inv.due_date);
              const displayStatus = overdue ? "overdue" : inv.status;

              return (
                <Link
                  key={inv.id}
                  href={`/dashboard/invoices/${inv.id}`}
                  className="py-4 grid sm:grid-cols-[100px_1fr_120px_100px_90px] gap-3 items-center hover:bg-white transition-colors -mx-2 px-2"
                >
                  <span className="text-sm text-ink/50">{inv.invoice_number}</span>
                  <span className="text-ink">{customer?.name ?? "—"}</span>
                  <span className="text-sm text-ink/70">
                    {total.toFixed(2)} {inv.currency}
                  </span>
                  <span className="text-xs text-ink/45">
                    {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                  </span>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full text-center capitalize ${
                      STATUS_STYLES[displayStatus] ?? "bg-ink/10 text-ink/60"
                    }`}
                  >
                    {displayStatus}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
