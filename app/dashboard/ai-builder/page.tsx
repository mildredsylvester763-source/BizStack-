// @ts-nocheck
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { runWebsiteBuild } from "@/lib/ai/build-engine/runtime";
import { runInvoiceBuild } from "@/lib/ai/build-engine/invoice-runtime";

async function runBuild(formData:FormData){
  "use server";
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect("/login");
  const {data:business}=await supabase.from("businesses").select("id").eq("owner_id",user.id).single(); if(!business) redirect("/onboarding");
  const capability=String(formData.get("capability")||"");
  const prompt=String(formData.get("prompt")||"").trim();
  if(!prompt) throw new Error("Describe the work you want BizStack to perform.");
  if(capability==="invoice") await runInvoiceBuild({businessId:business.id,userId:user.id,prompt,mode:"draft_only"});
  else await runWebsiteBuild({businessId:business.id,userId:user.id,prompt,mode:"auto_execute",publish:false});
  revalidatePath("/dashboard/ai-builder");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/website");
}

export default async function AIBuilderPage(){
 const supabase=createClient();
 const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/login");
 const {data:business}=await supabase.from("businesses").select("id,name").eq("owner_id",user.id).single(); if(!business)redirect("/onboarding");
 const {data:runs}=await supabase.from("ai_build_runs").select("id,capability_key,status,provider_status,request_text,result,error_message,created_at").eq("business_id",business.id).order("created_at",{ascending:false}).limit(12);
 return <main className="min-h-screen bg-ledger">
  <header className="border-b border-rule bg-white"><div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between"><div><Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link><h1 className="font-display text-2xl mt-1">BizStack Build Engine</h1></div><span className="text-xs text-ink/45">{business.name}</span></div></header>
  <section className="max-w-6xl mx-auto px-6 py-10">
   <div className="max-w-3xl"><p className="text-xs uppercase tracking-[.16em] text-vault">Business operating compiler</p><h2 className="font-display text-4xl mt-2">Tell BizStack what work needs to happen.</h2><p className="text-sm text-ink/55 mt-3">Each request becomes a durable run with a plan, executable steps, artifacts, validation tests, provider state and an audit event. The architecture is provider-ready, but core workflows do not depend on an external AI key.</p></div>
   <div className="grid lg:grid-cols-2 gap-6 mt-8">
    <form action={runBuild} className="bg-white border border-rule p-6">
      <input type="hidden" name="capability" value="website"/>
      <p className="text-xs uppercase tracking-[.16em] text-vault">Website compiler</p>
      <h3 className="font-display text-2xl mt-2">Build a website from a description</h3>
      <p className="text-sm text-ink/50 mt-2">Sitemap, page models, sections, forms, SEO and integration requirements.</p>
      <textarea name="prompt" required rows={7} className="mt-5 w-full border border-rule px-4 py-3 text-sm" placeholder="Build a modern website for my logistics company. Add services, tracking CTA, pricing, FAQ, contact form and WhatsApp. Make it mobile-first."/>
      <button className="mt-4 bg-ink text-white px-5 py-3 text-sm">Run website build</button>
    </form>
    <form action={runBuild} className="bg-white border border-rule p-6">
      <input type="hidden" name="capability" value="invoice"/>
      <p className="text-xs uppercase tracking-[.16em] text-vault">Invoice compiler</p>
      <h3 className="font-display text-2xl mt-2">Create a real draft invoice</h3>
      <p className="text-sm text-ink/50 mt-2">Matches an existing customer, parses billable lines, creates the invoice, recalculates totals and validates the result.</p>
      <textarea name="prompt" required rows={7} className="mt-5 w-full border border-rule px-4 py-3 text-sm" placeholder="Create an invoice for Acme Ltd for 2 logo design at 150000, due in 14 days, VAT 7.5%."/>
      <button className="mt-4 bg-vault text-white px-5 py-3 text-sm">Create draft invoice</button>
    </form>
       
    <form action={runBuild} className="bg-white border border-rule p-6">
      <input type="hidden" name="capability" value="product_inventory"/>
      <p className="text-xs uppercase tracking-[.16em] text-vault">Product + inventory</p>
      <h3 className="font-display text-2xl mt-2">Create a product and opening stock</h3>
      <p className="text-sm text-ink/50 mt-2">Creates the real product, price, cost, low-stock threshold and audited opening stock movement.</p>
      <textarea name="prompt" required rows={7} className="mt-5 w-full border border-rule px-4 py-3 text-sm" placeholder="Create product Premium Hoodie, SKU PH-001, price 25000, cost 14000, stock 20, low stock 5."/>
      <button className="mt-4 bg-vault text-white px-5 py-3 text-sm">Create product</button>
    </form>
    <form action={runBuild} className="bg-white border border-rule p-6">
      <input type="hidden" name="capability" value="money_transaction"/>
      <p className="text-xs uppercase tracking-[.16em] text-vault">Money entry</p>
      <h3 className="font-display text-2xl mt-2">Record cash movement</h3>
      <p className="text-sm text-ink/50 mt-2">Records a real inflow or outflow with an optional matching financial account and reconciliation state.</p>
      <textarea name="prompt" required rows={7} className="mt-5 w-full border border-rule px-4 py-3 text-sm" placeholder="Record an expense of ₦50000 for fuel from my Main Cash account."/>
      <button className="mt-4 bg-ink text-white px-5 py-3 text-sm">Record money</button>
    </form>
   </div>
   <div className="mt-10 bg-white border border-rule">
    <div className="p-5 border-b border-rule"><p className="text-xs uppercase tracking-[.16em] text-vault">Build ledger</p><h3 className="font-display text-xl mt-1">Recent execution history</h3></div>
    <div className="divide-y divide-rule">{(runs??[]).map(run=><div key={run.id} className="p-5 grid md:grid-cols-[130px_1fr_110px_110px] gap-4 items-start"><div className="text-xs uppercase text-vault">{run.capability_key}</div><div><p className="text-sm text-ink">{run.request_text}</p>{run.error_message&&<p className="text-xs text-alert mt-2">{run.error_message}</p>}{run.result?.invoiceNumber&&<p className="text-xs text-ink/45 mt-2">Invoice {run.result.invoiceNumber} · {run.result.currency} {run.result.total}</p>}{run.result?.metrics&&<p className="text-xs text-ink/45 mt-2">{run.result.metrics.pages} pages · {run.result.metrics.sections} sections</p>}</div><div className="text-xs capitalize text-ink/60">{String(run.status).replace("_"," ")}</div><div className="text-xs text-ink/40 text-right">{new Date(run.created_at).toLocaleString()}</div></div>)}{!(runs??[]).length&&<p className="p-5 text-sm text-ink/45">No build runs yet.</p>}</div>
   </div>
  </section>
 </main>;
}
