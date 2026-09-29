import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { sendEmail } from "@/lib/integrations/providers";

async function markSent(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const invoiceId = String(formData.get("invoice_id") || "");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const { data: job, error } = await supabase.rpc("queue_invoice_email", { p_invoice_id: invoiceId });
  if (error) throw new Error("Unable to queue invoice delivery: " + error.message);
  const { data: delivery } = await supabase.from("communication_delivery_jobs").select("id,recipient,subject,body,idempotency_key,communication_id").eq("id",job).eq("business_id",business.id).single();
  if (delivery) {
    const result = await sendEmail({to:delivery.recipient,subject:delivery.subject||undefined,body:delivery.body||"",metadata:{idempotencyKey:delivery.idempotency_key}});
    if (result.ok) {
      const now=new Date().toISOString();
      await supabase.from("communication_delivery_jobs").update({status:"sent",provider:result.provider,provider_status:"accepted",provider_message_id:result.messageId||null,response_metadata:result.response||{},sent_at:now,last_error:null}).eq("id",delivery.id).eq("business_id",business.id);
      await supabase.from("communication_messages").update({status:"sent",provider_message_id:result.messageId||null,sent_at:now,error_message:null}).eq("id",delivery.communication_id);
      await supabase.from("invoices").update({status:"sent"}).eq("id",invoiceId).eq("business_id",business.id).eq("status","draft");
    } else {
      await supabase.from("communication_delivery_jobs").update({status:"queued",provider:result.provider,provider_status:"provider_required_or_error",last_error:result.error,response_metadata:result.response||{}}).eq("id",delivery.id).eq("business_id",business.id);
      await supabase.from("communication_messages").update({status:"queued",error_message:result.error}).eq("id",delivery.communication_id);
    }
  }
  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/activity");
  revalidatePath("/dashboard/actions");
}

