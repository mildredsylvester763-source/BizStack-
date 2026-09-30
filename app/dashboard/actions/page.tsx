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
        <p className="text-sm text-textMuted">Nothing here.</p>
      ) : (
        <div className="space-y-2">
          {events.map(e => (
            <div key={e.id} className="bg-surface border border-line rounded-xl p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0 mt-0.5">{EVENT_ICONS[e.event_type] ?? EVENT_ICONS.default}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text leading-snug">{e.summary}</p>
                  <p className="text-xs text-textMuted mt-1">{new Date(e.created_at).toLocaleString()}</p>
                  {Object.keys(e.evidence ?? {}).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-primary cursor-pointer">Show evidence</summary>
                      <pre className="mt-1.5 bg-bg border border-line rounded-lg p-2 text-[10px] text-textMuted overflow-x-auto">{JSON.stringify(e.evidence, null, 2)}</pre>
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
                        <button type="submit" className="px-3 py-1.5 rounded-lg text-xs text-textMuted bg-surface border border-line hover:text-white">Dismiss</button>
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
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-white">Automation Center</h1>
        <p className="text-sm text-textMuted mt-0.5">What BizStack noticed, recommended, and already handled.</p>
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {[{label:"Needs Approval",value:needsApproval.length,color:"#F5A524"},{label:"Auto Handled",value:autoHandled.length,color:"#22C55E"},{label:"Total Events",value:all.length,color:"#5B6EF5"}].map(s=>(
          <div key={s.label} className="bg-surface border border-line rounded-xl p-4">
            <p className="text-xs text-textMuted mb-1">{s.label}</p>
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
