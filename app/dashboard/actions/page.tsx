import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

type EventRow = {
  id: string;
  event_type: string;
  summary: string;
  evidence: unknown;
  status: string;
  created_at: string;
};

type EventSectionProps = {
  title: string;
  description: string;
  events: EventRow[];
};

async function updateEventStatus(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") ?? "");
  const nextStatus = String(formData.get("status") ?? "");

  if (!eventId || !["auto_handled", "dismissed"].includes(nextStatus)) {
    return;
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!business) {
    redirect("/onboarding");
  }

  const { error } = await supabase
    .from("events")
    .update({ status: nextStatus })
    .eq("id", eventId)
    .eq("business_id", business.id);

  if (error) {
    throw new Error("Unable to update this action: " + error.message);
  }

  revalidatePath("/dashboard/actions");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function EventSection({ title, description, events }: EventSectionProps) {
  return (
    <section className="mb-10">
      <div className="mb-4">
        <h2 className="font-display text-lg text-ink">{title}</h2>
        <p className="text-sm text-ink/60">{description}</p>
      </div>

      {events.length === 0 ? (
        <div className="border border-line bg-white px-5 py-6 text-sm text-ink/50">
          Nothing here yet.
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <article key={event.id} className="border border-line bg-white px-5 py-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-ink/40">
                    {event.event_type.replaceAll(".", " · ")}
                  </p>
                  <p className="font-body text-sm leading-6 text-ink">{event.summary}</p>
                  <p className="mt-2 text-xs text-ink/45">{formatDate(event.created_at)}</p>
                </div>

                {event.status === "needs_approval" && (
                  <div className="flex shrink-0 gap-2">
                    <form action={updateEventStatus}>
                      <input type="hidden" name="event_id" value={event.id} />
                      <input type="hidden" name="status" value="auto_handled" />
                      <button
                        type="submit"
                        className="rounded-sm bg-moss px-3 py-2 text-xs text-paper hover:bg-moss/90"
                      >
                        Approve
                      </button>
                    </form>
                    <form action={updateEventStatus}>
                      <input type="hidden" name="event_id" value={event.id} />
                      <input type="hidden" name="status" value="dismissed" />
                      <button
                        type="submit"
                        className="rounded-sm border border-line px-3 py-2 text-xs text-ink/70 hover:border-ink/30 hover:text-ink"
                      >
                        Dismiss
                      </button>
                    </form>
                  </div>
                )}
              </div>

              <details className="mt-4 border-t border-line pt-3">
                <summary className="cursor-pointer text-xs text-moss hover:text-ink">
                  View evidence
                </summary>
                <pre className="mt-3 overflow-x-auto rounded-sm bg-ink px-4 py-3 text-xs leading-relaxed text-paper">
                  {JSON.stringify(event.evidence ?? {}, null, 2)}
                </pre>
              </details>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function ActionCenterPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (!business) {
    redirect("/onboarding");
  }

  const { data: events, error } = await supabase
    .from("events")
    .select("id, event_type, summary, evidence, status, created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Unable to load the action center: " + error.message);
  }

  const eventRows = (events ?? []) as EventRow[];
  const needsApproval = eventRows.filter((event) => event.status === "needs_approval");
  const alreadyHandled = eventRows.filter((event) => event.status === "auto_handled");
  const recentActivity = eventRows.filter((event) => event.status === "info");

  return (
    <main className="min-h-screen">
      <header className="flex flex-col gap-4 border-b border-line px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/dashboard" className="font-display text-lg text-ink hover:text-moss">
            {business.name}
          </Link>
          <p className="text-xs text-ink/50">AI Action Center</p>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-ink/60 hover:text-ink">Dashboard</Link>
          <Link href="/dashboard/settings/automation" className="text-ink/60 hover:text-ink">
            Automation Settings
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
        <div className="mb-10">
          <p className="mb-3 text-xs uppercase tracking-[0.18em] text-moss">Module 2</p>
          <h1 className="font-display text-3xl text-ink">AI Action Center</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">
            See what BizStack noticed, what it handled, and where it needs your decision.
            Every future module will use this same activity spine.
          </p>
        </div>

        <EventSection
          title="Needs your approval"
          description="Actions waiting for your permission before anything is sent or changed."
          events={needsApproval}
        />
        <EventSection
          title="Already handled"
          description="Actions BizStack completed according to your autonomy settings."
          events={alreadyHandled}
        />
        <EventSection
          title="Recent activity"
          description="Important business events recorded across your workspace."
          events={recentActivity}
        />
      </section>
    </main>
  );
}
