"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4" aria-hidden="true">
      <path fill="#4285F4" d="M19.6 10.23c0-.68-.06-1.32-.17-1.94H10v3.67h5.39a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.9-1.75 2.98-4.33 2.98-7.25Z" />
      <path fill="#34A853" d="M10 20c2.7 0 4.96-.9 6.62-2.43l-3.23-2.5c-.9.6-2.05.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H1.06v2.59A10 10 0 0 0 10 20Z" />
      <path fill="#FBBC05" d="M4.41 11.9a6 6 0 0 1 0-3.8V5.5H1.06a10 10 0 0 0 0 9l3.35-2.6Z" />
      <path fill="#EA4335" d="M10 3.98c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.6 9.6 0 0 0 10 0 10 10 0 0 0 1.06 5.5l3.35 2.6C5.2 5.74 7.4 3.98 10 3.98Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4" fill="#12182B" aria-hidden="true">
      <path d="M13.9 3.6c.7-.85 1.18-2.02 1.05-3.2-1.02.05-2.26.68-3 1.53-.66.75-1.24 1.96-1.08 3.1 1.13.09 2.28-.57 3.03-1.43ZM17 14.3c-.3.7-.66 1.36-1.1 1.98-.6.85-1.1 1.44-1.48 1.76-.6.55-1.24.83-1.93.85-.5.01-1.1-.14-1.8-.44-.7-.3-1.35-.44-1.93-.44-.6 0-1.26.15-1.98.44-.72.3-1.3.46-1.75.47-.66.03-1.32-.26-1.97-.87-.4-.35-.94-.97-1.58-1.86C.7 15.1.16 13.9.16 12.6c0-1.5.32-2.75.97-3.75.65-1 1.5-1.5 2.55-1.53.5-.01 1.16.16 1.98.5.8.34 1.32.5 1.55.5.17 0 .74-.2 1.7-.58 1.02-.4 1.87-.55 2.55-.46 1.9.15 3.32.9 4.28 2.24-1.7 1.03-2.55 2.47-2.53 4.32.02 1.44.53 2.64 1.53 3.6.46.44.98.78 1.56 1.02-.13.36-.26.7-.4 1.02Z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M20 10a10 10 0 1 0-11.56 9.88v-6.99H5.9V10h2.54V7.8c0-2.5 1.49-3.89 3.77-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V10h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 20 10Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/dashboard");
  }

  async function handleOAuth(provider: "google" | "apple" | "facebook") {
    setError(null);
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-ledger">
      <section className="hidden lg:flex flex-col justify-between bg-vault text-mist p-12">
        <span className="font-display italic text-xl">BizStack</span>
        <p className="font-display text-3xl italic leading-snug max-w-sm">
          "I stopped chasing payments myself. It just happens now."
        </p>
        <span className="text-mist/50 text-xs">
          One system. Every part of the business.
        </span>
      </section>

      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl text-ink mb-1">Welcome back</h1>
          <p className="text-sm text-ink/60 mb-8">Log in to your business.</p>

          <div className="space-y-2.5 mb-6">
            <button
              onClick={() => handleOAuth("google")}
              className="w-full flex items-center justify-center gap-2.5 border border-rule rounded-sm py-2.5 text-sm text-ink hover:bg-mist transition-colors"
            >
              <GoogleIcon />
              Continue with Google
            </button>
            <button
              onClick={() => handleOAuth("facebook")}
              className="w-full flex items-center justify-center gap-2.5 border border-rule rounded-sm py-2.5 text-sm text-ink hover:bg-mist transition-colors"
            >
              <FacebookIcon />
              Continue with Facebook
            </button>
            <button
              onClick={() => handleOAuth("apple")}
              className="w-full flex items-center justify-center gap-2.5 border border-rule rounded-sm py-2.5 text-sm text-ink hover:bg-mist transition-colors"
            >
              <AppleIcon />
              Continue with Apple
            </button>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="h-px bg-rule flex-1" />
            <span className="text-xs text-ink/40">or with email</span>
            <div className="h-px bg-rule flex-1" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-ink/70 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-rule rounded-sm px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-vault/25 focus:border-vault transition-shadow"
              />
            </div>
            <div>
              <label className="block text-sm text-ink/70 mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-rule rounded-sm px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-vault/25 focus:border-vault transition-shadow"
              />
            </div>

            {error && <p className="text-sm text-alert">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink text-mist py-2.5 rounded-sm hover:bg-vaultDeep transition-colors disabled:opacity-60 font-medium"
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>

          <p className="text-sm text-ink/60 mt-6">
            No account yet?{" "}
            <Link href="/signup" className="text-vault underline underline-offset-2">
              Create one
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
