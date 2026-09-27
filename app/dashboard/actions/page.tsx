import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

type EventRow = {
  id: string;
  event_type: string;
  summary: string;
  evidence: Record<string, unknown>;
  status: string;
  created_at: string;
};

async function updateEventStatus(formData: FormData) {
  "use server";
  const supabase = createClient();
  const id = formData.get("id") as string;
  const status = formData.get("status") as string;
  await supabase.from("events").update({ status }).eq("id", id);
  revalidatePath("/dashboard/actions");
}

function EventCard({ event }: { event: EventRow }) {
  const hasEvidence = event.evidence && Object.keys(event.evidence).length > 0;

  return (
    <div className="bg-white border border-rule p-5">
      <p className="text-ink text-sm leading-relaxed">{event.summary}</p>
      <p className="text-xs text-ink/40 mt-1.5">
        {new Date(event.created_at).toLocaleString()}
      </p>

      {hasEvidence && (
        <details className="mt-3">
          <summary className="text-xs text-vault cursor-pointer">Show evidence</summary>
          <pre className="mt-2 bg-mist border border-rule p-3 text-xs text-ink/70 overflow-x-auto">
            {JSON.stringify(event.evidence, null, 2)}
          </pre>
        </details>
      )}

      {event.status === "needs_approval" && (
        <div className="mt-4 flex gap-2">
          <form action={updateEventStatus}>
            <input type="hidden" name="id" value={event.id} />
            <input type="hidden" name="status" value="auto_handled" />
            <button className="bg-ink text-mist text-sm px-4 py-2 hover:bg-vaultDeep transition-colors">
              Approve
            </button>
          </form>
          <form action={updateEventStatus}>
            <input type="hidden" name="id" value={event.id} />
            <input type="hidden" name="status" value="dismissed" />
            <button className="border border-rule text-ink/70 text-sm px-4 py-2 hover:bg-mist transition-colors">
              Dismiss
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default async function ActionCenterPage() {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("owner_id", user!.id)
    .single();

  if (!business) redirect("/onboarding");

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  const all = (events ?? []) as EventRow[];
  const needsApproval = all.filter((e) => e.status === "needs_approval");
  const autoHandled = all.filter((e) => e.status === "auto_handled");
  const info = all.filter((e) => e.status === "info");

  return (
    <main className="min-h-screen bg-ledger">
      <header className="border-b border-rule bg-white">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/dashboard" className="font-display text-lg text-ink">
            {business.name}
          </Link>
          <Link href="/dashboard" className="text-sm text-ink/45 hover:text-ink">
            Back to dashboard
          </Link>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="font-display text-3xl text-ink mb-1">Action Center</h1>
        <p className="text-ink/60 mb-10">
          What BizStack noticed, what it recommends, and what it already handled.
        </p>

        <div className="space-y-10">
          <div>
            <h2 className="text-sm text-alert font-medium mb-3">Needs your approval</h2>
            {needsApproval.length === 0 ? (
              <p className="text-sm text-ink/40">Nothing waiting on you.</p>
            ) : (
              <div className="space-y-3">
                {needsApproval.map((e) => <EventCard key={e.id} event={e} />)}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm text-vault font-medium mb-3">Already handled</h2>
            {autoHandled.length === 0 ? (
              <p className="text-sm text-ink/40">Nothing handled yet.</p>
            ) : (
              <div className="space-y-3">
                {autoHandled.map((e) => <EventCard key={e.id} event={e} />)}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm text-ink/50 font-medium mb-3">Recent activity</h2>
            {info.length === 0 ? (
              <p className="text-sm text-ink/40">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {info.map((e) => <EventCard key={e.id} event={e} />)}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
