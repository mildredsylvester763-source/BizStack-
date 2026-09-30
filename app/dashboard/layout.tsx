import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

const NAV = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/ai-assistant", label: "AI Assistant" },
  { href: "/dashboard/website-builder", label: "AI Builder" },
  { href: "/dashboard/invoices", label: "Invoices" },
  { href: "/dashboard/customers", label: "Customers" },
  { href: "/dashboard/products", label: "Inventory" },
  { href: "/dashboard/accounting", label: "Accounting" },
  { href: "/dashboard/marketing", label: "Marketing" },
  { href: "/dashboard/actions", label: "Automation" },
  { href: "/dashboard/integrations", label: "Integrations" },
  { href: "/dashboard/documents", label: "Files & Knowledge" },
  { href: "/dashboard/reports", label: "Reports & Analytics" },
  { href: "/dashboard/billing", label: "Plans & Pricing" },
  { href: "/dashboard/settings", label: "Settings" }
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id, name, industry").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");

  return (
    <div className="min-h-screen flex relative overflow-hidden" style={{ background: "#050914" }}>
      <div className="pointer-events-none fixed inset-0 z-0" style={{background:"radial-gradient(circle at 72% 8%, rgba(64,92,255,.10), transparent 28%), radial-gradient(circle at 30% 100%, rgba(139,92,246,.08), transparent 26%)"}} />
      <aside className="hidden md:flex w-[232px] shrink-0 flex-col fixed h-screen border-r border-white/[.07] z-20" style={{ background: "linear-gradient(180deg,#080d18 0%,#070b14 72%,#090d18 100%)", boxShadow:"18px 0 60px rgba(0,0,0,.22)" }}>
        <div className="px-5 py-[18px] border-b border-white/[.07] relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 border border-indigo-200/10 shadow-[0_0_28px_rgba(91,110,245,.22)]" style={{ background: "linear-gradient(135deg, #6375ff, #7c3aed)" }}>
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="white">
                <rect x="1" y="1" width="6" height="6" rx="1.5"/>
                <rect x="9" y="1" width="6" height="6" rx="1.5"/>
                <rect x="1" y="9" width="6" height="6" rx="1.5"/>
                <rect x="9" y="9" width="6" height="6" rx="1.5" opacity="0.5"/>
              </svg>
            </div>
            <div>
              <span className="text-[16px] font-semibold text-white tracking-[-.03em]">BizStack</span>
              <p className="text-[8px] text-slate-500 leading-none mt-1 tracking-[.01em]">Your Business. Powered by AI.</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}
              className="group flex items-center gap-2.5 px-3 py-[9px] rounded-[9px] text-[12px] text-slate-400 hover:text-white hover:bg-white/[.045] transition-all border border-transparent hover:border-white/[.045]">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-indigo-300 group-hover:shadow-[0_0_10px_rgba(129,140,248,.75)] transition-all" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-white/[.07] bg-black/[.08]">
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

      <div className="flex-1 md:pl-[232px] min-w-0 overflow-x-hidden relative z-10">
        {children}
      </div>
    </div>
  );
}
