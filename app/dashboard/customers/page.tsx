import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { BizIcon, BizMetric, BizPanel, BizSection, BizStatus, BizTabs } from "@/components/ui/BizStackVisual";

async function addCustomer(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
  if (!business) return;
  await supabase.from("customers").insert({
    business_id: business.id,
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim() || null,
    phone: String(formData.get("phone") || "").trim() || null
  });
  revalidatePath("/dashboard/customers");
}

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id,name").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const { data: customers } = await supabase.from("customers").select("id,name,email,phone,status,company_name,created_at,last_contact_at").eq("business_id", business.id).order("created_at",{ascending:false});
  const list=customers||[];
  const active=list.filter((c:any)=>c.status==="active").length;

  return <div className="biz-content">
    <BizSection number="8" title="Customers & CRM" subtitle="Manage your customer records, relationships and business activity in one place.">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3"><BizTabs items={["Customers","Companies","Leads","Segments"]}/><Link href="/dashboard/ai-builder"><span className="biz-button bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white">+ Ask AI to manage CRM</span></Link></div>
      <div className="biz-grid biz-grid-4">
        <BizMetric label="Customers" value={String(list.length)} delta="Total records" tone="blue" icon="◎"/>
        <BizMetric label="Active" value={String(active)} delta="Current customer status" tone="green" icon="✓"/>
        <BizMetric label="Companies" value={String(new Set(list.map((c:any)=>c.company_name).filter(Boolean)).size)} delta="Distinct companies" tone="purple" icon="▦"/>
        <BizMetric label="Recent contacts" value={String(list.filter((c:any)=>c.last_contact_at).length)} delta="Records with contact history" tone="cyan" icon="◌"/>
      </div>

      <div className="grid xl:grid-cols-[1fr_320px] gap-3 mt-3">
        <BizPanel title="Customer directory" subtitle="Searchable business records">
          <div className="p-3 border-b border-white/[.07] flex gap-2"><input placeholder="Search customers…" className="flex-1 rounded-xl border border-white/[.08] bg-white/[.025] px-3 py-2.5 text-[8px] text-white outline-none"/><span className="biz-chip">{list.length} records</span></div>
          {list.length===0?<div className="p-8 text-center text-[9px] text-white/25">No customers yet.</div>:list.map((c:any)=><div key={c.id} className="biz-list-row px-4 py-3.5"><BizIcon tone={c.status==="active"?"green":"slate"} size="md">{(c.name||"C").slice(0,1).toUpperCase()}</BizIcon><div className="min-w-0 flex-1"><div className="text-[9px] font-medium text-white/70 truncate">{c.name}</div><div className="text-[7px] text-white/22 mt-1 truncate">{c.company_name||c.email||c.phone||"No additional details"}</div></div><BizStatus tone={c.status==="active"?"green":"slate"}>{c.status}</BizStatus><Link href={"/dashboard/customers/"+c.id} className="text-[8px] text-blue-300">View</Link></div>)}
        </BizPanel>

        <BizPanel title="Add customer" subtitle="Create a real CRM record">
          <div className="p-4">
            <form action={addCustomer} className="space-y-2.5">
              <input name="name" required placeholder="Name" className="w-full rounded-xl border border-white/[.08] bg-white/[.025] px-3 py-3 text-[9px] text-white outline-none"/>
              <input name="email" type="email" placeholder="Email" className="w-full rounded-xl border border-white/[.08] bg-white/[.025] px-3 py-3 text-[9px] text-white outline-none"/>
              <input name="phone" placeholder="Phone" className="w-full rounded-xl border border-white/[.08] bg-white/[.025] px-3 py-3 text-[9px] text-white outline-none"/>
              <button className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 py-3 text-[8px] font-semibold text-white">Add customer</button>
            </form>
            <div className="mt-4 grid grid-cols-2 gap-2">{[["Profile","Identity & contact"],["Invoices","Payment history"],["Portal","Secure customer workspace"],["AI","Automated follow-up"]].map(([a,b],i)=><div key={a} className="rounded-xl border border-white/[.06] bg-white/[.02] p-3"><BizIcon tone={["blue","green","purple","cyan"][i] as any} size="sm">{a[0]}</BizIcon><div className="mt-2 text-[8px] text-white/55">{a}</div><div className="mt-1 text-[7px] text-white/20">{b}</div></div>)}</div>
          </div>
        </BizPanel>
      </div>
    </BizSection>
  </div>;
}
