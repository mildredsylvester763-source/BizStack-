import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

const NAV = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/ai-assistant", label: "AI Assistant" },
  { href: "/dashboard/website-builder", label: "Website Builder" },
  { href: "/dashboard/invoices", label: "Invoices" },
  { href: "/dashboard/customers", label: "Customers" },
  { href: "/dashboard/products", label: "Inventory" },
  { href: "/dashboard/accounting", label: "Accounting" },
  { href: "/dashboard/marketing", label: "Marketing" },
  { href: "/dashboard/actions", label: "Automation" },
  { href: "/dashboard/integrations", label: "Integrations" },
  { href: "/dashboard/settings", label: "Settings" }
];

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, industry")
    .eq("owner_id", user.id)
    .single();
  if (!business) redirect("/onboarding");

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-line bg-surface/60 backdrop-blur-sm">
        <div className="px-5 py-5 border-b border-line">
          <span className="font-display italic text-lg text-text">BizStack</span>
          <p className="text-xs text-textMuted mt-0.5">Your business, powered by AI</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded-lg text-sm text-textMuted hover:text-text hover:bg-surfaceAlt transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-line">
          <p className="text-sm text-text truncate">{business.name}</p>
          <p className="text-xs text-textMuted">{business.industry}</p>
          <form action="/auth/sign-out" method="post" className="mt-2">
            <button className="text-xs text-textMuted hover:text-text">Sign out</button>
          </form>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="md:hidden border-b border-line bg-surface/80 px-4 py-3 flex items-center justify-between">
          <span className="font-display italic text-text">BizStack</span>
          <span className="text-xs text-textMuted">{business.name}</span>
        </header>
        {children}
      </div>
    </div>
  );
}
