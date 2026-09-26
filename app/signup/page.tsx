"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (data.session) {
      router.push("/onboarding");
    } else {
      setConfirmSent(true);
    }
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-noise">
      <section className="hidden lg:flex flex-col justify-between bg-mossDeep text-paper p-12">
        <span className="font-display text-xl">BizStack</span>
        <div>
          <p className="font-display text-3xl leading-snug max-w-sm">
            "Every invoice used to take me twenty minutes. Now I just say
            the words."
          </p>
          <p className="mt-4 text-paper/60 text-sm">
            — a small business, somewhere, running on BizStack
          </p>
        </div>
        <span className="text-paper/40 text-xs">
          One system. Every part of the business.
        </span>
      </section>

      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl text-ink mb-1">
            Create your account
          </h1>
          <p className="text-sm text-ink/60 mb-8">
            One account, every part of the business.
          </p>

          {confirmSent ? (
            <div className="bg-white border border-line rounded-2xl p-6 shadow-soft text-sm text-ink/75 leading-relaxed">
              Check <span className="text-ink font-medium">{email}</span> for
              a confirmation link, then come back and log in.
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-sm text-ink/70 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-line rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-mossDeep/30 focus:border-mossDeep transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm text-ink/70 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-line rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-mossDeep/30 focus:border-mossDeep transition-shadow"
                />
              </div>

              {error && <p className="text-sm text-clay">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-mossDeep text-paper py-3 rounded-xl hover:bg-moss transition-colors disabled:opacity-60 font-medium"
              >
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>
          )}

          <p className="text-sm text-ink/60 mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-mossDeep underline underline-offset-2">
              Log in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
