import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { BizIcon, BizMetric, BizPanel, BizSection, BizStatus, BizTabs } from "@/components/ui/BizStackVisual";

export default async function MarketingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id,name").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");

  const [{ data: campaigns }, { data: customers }, { data: events }] = await Promise.all([
    supabase.from("marketing_campaigns").select("id,name,status,channel,budget,starts_at,ends_at,created_at").eq("business_id", business.id).order("created_at",{ascending:false}).limit(20),
    supabase.from("customers").select("id,status,last_contact_at,created_at").eq("business_id", business.id),
    supabase.from("events").select("id,event_type,summary,status,created_at").eq("business_id",business.id).in("event_type",["marketing.campaign","marketing.email","marketing.social"]).order("created_at",{ascending:false}).limit(10)
  ]);

  const liveCampaigns=campaigns||[];
  const active=liveCampaigns.filter((x:any)=>x.status==="active").length;
  const totalBudget=liveCampaigns.reduce((s:any,x:any)=>s+Number(x.budget||0),0);
  const recentlyContacted=(customers||[]).filter((x:any)=>x.last_contact_at).length;

  return <div className="biz-content">
    <BizSection number="3.4" title="Marketing & Automation" subtitle="Plan campaigns, prepare content and connect outreach to real business data.">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3"><BizTabs items={["Campaigns","Email","Social","Audiences","Automation"]}/><Link href="/dashboard/ai-builder"><span className="biz-button bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white">Create campaign with AI</span></Link></div>
      <div className="biz-grid biz-grid-4">
        <BizMetric label="Campaigns" value={String(liveCampaigns.length)} delta="Saved marketing campaigns" tone="blue" icon="◈"/>
        <BizMetric label="Active" value={String(active)} delta="Currently active" tone="green" icon="●"/>
        <BizMetric label="Budget" value={totalBudget?totalBudget.toLocaleString():"—"} delta={totalBudget?"Tracked campaign budgets":"No budget records"} tone="purple" icon="¤"/>
        <BizMetric label="Customers reached" value={String(recentlyContacted)} delta="Records with contact history" tone="cyan" icon="◎"/>
      </div>

      <div className="grid xl:grid-cols-[1.25fr_.75fr] gap-3 mt-3">
        <BizPanel title="Campaign workspace" subtitle="Real campaign records only; AI creation is handed into the full Builder.">
          {liveCampaigns.length===0?<div className="p-9 text-center"><BizIcon tone="purple" size="lg">✦</BizIcon><div className="mt-3 text-[10px] text-white/55">No campaigns yet</div><p className="text-[8px] text-white/22 mt-1">Use AI Builder to create a campaign plan, assets and workflow, then track the saved campaign here.</p><Link href="/dashboard/ai-builder" className="mt-3 inline-flex"><span className="biz-button bg-gradient-to-r from-blue-600 to-violet-600 text-white">Open AI Builder</span></Link></div>:
            liveCampaigns.map((c:any)=><div key={c.id} className="biz-list-row px-4 py-4"><BizIcon tone={c.status==="active"?"green":"purple"} size="md">{c.channel==="email"?"✉":c.channel==="social"?"◎":"◆"}</BizIcon><div className="min-w-0 flex-1"><div className="text-[9px] text-white/65">{c.name}</div><div className="text-[7px] text-white/20 mt-1">{c.channel||"multi-channel"} · {c.starts_at?String(c.starts_at).slice(0,10):"No start date"}</div></div><BizStatus tone={c.status==="active"?"green":"slate"}>{c.status}</BizStatus></div>)}
        </BizPanel>

        <BizPanel title="AI marketing actions" subtitle="Fast paths into planning, content and automation.">
          <div className="p-3 space-y-2">
            {[["Campaign strategist","Build a 30-day campaign plan","/dashboard/ai-builder","purple"],["Email sequence","Draft a segmented customer sequence","/dashboard/ai-builder","cyan"],["Social content","Create platform-specific posts","/dashboard/ai-builder","blue"],["Audience analysis","Find customers by business context","/dashboard/customers","green"],["Workflow automation","Trigger follow-up from business events","/dashboard/actions","orange"]].map(([a,b,href,tone])=><Link key={a} href={href} className="flex items-center gap-2 rounded-2xl border border-white/[.06] bg-white/[.02] p-3 hover:border-blue-400/20"><BizIcon tone={tone as any} size="sm">✦</BizIcon><div className="min-w-0 flex-1"><div className="text-[8px] text-white/62">{a}</div><div className="text-[7px] text-white/20 mt-1">{b}</div></div><span className="text-[9px] text-white/15">›</span></Link>)}
          </div>
        </BizPanel>
      </div>

      <BizSection title="Marketing activity" subtitle="Business events related to campaigns and outreach.">
        <BizPanel title="Recent marketing events">
          {(events||[]).length===0?<div className="p-6 text-[9px] text-white/25">No marketing events captured yet.</div>:(events||[]).map((e:any)=><div className="biz-list-row" key={e.id}><span className="text-blue-300">●</span><span className="biz-small flex-1 truncate">{e.summary}</span><BizStatus tone={e.status==="needs_approval"?"orange":"slate"}>{e.status}</BizStatus><span className="biz-mini">{new Date(e.created_at).toLocaleDateString()}</span></div>)}
        </BizPanel>
      </BizSection>
    </BizSection>
  </div>;
}
