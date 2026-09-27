import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

async function addCustomer(formData: FormData) {
  "use server";
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!business) return;

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;

  await supabase.from("customers").insert({
    business_id: business.id,
    name,
    email: email || null,
    phone: phone || null
  });

  revalidatePath("/dashboard/customers");
}

export default async function CustomersPage() {
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

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, email, phone, created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-ledger">
      <header className="border-b border-rule bg-white">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/dashboard" className="font-display text-lg text-ink">
            {business.name}
          </Link>
          <Link href="/dashboard" className="text-sm text-ink/45 hover:text-ink">
            Back to dashboard
          </Link>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="font-display text-3xl text-ink mb-1">Customers</h1>
        <p className="text-ink/60 mb-8">Everyone the business sells to.</p>

        <form
          action={addCustomer}
          className="bg-white border border-rule p-5 mb-10 grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-3"
        >
          <input
            name="name"
            required
            placeholder="Name"
            className="border border-rule px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-vault/25"
          />
          <input
            name="email"
            type="email"
            placeholder="Email (optional)"
            className="border border-rule px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-vault/25"
          />
          <input
            name="phone"
            placeholder="Phone (optional)"
            className="border border-rule px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-vault/25"
          />
          <button className="bg-ink text-mist px-5 py-2.5 text-sm font-medium hover:bg-vaultDeep transition-colors">
            Add
          </button>
        </form>

        {!customers || customers.length === 0 ? (
          <p className="text-sm text-ink/40">No customers yet — add the first one above.</p>
        ) : (
          <div className="divide-y divide-rule border-t border-b border-rule">
            {customers.map((c) => (
              <div key={c.id} className="py-4 grid sm:grid-cols-3 gap-2">
                <p className="text-ink font-medium">{c.name}</p>
                <p className="text-sm text-ink/60">{c.email || "—"}</p>
                <p className="text-sm text-ink/60">{c.phone || "—"}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
