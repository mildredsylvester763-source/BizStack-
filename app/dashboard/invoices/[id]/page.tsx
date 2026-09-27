import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

async function markSent(formData: FormData) {
  "use server";
  const supabase = createClient();
  const invoiceId = String(formData.get("invoice_id"));
  const businessId = String(formData.get("business_id"));
  const invoiceNumber = String(formData.get("invoice_number"));
  await supabase.from("invoices").update({ status: "sent" }).eq("id", invoiceId).eq("business_id", businessId);
  await supabase.from("events").insert({ business_id: businessId, event_type: "invoice.sent", summary: `Invoice ${invoiceNumber} marked as sent`, evidence: { invoice_id: invoiceId }, status: "info" });
  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  revalidatePath("/dashboard/invoices");
}

async function recordPayment(formData: FormData) {
  "use server";
  const supabase = createClient();
  const invoiceId = String(formData.get("invoice_id") || "");
  const amount = Number(formData.get("amount"));
  const method = String(formData.get("method") || "").trim() || null;
  const reference = String(formData.get("reference") || "").trim() || null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid payment amount.");
  const { error } = await supabase.rpc("record_invoice_payment", {
    p_invoice_id: invoiceId,
    p_amount: Number(amount.toFixed(2)),
    p_method: method,
    p_reference: reference,
    p_payment_date: new Date().toISOString()
  });
  if (error) throw new Error("Unable to record payment: " + error.message);
  revalidatePath("/dashboard/invoices/" + invoiceId);
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/money");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/actions");
  revalidatePath("/dashboard/activity");
}
function money(value: number, currency: string) {
  return `${value.toFixed(2)} ${currency}`;
}

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, address, contact_email, contact_phone")
    .eq("owner_id", user.id)
    .single();
  if (!business) redirect("/onboarding");

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, issue_date, due_date, payment_terms, reference, purchase_order, notes, terms_and_conditions, discount_type, discount_value, tax_enabled, tax_name, tax_treatment, tax_jurisdiction, tax_registration_number, tax_rate, subtotal, discount_amount, tax_amount, total, paid_amount, currency, created_at, paid_at, customer:customers(name, email, phone), invoice_items(id, description, quantity, unit_price)")
    .eq("id", params.id)
    .eq("business_id", business.id)
    .single();

  if (!invoice) redirect("/dashboard/invoices");
  const { data: businessSettings } = await supabase.from("business_settings").select("invoice_settings").eq("business_id", business.id).maybeSingle();
  const invoiceSettings = { show_tax: true, show_discount: true, show_reference: true, show_purchase_order: true, show_notes: true, show_terms: true, ...(businessSettings?.invoice_settings ?? {}) };
  const customer = invoice.customer as unknown as { name: string; email: string | null; phone: string | null } | null;
  const items = (invoice.invoice_items ?? []) as { id: string; description: string; quantity: number; unit_price: number }[];
  const subtotal = Number(invoice.subtotal ?? items.reduce((s, i) => s + i.quantity * i.unit_price, 0));
  const discount = Number(invoice.discount_amount ?? 0);
  const tax = Number(invoice.tax_amount ?? 0);
  const total = Number(invoice.total ?? Math.max(0, subtotal - discount + tax));
  const overdue = invoice.status !== "draft" && invoice.status !== "paid" && !!invoice.due_date && new Date(invoice.due_date + "T23:59:59") < new Date();

  return (
    <main className="min-h-screen bg-ledger">
      <header className="border-b border-rule bg-white">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/dashboard/invoices" className="text-sm text-ink/50 hover:text-ink">← Back to invoices</Link>
          <span className="text-xs uppercase tracking-[0.16em] text-ink/35">Invoice detail</span>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-vault mb-2">{business.name}</p>
            <h1 className="font-display text-4xl text-ink">{invoice.invoice_number}</h1>
            <p className="text-ink/55 mt-2">{customer?.name ?? "No customer"} · {invoice.payment_terms} · Paid {money(Number(invoice.paid_amount || 0), invoice.currency)}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs px-3 py-1.5 rounded-full bg-ink/10 text-ink/65 capitalize">{overdue ? "overdue" : invoice.status}</span>
            <span className="text-sm text-ink/45">{invoice.currency}</span>
          </div>
        </div>

        <article className="bg-white border border-rule shadow-sm">
          <div className="p-8 border-b border-rule grid md:grid-cols-2 gap-8">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-ink/35 mb-2">From</p>
              <p className="font-medium text-ink">{business.name}</p>
              {business.address && <p className="text-sm text-ink/55 whitespace-pre-line mt-1">{business.address}</p>}
              {business.contact_email && <p className="text-sm text-ink/55 mt-1">{business.contact_email}</p>}
              {business.contact_phone && <p className="text-sm text-ink/55">{business.contact_phone}</p>}
            </div>
            <div className="md:text-right">
              <p className="text-[11px] uppercase tracking-wider text-ink/35 mb-2">Bill to</p>
              <p className="font-medium text-ink">{customer?.name ?? "—"}</p>
              {customer?.email && <p className="text-sm text-ink/55 mt-1">{customer.email}</p>}
              {customer?.phone && <p className="text-sm text-ink/55">{customer.phone}</p>}
            </div>
          </div>

          <div className="p-8 border-b border-rule grid grid-cols-2 md:grid-cols-4 gap-6">
            <div><p className="text-[11px] uppercase tracking-wider text-ink/35">Issue date</p><p className="text-sm text-ink mt-1">{invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString() : "—"}</p></div>
            <div><p className="text-[11px] uppercase tracking-wider text-ink/35">Due date</p><p className="text-sm text-ink mt-1">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "—"}</p></div>
            <div><p className="text-[11px] uppercase tracking-wider text-ink/35">Reference</p><p className="text-sm text-ink mt-1">{invoiceSettings.show_reference ? (invoice.reference || "—") : "—"}</p></div>
            <div><p className="text-[11px] uppercase tracking-wider text-ink/35">Purchase order</p><p className="text-sm text-ink mt-1">{invoiceSettings.show_purchase_order ? (invoice.purchase_order || "—") : "—"}</p></div>
          </div>

          <div className="p-8">
            <div className="hidden md:grid grid-cols-[1fr_90px_140px_150px] gap-4 text-[11px] uppercase tracking-wider text-ink/35 pb-3 border-b border-rule">
              <span>Description</span><span>Qty</span><span>Unit price</span><span className="text-right">Amount</span>
            </div>
            <div className="divide-y divide-rule">
              {items.map(item => (
                <div key={item.id} className="grid md:grid-cols-[1fr_90px_140px_150px] gap-4 py-4 text-sm">
                  <span className="text-ink">{item.description}</span>
                  <span className="text-ink/60">{item.quantity}</span>
                  <span className="text-ink/60">{money(item.unit_price, invoice.currency)}</span>
                  <span className="text-right text-ink font-medium">{money(item.quantity * item.unit_price, invoice.currency)}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 ml-auto max-w-sm space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-ink/55">Subtotal</span><span>{money(subtotal, invoice.currency)}</span></div>
              {invoiceSettings.show_discount && discount > 0 && <div className="flex justify-between"><span className="text-ink/55">Discount</span><span>-{money(discount, invoice.currency)}</span></div>}
              {invoiceSettings.show_tax && Boolean(invoice.tax_enabled) && Number(invoice.tax_amount) > 0 && <div className="flex justify-between"><span className="text-ink/55">{invoice.tax_name || "Tax"} ({Number(invoice.tax_rate).toFixed(2)}%)</span><span>{money(tax, invoice.currency)}</span></div>}
              <div className="border-t border-ink pt-4 flex justify-between items-end"><span className="text-ink/60">Total</span><span className="font-display text-2xl text-ink">{money(total, invoice.currency)}</span></div>
            </div>
          </div>

          {((invoiceSettings.show_notes && invoice.notes) || (invoiceSettings.show_terms && invoice.terms_and_conditions)) && (
            <div className="p-8 border-t border-rule grid md:grid-cols-2 gap-8">
              {invoiceSettings.show_notes && invoice.notes && <div><p className="text-[11px] uppercase tracking-wider text-ink/35 mb-2">Note</p><p className="text-sm text-ink/65 whitespace-pre-line">{invoice.notes}</p></div>}
              {invoiceSettings.show_terms && invoice.terms_and_conditions && <div><p className="text-[11px] uppercase tracking-wider text-ink/35 mb-2">Terms & conditions</p><p className="text-sm text-ink/65 whitespace-pre-line">{invoice.terms_and_conditions}</p></div>}
            </div>
          )}
        </article>

        <div className="flex flex-wrap gap-3 mt-6">
          {invoice.status === "draft" && (
            <form action={markSent}>
              <input type="hidden" name="invoice_id" value={invoice.id} />
              <input type="hidden" name="business_id" value={business.id} />
              <input type="hidden" name="invoice_number" value={invoice.invoice_number} />
              <button className="bg-ink text-mist px-5 py-2.5 text-sm font-medium hover:bg-vaultDeep transition-colors">Mark as sent</button>
            </form>
          )}
          {(invoice.status === "sent" || invoice.status === "partially_paid" || overdue) && Number(invoice.paid_amount || 0) < total && (
            <form action={recordPayment} className="flex flex-wrap items-end gap-2 border border-rule bg-white p-3">
              <input type="hidden" name="invoice_id" value={invoice.id} />
              <label className="text-xs text-ink/55">Payment amount<input required name="amount" type="number" min="0.01" step="0.01" max={Math.max(0,total-Number(invoice.paid_amount||0)).toFixed(2)} defaultValue={Math.max(0,total-Number(invoice.paid_amount||0)).toFixed(2)} className="mt-1 block w-32 border border-rule px-2.5 py-2 text-sm" /></label>
              <label className="text-xs text-ink/55">Method<input name="method" placeholder="Bank transfer, cash..." className="mt-1 block w-40 border border-rule px-2.5 py-2 text-sm" /></label>
              <label className="text-xs text-ink/55">Reference<input name="reference" placeholder="Payment reference" className="mt-1 block w-40 border border-rule px-2.5 py-2 text-sm" /></label>
              <button className="bg-vault text-mist px-5 py-2.5 text-sm font-medium hover:bg-vaultDeep transition-colors">Record payment</button>
            </form>
          )}
          <Link href="/dashboard/invoices" className="border border-rule px-5 py-2.5 text-sm text-ink/60 hover:text-ink">All invoices</Link>
        </div>
      </section>
    </main>
  );
}
