export type InvoiceLineItem = { quantity: number; unit_price: number; };

export function calculateInvoiceTotal(items: InvoiceLineItem[]): number {
  return items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0);
}

export function calculateOutstanding(total: number, paid: number): number {
  return Math.max(0, Number(total || 0) - Number(paid || 0));
}

export function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export function isOverdue(status: string, dueDate: string | null): boolean {
  if (!dueDate || status === "draft" || status === "paid") return false;
  return new Date(dueDate + (dueDate.length === 10 ? "T23:59:59" : "")) < new Date();
}

export function displayInvoiceStatus(status: string, dueDate: string | null): string {
  return isOverdue(status, dueDate) ? "overdue" : status;
}
