import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id,name").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const { data: plans } = await supabase.from("billing_plans").select("id,code,name,description,monthly_price,annual_price,currency,features").eq("active", true).order("sort_order");
  const { data: subscription } = await supabase.from("business_subscriptions").select("status,billing_interval,current_period_end,plan_id").eq("business_id", business.id).in("status", ["trialing","active","past_due","paused"]).maybeSingle();
  let currentPlanName = "No active plan";
  if (subscription?.plan_id) {
    const { data: currentPlan } = await supabase.from("billing_plans").select("name").eq("id", subscription.plan_id).maybeSingle();
    if (currentPlan?.name) currentPlanName = currentPlan.name;
  }
  return <main className="min-h-screen bg-ledger">
    <header className="border-b border-rule bg-white"><div className="max-w-6xl mx-auto px-6 py-5 flex justify-between"><div><Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link><h1 className="font-display text-2xl mt-1">Plans & billing</h1></div><span className="text-xs text-ink/40">Billing foundation</span></div></header>
    <section className="max-w-6xl mx-auto px-6 py-10">
      <div className="bg-white border border-rule p-6 mb-8"><p className="text-xs uppercase tracking-[.16em] text-vault">Current subscription</p><h2 className="font-display text-2xl mt-2">{currentPlanName}</h2><p className="text-sm text-ink/50 mt-1">{subscription ? subscription.status + " · " + subscription.billing_interval : "Choose a plan when billing is ready."}</p></div>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">{(plans || []).map((p) => { const features = Array.isArray(p.features) ? p.features.filter((f): f is string => typeof f === "string") : []; return <article key={p.code} className="bg-white border border-rule p-6"><h3 className="font-display text-xl">{p.name}</h3><p className="text-sm text-ink/50 mt-2 min-h-10">{p.description}</p><p className="font-display text-3xl mt-5">{"$" + p.monthly_price}<span className="text-sm font-sans text-ink/45">/month</span></p><p className="text-xs text-ink/40 mt-1">{"$" + p.annual_price}/year</p><ul className="mt-5 space-y-2 text-sm text-ink/65">{features.map((f) => <li key={f}>• {f}</li>)}</ul><button disabled className="mt-6 w-full border border-rule px-4 py-2.5 text-sm text-ink/40">Connect billing provider later</button></article>; })}</div>
    </section>
  </main>;
}