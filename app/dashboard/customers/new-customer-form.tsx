"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCustomer } from "./actions";

export default function NewCustomerForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    const form = event.currentTarget;
    const result = await createCustomer(new FormData(form));

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    form.reset();
    setMessage("Customer added.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="border border-line bg-white px-5 py-5">
      <div className="mb-5">
        <h2 className="font-display text-lg text-ink">Add a customer</h2>
        <p className="mt-1 text-sm text-ink/60">
          Keep the people you serve in one place for invoices and follow-ups.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm text-ink/70" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            className="w-full rounded-sm border border-line bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-moss"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-ink/70" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="w-full rounded-sm border border-line bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-moss"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-ink/70" htmlFor="phone">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            className="w-full rounded-sm border border-line bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-moss"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-sm bg-moss px-4 py-2 text-sm text-paper hover:bg-moss/90 disabled:opacity-60"
        >
          {saving ? "Adding..." : "Add customer"}
        </button>
        {message && <p className="text-sm text-moss" role="status">{message}</p>}
        {error && <p className="text-sm text-clay" role="alert">{error}</p>}
      </div>
    </form>
  );
}
