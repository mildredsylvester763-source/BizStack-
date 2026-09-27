export type InvoiceLineItem = {
  quantity: number;
  unit_price: number;
};

export function calculateInvoiceTotal(items: InvoiceLineItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
}

export function isOverdue(status: string, dueDate: string | null): boolean {
  if (status !== "sent" || !dueDate) return false;
  return new Date(dueDate) < new Date();
}