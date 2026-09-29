import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

async function addCustomer(formData: FormData) {
  "use server";
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
  if (!business) return;
  await supabase.from("customers").insert({
    business_id: business.id,
    name: formData.get("name") as string,
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null
  });
  revalidatePath("/dashboard/customers");
}

export default async function CustomersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id, name").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, email, phone")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  return (
    <section className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl text-text mb-1">Customers</h1>
      <p className="text-textMuted mb-8">Everyone the business sells to.</p>

      <Card className="p-5 mb-8">
        <form action={addCustomer} className="grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-3">
          <Input name="name" required placeholder="Name" />
          <Input name="email" type="email" placeholder="Email (optional)" />
          <Input name="phone" placeholder="Phone (optional)" />
          <Button type="submit">Add</Button>
        </form>
      </Card>

      {!customers || customers.length === 0 ? (
        <EmptyState message="No customers yet — add the first one above." />
      ) : (
        <Card className="divide-y divide-line">
          {customers.map((c) => (
            <div key={c.id} className="px-5 py-4 grid sm:grid-cols-3 gap-2">
              <p className="text-text font-medium">{c.name}</p>
              <p className="text-sm text-textMuted">{c.email || "—"}</p>
              <p className="text-sm text-textMuted">{c.phone || "—"}</p>
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}
