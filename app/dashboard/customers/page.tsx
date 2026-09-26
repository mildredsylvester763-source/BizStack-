import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import NewCustomerForm from "./new-customer-form";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
};

export default async function CustomersPage() {
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

  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, name, email, phone, created_at")
    .eq("business_id", business.id)
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Unable to load customers: " + error.message);
  }

  const customerRows = (customers ?? []) as Customer[];

  return (
    <main className="min-h-screen">
      <header className="flex flex-col gap-4 border-b border-line px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/dashboard" className="font-display text-lg text-ink hover:text-moss">
            {business.name}
          </Link>
          <p className="text-xs text-ink/50">Customers</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/dashboard/invoices" className="text-ink/60 hover:text-ink">Invoices</Link>
            <Link href="/dashboard/actions" className="text-ink/60 hover:text-ink">Action Center</Link>
            <Link href="/dashboard/settings/automation" className="text-ink/60 hover:text-ink">
              Automation Settings
            </Link>
          </nav>
          <form action="/auth/sign-out" method="post">
            <button className="text-sm text-ink/60 hover:text-ink">Sign out</button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.18em] text-moss">Module 3</p>
            <h1 className="font-display text-3xl text-ink">Customers</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-ink/65">
              The people your business serves, ready for invoicing and future follow-up.
            </p>
          </div>
          <Link href="/dashboard/invoices" className="text-sm text-moss hover:text-ink">
            View invoices →
          </Link>
        </div>

        <NewCustomerForm />

        <div className="mt-10 overflow-hidden border border-line bg-white">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-lg text-ink">Customer list</h2>
          </div>
          {customerRows.length === 0 ? (
            <p className="px-5 py-8 text-sm text-ink/55">
              No customers yet. Add the first one above to start creating invoices.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-ink/45">
                  <tr>
                    <th className="px-5 py-3 font-normal">Name</th>
                    <th className="px-5 py-3 font-normal">Email</th>
                    <th className="px-5 py-3 font-normal">Phone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {customerRows.map((customer) => (
                    <tr key={customer.id}>
                      <td className="px-5 py-4 text-ink">{customer.name}</td>
                      <td className="px-5 py-4 text-ink/65">{customer.email || "—"}</td>
                      <td className="px-5 py-4 text-ink/65">{customer.phone || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
