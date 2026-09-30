import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import Link from "next/link";

async function addCustomer(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
  if (!business) return;
  await supabase.from("customers").insert({ business_id: business.id, name: formData.get("name") as string, email: (formData.get("email") as string)||null, phone: (formData.get("phone") as string)||null });
  revalidatePath("/dashboard/customers");
}

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id, name").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");

  const { data: customers } = await supabase.from("customers").select("id, name, email, phone, created_at").eq("business_id", business.id).order("created_at", { ascending: false });
  const { data: invoices } = await supabase.from("invoices").select("id, customer_id, status").eq("business_id", business.id);

  const totalCount = (customers ?? []).length;
  const invoiceMap: Record<string, number> = {};
  for (const inv of invoices ?? []) {
    if (inv.customer_id) invoiceMap[inv.customer_id] = (invoiceMap[inv.customer_id] ?? 0) + 1;
  }

  const COLORS = ["#5B6EF5","#8B5CF6","#22C55E","#F5A524","#EF4444","#06B6D4","#EC4899","#14B8A6"];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold text-white">Customers</h1>
          <p className="text-sm text-textMuted mt-0.5">Manage your customers, track progress and build lasting relationships.</p>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{background:"#5B6EF5"}}>+ Add Customer</button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-surface border border-line rounded-xl p-4"><p className="text-xs text-textMuted mb-1">Total Customers</p><p className="text-2xl font-bold text-white">{totalCount}</p></div>
        <div className="bg-surface border border-line rounded-xl p-4"><p className="text-xs text-textMuted mb-1">Active</p><p className="text-2xl font-bold text-white">{totalCount}</p></div>
        <div className="bg-surface border border-line rounded-xl p-4"><p className="text-xs text-textMuted mb-1">New This Month</p><p className="text-2xl font-bold text-white">{(customers ?? []).filter(c => new Date(c.created_at) > new Date(Date.now() - 30*86400000)).length}</p></div>
      </div>

      <div className="bg-surface border border-line rounded-xl overflow-hidden mb-6">
        <div className="flex items-center gap-3 p-4 border-b border-line">
          <input placeholder="Search customers..." className="flex-1 bg-bg border border-line rounded-lg px-3 py-2 text-sm text-text placeholder:text-textMuted focus:outline-none focus:border-primary"/>
          <select className="bg-bg border border-line text-textMuted text-sm rounded-lg px-3 py-2 focus:outline-none"><option>All Customers</option></select>
          <select className="bg-bg border border-line text-textMuted text-sm rounded-lg px-3 py-2 focus:outline-none"><option>Newest</option></select>
          <button className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{background:"#5B6EF5"}}>+ Add Customer</button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-line">
              <th className="px-4 py-3 text-left text-xs font-medium text-textMuted">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-textMuted">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-textMuted">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-textMuted">Total Invoices</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-textMuted">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-textMuted">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {!(customers ?? []).length && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-textMuted">No customers yet.</td></tr>}
            {(customers ?? []).map((c, i) => (
              <tr key={c.id} className="hover:bg-white/3">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{background: COLORS[i % COLORS.length]}}>{c.name.charAt(0).toUpperCase()}</div>
                    <span className="text-sm font-medium text-text">{c.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-textMuted">{c.email ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-textMuted">{c.phone ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-textMuted">{invoiceMap[c.id] ?? 0}</td>
                <td className="px-4 py-3"><span className="text-xs px-2.5 py-1 rounded-full" style={{background:"rgba(34,197,94,0.15)",color:"#22C55E"}}>Active</span></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Link href={`/dashboard/invoices/new`} className="text-[11px] px-2 py-1 rounded bg-surface border border-line text-textMuted hover:text-white">Create Invoice</Link>
                    <button className="text-textMuted hover:text-white text-lg leading-none ml-1">...</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-surface border border-line rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Add New Customer</h2>
        <form action={addCustomer} className="grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-3">
          <input name="name" required placeholder="Full name" className="bg-bg border border-line rounded-lg px-3 py-2 text-sm text-text placeholder:text-textMuted focus:outline-none focus:border-primary"/>
          <input name="email" type="email" placeholder="Email address" className="bg-bg border border-line rounded-lg px-3 py-2 text-sm text-text placeholder:text-textMuted focus:outline-none focus:border-primary"/>
          <input name="phone" placeholder="Phone number" className="bg-bg border border-line rounded-lg px-3 py-2 text-sm text-text placeholder:text-textMuted focus:outline-none focus:border-primary"/>
          <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{background:"#5B6EF5"}}>Add</button>
        </form>
      </div>
    </div>
  );
}
