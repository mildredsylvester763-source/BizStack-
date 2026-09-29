import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

function money(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
}

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, currency")
    .eq("owner_id", user.id)
    .single();
  if (!business) redirect("/onboarding");

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, email, phone, created_at")
    .eq("id", customerId)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!customer) notFound();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, status, total, paid_amount, due_date, currency, created_at")
    .eq("business_id", business.id)
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false });

  const rows = invoices ?? [];
  const billed = rows.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
  const paid = rows.reduce((sum, invoice) => sum + Number(invoice.paid_amount || 0), 0);
  const outstanding = Math.max(0, billed - paid);
  const overdue = rows.reduce((sum, invoice) => {
    const due = invoice.due_date ? new Date(invoice.due_date + "T23:59:59") : null;
    const unpaid = Math.max(0, Number(invoice.total || 0) - Number(invoice.paid_amount || 0));
    return sum + (due && due < new Date() && unpaid > 0 ? unpaid : 0);
  }, 0);

  return (
    <main className="min-h-screen bg-ledger">
      <header className="border-b border-rule bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Link href="/dashboard/customers" className="text-xs text-ink/45 hover:text-ink">Customers</Link>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-display text-lg text-ink truncate">{customer.name}</span>
              <span className="text-[10px] uppercase tracking-[.12em] text-vault">Profile</span>
            </div>
          </div>
          <Link href="/dashboard/customers" className="shrink-0 text-sm text-ink/45 hover:text-ink">Back to customers</Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid lg:grid-cols-[1.05fr_.95fr] gap-5">
          <section className="bg-white border border-rule p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-ink text-mist grid place-items-center font-display text-xl">
                {(customer.name?.trim()[0] || "C").toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[.16em] text-vault font-medium">Customer profile</p>
                <h1 className="font-display text-2xl text-ink mt-1">{customer.name}</h1>
                <p className="text-sm text-ink/45 mt-1">Customer since {new Date(customer.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-6">
              {customer.email && <a href={"mailto:" + customer.email} className="rounded-xl bg-ink text-mist px-3 py-2 text-xs hover:opacity-90">Email customer</a>}
              {customer.phone && <a href={"tel:" + customer.phone} className="rounded-xl border border-rule bg-white px-3 py-2 text-xs text-ink/65 hover:text-ink">Call</a>}
              {customer.phone && <a href={"https://wa.me/" + String(customer.phone).replace(/\D/g, "")} target="_blank" rel="noreferrer" className="rounded-xl border border-rule bg-white px-3 py-2 text-xs text-ink/65 hover:text-ink">WhatsApp</a>}
              <Link href={"/dashboard/invoices?customer=" + customer.id} className="rounded-xl border border-rule bg-white px-3 py-2 text-xs text-ink/65 hover:text-ink">View customer invoices</Link>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mt-6">
              <div className="border border-rule p-4">
                <p className="text-xs text-ink/40">Email</p>
                <p className="text-sm text-ink mt-1 break-all">{customer.email || "Not provided"}</p>
              </div>
              <div className="border border-rule p-4">
                <p className="text-xs text-ink/40">Phone / WhatsApp</p>
                <p className="text-sm text-ink mt-1">{customer.phone || "Not provided"}</p>
              </div>
            </div>

            <div className="mt-5 border border-rule p-4">
              <p className="text-xs uppercase tracking-[.14em] text-ink/35">Relationship context</p>
              <p className="text-sm leading-6 text-ink/60 mt-2">
                This profile consolidates the customer record and the financial relationship already stored in BizStack. Future customer actions can use this page as their source-backed context.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            {[
              ["Billed", money(billed, business.currency || "USD"), "All invoices tied to this customer"],
              ["Paid", money(paid, business.currency || "USD"), "Recorded paid amount"],
              ["Outstanding", money(outstanding, business.currency || "USD"), "Current unpaid balance"],
              ["Overdue", money(overdue, business.currency || "USD"), "Unpaid amount past due"],
            ].map(([label, value, detail]) => (
              <div key={String(label)} className="bg-white border border-rule p-4">
                <p className="text-xs text-ink/40">{label}</p>
                <p className="font-display text-2xl text-ink mt-1">{value}</p>
                <p className="text-xs text-ink/35 mt-1">{detail}</p>
              </div>
            ))}
          </section>
        </div>

        <section className="mt-6 bg-white border border-rule overflow-hidden">
          <div className="px-5 py-4 border-b border-rule flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[.14em] text-vault font-medium">Financial activity</p>
              <h2 className="font-display text-xl text-ink mt-1">Invoices</h2>
            </div>
            <span className="text-sm text-ink/35">{rows.length} record{rows.length === 1 ? "" : "s"}</span>
          </div>
          {!rows.length ? (
            <div className="px-5 py-12 text-center text-sm text-ink/35">No invoices are attached to this customer yet.</div>
          ) : (
            <div className="divide-y divide-rule">
              {rows.map(invoice => {
                const total = Number(invoice.total || 0);
                const paidAmount = Number(invoice.paid_amount || 0);
                const balance = Math.max(0, total - paidAmount);
                const due = invoice.due_date ? new Date(invoice.due_date + "T23:59:59") : null;
                const isOverdue = !!due && due < new Date() && balance > 0;
                return (
                  <div key={invoice.id} className="px-5 py-4 grid md:grid-cols-[1fr_auto_auto_auto] gap-3 md:items-center">
                    <div>
                      <p className="font-medium text-ink">{invoice.status || "Invoice"}</p>
                      <p className="text-xs text-ink/35 mt-1">Created {new Date(invoice.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-sm text-ink/60">{money(total, invoice.currency || business.currency || "USD")}</div>
                    <div className="text-sm text-vault">{money(paidAmount, invoice.currency || business.currency || "USD")} paid</div>
                    <div className={isOverdue ? "text-sm text-alert" : "text-sm text-ink"}>{money(balance, invoice.currency || business.currency || "USD")} {isOverdue ? "overdue" : "due"}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
