"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { calculateInvoiceTotal } from "@/lib/invoices";
import { createInvoice, type CreateInvoiceInput } from "../actions";

type Customer = {
  id: string;
  name: string;
  email: string | null;
};

type LineItem = {
  id: number;
  description: string;
  quantity: number;
  unit_price: number;
};

const emptyLine = (id: number): LineItem => ({
  id,
  description: "",
  quantity: 1,
  unit_price: 0
});

export default function NewInvoicePage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<LineItem[]>([emptyLine(1)]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function loadCustomers() {
      const { data, error: loadError } = await supabase
        .from("customers")
        .select("id, name, email")
        .order("name", { ascending: true });

      if (!active) {
        return;
      }

      if (loadError) {
        setCustomerError("Unable to load customers: " + loadError.message);
      } else {
        setCustomers((data ?? []) as Customer[]);
        if (data?.[0]) {
          setCustomerId(data[0].id);
        }
      }
      setCustomersLoading(false);
    }

    loadCustomers();
    return () => {
      active = false;
    };
  }, []);

  const total = useMemo(
    () => calculateInvoiceTotal(items.map(({ quantity, unit_price }) => ({ quantity, unit_price }))),
    [items]
  );

  function updateItem(id: number, field: keyof Omit<LineItem, "id">, value: string) {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) {
          return item;
        }
        if (field === "description") {
          return { ...item, description: value };
        }
        return { ...item, [field]: Number(value) };
      })
    );
  }

  function addLine() {
    const nextId = Math.max(...items.map((item) => item.id), 0) + 1;
    setItems((current) => [...current, emptyLine(nextId)]);
  }

  function removeLine(id: number) {
    if (items.length === 1) {
      return;
    }
    setItems((current) => current.filter((item) => item.id !== id));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload: CreateInvoiceInput = {
      customerId,
      dueDate: dueDate || null,
      currency: "USD",
      items: items.map(({ description, quantity, unit_price }) => ({
        description,
        quantity,
        unit_price
      }))
    };

    try {
      const result = await createInvoice(payload);
      router.push("/dashboard/invoices/" + result.invoiceId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create invoice.");
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen">
      <header className="flex flex-col gap-4 border-b border-line px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/dashboard" className="font-display text-lg text-ink hover:text-moss">BizStack</Link>
          <p className="text-xs text-ink/50">New invoice</p>
        </div>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/dashboard/customers" className="text-ink/60 hover:text-ink">Customers</Link>
          <Link href="/dashboard/invoices" className="text-ink/60 hover:text-ink">Invoices</Link>
          <Link href="/dashboard/actions" className="text-ink/60 hover:text-ink">Action Center</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <div className="mb-8">
          <p className="mb-3 text-xs uppercase tracking-[0.18em] text-moss">Module 3</p>
          <h1 className="font-display text-3xl text-ink">New invoice</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink/65">
            Build a clear draft now. You can mark it sent when it is ready to go.
          </p>
        </div>

        {customersLoading ? (
          <div className="border border-line bg-white px-5 py-6 text-sm text-ink/55">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="border border-line bg-white px-5 py-6">
            <h2 className="font-display text-lg text-ink">Add a customer first</h2>
            <p className="mt-2 text-sm text-ink/60">
              An invoice needs a customer to belong to before it can be created.
            </p>
            <Link href="/dashboard/customers" className="mt-4 inline-flex rounded-sm bg-moss px-4 py-2 text-sm text-paper hover:bg-moss/90">
              Add customer
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="border border-line bg-white px-5 py-5">
              <label className="mb-1 block text-sm text-ink/70" htmlFor="customer">
                Customer
              </label>
              <select
                id="customer"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                className="w-full rounded-sm border border-line bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-moss"
              >
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}{customer.email ? " — " + customer.email : ""}
                  </option>
                ))}
              </select>
              {customerError && <p className="mt-2 text-sm text-clay">{customerError}</p>}
            </div>

            <div className="border border-line bg-white px-5 py-5">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg text-ink">Line items</h2>
                  <p className="mt-1 text-sm text-ink/60">Add what the customer is paying for.</p>
                </div>
                <button type="button" onClick={addLine} className="text-sm text-moss hover:text-ink">
                  + Add line
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="grid gap-3 sm:grid-cols-[1fr_110px_140px_auto] sm:items-end">
                    <div>
                      <label className="mb-1 block text-xs text-ink/60">Description</label>
                      <input
                        value={item.description}
                        onChange={(event) => updateItem(item.id, "description", event.target.value)}
                        required
                        className="w-full rounded-sm border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-moss"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-ink/60">Quantity</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(event) => updateItem(item.id, "quantity", event.target.value)}
                        required
                        className="w-full rounded-sm border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-moss"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-ink/60">Unit price (USD)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(event) => updateItem(item.id, "unit_price", event.target.value)}
                        required
                        className="w-full rounded-sm border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-moss"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(item.id)}
                      disabled={items.length === 1}
                      className="pb-2 text-xs text-ink/45 hover:text-clay disabled:invisible"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
                <span className="text-sm text-ink/60">Total</span>
                <span className="font-display text-xl text-ink">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(total)}
                </span>
              </div>
            </div>

            <div className="border border-line bg-white px-5 py-5">
              <label className="mb-1 block text-sm text-ink/70" htmlFor="due-date">
                Due date
              </label>
              <input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="rounded-sm border border-line bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-moss"
              />
            </div>

            {error && <p className="text-sm text-clay" role="alert">{error}</p>}
            <div className="flex items-center justify-between gap-4">
              <Link href="/dashboard/invoices" className="text-sm text-ink/60 hover:text-ink">Cancel</Link>
              <button
                type="submit"
                disabled={saving || !customerId}
                className="rounded-sm bg-moss px-5 py-2.5 text-sm text-paper hover:bg-moss/90 disabled:opacity-60"
              >
                {saving ? "Creating..." : "Create draft invoice"}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
