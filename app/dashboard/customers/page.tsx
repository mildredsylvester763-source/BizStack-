import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

async function addCustomer(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
  if (!business) return;

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim() || null;
  const phone = String(formData.get("phone") || "").trim() || null;
  if (!name) return;

  await supabase.from("customers").insert({ business_id: business.id, name, email, phone });
  revalidatePath("/dashboard/customers");
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
}

export default async function CustomersPage() {
  const supabase = await await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase.from("businesses").select("id, name, currency").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");

  const [{ data: customers }, { data: invoices }] = await Promise.all([
    supabase.from("customers").select("id, name, email, phone, created_at").eq("business_id", business.id).order("created_at", { ascending: false }),
    supabase.from("invoices").select("customer_id, status, total, paid_amount, due_date, currency").eq("business_id", business.id)
  ]);

  const customerStats = new Map<string, { billed: number; paid: number; outstanding: number; overdue: number; invoices: number }>();
  for (const invoice of invoices ?? []) {
    if (!invoice.customer_id) continue;
    const current = customerStats.get(invoice.customer_id) ?? { billed: 0, paid: 0, outstanding: 0, overdue: 0, invoices: 0 };
    const total = Number(invoice.total || 0);
    const paid = Number(invoice.paid_amount || 0);
    current.billed += total;
    current.paid += paid;
    current.outstanding += Math.max(0, total - paid);
    current.invoices += 1;
    if (invoice.due_date && new Date(invoice.due_date + "T23:59:59") < new Date() && total > paid) current.overdue += Math.max(0, total - paid);
    customerStats.set(invoice.customer_id, current);
  }

  const rows = (customers ?? []).map((customer) => ({
    ...customer,
    stats: customerStats.get(customer.id) ?? { billed: 0, paid: 0, outstanding: 0, overdue: 0, invoices: 0 }
  }));

  const totalCustomers = rows.length;
  const activeCustomers = rows.filter(c => c.stats.invoices > 0).length;
  const receivables = rows.reduce((n, c) => n + c.stats.outstanding, 0);
  const overdue = rows.reduce((n, c) => n + c.stats.overdue, 0);

  return (
    <main className="min-h-screen bg-[#f4f1ea] text-[#151817]">
      <header className="border-b border-black/10 bg-[#fbfaf7]/95 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <Link href="/dashboard" className="font-display text-lg text-ink">{business.name}</Link>
          <Link href="/dashboard" className="text-sm text-ink/45 hover:text-ink">Back to dashboard</Link>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-8">
          <div><p className="text-[10px] uppercase tracking-[.2em] text-[#7c6f58] mb-2">Relationships · Customer Studio</p><h1 className="font-display text-4xl sm:text-5xl tracking-tight text-[#151817] mb-2">Customers are more than contacts.</h1><p className="text-[#151817]/55 max-w-2xl">See the commercial relationship: invoices, payments, outstanding balance and direct communication from one living customer record.</p></div>
          <span className="rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-xs text-black/50">{totalCustomers} customer{totalCustomers===1?"":"s"}</span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <div className="rounded-2xl bg-white border border-black/10 p-5 shadow-[0_12px_40px_rgba(20,20,16,.04)]"><p className="text-xs text-ink/45">Customers</p><p className="text-2xl font-display text-ink mt-1">{totalCustomers}</p></div>
          <div className="bg-white border border-rule p-4"><p className="text-xs text-ink/45">With invoices</p><p className="text-2xl font-display text-ink mt-1">{activeCustomers}</p></div>
          <div className="bg-white border border-rule p-4"><p className="text-xs text-ink/45">Receivables</p><p className="text-2xl font-display text-ink mt-1">{money(receivables, business.currency || "USD")}</p></div>
          <div className="bg-white border border-rule p-4"><p className="text-xs text-ink/45">Overdue</p><p className="text-2xl font-display text-alert mt-1">{money(overdue, business.currency || "USD")}</p></div>
        </div>

        <form action={addCustomer} className="rounded-[24px] bg-[#fffdf9] border border-black/10 p-5 sm:p-6 mb-8 grid sm:grid-cols-[1.2fr_1fr_1fr_auto] gap-3 shadow-[0_18px_60px_rgba(20,20,16,.06)]"><div className="sm:col-span-4 mb-1"><p className="text-[10px] uppercase tracking-[.16em] text-black/35">Quick add</p><p className="text-sm text-black/55 mt-1">Create the customer record first; invoices and communication can attach to it immediately.</p></div>
          <input name="name" required placeholder="Customer / company name" className="border border-rule px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-vault/25" />
          <input name="email" type="email" placeholder="Email" className="border border-rule px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-vault/25" />
          <input name="phone" placeholder="Phone / WhatsApp" className="border border-rule px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-vault/25" />
          <button className="rounded-xl bg-[#151817] text-white px-5 py-2.5 text-sm font-medium">Add customer</button>
        </form>

        {!rows.length ? <p className="text-sm text-ink/40">No customers yet.</p> : (
          <div className="rounded-[28px] bg-[#fffdf9] border border-black/10 overflow-hidden shadow-[0_24px_80px_rgba(20,20,16,.07)]">
            <div className="hidden md:grid grid-cols-[1.5fr_1.2fr_1fr_1fr_1fr] gap-4 px-5 py-3 bg-[#f7f3eb] border-b border-black/10 text-[10px] uppercase tracking-[.16em] text-black/35">
              <span>Customer</span><span>Contact</span><span>Invoices</span><span>Paid</span><span>Outstanding</span>
            </div>
            <div className="divide-y divide-black/10">
              {rows.map((c) => (
                <Link href={"/dashboard/customers/" + c.id} key={c.id} className="group grid md:grid-cols-[1.5fr_1.2fr_1fr_1fr_1fr] gap-3 md:gap-4 px-5 py-5 hover:bg-[#f7f3eb] transition-colors">
                  <div><p className="font-medium text-ink">{c.name}</p><p className="text-xs text-ink/40 mt-1">Added {new Date(c.created_at).toLocaleDateString()} · Open profile</p></div>
                  <div className="text-sm text-ink/60"><p>{c.email || "No email"}</p><p>{c.phone || "No phone"}</p></div>
                  <div className="text-sm text-ink/60">{c.stats.invoices}</div>
                  <div className="text-sm text-vault">{money(c.stats.paid, business.currency || "USD")}</div>
                  <div className="text-sm"><span className={c.stats.overdue > 0 ? "text-alert" : "text-ink"}>{money(c.stats.outstanding, business.currency || "USD")}</span>{c.stats.overdue > 0 && <p className="text-xs text-alert mt-1">Overdue {money(c.stats.overdue, business.currency || "USD")}</p>}</div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}