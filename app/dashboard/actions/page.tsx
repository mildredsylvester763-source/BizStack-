import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

type EventRow = {
  id: string; event_type: string; summary: string; evidence: Record<string, unknown>;
  status: string; created_at: string; priority: string | null; category: string | null;
  action_type: string | null; due_at: string | null; assigned_to: string | null; resolved_at: string | null;
};

async function updateEventStatus(formData: FormData) {
  "use server";
  const supabase = createClient();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id || !["auto_handled", "dismissed"].includes(status)) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  await supabase.from("events").update({ status, resolved_at: new Date().toISOString() }).eq("id", id).eq("business_id", business.id);
  revalidatePath("/dashboard/actions"); revalidatePath("/dashboard/activity");
}

function label(value: string | null | undefined) {
  return (value || "general").replace(/[._-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
function isOverdue(e: EventRow) {
  return Boolean(e.due_at && new Date(e.due_at).getTime() < Date.now() && !e.resolved_at);
}
function isAction(e: EventRow) {
  return e.status === "needs_approval" || e.priority === "critical" || e.priority === "high" || isOverdue(e) || Boolean(e.action_type);
}

function EvidencePanel({ event }: { event: EventRow }) {
  const evidence = event.evidence && typeof event.evidence === "object" ? event.evidence : {};
  const entries = Object.entries(evidence).filter(([, value]) => value !== null && value !== undefined && value !== "");
  return (
    <details className="mt-4 border-t border-rule pt-3">
      <summary className="cursor-pointer text-sm text-vault hover:text-vaultDeep">Show evidence</summary>
      <div className="mt-4 space-y-3">
        <div className="bg-mist border border-rule p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-vault mb-2">Why this appeared</p>
          <p className="text-sm text-ink/70 leading-relaxed">{event.summary}</p>
        </div>
        {entries.length ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {entries.map(([key, value]) => (
              <div key={key} className="border border-rule p-3 bg-white">
                <p className="text-[11px] uppercase tracking-[0.12em] text-ink/40">{label(key)}</p>
                <p className="text-sm text-ink mt-1 break-words">{typeof value === "object" ? JSON.stringify(value) : String(value)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink/45">No additional evidence was attached to this event.</p>
        )}
      </div>
    </details>
  );
}

function EventCard({ event }: { event: EventRow }) {
  const overdue = isOverdue(event);
  return (
    <div className="bg-white border border-rule p-5">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-xs text-vault">{label(event.category)}</span>
        {event.priority && event.priority !== "normal" && <span className="text-[11px] px-2 py-0.5 bg-alert/10 text-alert">{label(event.priority)}</span>}
        {overdue && <span className="text-[11px] px-2 py-0.5 bg-alert/10 text-alert">Overdue</span>}
        {event.action_type && <span className="text-[11px] px-2 py-0.5 bg-mist text-ink/55">{label(event.action_type)}</span>}
      </div>
      <p className="text-sm text-ink leading-relaxed">{event.summary}</p>
      <p className="text-xs text-ink/40 mt-2">{new Date(event.created_at).toLocaleString()}</p>
      <EvidencePanel event={event} />
      {event.status === "needs_approval" && (
        <div className="mt-4 flex gap-2">
          <form action={updateEventStatus}><input type="hidden" name="id" value={event.id} /><input type="hidden" name="status" value="auto_handled" /><button className="bg-ink text-mist text-sm px-4 py-2 hover:bg-vaultDeep transition-colors">Approve</button></form>
          <form action={updateEventStatus}><input type="hidden" name="id" value={event.id} /><input type="hidden" name="status" value="dismissed" /><button className="border border-rule text-ink/70 text-sm px-4 py-2 hover:bg-mist transition-colors">Dismiss</button></form>
        </div>
      )}
    </div>
  );
}

function ActivityGroup({ events }: { events: EventRow[] }) {
  const first = events[0];
  if (events.length === 1) return <EventCard event={first} />;
  return <div className="bg-white border border-rule p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.14em] text-vault mb-1">Grouped activity</p><p className="text-sm text-ink">{events.length} {label(first.event_type).toLowerCase()} events</p><p className="text-xs text-ink/45 mt-1">Latest: {first.summary}</p></div><span className="text-2xl font-display text-ink/35">{events.length}</span></div><p className="text-xs text-ink/40 mt-3">Showing one summary instead of flooding your Action Center.</p></div>;
}

export default async function ActionCenterPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id,name").eq("owner_id", user.id).single(); if (!business) redirect("/onboarding");
  const { data: events } = await supabase.from("events").select("id,event_type,summary,evidence,status,created_at,priority,category,action_type,due_at,assigned_to,resolved_at").eq("business_id", business.id).order("created_at", { ascending: false }).limit(500);
  const all = (events ?? []) as EventRow[];
  const active = all.filter(isAction).filter(e => e.status !== "auto_handled" && e.status !== "dismissed");
  const approvals = active.filter(e => e.status === "needs_approval");
  const critical = active.filter(e => e.status !== "needs_approval" && (e.priority === "critical" || e.priority === "high"));
  const attention = active.filter(e => e.status !== "needs_approval" && !critical.includes(e) && (isOverdue(e) || e.category === "money" || e.category === "integrations" || e.action_type === "review"));
  const recommendations = active.filter(e => e.status !== "needs_approval" && !critical.includes(e) && !attention.includes(e) && (e.action_type === "recommendation" || e.action_type === "recommended"));
  const handled = all.filter(e => e.status === "auto_handled");
  const routine = all.filter(e => !isAction(e) && e.status !== "auto_handled" && e.status !== "dismissed");
  const grouped = Array.from(routine.reduce((map, event) => { const key = event.event_type + "|" + new Date(event.created_at).toISOString().slice(0, 10); const list = map.get(key) ?? []; list.push(event); map.set(key, list); return map; }, new Map<string, EventRow[]>()).values());

  return <main className="min-h-screen bg-ledger">
    <header className="border-b border-rule bg-white"><div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between"><Link href="/dashboard" className="font-display text-lg text-ink">{business.name}</Link><div className="flex items-center gap-4"><Link href="/dashboard/activity" className="text-sm text-ink/50 hover:text-ink">Full timeline</Link><Link href="/dashboard" className="text-sm text-ink/45 hover:text-ink">Dashboard</Link></div></div></header>
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8"><div><p className="text-xs uppercase tracking-[0.16em] text-vault font-medium mb-2">Operational inbox</p><h1 className="font-display text-3xl text-ink mb-1">Action Center</h1><p className="text-ink/60">Only work that needs attention rises here. Everything else stays in the business timeline.</p></div><Link href="/dashboard/activity" className="border border-rule bg-white px-4 py-2 text-sm text-ink/65 hover:text-ink">View activity</Link></div>
      <div className="grid sm:grid-cols-4 gap-3 mb-8"><div className="bg-white border border-rule p-4"><p className="text-xs text-ink/45">Needs approval</p><p className="text-2xl font-display text-alert mt-1">{approvals.length}</p></div><div className="bg-white border border-rule p-4"><p className="text-xs text-ink/45">Critical / high</p><p className="text-2xl font-display text-alert mt-1">{critical.length}</p></div><div className="bg-white border border-rule p-4"><p className="text-xs text-ink/45">Needs attention</p><p className="text-2xl font-display text-ink mt-1">{attention.length}</p></div><div className="bg-white border border-rule p-4"><p className="text-xs text-ink/45">Recommendations</p><p className="text-2xl font-display text-vault mt-1">{recommendations.length}</p></div></div>
      <div className="mb-8 bg-white border border-rule p-5"><p className="text-xs uppercase tracking-[0.16em] text-vault font-medium mb-2">How this works</p><p className="text-sm text-ink/65 leading-relaxed">Events are the raw source of truth. The Action Center turns those events into decisions, exceptions and approvals. Routine events are grouped, while the complete source timeline remains available separately.</p></div>
      <div className="space-y-10">
        <section><h2 className="text-sm text-alert font-medium mb-3">Needs your approval</h2>{approvals.length ? <div className="space-y-3">{approvals.map(e => <EventCard key={e.id} event={e} />)}</div> : <p className="text-sm text-ink/40">Nothing waiting on you.</p>}</section>
        <section><h2 className="text-sm text-alert font-medium mb-3">Critical and high priority</h2>{critical.length ? <div className="space-y-3">{critical.map(e => <EventCard key={e.id} event={e} />)}</div> : <p className="text-sm text-ink/40">No critical or high-priority work.</p>}</section>
        <section><h2 className="text-sm text-ink font-medium mb-3">Needs attention</h2>{attention.length ? <div className="space-y-3">{attention.map(e => <EventCard key={e.id} event={e} />)}</div> : <p className="text-sm text-ink/40">Nothing currently needs attention.</p>}</section>
        <section><h2 className="text-sm text-vault font-medium mb-3">Recommendations</h2>{recommendations.length ? <div className="space-y-3">{recommendations.map(e => <EventCard key={e.id} event={e} />)}</div> : <p className="text-sm text-ink/40">No recommendations yet.</p>}</section>
        <section><div className="flex items-center justify-between gap-4 mb-3"><h2 className="text-sm text-ink/50 font-medium">Routine activity</h2><Link href="/dashboard/activity" className="text-xs text-vault hover:text-vaultDeep">Open full timeline</Link></div>{grouped.length ? <div className="space-y-3">{grouped.map(group => <ActivityGroup key={group[0].id} events={group} />)}</div> : <p className="text-sm text-ink/40">No routine activity to summarize.</p>}</section>
        <section><h2 className="text-sm text-vault font-medium mb-3">Already handled</h2>{handled.length ? <p className="text-sm text-ink/50">{handled.length} automated or approved action{handled.length === 1 ? "" : "s"} completed. <Link href="/dashboard/activity" className="text-vault hover:text-vaultDeep">View the timeline.</Link></p> : <p className="text-sm text-ink/40">Nothing handled yet.</p>}</section>
      </div>
    </section>
  </main>;
}