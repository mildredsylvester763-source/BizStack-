import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { BizPanel, BizSection } from "@/components/ui/BizStackVisual";

export default async function BillingPage() {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const {data:business}=await supabase.from("businesses").select("id,name").eq("owner_id",user.id).single();
  if(!business)redirect("/onboarding");
  const {data:plans}=await supabase.from("billing_plans").select("id,code,name,description,monthly_price,annual_price,currency,features").eq("active",true).order("sort_order");
  const {data:subscription}=await supabase.from("business_subscriptions").select("status,billing_interval,current_period_end,plan_id").eq("business_id",business.id).in("status",["trialing","active","past_due","paused"]).maybeSingle();
  let currentPlan="No active plan";
  if(subscription?.plan_id){const {data:p}=await supabase.from("billing_plans").select("name").eq("id",subscription.plan_id).maybeSingle();if(p?.name)currentPlan=p.name;}

  return <div className="biz-content">
    <BizSection number="12" title="Plans & Pricing" subtitle="Choose the operating layer that fits the business as it grows.">
      <BizPanel className="mb-3">
        <div className="p-5 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-blue-500/[.08] via-indigo-500/[.05] to-violet-500/[.08]">
          <div><div className="text-[8px] uppercase tracking-[.18em] text-blue-200/45">Current workspace</div><div className="mt-2 text-lg font-semibold text-white">{currentPlan}</div><div className="mt-1 text-[8px] text-white/25">{subscription ? subscription.status+" · "+subscription.billing_interval : "No active subscription"}</div></div>
          <span className="biz-status border-blue-400/20 bg-blue-400/10 text-blue-300">{subscription ? "Active state" : "Ready to choose"}</span>
        </div>
      </BizPanel>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        {(plans||[]).map((p:any,i:number)=>{
          const features=Array.isArray(p.features)?p.features.filter((x:any)=>typeof x==="string"):[],
          tone=i===1?"border-blue-400/35 shadow-[0_14px_45px_rgba(48,96,255,.13)]":"border-white/[.08]";
          return <article key={p.code} className={"rounded-2xl border bg-gradient-to-b from-white/[.035] to-white/[.015] p-5 "+tone}>
            {i===1&&<div className="text-[7px] uppercase tracking-[.16em] text-blue-300 mb-3">Popular workspace</div>}
            <div className="text-[11px] font-semibold text-white/80">{p.name}</div>
            <p className="text-[8px] leading-4 text-white/28 mt-2 min-h-8">{p.description}</p>
            <div className="mt-5 text-3xl font-semibold text-white">{String(p.monthly_price)}<span className="text-[9px] text-white/25"> /month</span></div>
            <div className="text-[7px] text-white/18 mt-1">{String(p.annual_price)}/year · {p.currency}</div>
            <div className="mt-5 space-y-2">{features.slice(0,7).map((f:string)=><div key={f} className="flex gap-2 text-[8px] text-white/42"><span className="text-emerald-300">✓</span>{f}</div>)}</div>
            <button disabled className="mt-6 w-full rounded-xl border border-white/[.08] bg-white/[.035] py-2.5 text-[8px] text-white/30">Billing provider setup required</button>
          </article>
        })}
      </div>

      <div className="grid xl:grid-cols-3 gap-3 mt-3">
        {["Usage & credits","Workspace members","Payment & invoices"].map((x,i)=><BizPanel key={x} title={x} subtitle={["AI and automation usage","Manage who can access BizStack","Your own BizStack subscription billing"][i]}><div className="p-4 text-[8px] leading-5 text-white/30">{i===0?"Usage controls can be layered on top of the existing AI build and runtime records.":i===1?"Team access controls are available from business settings and the AI Builder workspace.":"Connect the subscription payment provider when the billing runtime is enabled."}</div></BizPanel>)}
      </div>
    </BizSection>
  </div>;
}
