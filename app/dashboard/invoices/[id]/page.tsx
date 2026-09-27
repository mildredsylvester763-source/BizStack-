import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { calculateInvoiceTotal, isOverdue } from "@/lib/invoices";

async function markSent(formData: FormData) {
  "use server";
  const supabase = createClient();
  const invoiceId = formData.get("invoice_id") as string;
  const businessId = formData.get("business_id") as string;
  const invoiceNumber = formData.get("invoice_number") as string;

  await supabase.from("invoices").update({ status: "sent" }).eq("id", invoiceId);

  await supabase.from("events").insert({
    business_id: businessId,
    event_type: "invoice.sent",
    summary: `Invoice ${invoiceNumber} marked as sent`,
    evidence: { invoice_id: invoiceId },
    status: "info"
  });

  revalidatePath(`/dashboard/invoices/${invoiceId}`);
}

async function markPaid(formData: FormData) {
  "use server";
  const supabase = createClient();
  const invoiceId = formData.get("invoice_id") as string;
  const businessId = formData.get("business_id") as string;
  const invoiceNumber = formData.get("invoice_number") as string;
  const total = formData.get("total") as string;
  const currency = formData.get("currency") as string;
  const customerName = formData.get("customer_name") as string;

  await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoiceId);

  await supabase.from("events").insert({
    business_id: businessId,
    event_type: "invoice.paid",
    summary: `${total} ${currency} received from ${customerName} for invoice ${invoiceNumber}`,
    evidence: { invoice_id: invoiceId, total, currency },
    status: "info"
  });

  revalidatePath(`/dashboard/invoices/${invoiceId}`);
}

export default async function InvoiceDetailPage({
  params
}: {
  params: { id: string };
}) {
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

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, due_date, currency, customer:customers(name), invoice_items(id, description, quantity, unit_price)"
    )
    .eq("id", params.id)
    .eq("business_id", business.id)
    .single();

  if (!invoice) redirect("/dashboard/invoices");

  const customer = invoice.customer as unknown as { name: string } | null;
  const items = (invoice.invoice_items ?? []) as {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
  }[];
  const total = calculateInvoiceTotal(items);
  const overdue = isOverdue(invoice.status, invoice.due_date);

  // Autonomy-aware overdue handling: log at most once per invoice, using
  // the business's chosen mode from Module 2's automation_settings.
  if (overdue) {
    const { data: existing } = await supabase
      .from("events")
      .select("id")
      .eq("business_id", business.id)
      .eq("event_type", "payment.overdue")
      .contains("evidence", { invoice_id: invoice.id });

    if (!existing || existing.length === 0) {
      const { data: setting } = await supabase
        .from("automation_settings")
        .select("mode")
        .eq("business_id", business.id)
        .eq("action_type", "send_payment_reminder")
        .maybeSingle();

      const mode = setting?.mode ?? "ask_first";
      const autoExecute = mode === "auto_execute";

      await supabase.from("events").insert({
        business_id: business.id,
        event_type: "payment.overdue",
        summary: autoExecute
          ? `Invoice ${invoice.invoice_number} is overdue — reminder would be sent automatically (sending itself isn't built yet, this just logs the action)`
          : `Invoice ${invoice.invoice_number} is overdue and needs your decision on a reminder`,
        evidence: { invoice_id: invoice.id },
        status: autoExecute ? "auto_handled" : "needs_approval"
      });
    }
  }

  return (
    <main className="min-h-screen bg-ledger">
      <header className="border-b border-rule bg-white">
        <div className="max-w-2xl mx-auto px-6 py-5">
          <Link href="/dashboard/invoices" className="text-sm text-ink/45 hover:text-ink">
            ← Back to invoices
          </Link>
        </div>
      </header>

      <section className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl text-ink">{invoice.invoice_number}</h1>
            <p className="text-ink/60 mt-1">{customer?.name ?? "No customer"}</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-ink/10 text-ink/60 capitalize">
            {overdue ? "overdue" : invoice.status}
          </span>
        </div>

        <div className="bg-white border border-rule p-6 mb-6">
          <div className="divide-y divide-rule">
            {items.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-ink">{item.description}</p>
                  <p className="text-xs text-ink/45">
                    {item.quantity} × {item.unit_price.toFixed(2)}
                  </p>
                </div>
                <p className="text-ink/80">
                  {(item.quantity * item.unit_price).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
          <div className="border-t border-ink mt-4 pt-4 flex items-center justify-between">
            <span className="text-ink/60">Total</span>
            <span className="font-display text-2xl text-ink">
              {total.toFixed(2)} {invoice.currency}
            </span>
          </div>
          {invoice.due_date && (
            <p className="text-xs text-ink/45 mt-3">
              Due {new Date(invoice.due_date).toLocaleDateString()}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          {invoice.status === "draft" && (
            <form action={markSent}>
              <input type="hidden" name="invoice_id" value={invoice.id} />
              <input type="hidden" name="business_id" value={business.id} />
              <input type="hidden" name="invoice_number" value={invoice.invoice_number} />
              <button className="bg-ink text-mist px-5 py-2.5 text-sm font-medium hover:bg-vaultDeep transition-colors">
                Mark as sent
              </button>
            </form>
          )}

          {(invoice.status === "sent" || overdue) && (
            <form action={markPaid}>
              <input type="hidden" name="invoice_id" value={invoice.id} />
              <input type="hidden" name="business_id" value={business.id} />
              <input type="hidden" name="invoice_number" value={invoice.invoice_number} />
              <input type="hidden" name="total" value={total.toFixed(2)} />
              <input type="hidden" name="currency" value={invoice.currency} />
              <input type="hidden" name="customer_name" value={customer?.name ?? "a customer"} />
              <button className="bg-vault text-mist px-5 py-2.5 text-sm font-medium hover:bg-vaultDeep transition-colors">
                Mark as paid
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
