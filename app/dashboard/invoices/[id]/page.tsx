import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { logEvent } from "@/lib/events";
import { calculateInvoiceTotal } from "@/lib/invoices";
import { markInvoicePaid, markInvoiceSent } from "../actions";

type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
};

type InvoiceDetail = {
  id: string;
  invoice_number: string;
  status: string;
  due_date: string | null;
  currency: string;
  created_at: string;
  paid_at: string | null;
  customer: { id: string; name: string; email: string | null; phone: string | null } | null;
  invoice_items: InvoiceItem[];
};

function isPastDue(value: string | null) {
  return Boolean(value) && value! < new Date().toISOString().slice(0, 10);
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return amount.toFixed(2) + " " + currency;
  }
}

function statusClasses(status: string) {
  const styles: Record<string, string> = {
    draft: "bg-ink/10 text-ink/65",
    sent: "bg-moss/10 text-moss",
    paid: "bg-emerald-100 text-emerald-800",
    overdue: "bg-clay/10 text-clay"
  };
  return styles[status] ?? styles.draft;
}

async function recordOverdueEvent(
  supabase: ReturnType<typeof createClient>,
  businessId: string,
  invoice: InvoiceDetail,
  total: number,
  mode: string
) {
  const { data: existingEvent, error: eventLookupError } = await supabase
    .from("events")
    .select("id")
    .eq("business_id", businessId)
    .eq("event_type", "payment.overdue")
    .eq("evidence->>invoice_id", invoice.id)
    .limit(1)
    .maybeSingle();

  if (eventLookupError) {
    throw new Error("Unable to check overdue activity: " + eventLookupError.message);
  }

  if (existingEvent) {
    return;
  }

  const automatic = mode === "auto_execute";
  const summary = automatic
    ? "Invoice " + invoice.invoice_number + " is overdue — reminder would be sent automatically (reminder sending itself is not built yet, this just logs the action)"
    : "Invoice " + invoice.invoice_number + " is overdue — needs your decision before a payment reminder is sent";

  await logEvent(
    businessId,
    "payment.overdue",
    summary,
    {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      total,
      currency: invoice.currency,
      mode
    },
    automatic ? "auto_handled" : "needs_approval"
  );
}

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
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

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, due_date, currency, created_at, paid_at, customer:customers(id, name, email, phone), invoice_items(id, description, quantity, unit_price)")
    .eq("id", params.id)
    .eq("business_id", business.id)
    .single();

  if (error || !invoice) {
    notFound();
  }

  const invoiceDetail = invoice as unknown as InvoiceDetail;
  const total = calculateInvoiceTotal(invoiceDetail.invoice_items ?? []);
  const overdue = invoiceDetail.status === "sent" && isPastDue(invoiceDetail.due_date);
  const displayStatus = overdue ? "overdue" : invoiceDetail.status;

  if (overdue) {
    const { data: automationSetting, error: automationError } = await supabase
      .from("automation_settings")
      .select("mode")
      .eq("business_id", business.id)
      .eq("action_type", "send_payment_reminder")
      .maybeSingle();

    if (automationError) {
      throw new Error("Unable to load payment reminder settings: " + automationError.message);
    }

    await recordOverdueEvent(
      supabase,
      business.id,
      invoiceDetail,
      total,
      automationSetting?.mode ?? "ask_first"
    );
  }

  return (
    <main className="min-h-screen">
      <header className="flex flex-col gap-4 border-b border-line px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/dashboard" className="font-display text-lg text-ink hover:text-moss">
            {business.name}
          </Link>
          <p className="text-xs text-ink/50">Invoice detail</p>
        </div>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/dashboard/customers" className="text-ink/60 hover:text-ink">Customers</Link>
          <Link href="/dashboard/invoices" className="text-ink/60 hover:text-ink">Invoices</Link>
          <Link href="/dashboard/actions" className="text-ink/60 hover:text-ink">Action Center</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.18em] text-moss">Module 3</p>
            <h1 className="font-display text-3xl text-ink">{invoiceDetail.invoice_number}</h1>
            <p className="mt-2 text-sm text-ink/60">
              Created {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(invoiceDetail.created_at))}
            </p>
          </div>
          <span className={"inline-flex self-start rounded-full px-3 py-1.5 text-sm " + statusClasses(displayStatus)}>
            {displayStatus}
          </span>
        </div>

        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="border border-line bg-white px-5 py-5">
              <p className="text-xs uppercase tracking-[0.12em] text-ink/45">Customer</p>
              <p className="mt-2 font-display text-lg text-ink">{invoiceDetail.customer?.name ?? "—"}</p>
              {invoiceDetail.customer?.email && <p className="mt-1 text-sm text-ink/60">{invoiceDetail.customer.email}</p>}
              {invoiceDetail.customer?.phone && <p className="mt-1 text-sm text-ink/60">{invoiceDetail.customer.phone}</p>}
            </div>
            <div className="border border-line bg-white px-5 py-5">
              <p className="text-xs uppercase tracking-[0.12em] text-ink/45">Payment details</p>
              <p className="mt-2 text-sm text-ink/70">Due: {invoiceDetail.due_date ?? "No due date"}</p>
              {invoiceDetail.paid_at && <p className="mt-1 text-sm text-moss">Paid: {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(invoiceDetail.paid_at))}</p>}
            </div>
          </div>

          <div className="overflow-hidden border border-line bg-white">
            <div className="border-b border-line px-5 py-4">
              <h2 className="font-display text-lg text-ink">Line items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-ink/45">
                  <tr>
                    <th className="px-5 py-3 font-normal">Description</th>
                    <th className="px-5 py-3 font-normal">Quantity</th>
                    <th className="px-5 py-3 font-normal">Unit price</th>
                    <th className="px-5 py-3 text-right font-normal">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {invoiceDetail.invoice_items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-4 text-ink">{item.description}</td>
                      <td className="px-5 py-4 text-ink/65">{item.quantity}</td>
                      <td className="px-5 py-4 text-ink/65">{formatMoney(item.unit_price, invoiceDetail.currency)}</td>
                      <td className="px-5 py-4 text-right text-ink">{formatMoney(item.quantity * item.unit_price, invoiceDetail.currency)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-line">
                  <tr>
                    <td colSpan={3} className="px-5 py-4 text-right text-sm text-ink/60">Total</td>
                    <td className="px-5 py-4 text-right font-display text-xl text-ink">{formatMoney(total, invoiceDetail.currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {(invoiceDetail.status === "draft" || invoiceDetail.status === "sent" || invoiceDetail.status === "overdue") && (
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
              <Link href="/dashboard/invoices" className="text-sm text-ink/60 hover:text-ink">← Back to invoices</Link>
              <div className="flex gap-3">
                {invoiceDetail.status === "draft" && (
                  <form action={markInvoiceSent.bind(null, invoiceDetail.id)}>
                    <button type="submit" className="rounded-sm bg-moss px-4 py-2 text-sm text-paper hover:bg-moss/90">
                      Mark as Sent
                    </button>
                  </form>
                )}
                {(invoiceDetail.status === "sent" || invoiceDetail.status === "overdue") && (
                  <form action={markInvoicePaid.bind(null, invoiceDetail.id)}>
                    <button type="submit" className="rounded-sm bg-moss px-4 py-2 text-sm text-paper hover:bg-moss/90">
                      Mark as Paid
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
