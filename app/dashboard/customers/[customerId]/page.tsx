import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-[#dcefe2] text-[#2f6b43] border-[#b9dcc5]",
  overdue: "bg-[#f7dddd] text-[#a04444] border-[#e8bcbc]",
  partial: "bg-[#f8edc8] text-[#7b611c] border-[#ead89b]",
  sent: "bg-[#e8eef4] text-[#31536f] border-[#cbd9e5]",
  draft: "bg-[#eceae5] text-[#5e5b55] border-[#d9d6ce]"
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
}

export default async function CustomerProfilePage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase.from("businesses").select("id, name, currency").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");

  const { data: customer } = await supabase.from("customers").select("id, name, email, phone, created_at").eq("id", customerId).eq("business_id", business.id).maybeSingle();
  if (!customer) notFound();

  const { data: invoices } = await supabase.from("invoices").select("id,invoice_number,status,total,paid_amount,due_date,currency,created_at").eq("business_id", business.id).eq("customer_id", customer.id).order("created_at", { ascending: false });
  const rows = invoices ?? [];
  const billed = rows.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
  const paid = rows.reduce((sum, invoice) => sum + Number(invoice.paid_amount || 0), 0);
  const outstanding = Math.max(0, billed - paid);
  const overdue = rows.reduce((sum, invoice) => {
    const due = invoice.due_date ? new Date(invoice.due_date + "T23:59:59") : null;
    const unpaid = Math.max(0, Number(invoice.total || 0) - Number(invoice.paid_amount || 0));
    return sum + (due && due < new Date() && unpaid > 0 ? unpaid : 0);
  }, 0);
  const currency = business.currency || "USD";

  return (
    <main className="min-h-screen bg-[#f3f0e8] text-[#171918]">
      <header className="sticky top-0 z-30 border-b border-black/[.08] bg-[#f8f6f0]/90 backdrop-blur-xl">
        <div className="max-w-[1320px] mx-auto h-[72px] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0"><Link href="/dashboard" className="font-display text-xl tracking-tight truncate">{business.name}</Link><span className="hidden sm:block h-5 w-px bg-black/10" /><Link href="/dashboard/customers" className="hidden sm:inline text-[10px] uppercase tracking-[.2em] text-black/35 hover:text-black">Customers</Link></div>
          <div className="flex items-center gap-2"><Link href="/dashboard/customers" className="rounded-full border border-black/10 bg-white/60 px-3 py-2 text-[11px]">All customers</Link><Link href="/dashboard/invoices/new" className="rounded-full bg-[#171918] text-white px-3.5 py-2 text-[11px]">New invoice</Link></div>
        </div>
      </header>

      <section className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mb-8"><div className="flex items-center gap-2 mb-4"><span className="h-1.5 w-1.5 rounded-full bg-[#806f50]" /><span className="text-[10px] uppercase tracking-[.24em] text-[#806f50]">Relationships / Customer record</span></div><h1 className="font-display text-[42px] sm:text-[54px] leading-[.98] tracking-[-.035em]">The customer record should carry the relationship.</h1><p className="text-[15px] leading-6 text-black/50 mt-4 max-w-2xl">Contact context, invoice history, payment position and direct communication belong together so the record stays useful beyond a contact list.</p></div>

        <div className="grid xl:grid-cols-[1fr_360px] gap-5 items-start">
          <section className="rounded-[30px] border border-black/[.08] bg-[#fcfaf5] shadow-[0_24px_90px_rgba(25,24,20,.07)] overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-black/[.07]">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                <div className="flex items-start gap-4 min-w-0"><div className="h-14 w-14 shrink-0 rounded-2xl bg-[#202725] text-white grid place-items-center font-display text-xl">{(customer.name?.trim()[0] || "C").toUpperCase()}</div><div className="min-w-0"><p className="text-[10px] uppercase tracking-[.2em] text-[#806f50]">Customer record</p><h2 className="font-display text-4xl sm:text-5xl tracking-[-.03em] mt-1 truncate">{customer.name}</h2><p className="text-sm text-black/40 mt-2">Customer since {new Date(customer.created_at).toLocaleDateString()}</p></div></div>
                <div className="flex flex-wrap items-center gap-2">{customer.email && <a href={"mailto:" + customer.email} className="rounded-xl bg-[#171918] text-white px-3.5 py-2.5 text-xs">Email</a>}{customer.phone && <a href={"tel:" + customer.phone} className="rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-xs text-black/65">Call</a>}{customer.phone && <a href={"https://wa.me/" + String(customer.phone).replace(/D/g, "")} target="_blank" rel="noreferrer" className="rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-xs text-black/65">WhatsApp</a>}</div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mt-7"><div className="rounded-2xl border border-black/[.08] bg-white/70 p-4"><p className="text-[9px] uppercase tracking-[.18em] text-black/30">Email</p><p className="text-sm font-medium mt-2 break-all">{customer.email || "Not provided"}</p></div><div className="rounded-2xl border border-black/[.08] bg-white/70 p-4"><p className="text-[9px] uppercase tracking-[.18em] text-black/30">Phone / WhatsApp</p><p className="text-sm font-medium mt-2">{customer.phone || "Not provided"}</p></div></div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="flex items-end justify-between gap-4 mb-4"><div><p className="text-[10px] uppercase tracking-[.2em] text-black/30">Financial relationship</p><h2 className="font-display text-2xl mt-1">Invoice history</h2></div><Link href={"/dashboard/invoices?customer=" + customer.id} className="text-xs text-black/45 hover:text-black">View customer invoices ↗</Link></div>
              {!rows.length ? <div className="rounded-[22px] border border-dashed border-black/15 bg-white/50 p-10 text-center"><p className="font-display text-xl">No invoices yet.</p><p className="text-sm text-black/40 mt-2">This customer record is ready for its first commercial document.</p><Link href="/dashboard/invoices/new" className="inline-flex mt-5 rounded-xl bg-[#171918] text-white px-4 py-2.5 text-xs">Create invoice</Link></div> : (
                <div className="rounded-[22px] border border-black/[.08] bg-white overflow-hidden">
                  <div className="hidden md:grid grid-cols-[130px_1fr_140px_150px_120px] gap-4 px-5 py-3 border-b border-black/[.07] bg-[#f7f3eb] text-[9px] uppercase tracking-[.18em] text-black/30"><span>Record</span><span>Status</span><span>Total</span><span>Paid</span><span>Balance</span></div>
                  <div className="divide-y divide-black/[.07]">{rows.map(invoice => {
                    const total = Number(invoice.total || 0); const paidAmount = Number(invoice.paid_amount || 0); const balance = Math.max(0, total - paidAmount);
                    const due = invoice.due_date ? new Date(invoice.due_date + "T23:59:59") : null; const isOverdue = !!due && due < new Date() && balance > 0 && invoice.status !== "draft";
                    const state = isOverdue ? "overdue" : (paidAmount >= total && total > 0 ? "paid" : (paidAmount > 0 ? "partial" : invoice.status));
                    return <Link key={invoice.id} href={"/dashboard/invoices/" + invoice.id} className="group grid md:grid-cols-[130px_1fr_140px_150px_120px] gap-3 md:gap-4 px-5 py-4 hover:bg-[#f7f3eb] transition-colors"><div><p className="font-mono text-[11px] text-black/45">{invoice.invoice_number}</p><p className="text-[10px] text-black/30 mt-1">{invoice.due_date ? "Due " + new Date(invoice.due_date).toLocaleDateString() : "No due date"}</p></div><div><span className={"inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] capitalize " + (STATUS_STYLES[state] || STATUS_STYLES.draft)}>{state === "partial" ? "Partial" : String(state).replace("_", " ")}</span></div><div className="text-sm">{money(total, invoice.currency || currency)}</div><div className="text-sm text-[#2f6b43]">{money(paidAmount, invoice.currency || currency)}</div><div className={"text-sm " + (isOverdue ? "text-[#a04444]" : "text-black/65")}>{money(balance, invoice.currency || currency)}</div></Link>;
                  })}</div>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-3 xl:sticky xl:top-[92px]">
            <div className="rounded-[26px] bg-[#202725] text-white p-6 shadow-[0_24px_80px_rgba(32,39,37,.16)]"><p className="text-[10px] uppercase tracking-[.18em] text-white/40">Relationship position</p><div className="mt-5 space-y-4"><div><p className="text-[10px] uppercase tracking-[.14em] text-white/35">Billed</p><p className="font-display text-2xl mt-1">{money(billed, currency)}</p></div><div className="pt-4 border-t border-white/10"><p className="text-[10px] uppercase tracking-[.14em] text-white/35">Collected</p><p className="font-display text-2xl mt-1">{money(paid, currency)}</p></div><div className="pt-4 border-t border-white/10"><p className="text-[10px] uppercase tracking-[.14em] text-white/35">Outstanding</p><p className="font-display text-2xl mt-1">{money(outstanding, currency)}</p></div></div><div className="mt-5 pt-5 border-t border-white/10"><div className="flex justify-between text-[10px] text-white/40"><span>Collected</span><span>{billed > 0 ? Math.round((paid / billed) * 100) : 0}%</span></div><div className="h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden"><div className="h-full rounded-full bg-white/80" style={{ width: (billed > 0 ? Math.min(100, paid / billed * 100) : 0) + "%" }} /></div></div></div>
            <div className="rounded-[22px] border border-black/[.08] bg-[#eee8da] p-5"><p className="text-[10px] uppercase tracking-[.18em] text-black/35">Attention</p><p className="font-display text-2xl mt-2 text-[#a04444]">{money(overdue, currency)}</p><p className="text-xs text-black/45 mt-1">Currently overdue from this customer.</p></div>
            <div className="rounded-[22px] border border-black/[.08] bg-[#fcfaf5] p-5"><p className="text-[10px] uppercase tracking-[.18em] text-black/35">Next step</p><p className="text-sm leading-5 text-black/60 mt-2">{outstanding > 0 ? "There is still a balance to collect. Use the invoice records above to continue the payment workflow." : "This customer has no outstanding invoice balance."}</p></div>
          </aside>
        </div>
      </section>
    </main>
  );
}