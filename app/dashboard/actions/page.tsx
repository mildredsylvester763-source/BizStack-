import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type EventRow = { id: string; summary: string; evidence: Record<string, unknown>; status: string; created_at: string };

async function updateEventStatus(formData: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("events").update({ status: formData.get("status") as string }).eq("id", formData.get("id") as string);
  revalidatePath("/dashboard/actions");
}

function EventCard({ event }: { event: EventRow }) {
  const hasEvidence = event.evidence && Object.keys(event.evidence).length > 0;
  return (
    <Card className="p-5">
      <p className="text-text text-sm leading-relaxed">{event.summary}</p>
      <p className="text-xs text-textMuted mt-1.5">{new Date(event.created_at).toLocaleString()}</p>
      {hasEvidence && (
        <details className="mt-3">
          <summary className="text-xs text-primary cursor-pointer">Show evidence</summary>
          <pre className="mt-2 bg-bg border border-line rounded-lg p-3 text-xs text-textMuted overflow-x-auto">{JSON.stringify(event.evidence, null, 2)}</pre>
        </details>
      )}
      {event.status === "needs_approval" && (
        <div className="mt-4 flex gap-2">
          <form action={updateEventStatus}>
            <input type="hidden" name="id" value={event.id} />
            <input type="hidden" name="status" value="auto_handled" />
            <Button type="submit">Approve</Button>
          </form>
          <form action={updateEventStatus}>
            <input type="hidden" name="id" value={event.id} />
            <input type="hidden" name="status" value="dismissed" />
            <Button type="submit" variant="outline">Dismiss</Button>
          </form>
        </div>
      )}
    </Card>
  );
}

export default async function ActionCenterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id, name").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const { data: events } = await supabase.from("events").select("*").eq("business_id", business.id).order("created_at", { ascending: false });
  const all = (events ?? []) as EventRow[];
  const needsApproval = all.filter((e) => e.status === "needs_approval");
  const autoHandled = all.filter((e) => e.status === "auto_handled");
  const info = all.filter((e) => e.status === "info");

  return (
    <section className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl text-text mb-1">Action Center</h1>
      <p className="text-textMuted mb-8">What BizStack noticed, recommends, and already handled.</p>
      <div className="space-y-8">
        <div>
          <h2 className="text-sm text-warning font-medium mb-3">Needs your approval</h2>
          {needsApproval.length === 0 ? <p className="text-sm text-textMuted">Nothing waiting on you.</p> : <div className="space-y-3">{needsApproval.map((e) => <EventCard key={e.id} event={e} />)}</div>}
        </div>
        <div>
          <h2 className="text-sm text-success font-medium mb-3">Already handled</h2>
          {autoHandled.length === 0 ? <p className="text-sm text-textMuted">Nothing handled yet.</p> : <div className="space-y-3">{autoHandled.map((e) => <EventCard key={e.id} event={e} />)}</div>}
        </div>
        <div>
          <h2 className="text-sm text-textMuted font-medium mb-3">Recent activity</h2>
          {info.length === 0 ? <p className="text-sm text-textMuted">No activity yet.</p> : <div className="space-y-3">{info.map((e) => <EventCard key={e.id} event={e} />)}</div>}
        </div>
      </div>
    </section>
  );
}
