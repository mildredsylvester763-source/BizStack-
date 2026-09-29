import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { calculateInvoiceTotal, isOverdue } from "@/lib/invoices";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { Card } from "@/components/ui/Card";

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

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select(
      "id, name, address, contact_email, contact_phone, bank_name, bank_account_name, bank_account_number"
    )
    .eq("owner_id", user.id)
    .single();
  if (!business) redirect("/onboarding");

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, due_date, currency, created_at, payment_methods, customer:customers(name, email, phone), invoice_items(id, description, quantity, unit_price)"
    )
    .eq("id", params.id)
    .eq("business_id", business.id)
    .single();
  if (!invoice) redirect("/dashboard/invoices");

  const customer = invoice.customer as unknown as {
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  const items = (invoice.invoice_items ?? []) as {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
  }[];
  const total = calculateInvoiceTotal(items);
  const overdue = isOverdue(invoice.status, invoice.due_date);
  const methods = invoice.payment_methods ?? [];

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
      const autoExecute = (setting?.mode ?? "ask_first") === "auto_execute";
      await supabase.from("events").insert({
        business_id: business.id,
        event_type: "payment.overdue",
        summary: autoExecute
          ? `Invoice ${invoice.invoice_number} is overdue — reminder would be sent automatically`
          : `Invoice ${invoice.invoice_number} is overdue and needs your decision on a reminder`,
        evidence: { invoice_id: invoice.id },
        status: autoExecute ? "auto_handled" : "needs_approval"
      });
    }
  }

  const displayStatus = overdue ? "overdue" : invoice.status;

  const qrPayload = encodeURIComponent(
    `Pay ${total.toFixed(2)} ${invoice.currency} to ${business.name} — Invoice ${invoice.invoice_number}`
  );
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${qrPayload}`;

  return (
    <section className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <Link href="/dashboard/invoices" className="text-sm text-textMuted hover:text-text">
          ← Back to invoices
        </Link>
        <div className="flex gap-3">
          {invoice.status === "draft" && (
            <form action={markSent}>
              <input type="hidden" name="invoice_id" value={invoice.id} />
              <input type="hidden" name="business_id" value={business.id} />
              <input type="hidden" name="invoice_number" value={invoice.invoice_number} />
              <Button type="submit">Mark as sent</Button>
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
              <Button type="submit" variant="secondary">
                Mark as paid
              </Button>
            </form>
          )}
        </div>
      </div>

      <Card className="p-8 mb-6">
        <div className="flex items-start justify-between border-b border-line pb-6 mb-6">
          <div>
            <p className="font-display text-xl text-text">{business.name}</p>
            {business.address && (
              <p className="text-sm text-textMuted mt-1 max-w-xs">{business.address}</p>
            )}
            <p className="text-sm text-textMuted mt-1">
              {[business.contact_email, business.contact_phone].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display italic text-lg text-accent">Invoice</p>
            <p className="text-sm text-textMuted mt-1">{invoice.invoice_number}</p>
            <p className="text-xs text-textMuted mt-2">
              Issued {new Date(invoice.created_at).toLocaleDateString()}
            </p>
            {invoice.due_date && (
              <p className="text-xs text-textMuted">
                Due {new Date(invoice.due_date).toLocaleDateString()}
              </p>
            )}
            <div className="mt-2">
              <StatusPill status={displayStatus} />
            </div>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs uppercase text-textMuted tracking-wide mb-1">Bill to</p>
          <p className="text-text font-medium">{customer?.name ?? "No customer"}</p>
          {customer?.email && <p className="text-sm text-textMuted">{customer.email}</p>}
          {customer?.phone && <p className="text-sm text-textMuted">{customer.phone}</p>}
        </div>

        <div className="grid grid-cols-[1fr_60px_90px_90px] gap-2 text-xs uppercase text-textMuted tracking-wide pb-2 border-b border-line">
          <span>Description</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Price</span>
          <span className="text-right">Amount</span>
        </div>
        <div className="divide-y divide-line">
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_60px_90px_90px] gap-2 py-3 text-sm">
              <span className="text-text">{item.description}</span>
              <span className="text-right text-textMuted">{item.quantity}</span>
              <span className="text-right text-textMuted">{item.unit_price.toFixed(2)}</span>
              <span className="text-right text-text">
                {(item.quantity * item.unit_price).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-6">
          <div className="w-48">
            <div className="flex justify-between font-display text-xl text-text border-t border-line pt-3">
              <span>Total</span>
              <span>
                {total.toFixed(2)} {invoice.currency}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {methods.length > 0 && (
        <Card className="p-6">
          <p className="text-sm text-textMuted mb-4">How to pay</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {methods.includes("bank_transfer") && (
              <div className="border border-line rounded-lg p-4">
                <p className="text-sm text-text font-medium mb-2">Bank transfer</p>
                {business.bank_name ? (
                  <div className="text-sm text-textMuted space-y-0.5">
                    <p>{business.bank_name}</p>
                    <p>{business.bank_account_name}</p>
                    <p className="text-text">{business.bank_account_number}</p>
                  </div>
                ) : (
                  <p className="text-sm text-textMuted">
                    Bank details not set yet —{" "}
                    <Link href="/dashboard/settings/payments" className="text-primary underline">
                      add them
                    </Link>
                    .
                  </p>
                )}
              </div>
            )}
            {methods.includes("qr") && (
              <div className="border border-line rounded-lg p-4 flex flex-col items-center text-center">
                <p className="text-sm text-text font-medium mb-2">Scan to pay</p>
                <img src={qrUrl} alt="Payment QR code" width={140} height={140} className="rounded" />
              </div>
            )}
            {methods.includes("card") && (
              <div className="border border-line rounded-lg p-4">
                <p className="text-sm text-text font-medium mb-2">Card payment</p>
                <p className="text-sm text-textMuted">Coming soon — not connected to a processor yet.</p>
              </div>
            )}
          </div>
        </Card>
      )}
    </section>
  );
}
