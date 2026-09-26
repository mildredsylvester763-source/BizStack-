export function calculateInvoiceTotal(
  items: { quantity: number; unit_price: number }[]
): number {
  return items.reduce(
    (total, item) => total + item.quantity * item.unit_price,
    0
  );
}
