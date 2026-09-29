import type { SupabaseClient } from "@supabase/supabase-js";

type StockAdjustmentResult = {
  product_id: string;
  previous_quantity: number;
  new_quantity: number;
  change: number;
};

export async function adjustStock(
  supabase: SupabaseClient,
  businessId: string,
  productId: string,
  change: number,
  reason: string,
  note?: string
): Promise<StockAdjustmentResult> {
  if (!Number.isFinite(change) || change === 0) {
    throw new Error("Stock adjustment must be a non-zero finite number.");
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, stock_quantity")
    .eq("id", productId)
    .eq("business_id", businessId)
    .single();

  if (productError || !product) {
    throw new Error("Product not found for this business.");
  }

  const previousQuantity = Number(product.stock_quantity);
  const newQuantity = previousQuantity + change;

  if (newQuantity < 0) {
    throw new Error("Stock quantity cannot be negative.");
  }

  const { error: updateError } = await supabase
    .from("products")
    .update({ stock_quantity: newQuantity })
    .eq("id", productId)
    .eq("business_id", businessId);

  if (updateError) {
    throw updateError;
  }

  const { error: movementError } = await supabase
    .from("stock_movements")
    .insert({
      product_id: productId,
      business_id: businessId,
      change,
      reason,
      note: note || null
    });

  if (movementError) {
    throw movementError;
  }

  return {
    product_id: productId,
    previous_quantity: previousQuantity,
    new_quantity: newQuantity,
    change
  };
}
