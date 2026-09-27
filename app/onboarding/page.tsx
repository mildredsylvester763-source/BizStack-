"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

const CURRENCIES = ["USD", "NGN", "GBP", "EUR", "KES", "GHS", "INR"];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateBusiness(e: React.FormEvent) {
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

    const { error: insertError } = await supabase.from("businesses").insert({
      owner_id: user.id,
      name: businessName,
      industry,
      currency
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <h1 className="font-display text-2xl text-ink mb-1">
          Tell us about the business
        </h1>
        <p className="text-sm text-ink/60 mb-8">
          This sets up the foundation every module plugs into next.
        </p>

        <form onSubmit={handleCreateBusiness} className="space-y-4">
          <div>
            <label className="block text-sm text-ink/70 mb-1">
              Business name
            </label>
            <input
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full border border-rule rounded-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-vault/25"
            />
          </div>

          <div>
            <label className="block text-sm text-ink/70 mb-1">Industry</label>
            <input
              required
              placeholder="Retail, salon, agency, importer..."
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full border border-rule rounded-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-vault/25"
            />
          </div>

          <div>
            <label className="block text-sm text-ink/70 mb-1">
              Primary currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full border border-rule rounded-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-vault/25"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-alert">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink text-mist py-2 rounded-sm hover:bg-ink/90 disabled:opacity-60"
          >
            {loading ? "Setting up..." : "Set up business"}
          </button>
        </form>
      </div>
    </main>
  );
      }
