import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user!.id)
    .single();

  if (!business) {
    redirect("/onboarding");
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-line px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/dashboard" className="font-display text-lg text-ink hover:text-moss">
            {business.name}
          </Link>
          <p className="text-xs text-ink/50">
            {business.industry} · {business.currency}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard/actions" className="text-ink/60 hover:text-ink">
              Action Center
            </Link>
            <Link href="/dashboard/settings/automation" className="text-ink/60 hover:text-ink">
              Automation Settings
            </Link>
          </nav>
          <form action="/auth/sign-out" method="post">
            <button className="text-sm text-ink/60 hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="font-display text-2xl text-ink mb-2">
          Foundation is live.
        </h1>
        <p className="text-ink/70 max-w-lg">
          Accounts, business setup, and the database are wired up. This is
          where invoicing, CRM, inventory, and the rest of the 170 modules
          get added next, one at a time, on top of this same page.
        </p>
      </section>
    </main>
  );
}
