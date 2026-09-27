import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user!.id)
    .single();

  if (!business) redirect("/onboarding");

  return (
    <main className="min-h-screen bg-ledger">
      <header className="border-b border-rule bg-white">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <p className="font-display text-lg text-ink">{business.name}</p>
            <p className="text-xs text-ink/45">
              {business.industry} · {business.currency}
            </p>
          </div>

          <nav className="hidden sm:flex items-center gap-1 text-sm">
            <Link href="/dashboard/customers" className="text-ink/65 hover:text-ink px-3 py-2">
              Customers
            </Link>
            <Link href="/dashboard/invoices" className="text-ink/65 hover:text-ink px-3 py-2">
              Invoices
            </Link>
            <Link href="/dashboard/actions" className="text-ink/65 hover:text-ink px-3 py-2">
              Action Center
            </Link>
            <Link href="/dashboard/settings/automation" className="text-ink/65 hover:text-ink px-3 py-2">
              Automation
            </Link>
          </nav>

          <form action="/auth/sign-out" method="post">
            <button className="text-sm text-ink/45 hover:text-ink px-3 py-2">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="font-display text-3xl text-ink mb-2">Foundation is live.</h1>
        <p className="text-ink/65 max-w-lg leading-relaxed">
          Accounts, business setup, and the database are wired up — this is
          where invoicing, CRM, and the rest of the platform get added next.
        </p>

        <div className="mt-10 grid sm:grid-cols-2 gap-px bg-rule border border-rule max-w-2xl">
          <Link href="/dashboard/customers" className="bg-white p-6 hover:bg-mist transition-colors">
            <h3 className="font-display text-lg text-ink mb-1">Customers</h3>
            <p className="text-sm text-ink/60">Everyone the business sells to.</p>
          </Link>
          <Link href="/dashboard/invoices" className="bg-white p-6 hover:bg-mist transition-colors">
            <h3 className="font-display text-lg text-ink mb-1">Invoices</h3>
            <p className="text-sm text-ink/60">Create, send, and track what's owed.</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
