import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { calculateInvoiceTotal, isOverdue } from "@/lib/invoices";

async function markSent(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const invoiceId = formData.get("invoice_id") as string;
  const businessId = formData.get("business_id") as string;
  const invoiceNumber = formData.get("invoice_number") as string;
  await supabase.from("invoices").update({ status: "sent" }).eq("id", invoiceId);
  await supabase.from("events").insert({ business_id: businessId, event_type: "invoice.sent", summary: `Invoice ${invoiceNumber} marked as sent`, evidence: { invoice_id: invoiceId }, status: "info" });
  revalidatePath(`/dashboard/invoices/${invoiceId}`);
}

async function markPaid(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const invoiceId = formData.get("invoice_id") as string;
  const businessId = formData.get("business_id") as string;
  const invoiceNumber = formData.get("invoice_number") as string;
  const total = formData.get("total") as string;
  const currency = formData.get("currency") as string;
  const customerName = formData.get("customer_name") as string;
  await supabase.from("invoices").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", invoiceId);
  await supabase.from("events").insert({ business_id: businessId, event_type: "invoice.paid", summary: `${total} ${currency} received from ${customerName} for invoice ${invoiceNumber}`, evidence: { invoice_id: invoiceId, total, currency }, status: "info" });
  revalidatePath(`/dashboard/invoices/${invoiceId}`);
}

