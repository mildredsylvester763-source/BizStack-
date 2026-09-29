import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { calculateInvoiceTotal, isOverdue } from "@/lib/invoices";
import { BizPanel, BizStatus } from "@/components/ui/BizStackVisual";

async function markSent(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const invoiceId = String(formData.get("invoice_id") || "");
  const businessId = String(formData.get("business_id") || "");
  const invoiceNumber = String(formData.get("invoice_number") || "");
  await supabase.from("invoices").update({ status: "sent" }).eq("id", invoiceId).eq("business_id", businessId);
  await supabase.from("events").insert({
    business_id: businessId,
    event_type: "invoice.sent",
    summary: \`Invoice \${invoiceNumber} marked as sent\`,
    evidence: { invoice_id: invoiceId },
    status: "info"
  });
  revalidatePath(\`/dashboard/invoices/\${invoiceId}\`);
}

async function markPaid(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const invoiceId = String(formData.get("invoice_id") || "");
  const businessId = String(formData.get("business_id") || "");
  const invoiceNumber = String(formData.get("invoice_number") || "");
  const total = String(formData.get("total") || "");
  const currency = String(formData.get("currency") || "");
  const customerName = String(formData.get("customer_name") || "a customer");
  const paymentMethod = String(formData.get("payment_method") || "bank_transfer");

  await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString(), paid_amount: Number(total) || 0 })
    .eq("id", invoiceId)
    .eq("business_id", businessId);

  await supabase.from("events").insert({
    business_id: businessId,
    event_type: "invoice.paid",
    summary: \`\${total} \${currency} received from \${customerName} for invoice \${invoiceNumber} via \${paymentMethod.replace("_", " ")}\`,
    evidence: { invoice_id: invoiceId, total, currency, payment_method: paymentMethod },
    status: "info"
  });

  revalidatePath(\`/dashboard/invoices/\${invoiceId}\`);
  revalidatePath("/dashboard/invoices");
}

const methodMeta = {
  bank_transfer: { label: "Bank transfer", icon: "₦", tone: "cyan" as const },
  qr: { label: "QR payment", icon: "▦", tone: "purple" as const },
  card: { label: "Card payment", icon: "▣", tone: "blue" as const }
};

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id,name,address,contact_email,contact_phone,currency,bank_name,bank_account_name,bank_account_number")
    .eq("owner_id", user.id)
    .single();
  if (!business) redirect("/onboarding");

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id,invoice_number,status,due_date,currency,created_at,payment_methods,total,paid_amount,customer:customers(name,email,phone),invoice_items(id,description,quantity,unit_price)")
    .eq("id", id)
    .eq("business_id", business.id)
    .single();

  if (!invoice) redirect("/dashboard/invoices");

  const customer = invoice.customer as unknown as { name: string; email: string | null; phone: string | null } | null;
  const items = (invoice.invoice_items ?? []) as { id: string; description: string; quantity: number; unit_price: number }[];
  const calculatedTotal = calculateInvoiceTotal(items);
  const total = Number(invoice.total || 0) > 0 ? Number(invoice.total) : calculatedTotal;
  const paidAmount = Number(invoice.paid_amount || 0);
  const outstanding = Math.max(total - paidAmount, 0);
  const overdue = isOverdue(invoice.status, invoice.due_date);
  const displayStatus = overdue ? "overdue" : invoice.status;
  const methods = (invoice.payment_methods || []) as string[];

  if (overdue) {
    const { data: existing } = await supabase
      .from("events")
      .select("id")
      .eq("business_id", business.id)
      .eq("event_type", "payment.overdue")
      .contains("evidence", { invoice_id: invoice.id });
    if (!existing?.length) {
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
        summary: autoExecute ? \`Invoice \${invoice.invoice_number} is overdue — reminder would be sent automatically\` : \`Invoice \${invoice.invoice_number} is overdue and needs your decision on a reminder\`,
        evidence: { invoice_id: invoice.id },
        status: autoExecute ? "auto_handled" : "needs_approval"
      });
    }
  }

  const qrPayload = encodeURIComponent(\`Pay \${total.toFixed(2)} \${invoice.currency} to \${business.name} — Invoice \${invoice.invoice_number}\`);
  const qrUrl = \`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=\${qrPayload}\`;

  return (
    <main className="biz-page min-h-screen">
      <section className="biz-content max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-4">
          <Link href="/dashboard/invoices" className="text-[9px] text-white/35 hover:text-white/65">← Invoices</Link>
          <div className="flex items-center gap-2">
            <BizStatus tone={displayStatus === "paid" ? "green" : displayStatus === "overdue" ? "red" : "blue"}>{displayStatus}</BizStatus>
            <span className="biz-chip">{invoice.invoice_number}</span>
          </div>
        </div>

        <div className="grid xl:grid-cols-[1.5fr_.8fr] gap-4 items-start">
          <BizPanel>
            <div className="p-6 border-b border-white/[.07]">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="text-[8px] uppercase tracking-[.18em] text-blue-200/45">Invoice</div>
                  <h1 className="mt-2 text-2xl font-semibold text-white">{business.name}</h1>
                  {business.address && <p className="text-[9px] text-white/30 mt-2 max-w-sm">{business.address}</p>}
                  <p className="text-[9px] text-white/25 mt-1">{[business.contact_email, business.contact_phone].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="text-right">
                  <div className="text-[9px] text-white/25">Issued</div>
                  <div className="text-[10px] text-white/65 mt-1">{new Date(invoice.created_at).toLocaleDateString()}</div>
                  <div className="text-[9px] text-white/25 mt-3">Due</div>
                  <div className="text-[10px] text-white/65 mt-1">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "—"}</div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/[.07] bg-white/[.025] p-4">
                <div className="text-[8px] uppercase tracking-[.15em] text-white/25">Bill to</div>
                <div className="mt-2 text-[12px] font-medium text-white/75">{customer?.name || "No customer"}</div>
                <div className="text-[8px] text-white/30 mt-1">{[customer?.email, customer?.phone].filter(Boolean).join(" · ")}</div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-[1fr_70px_100px_110px] gap-3 pb-3 border-b border-white/[.07] text-[7px] uppercase tracking-[.13em] text-white/20">
                <span>Description</span><span className="text-right">Qty</span><span className="text-right">Unit</span><span className="text-right">Amount</span>
              </div>
              {items.map(item => (
                <div key={item.id} className="grid grid-cols-[1fr_70px_100px_110px] gap-3 py-3 border-b border-white/[.05] text-[9px]">
                  <span className="text-white/70">{item.description}</span>
                  <span className="text-right text-white/35">{item.quantity}</span>
                  <span className="text-right text-white/35">{Number(item.unit_price).toFixed(2)}</span>
                  <span className="text-right text-white/70">{(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}</span>
                </div>
              ))}

              <div className="mt-6 flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-[9px] text-white/30"><span>Invoice total</span><span>{total.toFixed(2)} {invoice.currency}</span></div>
                  <div className="flex justify-between text-[9px] text-emerald-300/70"><span>Paid</span><span>{paidAmount.toFixed(2)} {invoice.currency}</span></div>
                  <div className="flex justify-between border-t border-white/[.08] pt-3 text-[13px] font-semibold text-white"><span>Outstanding</span><span>{outstanding.toFixed(2)} {invoice.currency}</span></div>
                </div>
              </div>
            </div>
          </BizPanel>

          <aside className="space-y-4">
            {invoice.status !== "paid" && (
              <BizPanel>
                <div className="biz-panel-head">
                  <div><h2 className="biz-title">Payment actions</h2><p className="biz-subtitle">Record how this invoice was paid.</p></div>
                </div>
                <div className="p-4">
                  <form action={markPaid} className="space-y-3">
                    <input type="hidden" name="invoice_id" value={invoice.id} />
                    <input type="hidden" name="business_id" value={business.id} />
                    <input type="hidden" name="invoice_number" value={invoice.invoice_number} />
                    <input type="hidden" name="total" value={outstanding.toFixed(2)} />
                    <input type="hidden" name="currency" value={invoice.currency} />
                    <input type="hidden" name="customer_name" value={customer?.name || "a customer"} />
                    <label className="block text-[8px] uppercase tracking-[.13em] text-white/25">Payment method used</label>
                    <select name="payment_method" className="w-full rounded-xl border border-white/[.08] bg-white/[.035] px-3 py-3 text-[9px] text-white outline-none">
                      {methods.map(method => <option key={method} value={method}>{methodMeta[method as keyof typeof methodMeta]?.label || method}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      {invoice.status === "draft" && (
                        <button formAction={markSent} className="rounded-xl border border-white/[.09] bg-white/[.04] px-3 py-3 text-[9px] text-white/60">Mark sent</button>
                      )}
                      <button type="submit" className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-3 text-[9px] font-semibold text-white">Record payment</button>
                    </div>
                  </form>
                </div>
              </BizPanel>
            )}

            <BizPanel title="How customers can pay" subtitle="These are the exact payment methods stored on this invoice.">
              <div className="p-4 space-y-3">
                {methods.length === 0 && <div className="text-[9px] text-white/25">No payment methods selected.</div>}
                {methods.includes("bank_transfer") && (
                  <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[.045] p-4">
                    <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">₦</span><div><div className="text-[10px] font-medium text-white/75">Bank transfer</div><div className="text-[7px] text-white/25">Account details</div></div></div>
                    {business.bank_name ? (
                      <div className="mt-4 space-y-1 text-[8px] text-white/45"><div>{business.bank_name}</div><div>{business.bank_account_name}</div><div className="text-white/75">{business.bank_account_number}</div></div>
                    ) : (
                      <p className="mt-3 text-[8px] text-orange-200/55">Bank details are not configured yet. <Link href="/dashboard/settings/payments" className="text-orange-200 underline">Add bank details</Link>.</p>
                    )}
                  </div>
                )}

                {methods.includes("qr") && (
                  <div className="rounded-2xl border border-violet-400/15 bg-violet-400/[.045] p-4 text-center">
                    <div className="text-[10px] font-medium text-white/75">QR payment</div>
                    <p className="text-[7px] text-white/25 mt-1">Customer can scan this invoice-specific code.</p>
                    <div className="mt-3 inline-flex rounded-xl bg-white p-2"><img src={qrUrl} alt="Invoice payment QR code" width={150} height={150} className="rounded-lg" /></div>
                  </div>
                )}

                {methods.includes("card") && (
                  <div className="rounded-2xl border border-blue-400/15 bg-blue-400/[.045] p-4">
                    <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-400/10 text-blue-300">▣</span><div><div className="text-[10px] font-medium text-white/75">Card payment</div><div className="text-[7px] text-white/25">Customer-selectable</div></div></div>
                    <p className="mt-3 text-[8px] leading-4 text-white/35">The invoice now exposes card as a payment choice. A real charge requires a verified payment processor integration; BizStack does not mark a card payment successful without provider confirmation.</p>
                  </div>
                )}
              </div>
            </BizPanel>
          </aside>
        </div>
      </section>
    </main>
  );
}
