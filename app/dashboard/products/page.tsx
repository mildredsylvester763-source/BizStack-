import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";

async function addProduct(formData: FormData) {
  "use server";
  const supabase = await createClient();

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

  await supabase.from("products").insert({
    business_id: business.id,
    name: formData.get("name") as string,
    sku: (formData.get("sku") as string) || null,
    unit: (formData.get("unit") as string) || "unit",
    unit_price: Number(formData.get("unit_price")) || 0,
    cost_price: formData.get("cost_price") ? Number(formData.get("cost_price")) : null,
    stock_quantity: Number(formData.get("stock_quantity")) || 0,
    low_stock_threshold: formData.get("low_stock_threshold")
      ? Number(formData.get("low_stock_threshold"))
      : 5
  });

  revalidatePath("/dashboard/products");
}

export default async function ProductsPage() {
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, currency")
    .eq("owner_id", user.id)
    .single();
  if (!business) redirect("/onboarding");

  const { data: products } = await supabase
    .from("products")
    .select("id, name, sku, unit_price, stock_quantity, low_stock_threshold, is_active")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  const rows = products ?? [];

  return (
    <main className="min-h-screen bg-ledger">
      <PageHeader businessName={business.name} />

      <section className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="font-display text-3xl text-ink mb-1">Products</h1>
        <p className="text-ink/60 mb-8">What the business sells, and what's left of it.</p>

        <form
          action={addProduct}
          className="bg-white border border-rule p-5 mb-10 grid sm:grid-cols-3 gap-3"
        >
          <Input name="name" required label="Name" />
          <Input name="sku" label="SKU (optional)" />
          <Input name="unit" label="Unit" placeholder="unit, kg, box..." defaultValue="unit" />
          <Input name="unit_price" type="number" step="0.01" min={0} required label="Sell price" />
          <Input name="cost_price" type="number" step="0.01" min={0} label="Cost price (optional)" />
          <Input name="stock_quantity" type="number" min={0} label="Starting stock" defaultValue={0} />
          <Input
            name="low_stock_threshold"
            type="number"
            min={0}
            label="Low-stock alert at"
            defaultValue={5}
          />
          <div className="sm:col-span-3">
            <Button type="submit">Add product</Button>
          </div>
        </form>

        {rows.length === 0 ? (
          <EmptyState message="No products yet — add the first one above." />
        ) : (
          <div className="divide-y divide-rule border-t border-b border-rule">
            {rows.map((p) => {
              const low =
                p.low_stock_threshold !== null && p.stock_quantity <= p.low_stock_threshold;
              return (
                <Link
                  key={p.id}
                  href={`/dashboard/products/${p.id}`}
                  className="py-4 grid sm:grid-cols-[1fr_100px_90px_100px] gap-3 items-center hover:bg-white transition-colors -mx-2 px-2"
                >
                  <div>
                    <p className="text-ink">{p.name}</p>
                    {p.sku && <p className="text-xs text-ink/40">{p.sku}</p>}
                  </div>
                  <span className="text-sm text-ink/70">
                    {p.unit_price.toFixed(2)} {business.currency}
                  </span>
                  <span className={`text-sm ${low ? "text-alert font-medium" : "text-ink/70"}`}>
                    {p.stock_quantity} in stock
                  </span>
                  {low && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-alert/10 text-alert text-center">
                      Low stock
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