type CustomerRef = { id: string; name: string; email: string | null; phone: string | null };
type ItemRef    = { id: string; description: string; quantity: number; unit_price: number };

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id, name, address, contact_email, contact_phone, bank_name, bank_account_name, bank_account_number").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const { data: invoice } = await supabase.from("invoices").select("id, invoice_number, status, due_date, currency, created_at, paid_at, payment_methods, customer:customers(id, name, email, phone), invoice_items(id, description, quantity, unit_price)").eq("id", id).eq("business_id", business.id).single();
  if (!invoice) redirect("/dashboard/invoices");

  const customer = (invoice.customer as unknown) as CustomerRef | null;
  const items    = ((invoice.invoice_items ?? []) as unknown) as ItemRef[];
  const total    = calculateInvoiceTotal(items);
  const overdue  = isOverdue(invoice.status, invoice.due_date);
  const methods  = invoice.payment_methods ?? [];

  if (overdue) {
    const { data: existing } = await supabase.from("events").select("id").eq("business_id", business.id).eq("event_type", "payment.overdue").contains("evidence", { invoice_id: invoice.id });
    if (!existing || existing.length === 0) {
      const { data: setting } = await supabase.from("automation_settings").select("mode").eq("business_id", business.id).eq("action_type", "send_payment_reminder").maybeSingle();
      const autoExecute = (setting?.mode ?? "ask_first") === "auto_execute";
      await supabase.from("events").insert({ business_id: business.id, event_type: "payment.overdue", summary: autoExecute ? `Invoice ${invoice.invoice_number} is overdue — reminder would be sent automatically` : `Invoice ${invoice.invoice_number} is overdue and needs your decision on a reminder`, evidence: { invoice_id: invoice.id }, status: autoExecute ? "auto_handled" : "needs_approval" });
    }
  }

  const displayStatus = overdue ? "overdue" : invoice.status;
  const STATUS_CONFIG: Record<string,{bg:string;text:string}> = {
    paid:    { bg:"rgba(34,197,94,0.15)",   text:"#22C55E" },
    sent:    { bg:"rgba(91,110,245,0.15)",   text:"#5B6EF5" },
    draft:   { bg:"rgba(139,146,176,0.15)",  text:"#8B92B0" },
    overdue: { bg:"rgba(239,68,68,0.15)",    text:"#EF4444" },
  };
  const sc = STATUS_CONFIG[displayStatus] ?? STATUS_CONFIG.draft;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`Pay ${total.toFixed(2)} ${invoice.currency} to ${business.name} — ${invoice.invoice_number}`)}`;

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 text-xs text-textMuted mb-4">
        <Link href="/dashboard/invoices" className="hover:text-white">Invoices</Link>
        <span>/</span>
        <span className="text-white">{invoice.invoice_number}</span>
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">{invoice.invoice_number}</h1>
          <span className="text-sm px-3 py-1 rounded-full font-medium capitalize" style={{background:sc.bg,color:sc.text}}>{displayStatus}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 bg-surface border border-line rounded-lg text-xs text-textMuted hover:text-white">↓ Download</button>
          <button className="px-3 py-1.5 bg-surface border border-line rounded-lg text-xs text-textMuted hover:text-white">Share</button>
          <button className="px-3 py-1.5 bg-surface border border-line rounded-lg text-xs text-textMuted hover:text-white">···</button>
        </div>
      </div>

      <p className="text-sm text-textMuted mb-6">
        {customer?.name ?? "No customer"} · {new Date(invoice.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
        {invoice.due_date && ` · Due ${new Date(invoice.due_date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`}
      </p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          {label:"Total Amount",     value:`$${total.toFixed(2)}`},
          {label:invoice.status==="paid"?"Paid":"Outstanding", value:`$${total.toFixed(2)}`},
          {label:"Balance",          value:invoice.status==="paid"?"$0.00":`$${total.toFixed(2)}`}
        ].map(s=>(
          <div key={s.label} className="bg-surface border border-line rounded-xl p-4">
            <p className="text-xs text-textMuted mb-1">{s.label}</p>
            <p className="text-xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[200px_1fr_180px] gap-4">
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          <div className="p-4 border-b border-line flex flex-col items-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mb-2" style={{background:"linear-gradient(135deg,#5B6EF5,#8B5CF6)"}}>
              {customer?.name?.charAt(0) ?? "?"}
            </div>
            <p className="text-sm font-semibold text-white text-center">{customer?.name ?? "No customer"}</p>
            {customer?.email && <p className="text-xs text-textMuted">{customer.email}</p>}
            {customer?.phone && <p className="text-xs text-textMuted">{customer.phone}</p>}
          </div>
          {["Overview","Payments","Activity","Files","Settings"].map(t=>(
            <button key={t} className={`w-full text-left px-4 py-3 text-sm border-b border-line transition-colors ${t==="Overview"?"text-primary bg-primary/10":"text-textMuted hover:text-white hover:bg-white/5"}`}>{t}</button>
          ))}
        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-line rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Invoice Overview</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-textMuted text-xs mb-1">Customer</p><p className="text-text">{customer?.name ?? "—"}</p></div>
              <div><p className="text-textMuted text-xs mb-1">Issue Date</p><p className="text-text">{new Date(invoice.created_at).toLocaleDateString()}</p></div>
              <div><p className="text-textMuted text-xs mb-1">Due Date</p><p className="text-text">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "—"}</p></div>
              <div><p className="text-textMuted text-xs mb-1">Payment Status</p><span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{background:sc.bg,color:sc.text}}>{displayStatus}</span></div>
              <div><p className="text-textMuted text-xs mb-1">Payment Method</p><p className="text-text capitalize">{methods.includes("bank_transfer")?"Bank Transfer":methods[0]??"—"}</p></div>
              <div><p className="text-textMuted text-xs mb-1">Invoice #</p><p className="text-text">{invoice.invoice_number}</p></div>
            </div>
          </div>

          <div className="bg-surface border border-line rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Line Items</h3>
            <div className="grid grid-cols-[1fr_60px_90px_90px] gap-2 text-xs text-textMuted pb-2 border-b border-line">
              <span>Description</span><span className="text-right">Qty</span><span className="text-right">Price</span><span className="text-right">Amount</span>
            </div>
            {items.map(item=>(
              <div key={item.id} className="grid grid-cols-[1fr_60px_90px_90px] gap-2 py-2.5 border-b border-line/50 text-sm">
                <span className="text-text">{item.description}</span>
                <span className="text-right text-textMuted">{item.quantity}</span>
                <span className="text-right text-textMuted">{item.unit_price.toFixed(2)}</span>
                <span className="text-right text-white">{(item.quantity*item.unit_price).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-end mt-3">
              <div className="text-right space-y-1">
                <div className="flex justify-between gap-8 text-sm text-textMuted"><span>Subtotal</span><span>{total.toFixed(2)}</span></div>
                <div className="flex justify-between gap-8 text-base font-bold text-white border-t border-line pt-1"><span>Total</span><span>{total.toFixed(2)} {invoice.currency}</span></div>
              </div>
            </div>
          </div>

          {methods.length > 0 && (
            <div className="bg-surface border border-line rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">How to Pay</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {methods.includes("bank_transfer") && (
                  <div className="border border-line rounded-lg p-3">
                    <p className="text-xs font-medium text-white mb-1.5">Bank Transfer</p>
                    {business.bank_name ? (
                      <div className="text-xs text-textMuted space-y-0.5"><p>{business.bank_name}</p><p>{business.bank_account_name}</p><p className="text-text font-medium">{business.bank_account_number}</p></div>
                    ) : (
                      <p className="text-xs text-textMuted">Bank details not set — <Link href="/dashboard/settings/payments" className="text-primary underline">add them</Link>.</p>
                    )}
                  </div>
                )}
                {methods.includes("qr") && (
                  <div className="border border-line rounded-lg p-3 flex flex-col items-center text-center">
                    <p className="text-xs font-medium text-white mb-2">Scan to Pay</p>
                    <img src={qrUrl} alt="QR" width={100} height={100} className="rounded"/>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {invoice.status === "draft" && (
            <form action={markSent}>
              <input type="hidden" name="invoice_id" value={invoice.id}/>
              <input type="hidden" name="business_id" value={business.id}/>
              <input type="hidden" name="invoice_number" value={invoice.invoice_number}/>
              <button type="submit" className="w-full flex items-center gap-2 px-4 py-3 bg-surface border border-line rounded-xl text-sm text-white hover:bg-surfaceAlt">
                📤 Mark as Sent
              </button>
            </form>
          )}
          {(invoice.status === "sent" || overdue) && (
            <form action={markPaid}>
              <input type="hidden" name="invoice_id" value={invoice.id}/>
              <input type="hidden" name="business_id" value={business.id}/>
              <input type="hidden" name="invoice_number" value={invoice.invoice_number}/>
              <input type="hidden" name="total" value={total.toFixed(2)}/>
              <input type="hidden" name="currency" value={invoice.currency}/>
              <input type="hidden" name="customer_name" value={customer?.name??"a customer"}/>
              <button type="submit" className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white" style={{background:"#22C55E"}}>
                ✓ Mark as Paid
              </button>
            </form>
          )}
          {[
            {icon:"📧",label:"Send Receipt",   danger:false},
            {icon:"🔔",label:"Send Reminder",  danger:false},
            {icon:"➕",label:"Add Payment",    danger:false},
            {icon:"📋",label:"Duplicate",      danger:false},
            {icon:"✕", label:"Cancel Invoice", danger:true }
          ].map(a=>(
            <button key={a.label} className={`w-full flex items-center gap-2 px-4 py-3 bg-surface border border-line rounded-xl text-sm transition-colors ${a.danger?"text-danger hover:bg-danger/10":"text-textMuted hover:text-white hover:bg-surfaceAlt"}`}>
              <span>{a.icon}</span> {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
