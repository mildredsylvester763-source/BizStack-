// @ts-nocheck
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

async function createWebsite(formData:FormData){
 "use server";
 const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/login");
 const {data:business}=await supabase.from("businesses").select("id").eq("owner_id",user.id).single(); if(!business)redirect("/onboarding");
 const name=String(formData.get("name")||"Business website").trim()||"Business website";
 const slug=(String(formData.get("subdomain")||business.id).toLowerCase().replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,40)||business.id);
 const {data:site,error}=await supabase.from("websites").insert({business_id:business.id,name,subdomain:slug,status:"draft",settings:{theme:"bizstack-ledger",navigation:["home","about","services","products","contact"],analytics:{enabled:false},forms:{enabled:true}}}).select("id").single();
 if(error)throw new Error(error.message);
 await supabase.from("website_pages").insert({website_id:site.id,slug:"home",title:"Home",page_type:"home",content:{headline:"Welcome to "+business.name,body:"Tell customers what you do, the problem you solve, and why they should choose you.",primaryCta:"Contact us",ctaUrl:"/contact",sections:[{type:"hero",headline:"Welcome to "+business.name,body:"Tell customers what you do, the problem you solve, and why they should choose you.",primaryCta:"Contact us",ctaUrl:"/contact"},{type:"rich_text",heading:"Built around your customers",body:"Add your strongest proof, services, products and business story here."},{type:"cta",heading:"Ready to work together?",button:"Contact us",url:"/contact"}]},seo:{title:name,description:""}});
 revalidatePath("/dashboard/website");
}

export default async function WebsitePage(){
 const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/login");
 const {data:business}=await supabase.from("businesses").select("id,name").eq("owner_id",user.id).single(); if(!business)redirect("/onboarding");
 const {data:websites}=await supabase.from("websites").select("id,name,status,subdomain,custom_domain,published_at,current_version").eq("business_id",business.id).order("created_at",{ascending:false});
 return <main className="min-h-screen bg-ledger"><header className="border-b border-rule bg-white"><div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between"><div><Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link><h1 className="font-display text-2xl mt-1">Website Studio</h1></div><div className="flex gap-3 text-xs text-ink/50"><Link href="/dashboard/portal" className="hover:text-ink">Customer portal</Link><Link href="/dashboard/billing" className="hover:text-ink">Plans & billing</Link></div></div></header>
 <section className="max-w-6xl mx-auto px-6 py-10"><div className="max-w-3xl mb-8"><p className="text-xs uppercase tracking-[.16em] text-vault">Website operating layer</p><h2 className="font-display text-3xl mt-2">A real website editor connected to your business.</h2><p className="text-sm text-ink/55 mt-2">Pages, structured content, SEO metadata, navigation, publishing versions and public routes now live in the same business system instead of a static mockup.</p></div>
 <form action={createWebsite} className="bg-white border border-rule p-5 grid md:grid-cols-[1fr_1fr_auto] gap-3 mb-8"><input name="name" placeholder="Website name" className="border border-rule px-3 py-2.5 text-sm" /><input name="subdomain" placeholder="Subdomain, e.g. acme" className="border border-rule px-3 py-2.5 text-sm" /><button className="bg-ink text-mist px-5 py-2.5 text-sm">Create website</button></form>
 <div className="space-y-4">{(websites??[]).map(site=><div key={site.id} className="bg-white border border-rule p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"><div><p className="font-medium">{site.name}</p><p className="text-xs text-ink/45 mt-1">{site.subdomain?site.subdomain+".bizstack.local":"No subdomain"} · version {site.current_version}{site.custom_domain?" · "+site.custom_domain:""}</p><span className="inline-block mt-3 text-xs text-vault capitalize">{site.status}</span></div><div className="flex gap-2"><Link href={"/dashboard/website/"+site.id} className="bg-ink text-white px-4 py-2 text-sm">Edit website</Link>{site.status==="published"&&<Link href={"/site/"+site.subdomain} className="border border-rule px-4 py-2 text-sm">Preview</Link>}</div></div>)}{!(websites??[]).length&&<p className="text-sm text-ink/45">No website yet. Create one to begin.</p>}</div></section></main>;
}