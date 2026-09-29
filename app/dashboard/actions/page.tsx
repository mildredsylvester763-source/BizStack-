import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { BizPanel, BizSection, BizStatus, BizTabs, BizIcon } from "@/components/ui/BizStackVisual";

const workflowTemplates = [
  { name: "Invoice Reminder", trigger: "When invoice is overdue", status: "Active", tone: "orange" as const, icon: "◷", detail: "Identify overdue invoices and route reminder decisions." },
  { name: "Welcome Email", trigger: "When new customer is added", status: "Active", tone: "green" as const, icon: "✉", detail: "Start a customer onboarding sequence." },
  { name: "Low Stock Alert", trigger: "When stock falls below threshold", status: "Active", tone: "orange" as const, icon: "△", detail: "Create an operational alert before stock runs out." },
  { name: "Social Media Post", trigger: "Daily at scheduled time", status: "Template", tone: "blue" as const, icon: "◎", detail: "Prepare and schedule a content workflow." },
  { name: "Report Generation", trigger: "Weekly on Monday", status: "Template", tone: "purple" as const, icon: "▤", detail: "Compile recurring business performance summaries." }
];

export default async function ActionCenterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase.from("businesses").select("id,name").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");

  const [{ data: events }, { data: automationSettings }, { data: agents }] = await Promise.all([
    supabase.from("events").select("id,summary,evidence,status,created_at,event_type").eq("business_id", business.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("automation_settings").select("action_type,mode,limit_value").eq("business_id", business.id).order("action_type"),
    supabase.from("ai_agents").select("id,name,role,status,autonomy_mode,last_run_at").eq("business_id", business.id).order("updated_at", { ascending: false }).limit(8)
  ]);

  const activeRules = new Map((automationSettings || []).map((x:any)=>[x.action_type, x]));

  return (
    <div className="biz-content">
      <BizSection number="3.3" title="Automation Workflows" subtitle="Turn recurring work into observable, permission-aware workflows.">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <BizTabs items={["Workflows", "Templates", "History"]} />
          <Link href="/dashboard/ai-builder"><span className="biz-button bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white">+ Create Workflow</span></Link>
        </div>

        <div className="grid xl:grid-cols-[1.2fr_.8fr] gap-3">
          <BizPanel>
            <div className="divide-y divide-white/[.06]">
              {workflowTemplates.map(item => {
                const key = item.name.toLowerCase().replaceAll(" ", "_");
                const setting = activeRules.get(key);
                const liveStatus = setting ? String(setting.mode).replace("_", " ") : item.status;
                return (
                  <div key={item.name} className="px-4 py-4 flex items-center gap-3">
                    <BizIcon tone={item.tone === "orange" ? "orange" : item.tone === "green" ? "green" : item.tone === "purple" ? "purple" : "blue"} size="md">{item.icon}</BizIcon>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><span className="text-[9px] font-semibold text-white/70">{item.name}</span><BizStatus tone={liveStatus.toLowerCase().includes("auto") || liveStatus === "Active" ? "green" : liveStatus === "Template" ? "slate" : "orange"}>{liveStatus}</BizStatus></div>
                      <div className="text-[7px] text-white/23 mt-1">{item.trigger}</div>
                      <div className="text-[7px] text-white/15 mt-1">{item.detail}</div>
                    </div>
                    <Link href="/dashboard/ai-builder" className="rounded-lg border border-white/[.07] bg-white/[.03] px-2.5 py-2 text-[7px] text-white/35 hover:text-white/65">Configure</Link>
                  </div>
                );
              })}
            </div>
          </BizPanel>

          <BizPanel title="AI Agents" subtitle="Autonomous roles that can plan, research, build and execute.">
            <div className="p-3">
              {(!agents || agents.length === 0) ? (
                <div className="rounded-2xl border border-dashed border-white/[.08] p-6 text-center">
                  <BizIcon tone="purple" size="lg">✦</BizIcon>
                  <div className="mt-3 text-[10px] text-white/60">No agents configured yet</div>
                  <p className="mt-1 text-[7px] leading-4 text-white/20">Create an agent in the full AI Builder and give it explicit tools and permissions.</p>
                  <Link href="/dashboard/ai-builder" className="mt-3 inline-flex"><span className="biz-button bg-gradient-to-r from-blue-600 to-violet-600 text-white">Create New Agent</span></Link>
                </div>
              ) : agents.map((a:any)=>(
                <div key={a.id} className="biz-list-row px-0">
                  <BizIcon tone="purple" size="sm">✦</BizIcon>
                  <div className="min-w-0 flex-1"><div className="text-[8px] text-white/65">{a.name}</div><div className="text-[7px] text-white/20">{a.role.replaceAll("_"," ")} · {a.autonomy_mode.replaceAll("_"," ")}</div></div>
                  <BizStatus tone={a.status === "active" ? "green" : "slate"}>{a.status}</BizStatus>
                </div>
              ))}
            </div>
          </BizPanel>
        </div>
      </BizSection>

      <BizSection title="Automation evidence" subtitle="The event trail shows what the system noticed and what still needs a human decision.">
        <div className="grid xl:grid-cols-[1.3fr_.7fr] gap-3">
          <BizPanel title="Recent workflow activity" subtitle="Live events">
            <div>
              {(events || []).length === 0 ? (
                <div className="p-5 text-[9px] text-white/25">No automation events yet.</div>
              ) : (events || []).map((e:any)=>(
                <div key={e.id} className="biz-list-row">
                  <span className={e.status === "needs_approval" ? "text-orange-300" : e.status === "auto_handled" ? "text-emerald-300" : "text-blue-300"}>●</span>
                  <div className="min-w-0 flex-1"><div className="text-[8px] text-white/55 truncate">{e.summary}</div><div className="text-[7px] text-white/18 mt-1">{new Date(e.created_at).toLocaleString()}</div></div>
                  <BizStatus tone={e.status === "needs_approval" ? "orange" : e.status === "auto_handled" ? "green" : "slate"}>{e.status.replaceAll("_"," ")}</BizStatus>
                </div>
              ))}
            </div>
          </BizPanel>
          <BizPanel title="Guardrails" subtitle="Automation is controlled here before it can become autonomous.">
            <div className="p-4 space-y-2">
              {["Ask before external communication", "Require verified payment provider for card charges", "Keep customer data scoped to the business", "Record evidence for autonomous runs", "Allow rollback after failed operations"].map((x, i) => (
                <div key={x} className="flex gap-2 rounded-xl border border-white/[.06] bg-white/[.02] p-3">
                  <span className="text-[9px] text-emerald-300">{i < 4 ? "✓" : "↶"}</span>
                  <span className="text-[8px] leading-4 text-white/40">{x}</span>
                </div>
              ))}
            </div>
          </BizPanel>
        </div>
      </BizSection>
    </div>
  );
}
