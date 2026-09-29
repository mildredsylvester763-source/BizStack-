import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { INTEGRATION_CATALOG } from "@/lib/integrations/catalog";
import { BizIcon, BizPanel, BizSection, BizStatus, BizTabs } from "@/components/ui/BizStackVisual";

const FEATURED = [
  { provider: "github", name: "GitHub", category: "Development", detail: "Code & repositories", tone: "slate" as const, icon: "GH" },
  { provider: "vercel", name: "Vercel", category: "Development", detail: "Deploy & hosting", tone: "slate" as const, icon: "▲" },
  { provider: "supabase", name: "Supabase", category: "Data", detail: "Database & backend", tone: "green" as const, icon: "S" },
  { provider: "stripe", name: "Stripe", category: "Finance", detail: "Payments", tone: "purple" as const, icon: "S" },
  { provider: "google-drive", name: "Google Drive", category: "Storage", detail: "Files & documents", tone: "blue" as const, icon: "G" },
  { provider: "slack", name: "Slack", category: "Communication", detail: "Team communication", tone: "orange" as const, icon: "✦" },
  { provider: "notion", name: "Notion", category: "Productivity", detail: "Notes & knowledge", tone: "slate" as const, icon: "N" },
  { provider: "paypal", name: "PayPal", category: "Finance", detail: "Payments", tone: "blue" as const, icon: "P" },
  { provider: "figma", name: "Figma", category: "Design", detail: "Design files", tone: "purple" as const, icon: "F" }
];

const categories = ["All", "Popular", "Development", "Communication", "Finance", "Marketing", "Storage", "Productivity", "Design", "CRM"];

