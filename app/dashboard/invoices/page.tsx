import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { calculateInvoiceTotal } from "@/lib/invoices";

type InvoiceListRow = {
  id: string;
  invoice_number: string;
  status: string;
  due_date: string | null;
  currency: string;
  created_at: string;
  customer: { name: string } | null;
  invoice_items: { quantity: number; unit_price: number }[];
};

function isPastDue(value: string | null) {
  return Boolean(value) && value! < new Date().toISOString().slice(0, 10);
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency
    }).format(amount);
  } catch {
    return amount.toFixed(2) + " " + currency;
  }
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-ink/10 text-ink/65",
    sent: "bg-moss/10 text-moss",
    paid: "bg-emerald-100 text-emerald-800",
    overdue: "bg-clay/10 text-clay"
  };

  return (
    <span className={"inline-flex rounded-full px-2.5 py-1 text-xs " + (styles[status] ?? styles.draft)}>
      {status}
    </span>
  );
}

export default async function InvoicesPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (!business) {
    redirect("/onboarding");
  }

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, due_date, currency, created_at, customer:customers(name), invoice_items(quantity, unit_price)")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Unable to load invoices: " + error.message);
  }

  const invoiceRows = (invoices ?? []) as InvoiceListRow[];

  return (
    <main className="min-h-screen">
      <header className="flex flex-col gap-4 border-b border-line px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/dashboard" className="font-display text-lg text-ink hover:text-moss">
            {business.name}
          </Link>
          <p className="text-xs text-ink/50">Invoices</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/dashboard/customers" className="text-ink/60 hover:text-ink">Customers</Link>
            <Link href="/dashboard/actions" className="text-ink/60 hover:text-ink">Action Center</Link>
            <Link href="/dashboard/settings/automation" className="text-ink/60 hover:text-ink">
              Automation Settings
            </Link>
          </nav>
          <form action="/auth/sign-out" method="post">
            <button className="text-sm text-ink/60 hover:text-ink">Sign out</button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.18em] text-moss">Module 3</p>
            <h1 className="font-display text-3xl text-ink">Invoices</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-ink/65">
              Draft, track, and follow the money your business is owed.
            </p>
          </div>
          <Link
            href="/dashboard/invoices/new"
            className="inline-flex rounded-sm bg-moss px-4 py-2 text-sm text-paper hover:bg-moss/90"
          >
            New Invoice
          </Link>
        </div>

        <div className="overflow-hidden border border-line bg-white">
          {invoiceRows.length === 0 ? (
            <div className="px-5 py-10">
              <h2 className="font-display text-lg text-ink">No invoices yet.</h2>
              <p className="mt-2 text-sm text-ink/55">
                Create your first invoice to start tracking money in.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-ink/45">
                  <tr>
                    <th className="px-5 py-3 font-normal">Invoice</th>
                    <th className="px-5 py-3 font-normal">Customer</th>
                    <th className="px-5 py-3 font-normal">Total</th>
                    <th className="px-5 py-3 font-normal">Status</th>
                    <th className="px-5 py-3 font-normal">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {invoiceRows.map((invoice) => {
                    const displayStatus =
                      invoice.status === "sent" && isPastDue(invoice.due_date)
                        ? "overdue"
                        : invoice.status;
                    const total = calculateInvoiceTotal(invoice.invoice_items ?? []);

                    return (
                      <tr key={invoice.id} className="hover:bg-paper">
                        <td className="px-5 py-4">
                          <Link href={"/dashboard/invoices/" + invoice.id} className="text-moss hover:text-ink">
                            {invoice.invoice_number}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-ink">{invoice.customer?.name ?? "—"}</td>
                        <td className="px-5 py-4 text-ink">{formatMoney(total, invoice.currency)}</td>
                        <td className="px-5 py-4"><StatusBadge status={displayStatus} /></td>
                        <td className="px-5 py-4 text-ink/65">{invoice.due_date ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
