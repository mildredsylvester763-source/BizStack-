import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

async function addProduct(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
  if (!business) return;
  await supabase.from("products").insert({
    business_id: business.id,
    name: formData.get("name") as string,
    sku: (formData.get("sku") as string) || null,
    unit: (formData.get("unit") as string) || "unit",
    unit_price: Number(formData.get("unit_price")) || 0,
    cost_price: formData.get("cost_price") ? Number(formData.get("cost_price")) : null,
    stock_quantity: Number(formData.get("stock_quantity")) || 0,
    low_stock_threshold: formData.get("low_stock_threshold") ? Number(formData.get("low_stock_threshold")) : 5
  });
  revalidatePath("/dashboard/products");
}

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id, name, currency").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const { data: products } = await supabase
    .from("products")
    .select("id, name, sku, unit_price, stock_quantity, low_stock_threshold")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });
  const rows = products ?? [];

  return (
    <section className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl text-text mb-1">Inventory</h1>
      <p className="text-textMuted mb-8">What the business sells, and what's left of it.</p>

      <Card className="p-5 mb-8">
        <form action={addProduct} className="grid sm:grid-cols-3 gap-3">
          <Input name="name" required label="Name" />
          <Input name="sku" label="SKU (optional)" />
          <Input name="unit" label="Unit" defaultValue="unit" />
          <Input name="unit_price" type="number" step="0.01" min={0} required label="Sell price" />
          <Input name="cost_price" type="number" step="0.01" min={0} label="Cost price (optional)" />
          <Input name="stock_quantity" type="number" min={0} label="Starting stock" defaultValue={0} />
          <Input name="low_stock_threshold" type="number" min={0} label="Low-stock alert at" defaultValue={5} />
          <div className="sm:col-span-3"><Button type="submit">Add product</Button></div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState message="No products yet — add the first one above." />
      ) : (
        <Card className="divide-y divide-line">
          {rows.map((p) => {
            const low = p.low_stock_threshold !== null && p.stock_quantity <= p.low_stock_threshold;
            return (
              <Link key={p.id} href={`/dashboard/products/${p.id}`} className="px-5 py-4 grid sm:grid-cols-[1fr_100px_100px_90px] gap-3 items-center hover:bg-surfaceAlt transition-colors">
                <div>
                  <p className="text-text">{p.name}</p>
                  {p.sku && <p className="text-xs text-textMuted">{p.sku}</p>}
                </div>
                <span className="text-sm text-textMuted">{p.unit_price.toFixed(2)} {business.currency}</span>
                <span className={`text-sm ${low ? "text-danger font-medium" : "text-textMuted"}`}>{p.stock_quantity} in stock</span>
                {low && <span className="text-xs px-2.5 py-1 rounded-full bg-danger/15 text-danger text-center">Low stock</span>}
              </Link>
            );
          })}
        </Card>
      )}
    </section>
  );
}
