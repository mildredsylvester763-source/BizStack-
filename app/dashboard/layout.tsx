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

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id, name, industry").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");

  return (
    <div className="min-h-screen flex" style={{ background: "#0A0E1C" }}>
      <aside className="hidden md:flex w-[220px] shrink-0 flex-col fixed h-screen border-r border-line z-20" style={{ background: "#111827" }}>
        <div className="px-5 py-[18px] border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #5B6EF5, #8B5CF6)" }}>
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="white">
                <rect x="1" y="1" width="6" height="6" rx="1.5"/>
                <rect x="9" y="1" width="6" height="6" rx="1.5"/>
                <rect x="1" y="9" width="6" height="6" rx="1.5"/>
                <rect x="9" y="9" width="6" height="6" rx="1.5" opacity="0.5"/>
              </svg>
            </div>
            <div>
              <span className="text-[15px] font-semibold text-white tracking-tight">BizStack</span>
              <p className="text-[9px] text-textMuted leading-none mt-0.5">Your Business, Powered by AI</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-px overflow-y-auto">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}
              className="flex items-center px-3 py-[8px] rounded-lg text-[13px] text-textMuted hover:text-white hover:bg-white/8 transition-colors">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-line">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/5 cursor-pointer">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: "linear-gradient(135deg, #5B6EF5, #8B5CF6)" }}>
              {business.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-white truncate leading-tight">{business.name}</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded text-[#5B6EF5]" style={{ background: "rgba(91,110,245,0.15)" }}>Business Plan</span>
            </div>
          </div>
          <form action="/auth/sign-out" method="post" className="mt-1">
            <button className="w-full text-left px-3 py-1 text-[11px] text-textMuted hover:text-white rounded transition-colors">Sign out</button>
          </form>
        </div>
      </aside>

      <div className="flex-1 md:pl-[220px] min-w-0 overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
