import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

const NAV = [
  { label: "Home", href: "/dashboard", icon: "⌂" },
  { label: "AI Assistant", href: "/dashboard/ai-assistant", icon: "✦" },
  { label: "AI Builder", href: "/dashboard/ai-builder", icon: "◈" },
  { label: "Invoices", href: "/dashboard/invoices", icon: "▤" },
  { label: "Customers", href: "/dashboard/customers", icon: "◎" },
  { label: "Inventory", href: "/dashboard/products", icon: "▦" },
  { label: "Accounting", href: "/dashboard/accounting", icon: "◒" },
  { label: "Marketing", href: "/dashboard/marketing", icon: "➤" },
  { label: "Automation", href: "/dashboard/actions", icon: "⚡" },
  { label: "Integrations", href: "/dashboard/integrations", icon: "⌘" },
  { label: "Settings", href: "/dashboard/settings", icon: "⚙" }
];

const TOOLS = [
  { label: "Projects", href: "/dashboard/ai-builder", icon: "▧" },
  { label: "Documents", href: "/dashboard/documents", icon: "□" },
  { label: "Marketplace", href: "/dashboard/marketplace", icon: "◇" },
  { label: "Customer Portal", href: "/dashboard/portal", icon: "◉" }
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, industry")
    .eq("owner_id", user.id)
    .single();

  if (!business) redirect("/onboarding");

  return (
    <div className="biz-page">
      <div className="biz-shell">
        <aside className="biz-sidebar">
          <div className="biz-brand">
            <Link href="/dashboard" className="biz-brand-lockup">
              <span className="biz-brand-mark">B</span>
              <span>
                <span className="biz-brand-name block">BizStack</span>
                <span className="biz-brand-sub block">Your business, powered by AI.</span>
              </span>
            </Link>
          </div>

          <nav className="biz-nav">
            <div className="biz-nav-group">Workspace</div>
            {NAV.map(item => (
              <Link key={item.href} href={item.href} className={"biz-nav-item " + (item.href === "/dashboard" ? "active" : "")}>
                <span className="biz-nav-icon text-[11px]">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}

            <div className="biz-nav-group">Business tools</div>
            {TOOLS.map(item => (
              <Link key={item.href + item.label} href={item.href} className="biz-nav-item">
                <span className="biz-nav-icon text-[11px]">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-auto border-t border-white/[.07] p-3">
            <div className="rounded-xl border border-white/[.08] bg-white/[.025] p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-blue-500/25 to-violet-500/20 text-[10px] font-semibold text-white/70">
                  {(business.name?.[0] || "B").toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[9px] font-medium text-white/72">{business.name}</p>
                  <p className="truncate text-[7px] text-white/25">{business.industry || "Business workspace"}</p>
                </div>
              </div>
              <form action="/auth/sign-out" method="post" className="mt-2">
                <button className="text-[8px] text-white/25 hover:text-white/55">Sign out</button>
              </form>
            </div>
          </div>
        </aside>

        <div className="biz-main">
          <header className="biz-topbar">
            <div className="flex min-w-0 items-center gap-2">
              <div className="md:hidden biz-brand-mark !h-8 !w-8 !rounded-xl">B</div>
              <input className="biz-search" aria-label="Search BizStack" placeholder="Search projects, customers, invoices, tools…" />
            </div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/notifications" className="grid h-8 w-8 place-items-center rounded-lg border border-white/[.09] bg-white/[.03] text-[10px] text-white/50">◌</Link>
              <Link href="/dashboard/ai-builder" className="rounded-lg border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-[8px] font-medium text-blue-200">Open AI Builder</Link>
              <div className="hidden sm:block text-right">
                <div className="text-[8px] text-white/55">{business.name}</div>
                <div className="text-[7px] text-white/20">Business workspace</div>
              </div>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}