async function recordPayment(formData: FormData) {
  "use server";
  const supabase = await createClient();
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

export default async function InvoiceDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, address, contact_email, contact_phone, currency")
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
  const [{ data: businessSettings }, { data: paymentIntegrations }] = await Promise.all([supabase.from("business_settings").select("invoice_settings").eq("business_id", business.id).maybeSingle(), supabase.from("integrations").select("id,display_name,category,status,connection_type").eq("business_id", business.id).eq("category", "payments").order("created_at", { ascending: false })]);
  const invoiceSettings = { show_tax: true, show_discount: true, show_reference: true, show_purchase_order: true, show_notes: true, show_terms: true, ...(businessSettings?.invoice_settings ?? {}) };
  const customer = invoice.customer as unknown as { name: string; email: string | null; phone: string | null } | null;
  const items = (invoice.invoice_items ?? []) as { id: string; description: string; quantity: number; unit_price: number }[];
  const subtotal = Number(invoice.subtotal ?? items.reduce((s, i) => s + i.quantity * i.unit_price, 0));
  const discount = Number(invoice.discount_amount ?? 0);
  const tax = Number(invoice.tax_amount ?? 0);
  const total = Number(invoice.total ?? Math.max(0, subtotal - discount + tax));
  const { data: latestDelivery } = await supabase.from("communication_delivery_jobs").select("id,status,provider,provider_status,last_error,sent_at,created_at").eq("business_id",business.id).eq("entity_type","invoice").eq("entity_id",invoice.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
  const overdue = invoice.status !== "draft" && invoice.status !== "paid" && !!invoice.due_date && new Date(invoice.due_date + "T23:59:59") < new Date();

  return (
    <main className="min-h-screen bg-ledger">
      <header className="border-b border-black/10 bg-[#fbfaf7]/95 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/dashboard/invoices" className="text-sm text-ink/50 hover:text-ink">← Back to invoices</Link>
          <span className="text-xs uppercase tracking-[0.16em] text-ink/35">Invoice detail</span>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#7c6f58] mb-2">{business.name}</p>
            <div className="flex flex-wrap items-center gap-2 mb-3"><span className="inline-flex rounded-full bg-[#151817] text-white px-3 py-1.5 text-[11px] uppercase tracking-[.12em]">Invoice {invoice.invoice_number}</span><span className="inline-flex rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-xs capitalize">{overdue ? "Overdue" : invoice.status.replace("_"," ")}</span></div><h1 className="font-display text-4xl sm:text-5xl tracking-tight text-[#151817]">A commercial record that is ready to move money.</h1>
            <p className="text-[#151817]/55 mt-3 max-w-2xl">{customer?.name ?? "No customer"} · {invoice.payment_terms} · {paid.toFixed(2)} {invoice.currency} received · {outstanding.toFixed(2)} {invoice.currency} remaining</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs px-3 py-1.5 rounded-full bg-ink/10 text-ink/65 capitalize">{overdue ? "overdue" : invoice.status}</span>
            <span className="text-sm text-ink/45">{invoice.currency}</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_300px] gap-5 mb-6"><div className="rounded-[24px] border border-black/10 bg-white p-5 sm:p-6 shadow-[0_18px_60px_rgba(20,20,16,.08)]"><div className="flex items-center justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[.18em] text-black/35">Payment position</p><p className="font-display text-3xl mt-1">{money(outstanding, invoice.currency)} <span className="text-sm font-sans text-black/40">remaining</span></p></div><div className="text-right"><p className="text-[10px] uppercase tracking-[.18em] text-black/35">Collected</p><p className="text-sm mt-1">{money(paid, invoice.currency)}</p></div></div><div className="h-2 rounded-full bg-black/[.06] mt-5 overflow-hidden"><div className="h-full rounded-full bg-[#183f38]" style={{width: total > 0 ? Math.min(100, paid / total * 100) + "%" : "0%"}} /></div><div className="flex justify-between mt-2 text-[11px] text-black/40"><span>0</span><span>{money(total, invoice.currency)} total</span></div></div><div className="rounded-[24px] border border-black/10 bg-[#183f38] text-white p-5 shadow-[0_18px_60px_rgba(24,63,56,.18)]"><p className="text-[10px] uppercase tracking-[.18em] text-white/45">Payment rails</p><p className="font-display text-xl mt-2">{paymentReady ? "Provider connected" : "Manual payment ready"}</p><p className="text-xs text-white/55 mt-2 leading-5">{paymentReady ? "A payment provider is connected. Provider-specific initiation is capability-gated; BizStack will not show a fake payment button." : "No payment provider is verified yet. Confirmed bank, cash, transfer and other offline payments can still be recorded safely."}</p><a href="/dashboard/integrations" className="inline-block mt-4 rounded-xl bg-white/10 border border-white/10 px-3 py-2 text-xs">Manage connections</a></div></div><article className="bg-[#fffdf9] border border-black/10 shadow-[0_28px_90px_rgba(20,20,16,.10)] rounded-[28px] overflow-hidden">
          <div className="p-6 sm:p-9 border-b border-black/10 grid md:grid-cols-2 gap-8">
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

          <div className="p-6 sm:p-9 border-b border-black/10 grid grid-cols-2 md:grid-cols-4 gap-6">
            <div><p className="text-[11px] uppercase tracking-wider text-ink/35">Issue date</p><p className="text-sm text-ink mt-1">{invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString() : "—"}</p></div>
            <div><p className="text-[11px] uppercase tracking-wider text-ink/35">Due date</p><p className="text-sm text-ink mt-1">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "—"}</p></div>
            <div><p className="text-[11px] uppercase tracking-wider text-ink/35">Reference</p><p className="text-sm text-ink mt-1">{invoiceSettings.show_reference ? (invoice.reference || "—") : "—"}</p></div>
            <div><p className="text-[11px] uppercase tracking-wider text-ink/35">Purchase order</p><p className="text-sm text-ink mt-1">{invoiceSettings.show_purchase_order ? (invoice.purchase_order || "—") : "—"}</p></div>
          </div>

          <div className="p-6 sm:p-9">
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

        <div className="mt-6 grid md:grid-cols-2 gap-3"><div className="rounded-2xl border border-black/10 bg-white p-4 text-xs"><span className="font-medium">Delivery:</span> {latestDelivery ? latestDelivery.status + (latestDelivery.provider ? " via " + latestDelivery.provider : "") + (latestDelivery.last_error ? " · " + latestDelivery.last_error : "") : "Not sent yet."}</div><div className="rounded-2xl border border-black/10 bg-white p-4 text-xs"><span className="font-medium">Payment provider:</span> {paymentReady ? "Connected" : "Not connected — offline recording remains available."}</div></div><div className="mt-3">{latestDelivery && <div className={"border border-rule bg-white p-3 text-xs " + (latestDelivery.status==="sent" ? "text-ink/65" : "text-ink/55")}><span className="font-medium">Delivery:</span> {latestDelivery.status}{latestDelivery.provider ? " via " + latestDelivery.provider : ""}{latestDelivery.last_error ? " · " + latestDelivery.last_error : ""}</div>}</div>

        <div className="flex flex-wrap gap-3 mt-3">
          {invoice.status === "draft" && (
            <form action={markSent}>
              <input type="hidden" name="invoice_id" value={invoice.id} />
              <input type="hidden" name="business_id" value={business.id} />
              <input type="hidden" name="invoice_number" value={invoice.invoice_number} />
              <button className="bg-ink text-mist px-5 py-2.5 text-sm font-medium hover:bg-vaultDeep transition-colors">Send invoice</button>
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