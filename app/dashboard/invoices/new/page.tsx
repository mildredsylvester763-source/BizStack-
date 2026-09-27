"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { calculateInvoiceTotal } from "@/lib/invoices";

type Customer = { id: string; name: string };
type LineItem = { description: string; quantity: number; unit_price: number };

export default function NewInvoicePage() {
  const router = useRouter();
  const supabase = createClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unit_price: 0 }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCustomers() {
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

      const { data } = await supabase
        .from("customers")
        .select("id, name")
        .eq("business_id", business.id)
        .order("name");

      setCustomers(data ?? []);
    }
    loadCustomers();
  }, [supabase]);

  function updateItem(index: number, field: keyof LineItem, value: string) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: field === "description" ? value : Number(value)
            }
          : item
      )
    );
  }

  function addLine() {
    setItems((prev) => [...prev, { description: "", quantity: 1, unit_price: 0 }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Your session expired — please log in again.");
      setLoading(false);
      return;
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id, currency")
      .eq("owner_id", user.id)
      .single();
    if (!business) {
      setError("Business not found.");
      setLoading(false);
      return;
    }

    const { count } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id);

    const invoiceNumber = `INV-${String((count ?? 0) + 1).padStart(4, "0")}`;

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        business_id: business.id,
        customer_id: customerId || null,
        invoice_number: invoiceNumber,
        status: "draft",
        due_date: dueDate || null,
        currency: business.currency
      })
      .select()
      .single();

    if (invoiceError || !invoice) {
      setError(invoiceError?.message ?? "Could not create invoice.");
      setLoading(false);
      return;
    }

    const itemRows = items
      .filter((item) => item.description.trim() !== "")
      .map((item) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price
      }));

    if (itemRows.length > 0) {
      await supabase.from("invoice_items").insert(itemRows);
    }

    const total = calculateInvoiceTotal(items);
    const customerName = customers.find((c) => c.id === customerId)?.name ?? "a customer";

    await supabase.from("events").insert({
      business_id: business.id,
      event_type: "invoice.created",
      summary: `Invoice ${invoiceNumber} created for ${customerName} — ${total.toFixed(2)} ${business.currency}`,
      evidence: { invoice_id: invoice.id, total, currency: business.currency },
      status: "info"
    });

    router.push(`/dashboard/invoices/${invoice.id}`);
  }

  const total = calculateInvoiceTotal(items);

  return (
    <main className="min-h-screen bg-ledger">
      <header className="border-b border-rule bg-white">
        <div className="max-w-2xl mx-auto px-6 py-5">
          <Link href="/dashboard/invoices" className="text-sm text-ink/45 hover:text-ink">
            ← Back to invoices
          </Link>
        </div>
      </header>

      <section className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="font-display text-3xl text-ink mb-8">New invoice</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm text-ink/70 mb-1.5">Customer</label>
            {customers.length === 0 ? (
              <p className="text-sm text-ink/50">
                No customers yet —{" "}
                <Link href="/dashboard/customers" className="text-vault underline">
                  add one first
                </Link>
                .
              </p>
            ) : (
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
                className="w-full border border-rule px-3 py-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-vault/25"
              >
                <option value="">Select a customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm text-ink/70 mb-1.5">Due date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-rule px-3 py-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-vault/25"
            />
          </div>

          <div>
            <label className="block text-sm text-ink/70 mb-2">Line items</label>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-[1fr_70px_90px] gap-2">
                  <input
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateItem(i, "description", e.target.value)}
                    className="border border-rule px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vault/25"
                  />
                  <input
                    type="number"
                    min={0}
                    value={item.quantity}
                    onChange={(e) => updateItem(i, "quantity", e.target.value)}
                    className="border border-rule px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vault/25"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updateItem(i, "unit_price", e.target.value)}
                    className="border border-rule px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vault/25"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addLine}
              className="mt-2 text-sm text-vault underline underline-offset-2"
            >
              + Add line
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-rule pt-4">
            <span className="text-ink/60 text-sm">Total</span>
            <span className="font-display text-2xl text-ink">{total.toFixed(2)}</span>
          </div>

          {error && <p className="text-sm text-alert">{error}</p>}

          <button
            type="submit"
            disabled={loading || customers.length === 0}
            className="w-full bg-ink text-mist py-3 hover:bg-vaultDeep transition-colors disabled:opacity-50 font-medium"
          >
            {loading ? "Creating..." : "Create invoice"}
          </button>
        </form>
      </section>
    </main>
  );
}
