// @ts-nocheck
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

async function changeStatus(formData:FormData){
  "use server";
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
  const {data:business}=await supabase.from("businesses").select("id").eq("owner_id",user.id).single();if(!business)redirect("/onboarding");
  const id=String(formData.get("id")||""),status=String(formData.get("status")||"draft");
  if(!["draft","review","approved","archived"].includes(status))throw new Error("Invalid document status.");
  const {error}=await supabase.from("ai_business_documents").update({status,updated_at:new Date().toISOString()}).eq("id",id).eq("business_id",business.id);
  if(error)throw new Error(error.message);
  revalidatePath("/dashboard/documents");
}

async function buildDocument(formData:FormData){
  "use server";
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
  const {data:business}=await supabase.from("businesses").select("id").eq("owner_id",user.id).single();if(!business)redirect("/onboarding");
  const prompt=String(formData.get("prompt")||"").trim();if(!prompt)throw new Error("Describe the document you need.");
  const {runBusinessDocumentBuild}=await import("@/lib/ai/build-engine/business-document-runtime");
  await runBusinessDocumentBuild({businessId:business.id,userId:user.id,prompt,mode:"draft_only"});
  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard/ai-builder");
}

export default async function DocumentsPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const {data:business}=await supabase.from("businesses").select("id,name").eq("owner_id",user.id).single();if(!business)redirect("/onboarding");
 const {data:documents}=await supabase.from("ai_business_documents").select("id,document_type,title,status,version,audience,funder_name,content,assumptions,validation,created_at,updated_at").eq("business_id",business.id).order("updated_at",{ascending:false});
 return <main className="min-h-screen bg-ledger">
  <header className="border-b border-rule bg-white"><div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center"><div><Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link><h1 className="font-display text-2xl mt-1">AI Business Documents</h1></div><Link href="/dashboard/ai-builder" className="text-xs text-vault">AI Builder</Link></div></header>
  <section className="max-w-6xl mx-auto px-6 py-8 space-y-6">
   <form action={buildDocument} className="bg-ink text-mist p-6"><p className="text-xs uppercase tracking-[.16em] text-mist/50">Document compiler</p><h2 className="font-display text-3xl mt-2">Draft a business plan, grant, loan pack or CFO brief.</h2><p className="text-sm text-mist/55 mt-2">The compiler creates structured sections, explicit assumptions and a submission-readiness boundary. It does not invent external evidence.</p><textarea name="prompt" required rows={6} className="mt-5 w-full bg-white/10 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30" placeholder="Create a grant application draft for a ₦5,000,000 expansion project. Target a youth enterprise fund. Focus on job creation, digital operations and measurable revenue growth."/><button className="mt-4 bg-vault text-white px-5 py-3 text-sm">Generate draft</button></form>

   <div className="space-y-5">{(documents||[]).map((d:any)=><article key={d.id} className="bg-white border border-rule">
    <div className="p-5 border-b border-rule flex flex-col md:flex-row md:items-start md:justify-between gap-4"><div><p className="text-xs uppercase tracking-[.14em] text-vault">{d.document_type.replace("_"," ")}</p><h2 className="font-display text-2xl mt-1">{d.title}</h2><p className="text-xs text-ink/45 mt-1">Version {d.version} · {d.status}{d.audience?" · "+d.audience:""}{d.funder_name?" · "+d.funder_name:""}</p></div><div className="flex flex-wrap gap-2">{d.status!=="approved"&&<form action={changeStatus}><input type="hidden" name="id" value={d.id}/><input type="hidden" name="status" value={d.status==="draft"?"review":"approved"}/><button className="bg-ink text-white px-3 py-2 text-xs">{d.status==="draft"?"Move to review":"Approve"}</button></form>}{d.status!=="archived"&&<form action={changeStatus}><input type="hidden" name="id" value={d.id}/><input type="hidden" name="status" value="archived"/><button className="border border-rule px-3 py-2 text-xs">Archive</button></form>}</div></div>
    <div className="p-5 grid lg:grid-cols-2 gap-5"><div className="space-y-3">{Object.entries(d.content?.sections||{}).map(([key,value]:any)=><details key={key} className="border border-rule p-3"><summary className="cursor-pointer text-sm font-medium">{key.replaceAll("_"," ")}</summary><pre className="mt-3 text-xs text-ink/60 whitespace-pre-wrap font-sans">{typeof value==="string"?value:JSON.stringify(value,null,2)}</pre></details>)}</div><div className="bg-mist border border-rule p-4 h-fit"><p className="text-xs uppercase tracking-[.14em] text-alert">Evidence boundary</p><p className="text-sm text-ink/65 mt-2">{d.validation?.reason}</p><p className="text-xs text-ink/45 mt-3">Assumptions</p><ul className="text-xs text-ink/55 mt-2 space-y-1">{(d.assumptions||[]).map((a:string,i:number)=><li key={i}>{a}</li>)}</ul></div></div>
   </article>)}{!(documents||[]).length&&<p className="bg-white border border-rule p-8 text-sm text-ink/45">No AI business documents yet.</p>}</div>
  </section>
 </main>;
}
