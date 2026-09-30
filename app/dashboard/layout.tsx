import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

const NAV_GROUPS = [
  {
    label: "OPERATE",
    items: [
      ["/dashboard", "Home", "⌂"],
      ["/dashboard/ai-assistant", "AI Assistant", "✦"],
      ["/dashboard/actions", "Automation", "⌁"]
    ]
  },
  {
    label: "COMMERCE",
    items: [
      ["/dashboard/invoices", "Invoices", "▤"],
      ["/dashboard/customers", "Customers", "◌"],
      ["/dashboard/products", "Inventory", "□"],
      ["/dashboard/quotes", "Quotes", "◇"],
      ["/dashboard/cash-sales", "Cash Sales", "¤"]
    ]
  },
  {
    label: "MONEY & INSIGHT",
    items: [
      ["/dashboard/accounting", "Accounting", "∑"],
      ["/dashboard/money", "Money", "◈"],
      ["/dashboard/reports", "Reports", "⌗"],
      ["/dashboard/billing", "Plans & Billing", "⊙"]
    ]
  },
  {
    label: "GROWTH & BUILD",
    items: [
      ["/dashboard/marketing", "Marketing", "↗"],
      ["/dashboard/website-builder", "AI Builder", "▣"],
      ["/dashboard/website", "Websites", "⌘"],
      ["/dashboard/marketplace", "Marketplace", "⌂"]
    ]
  },
  {
    label: "SYSTEM",
    items: [
      ["/dashboard/integrations", "Integrations", "⊕"],
      ["/dashboard/documents", "Files & Knowledge", "▥"],
      ["/dashboard/activity", "Activity", "◷"],
      ["/dashboard/settings", "Settings", "⚙"]
    ]
  }
] as const;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id, name, industry").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");

  return (
    <div className="biz-console">
      <div className="biz-atmosphere" aria-hidden="true" />
      <aside className="biz-sidebar">
        <div className="biz-brand">
          <Link href="/dashboard" className="biz-brand-lockup" aria-label="BizStack home">
            <span className="biz-brand-mark">BS</span>
            <span><strong>BizStack</strong><small>BUSINESS OPERATING SYSTEM</small></span>
          </Link>
          <div className="biz-workspace-chip"><span className="biz-live-dot" /> {business.name} <span>⌄</span></div>
        </div>
        <nav className="biz-nav" aria-label="Business navigation">
          {NAV_GROUPS.map((group) => (
            <div className="biz-nav-section" key={group.label}>
              <p className="biz-nav-label">{group.label}</p>
              {group.items.map(([href, label, icon]) => (
                <Link key={href} href={href} className="biz-nav-item">
                  <span className="biz-nav-icon" aria-hidden="true">{icon}</span><span>{label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="biz-sidebar-footer">
          <Link href="/dashboard/settings" className="biz-identity-card">
            <span className="biz-avatar">{business.name.charAt(0).toUpperCase()}</span>
            <span><b>{business.name}</b><small>{business.industry || "Business workspace"}</small></span>
            <span className="biz-card-arrow">→</span>
          </Link>
          <form action="/auth/sign-out" method="post"><button className="biz-signout">Sign out</button></form>
        </div>
      </aside>

      <div className="biz-main">
        <header className="biz-topbar">
          <div className="biz-breadcrumb"><span className="biz-kicker">BIZSTACK /</span><strong>OPERATING CONSOLE</strong></div>
          <div className="biz-top-actions">
            <Link href="/dashboard/ai-assistant" className="biz-command-link">⌘ Ask BizStack</Link>
            <Link href="/dashboard/activity" className="biz-icon-button" aria-label="View activity">◷</Link>
            <Link href="/dashboard/settings" className="biz-user-chip"><span className="biz-avatar small">{business.name.charAt(0).toUpperCase()}</span><span className="desktop-only">Workspace</span><span>⌄</span></Link>
          </div>
        </header>
        <main className="biz-content">{children}</main>
      </div>
      <nav className="biz-mobile-nav" aria-label="Mobile navigation">
        {[["/dashboard", "⌂", "Home"], ["/dashboard/invoices", "▤", "Sales"], ["/dashboard/customers", "◌", "CRM"], ["/dashboard/ai-assistant", "✦", "AI"], ["/dashboard/settings", "⋯", "More"]].map(([href, icon, label]) => <Link href={href} key={href}><span>{icon}</span><small>{label}</small></Link>)}
      </nav>
    </div>
  );
}
