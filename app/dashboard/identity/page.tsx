import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { BizIcon, BizPanel, BizSection, BizStatus } from "@/components/ui/BizStackVisual";

export default async function IdentityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id,name").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");

  const { data: verifications } = await supabase.from("customer_identity_verifications")
    .select("id,customer_id,verification_type,status,provider,verified_at,expires_at,created_at,customer:customers(name,company_name)")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false }).limit(100);

  const checks=verifications||[];
  const verified=checks.filter((x:any)=>x.status==="verified").length;
  const pending=checks.filter((x:any)=>x.status==="pending").length;

  return <div className="biz-content">
    <BizSection number="4.4" title="Security & Authentication" subtitle="Keep business data safe with layered identity, session and verification controls.">
      <div className="grid xl:grid-cols-[1fr_1fr_1fr] gap-3">
        <BizPanel title="Authentication providers" subtitle="Business login surfaces">
          <div className="p-4 space-y-2">
            {["Email & Password","Google OAuth","GitHub OAuth","Microsoft OAuth","Magic Link","Phone OTP"].map((x,i)=><div key={x} className="flex items-center gap-2 rounded-xl border border-white/[.06] bg-white/[.02] p-3"><BizIcon tone={i<4?"green":"blue"} size="sm">✓</BizIcon><span className="text-[8px] text-white/55 flex-1">{x}</span><BizStatus tone="green">Enabled</BizStatus></div>)}
          </div>
        </BizPanel>
        <BizPanel title="Session & security" subtitle="Protection controls">
          <div className="p-4 space-y-2">
            {[
              ["Session timeout","7 days","Configured"],
              ["Refresh token rotation","Enabled","Recommended"],
              ["Multi-factor authentication","Enabled","Available"],
              ["IP restrictions","Disabled","Optional"],
              ["Audit logs","Enabled","Recorded"]
            ].map(([a,b,c])=><div key={a} className="rounded-xl border border-white/[.06] bg-white/[.02] p-3"><div className="text-[8px] text-white/55">{a}</div><div className="flex justify-between mt-2"><span className="text-[8px] text-white/25">{b}</span><span className="text-[7px] text-emerald-300">{c}</span></div></div>)}
          </div>
        </BizPanel>
        <BizPanel title="User roles & permissions" subtitle="Access boundaries">
          <div className="p-4 space-y-2">
            {["Owner","Admin","Member","Viewer","Custom role"].map((x,i)=><div key={x} className="biz-list-row px-0"><BizIcon tone={i===0?"purple":"slate"} size="sm">{x.slice(0,1)}</BizIcon><div className="flex-1 text-[8px] text-white/55">{x}</div><span className="biz-mini">{["Full access","Manage team","Build & view","Read only","Custom"][i]}</span></div>)}
          </div>
        </BizPanel>
      </div>
    </BizSection>

    <BizSection title="Identity verification ledger" subtitle="Verification results are separate from customer records and remain auditable.">
      <div className="grid xl:grid-cols-[1.2fr_.8fr] gap-3">
        <BizPanel title="Verification requests" subtitle="Current checks">
          {checks.length===0?<div className="p-8 text-center"><BizIcon tone="purple" size="lg">✓</BizIcon><div className="mt-3 text-[10px] text-white/55">No verification checks yet</div><p className="mt-1 text-[8px] text-white/20">Create checks only when the business actually requires identity evidence.</p></div>:
          checks.map((v:any)=><div key={v.id} className="biz-list-row px-4 py-4"><BizIcon tone={v.status==="verified"?"green":v.status==="pending"?"orange":"red"} size="md">✓</BizIcon><div className="min-w-0 flex-1"><div className="text-[9px] text-white/65">{v.customer?.name||v.customer?.company_name||"Customer"}</div><div className="text-[7px] text-white/20 mt-1">{String(v.verification_type).replaceAll("_"," ")} · {v.provider||"Provider not connected"}</div></div><BizStatus tone={v.status==="verified"?"green":v.status==="pending"?"orange":"red"}>{v.status}</BizStatus></div>)}
        </BizPanel>
        <BizPanel title="Verification summary" subtitle="Live counts from this business">
          <div className="p-4 grid grid-cols-2 gap-2"><div className="biz-metric"><div className="biz-metric-label">Verified</div><div className="biz-metric-value">{verified}</div></div><div className="biz-metric"><div className="biz-metric-label">Pending</div><div className="biz-metric-value">{pending}</div></div><div className="col-span-2 rounded-xl border border-indigo-400/15 bg-indigo-400/[.04] p-3 text-[8px] leading-4 text-indigo-100/45">Verification status is evidence returned by a configured verification provider; it is not inferred from the customer's name or contact record.</div></div>
        </BizPanel>
      </div>
    </BizSection>
  </div>;
}