function normalizeProvider(provider: string) {
  return provider.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id,name")
    .eq("owner_id", user.id)
    .single();
  if (!business) redirect("/onboarding");

  const { data: connections } = await supabase
    .from("integrations")
    .select("id,provider,display_name,status,account_label,external_account_email,last_verified_at,last_synced_at")
    .eq("business_id", business.id)
    .order("updated_at", { ascending: false });

  const rows = connections || [];
  const connected = new Map(rows.map((x: any) => [normalizeProvider(x.provider), x]));
  const catalog = INTEGRATION_CATALOG.slice(0, 24);

  return (
    <div className="biz-content">
      <BizSection number="4" title="Integrations, Apps & Connectors" subtitle="Connect your tools, apps and services. Build a more powerful business.">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <BizTabs items={categories} />
          <Link href="/dashboard/ai-builder"><span className="biz-button bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white">Open AI Builder</span></Link>
        </div>

        <div className="grid xl:grid-cols-[1.55fr_.9fr] gap-3">
          <BizPanel title="Connector Marketplace" subtitle="Connect company systems, productivity tools, payments and business services.">
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3 rounded-xl border border-white/[.07] bg-white/[.025] px-3 py-2.5">
                <span className="text-[10px] text-white/20">⌕</span>
                <input aria-label="Search connectors" placeholder="Search connectors, products or service…" className="w-full bg-transparent outline-none text-[8px] text-white/65 placeholder:text-white/20" />
                <span className="biz-chip">{catalog.length + FEATURED.length}+</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {FEATURED.map(item => {
                  const c = connected.get(normalizeProvider(item.provider));
                  const isConnected = c?.status === "connected";
                  return (
                    <div key={item.provider} className="rounded-2xl border border-blue-400/10 bg-white/[.02] p-3 hover:border-blue-400/25 transition">
                      <div className="flex items-start gap-2.5">
                        <BizIcon tone={item.tone} size="md">{item.icon}</BizIcon>
                        <div className="min-w-0 flex-1">
                          <div className="text-[9px] font-semibold text-white/75">{item.name}</div>
                          <div className="text-[7px] text-white/22 mt-1">{item.detail}</div>
                        </div>
                        {isConnected && <BizStatus tone="green">Connected</BizStatus>}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[7px] text-white/20">{item.category}</span>
                        <Link href={item.provider === "stripe" ? "/dashboard/settings/payments" : "/dashboard/ai-builder"} className="rounded-lg bg-blue-500/10 border border-blue-400/15 px-3 py-1.5 text-[7px] text-blue-200">
                          {isConnected ? "Manage" : "Connect"}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {catalog.map(item => {
                  const c = connected.get(normalizeProvider(item.provider));
                  return (
                    <div key={item.provider} className="biz-card-link">
                      <div className="flex items-center gap-2">
                        <BizIcon tone={item.category === "payments" ? "purple" : item.category === "developer" ? "blue" : item.category === "communications" ? "cyan" : "slate"} size="sm">{item.name.slice(0, 1)}</BizIcon>
                        <div className="min-w-0 flex-1">
                          <div className="text-[8px] text-white/65">{item.name}</div>
                          <div className="text-[7px] text-white/22 truncate">{item.category.replace("_", " ")}</div>
                        </div>
                        {c?.status === "connected" ? <span className="text-[7px] text-emerald-300">●</span> : <span className="text-[7px] text-white/15">○</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </BizPanel>

          <BizPanel title="Connected Apps" subtitle="Accounts authorized for this business workspace.">
            <div>
              {rows.length === 0 ? (
                <div className="p-5 text-[9px] text-white/25">No connected services yet. Connect an account from the marketplace or open AI Builder for the guided account setup.</div>
              ) : rows.map((c: any) => (
                <div className="biz-list-row" key={c.id}>
                  <BizIcon tone={c.status === "connected" ? "green" : c.status === "error" ? "red" : "orange"} size="sm">{String(c.display_name || c.provider).slice(0, 1)}</BizIcon>
                  <div className="min-w-0 flex-1">
                    <div className="text-[8px] text-white/65 truncate">{c.display_name || c.provider}</div>
                    <div className="text-[7px] text-white/20 truncate">{c.account_label || c.external_account_email || "Account not identified"}</div>
                  </div>
                  <BizStatus tone={c.status === "connected" ? "green" : c.status === "error" ? "red" : "orange"}>{c.status}</BizStatus>
                </div>
              ))}
              <div className="p-3 border-t border-white/[.07]">
                <Link href="/dashboard/ai-builder" className="block text-center rounded-xl border border-white/[.08] bg-white/[.035] py-2.5 text-[8px] text-white/55 hover:text-white/75">+ Add new connection</Link>
              </div>
            </div>
          </BizPanel>
        </div>
      </BizSection>

      <BizSection number="4.2" title="Integration control plane" subtitle="Connection state, permissions and data movement remain visible instead of being hidden behind a generic “connected” badge.">
        <div className="grid xl:grid-cols-3 gap-3">
          <BizPanel title="Integration Settings" subtitle="Permission and webhook controls">
            <div className="p-4 space-y-2">
              {["General", "Webhooks", "API Keys", "Permission scopes", "Sync schedules", "Audit events"].map((x, i) => (
                <div key={x} className="flex items-center justify-between rounded-xl border border-white/[.06] bg-white/[.02] px-3 py-2.5">
                  <span className="text-[8px] text-white/55">{x}</span>
                  <span className={i < 2 ? "text-[7px] text-emerald-300" : "text-[7px] text-white/20"}>{i < 2 ? "Enabled" : "Configure"}</span>
                </div>
              ))}
              <div className="mt-2 text-[7px] leading-4 text-white/22">Changes remain scoped to this business. Credentials are handled by the secure integration runtime rather than exposed in page markup.</div>
            </div>
          </BizPanel>

          <BizPanel title="Data & Database Integration" subtitle="Import, sync and inspect business data sources">
            <div className="p-4 grid grid-cols-2 gap-2">
              {[["PostgreSQL","db"],["MySQL","db"],["MongoDB","db"],["Supabase","data"],["Firebase","data"],["Custom API","api"]].map(([name,icon]) => (
                <Link key={name} href="/dashboard/ai-builder" className="biz-card-link">
                  <BizIcon tone={icon === "db" ? "cyan" : icon === "api" ? "orange" : "green"} size="sm">{name.slice(0, 1)}</BizIcon>
                  <div className="mt-2 text-[8px] text-white/60">{name}</div>
                  <div className="mt-1 text-[7px] text-white/20">Connect / inspect</div>
                </Link>
              ))}
            </div>
          </BizPanel>

          <BizPanel title="Developer Tools" subtitle="API, SDK and webhook surfaces">
            <div className="p-4 space-y-2">
              {["API", "SDKs", "Webhooks", "Docs", "Postman collection", "Rate limits", "Authentication"].map((x, i) => (
                <div key={x} className="rounded-xl border border-white/[.06] bg-white/[.02] px-3 py-2.5">
                  <div className="text-[8px] text-white/60">{x}</div>
                  <div className="text-[7px] text-white/20 mt-1">{i === 0 ? "GET /v1/invoices" : "Available through the connected runtime"}</div>
                </div>
              ))}
            </div>
          </BizPanel>
        </div>
      </BizSection>

      <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {[["Connected", String(rows.filter((x:any)=>x.status==="connected").length)],["Pending",String(rows.filter((x:any)=>x.status==="pending").length)],["Errors",String(rows.filter((x:any)=>x.status==="error").length)],["Catalog",String(INTEGRATION_CATALOG.length)]].map(([label,value])=>(
          <div key={label} className="biz-metric !min-h-0"><div className="biz-metric-label">{label}</div><div className="biz-metric-value !text-[15px]">{value}</div></div>
        ))}
      </div>
    </div>
  );
}
