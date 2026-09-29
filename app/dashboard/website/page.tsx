// @ts-nocheck
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { runWebsiteBuild } from "@/lib/ai/build-engine/runtime";

async function createWebsite(formData:FormData){
  "use server";
  const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/login");
  const {data:business}=await supabase.from("businesses").select("id,name").eq("owner_id",user.id).single(); if(!business)redirect("/onboarding");
  const name=String(formData.get("name")||"Business website").trim()||"Business website";
  const slug=(String(formData.get("subdomain")||business.id).toLowerCase().replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,40)||business.id);
  const {data:site,error}=await supabase.from("websites").insert({business_id:business.id,name,subdomain:slug,status:"draft",settings:{theme:"bizstack-ledger",navigation:["home"],analytics:{enabled:false},forms:{enabled:true}}}).select("id").single();
  if(error)throw new Error(error.message);
  await supabase.from("website_pages").insert({website_id:site.id,slug:"home",title:"Home",page_type:"home",content:{headline:"Welcome to "+business.name,body:"Tell customers what you do, the problem you solve, and why they should choose you.",primaryCta:"Contact us",ctaUrl:"/contact"},seo:{title:name,description:""}});
  revalidatePath("/dashboard/website");
}

async function createFromPrompt(formData:FormData){
  "use server";
  const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/login");
  const {data:business}=await supabase.from("businesses").select("id").eq("owner_id",user.id).single(); if(!business)redirect("/onboarding");
  const prompt=String(formData.get("prompt")||"").trim(); if(!prompt)throw new Error("Describe the website you want.");
  const result=await runWebsiteBuild({businessId:business.id,userId:user.id,prompt,mode:"auto_execute",publish:false});
  revalidatePath("/dashboard/website");
  if(result.result?.websiteId)redirect("/dashboard/website/"+result.result.websiteId);
}

export default async function WebsitePage(){
 const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/login");
 const {data:business}=await supabase.from("businesses").select("id,name").eq("owner_id",user.id).single(); if(!business)redirect("/onboarding");
 const {data:websites}=await supabase.from("websites").select("id,name,status,subdomain,custom_domain,published_at,current_version,settings").eq("business_id",business.id).order("created_at",{ascending:false});
 return <main className="min-h-screen bg-ledger"><header className="border-b border-rule bg-white"><div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between"><div><Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link><h1 className="font-display text-2xl mt-1">Website Studio</h1></div><div className="flex gap-3 text-xs text-ink/50"><Link href="/dashboard/ai-builder" className="text-indigo-700 hover:text-ink">AI Builder</Link><Link href="/dashboard/portal" className="hover:text-ink">Customer portal</Link><Link href="/dashboard/billing" className="hover:text-ink">Plans & billing</Link></div></div></header>
 <section className="max-w-6xl mx-auto px-6 py-10">
   <div className="max-w-4xl mb-8"><p className="text-xs uppercase tracking-[.16em] text-vault">Website operating layer</p><h2 className="font-display text-4xl mt-2">Describe the website. BizStack turns the request into real editable business assets.</h2><p className="text-sm text-ink/55 mt-3">The AI Build Engine creates the sitemap, structured page model, sections, forms, SEO metadata and integration requirements, validates the result and saves the actual records. No external AI key is required for the local compiler.</p></div>
   <form action={createFromPrompt} className="bg-ink text-mist border border-ink p-6 mb-6 rounded-sm"><p className="text-xs uppercase tracking-[.16em] text-mist/55">Start with a request</p><textarea name="prompt" required rows={5} placeholder="Example: Build a premium modern website for a Nigerian fashion brand. Add Home, About, Collections, Pricing, FAQ and Contact. Make it mobile-first, add WhatsApp CTA, newsletter capture and a strong visual portfolio." className="mt-3 w-full bg-white/10 border border-white/15 px-4 py-3 text-sm text-white placeholder:text-white/35"/><div className="mt-4 flex items-center justify-between gap-4"><p className="text-xs text-mist/45">Provider: local deterministic compiler unless BIZSTACK_AI_API_URL and BIZSTACK_AI_API_KEY are configured.</p><button className="bg-vault text-white px-6 py-3 text-sm font-medium">Build website</button></div></form>
   <form action={createWebsite} className="bg-white border border-rule p-5 grid md:grid-cols-[1fr_1fr_auto] gap-3 mb-8"><input name="name" placeholder="Create an empty website name" className="border border-rule px-3 py-2.5 text-sm" /><input name="subdomain" placeholder="Subdomain, e.g. acme" className="border border-rule px-3 py-2.5 text-sm" /><button className="bg-ink text-mist px-5 py-2.5 text-sm">Create blank website</button></form>
   <div className="space-y-4">{(websites??[]).map(site=><div key={site.id} className="bg-white border border-rule p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"><div><p className="font-medium">{site.name}</p><p className="text-xs text-ink/45 mt-1">{site.subdomain?site.subdomain+".bizstack.local":"No subdomain"} · version {site.current_version}{site.custom_domain?" · "+site.custom_domain:""}</p><span className="inline-block mt-3 text-xs text-vault capitalize">{site.status}</span></div><div className="flex gap-2"><Link href={"/dashboard/website/"+site.id} className="bg-ink text-white px-4 py-2 text-sm">Edit website</Link>{site.status==="published"&&<Link href={"/site/"+site.subdomain} className="border border-rule px-4 py-2 text-sm">Preview</Link>}</div></div>)}{!(websites??[]).length&&<p className="text-sm text-ink/45">No website yet. Start with an AI request above.</p>}</div>
 </section></main>;
}
