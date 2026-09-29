import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { adjustStock } from "@/lib/inventory";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";

async function recordAdjustment(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const productId = formData.get("product_id") as string;
  const businessId = formData.get("business_id") as string;
  const change = Number(formData.get("change"));
  const note = formData.get("note") as string;
  if (change !== 0) {
    await adjustStock(supabase, businessId, productId, change, "adjustment", note || undefined);
  }
  revalidatePath(`/dashboard/products/${productId}`);
}

export default async function ProductDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id, name, currency").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const { data: product } = await supabase.from("products").select("*").eq("id", id).eq("business_id", business.id).single();
  if (!product) redirect("/dashboard/products");
  const { data: movements } = await supabase
    .from("stock_movements")
    .select("id, change, reason, note, created_at")
    .eq("product_id", product.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const low = product.low_stock_threshold !== null && product.stock_quantity <= product.low_stock_threshold;

  return (
    <section className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl text-text">{product.name}</h1>
          {product.sku && <p className="text-sm text-textMuted mt-1">{product.sku}</p>}
        </div>
        {low && <span className="text-xs px-2.5 py-1 rounded-full bg-danger/15 text-danger">Low stock</span>}
      </div>

      <Card className="p-6 mb-6 grid sm:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-textMuted uppercase tracking-wide mb-1">Sell price</p>
          <p className="font-display text-xl text-text">{product.unit_price.toFixed(2)} {business.currency}</p>
        </div>
        <div>
          <p className="text-xs text-textMuted uppercase tracking-wide mb-1">Cost price</p>
          <p className="font-display text-xl text-text">{product.cost_price ? `${product.cost_price.toFixed(2)} ${business.currency}` : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-textMuted uppercase tracking-wide mb-1">In stock</p>
          <p className={`font-display text-xl ${low ? "text-danger" : "text-text"}`}>{product.stock_quantity} {product.unit}</p>
        </div>
      </Card>

      <Card className="p-5 mb-10">
        <p className="text-sm text-textMuted mb-3">Adjust stock</p>
        <form action={recordAdjustment} className="grid sm:grid-cols-[100px_1fr_auto] gap-3">
          <input type="hidden" name="product_id" value={product.id} />
          <input type="hidden" name="business_id" value={business.id} />
          <Input name="change" type="number" step="1" placeholder="+10 or -3" required />
          <Input name="note" placeholder="Reason (optional)" />
          <Button type="submit">Apply</Button>
        </form>
        <p className="text-xs text-textMuted mt-2">Positive adds stock, negative removes it.</p>
      </Card>

      <h2 className="text-sm text-textMuted font-medium mb-3">Stock history</h2>
      {!movements || movements.length === 0 ? (
        <EmptyState message="No stock changes recorded yet." />
      ) : (
        <Card className="divide-y divide-line">
          {movements.map((m) => (
            <div key={m.id} className="p-4 flex items-center justify-between text-sm">
              <div>
                <span className={m.change > 0 ? "text-success" : "text-danger"}>{m.change > 0 ? "+" : ""}{m.change}</span>
                <span className="text-textMuted ml-2 capitalize">{m.reason}</span>
                {m.note && <span className="text-textMuted ml-2">— {m.note}</span>}
              </div>
              <span className="text-xs text-textMuted">{new Date(m.created_at).toLocaleString()}</span>
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}
