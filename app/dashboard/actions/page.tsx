import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

type EventRow = { id: string; summary: string; evidence: Record<string, unknown>; status: string; created_at: string; event_type: string };

async function updateEventStatus(formData: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("events").update({ status: formData.get("status") as string }).eq("id", formData.get("id") as string);
  revalidatePath("/dashboard/actions");
}

const EVENT_ICONS: Record<string, string> = {
  "invoice.created": "📄", "invoice.sent": "📤", "invoice.paid": "✅",
  "payment.overdue": "⚠️", "product.low_stock": "📦", default: "🔔"
};

export default async function ActionCenterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id, name").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const { data: events } = await supabase.from("events").select("*").eq("business_id", business.id).order("created_at", { ascending: false });
  const all = (events ?? []) as EventRow[];
  const needsApproval = all.filter(e => e.status === "needs_approval");
  const autoHandled  = all.filter(e => e.status === "auto_handled");
  const info         = all.filter(e => e.status === "info");

  const Section = ({ title, color, events }: { title: string; color: string; events: EventRow[] }) => (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color }}>{title}</h2>
      {events.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing here.</p>
      ) : (
        <div className="space-y-2">
          {events.map(e => (
            <div key={e.id} className="bg-[#0a1220]/95 border border-white/[.06] rounded-xl p-4 hover:border-indigo-300/[.16] transition-all shadow-[0_10px_30px_rgba(0,0,0,.12)]">
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0 mt-0.5">{EVENT_ICONS[e.event_type] ?? EVENT_ICONS.default}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 leading-snug">{e.summary}</p>
                  <p className="text-xs text-slate-500 mt-1">{new Date(e.created_at).toLocaleString()}</p>
                  {Object.keys(e.evidence ?? {}).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-indigo-300 cursor-pointer">Show evidence</summary>
                      <pre className="mt-1.5 bg-bg border border-line rounded-lg p-2 text-[10px] text-slate-500 overflow-x-auto">{JSON.stringify(e.evidence, null, 2)}</pre>
                    </details>
                  )}
                  {e.status === "needs_approval" && (
                    <div className="mt-3 flex gap-2">
                      <form action={updateEventStatus}>
                        <input type="hidden" name="id" value={e.id}/>
                        <input type="hidden" name="status" value="auto_handled"/>
                        <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{background:"#5B6EF5"}}>Approve</button>
                      </form>
                      <form action={updateEventStatus}>
                        <input type="hidden" name="id" value={e.id}/>
                        <input type="hidden" name="status" value="dismissed"/>
                        <button type="submit" className="px-3 py-1.5 rounded-lg text-xs text-slate-500 bg-[#0b1220]/90 border border-white/[.065] hover:text-white">Dismiss</button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen p-5 lg:p-6 relative"><div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,.12),transparent_60%)]" />
      <div className="relative mb-5 pb-5 border-b border-white/[.055]">
        <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400/20 to-cyan-400/10 border border-indigo-200/10 grid place-items-center text-indigo-100/80">⌁</div><div><h1 className="text-[19px] font-semibold tracking-[-.02em] text-white">Automation &amp; Activity</h1>
        <p className="text-[11px] text-slate-500 mt-1">What BizStack noticed, recommended, and already handled.</p></div></div>
      </div>
      <div className="grid lg:grid-cols-3 gap-3 mb-6 relative">
        {[{label:"Needs Approval",value:needsApproval.length,color:"#F5A524"},{label:"Auto Handled",value:autoHandled.length,color:"#22C55E"},{label:"Total Events",value:all.length,color:"#5B6EF5"}].map(s=>(
          <div key={s.label} className="bg-[#0a1220]/95 border border-white/[.06] rounded-xl p-4 shadow-[0_14px_42px_rgba(0,0,0,.15)]">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="space-y-8">
        <Section title="Needs Your Approval" color="#F5A524" events={needsApproval}/>
        <Section title="Already Handled" color="#22C55E" events={autoHandled}/>
        <Section title="Recent Activity" color="#8B92B0" events={info}/>
      </div>
    </div>
  );
}
