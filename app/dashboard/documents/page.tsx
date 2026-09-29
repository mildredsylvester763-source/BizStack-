import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { BizIcon, BizPanel, BizSection, BizStatus, BizTabs } from "@/components/ui/BizStackVisual";

export default async function DocumentsPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/login");
 const {data:business}=await supabase.from("businesses").select("id,name").eq("owner_id",user.id).single(); if(!business)redirect("/onboarding");
 const {data:documents}=await supabase.from("ai_business_documents").select("id,document_type,title,status,version,audience,funder_name,content,assumptions,validation,created_at,updated_at").eq("business_id",business.id).order("updated_at",{ascending:false});
 const docs=documents||[];
 return <div className="biz-content">
  <BizSection number="7" title="File Management" subtitle="Store, organize and use business files as governed AI context.">
   <div className="flex flex-wrap justify-between gap-3 mb-3"><BizTabs items={["All Files","Documents","Spreadsheets","Images","Videos","Archives","Shared","Trash"]}/><Link href="/dashboard/ai-builder"><span className="biz-button bg-gradient-to-r from-blue-600 to-violet-600 text-white">+ Upload / Use in AI Builder</span></Link></div>
   <div className="grid xl:grid-cols-[260px_1fr] gap-3">
    <BizPanel title="Libraries" subtitle="Organize business knowledge">
      <div className="p-3 space-y-1.5">{["AI Files","Documents","Images","Videos","Archives","Shared","Trash"].map((x,i)=><div key={x} className={"flex items-center gap-2 rounded-xl px-3 py-2.5 "+(i===0?"bg-blue-500/10 border border-blue-400/15":"bg-white/[.02] border border-transparent")}><BizIcon tone={i===0?"blue":"slate"} size="sm">{x.slice(0,1)}</BizIcon><span className="text-[8px] text-white/55">{x}</span><span className="ml-auto text-[7px] text-white/15">{i===0?docs.length:"—"}</span></div>)}</div>
    </BizPanel>
    <BizPanel title="AI Business Documents" subtitle="Structured drafts produced from real business context">
      {docs.length===0?<div className="p-8 text-center"><BizIcon tone="purple" size="lg">□</BizIcon><div className="mt-3 text-[10px] text-white/55">No AI business documents yet</div><p className="mt-1 text-[8px] text-white/20">Build a plan, grant pack, loan brief or CFO document from the AI Builder.</p><Link href="/dashboard/ai-builder" className="mt-3 inline-flex"><span className="biz-button bg-gradient-to-r from-blue-600 to-violet-600 text-white">Create document</span></Link></div>:
      docs.map((d:any)=><Link href="/dashboard/documents" key={d.id} className="biz-list-row px-4 py-4 hover:bg-white/[.025]"><BizIcon tone={d.status==="approved"?"green":"purple"} size="md">□</BizIcon><div className="min-w-0 flex-1"><div className="text-[9px] text-white/70 truncate">{d.title}</div><div className="text-[7px] text-white/20 mt-1">{d.document_type.replaceAll("_"," ")} · version {d.version} · updated {new Date(d.updated_at).toLocaleDateString()}</div></div><BizStatus tone={d.status==="approved"?"green":"blue"}>{d.status}</BizStatus><span className="text-white/15">›</span></Link>)}
    </BizPanel>
   </div>
  </BizSection>
 </div>;
}
