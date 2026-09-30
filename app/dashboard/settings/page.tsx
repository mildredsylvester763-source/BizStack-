import Link from "next/link";

const SECTIONS = [
  { href: "/dashboard/settings/automation", label: "Automation", desc: "Autonomy per action type and execution controls.", icon: "⌁", tone: "blue", state: "Configured" },
  { href: "/dashboard/settings/payments", label: "Payment methods", desc: "Bank details and invoice payment options.", icon: "◈", tone: "green", state: "Configured" },
  { href: "/dashboard/settings", label: "Business profile", desc: "Identity, address, currency and brand settings.", icon: "◉", tone: "purple", state: "Workspace" },
  { href: "/dashboard/settings", label: "Team & permissions", desc: "Roles, workspace access and governed actions.", icon: "◎", tone: "cyan", state: "Workspace" }
];

const ECOSYSTEM = [
  ["Security & Authentication","Sessions, permissions, audit trails and protected business access.","Shield","/dashboard/settings"],
  ["Data & Database","Supabase, business data, files and governed AI context.","DB","/dashboard/documents"],
  ["Mobile App","Responsive workspace foundations and the mobile operating surface.","M","/dashboard"],
  ["AI & Automation","Models, agents, workflows, tools and execution controls.","AI","/dashboard/ai-assistant"]
];

export default function SettingsPage() {
  return (
    <div className="min-h-screen p-5 lg:p-6 relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_50%_0%,rgba(76,88,255,.14),transparent_62%)]" />
      <div className="relative max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 pb-5 border-b border-white/[.055]">
          <div>
            <div className="text-[8px] uppercase tracking-[.2em] text-indigo-300/55 mb-2">BizStack control center</div>
            <h1 className="text-[22px] font-semibold tracking-[-.03em] text-white">Settings</h1>
            <p className="text-[10px] text-slate-500 mt-1">Business identity, security, integrations and operating preferences.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-cyan-400/10 bg-cyan-400/[.025] px-3 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,.7)]" />
            <span className="text-[8px] text-cyan-100/55">Control plane online</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
          {SECTIONS.map((s) => (
            <Link key={s.label} href={s.href} className="group rounded-2xl border border-white/[.065] bg-[#0b1220]/90 p-4 hover:border-indigo-300/[.2] hover:-translate-y-0.5 transition-all shadow-[0_12px_35px_rgba(0,0,0,.12)]">
              <div className="flex items-start justify-between">
                <div className="w-9 h-9 rounded-xl border border-white/[.08] bg-white/[.03] grid place-items-center text-indigo-200/75 text-[12px]">{s.icon}</div>
                <span className="text-[7px] uppercase tracking-[.14em] text-emerald-300/45">{s.state}</span>
              </div>
              <p className="text-[11px] font-medium text-white/80 mt-4">{s.label}</p>
              <p className="text-[8px] leading-4 text-slate-500 mt-1.5">{s.desc}</p>
              <div className="mt-3 text-[8px] text-indigo-300/45 group-hover:text-indigo-200/75 transition">Open control →</div>
            </Link>
          ))}
        </div>

        <div className="grid xl:grid-cols-[1.4fr_.8fr] gap-3">
          <section className="rounded-2xl border border-white/[.065] bg-[#0b1220]/90 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[.055]">
              <div className="text-[8px] uppercase tracking-[.18em] text-indigo-300/45">Platform surfaces</div>
              <h2 className="text-sm font-semibold text-white mt-1">Ecosystem controls</h2>
              <p className="text-[9px] text-slate-500 mt-1">Navigate the operating layers without leaving the BizStack shell.</p>
            </div>
            <div className="grid sm:grid-cols-2">
              {ECOSYSTEM.map(([title,desc,icon,href]) => (
                <Link href={href} key={title} className="group p-4 border-b border-r border-white/[.045] hover:bg-white/[.018] transition">
                  <div className="flex gap-3">
                    <div className="w-9 h-9 shrink-0 rounded-xl border border-indigo-300/10 bg-gradient-to-br from-indigo-500/10 to-violet-500/[.06] grid place-items-center text-[9px] text-indigo-200/70">{icon}</div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium text-white/70 group-hover:text-white transition">{title}</div>
                      <p className="text-[8px] leading-4 text-slate-500 mt-1">{desc}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between"><span className="text-[7px] uppercase tracking-[.14em] text-white/15">Workspace surface</span><span className="text-[7px] text-indigo-300/45 group-hover:text-indigo-200/75">Open →</span></div>
                </Link>
              ))}
            </div>
          </section>

          <div className="space-y-3">
            <section className="rounded-2xl border border-cyan-400/10 bg-gradient-to-b from-cyan-500/[.055] to-indigo-500/[.025] p-5">
              <div className="text-[8px] uppercase tracking-[.18em] text-cyan-200/45">Security</div>
              <h2 className="text-sm font-semibold text-white mt-2">Authentication & access</h2>
              <p className="text-[9px] leading-4 text-slate-500 mt-2">Scoped access, protected sessions, permissions and auditable business actions.</p>
              <div className="mt-4 space-y-2">{["Protected workspace session","Business-scoped permissions","Audit-ready activity trail"].map(x => <div key={x} className="flex items-center gap-2 text-[8px] text-white/45"><span className="text-emerald-300">✓</span>{x}</div>)}</div>
            </section>
            <Link href="/dashboard/billing" className="block rounded-2xl border border-violet-400/10 bg-[#0b1220]/90 p-5 hover:border-violet-300/20 transition group">
              <div className="text-[8px] uppercase tracking-[.18em] text-violet-300/45">Workspace</div>
              <h2 className="text-sm font-semibold text-white mt-2">Plans & Pricing</h2>
              <p className="text-[9px] text-slate-500 mt-1">View operating layers, usage and subscription configuration.</p>
              <div className="mt-3 text-[8px] text-violet-300/45 group-hover:text-violet-200/75">Open billing surface →</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}