import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import ActivityFeed, { type ActivityEvent } from "./activity-feed";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const supabase = await await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id,name,industry,currency")
    .eq("owner_id", user.id)
    .single();

  if (!business) redirect("/onboarding");

  const { data: events } = await supabase
    .from("events")
    .select("id,event_type,summary,evidence,status,created_at,priority,category,action_type,due_at,resolved_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (events ?? []) as ActivityEvent[];
  const attention = rows.filter(e => e.status === "needs_approval" || e.priority === "critical" || e.priority === "high").length;
  const handled = rows.filter(e => e.status === "auto_handled").length;

  return (
    <main className="min-h-screen bg-[#f5f7f6] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/dashboard" className="shrink-0 text-[11px] font-medium text-slate-400 hover:text-slate-900">← Workspace</Link>
            <span className="h-5 w-px bg-slate-200" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[.16em] text-slate-400">Operations / Audit</p>
              <h1 className="truncate text-sm font-semibold text-slate-900">Activity feed</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block text-right">
              <p className="text-[10px] text-slate-400">{business.name}</p>
              <p className="text-[9px] text-slate-300">{business.industry || "Business"} · {business.currency || "Local currency"}</p>
            </div>
            <Link href="/dashboard/actions" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50">Action Center{attention ? <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] text-amber-700">{attention}</span> : null}</Link>
          </div>
        </div>
      </header>

      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-7 lg:py-9">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-7">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[.18em] text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live business record
            </div>
            <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-.03em] text-slate-950">Everything that happened.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">A searchable operational record of business events, automated work, approvals, exceptions and outcomes. Routine history stays here; decisions that need you stay in Action Center.</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">{rows.length} recorded events</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">{handled} handled automatically</span>
          </div>
        </div>

        <ActivityFeed events={rows} />
      </section>
    </main>
  );
}
