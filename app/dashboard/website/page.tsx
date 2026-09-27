import Link from "next/link";
import { redirect, revalidatePath } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

async function createWebsite(formData: FormData) {
 "use server";
 const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect("/login");
 const {data:business}=await supabase.from("businesses").select("id").eq("owner_id",user.id).single(); if(!business) redirect("/onboarding");
 const name=String(formData.get("name")||"Business website").trim()||"Business website";
 const slug=(String(formData.get("subdomain")||business.id).toLowerCase().replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,40)||business.id);
 const {data:site,error}=await supabase.from("websites").insert({business_id:business.id,name,subdomain:slug,status:"draft"}).select("id").single();
 if(error) throw new Error(error.message);
 await supabase.from("website_pages").insert({website_id:site.id,slug:"home",title:"Home",page_type:"home",content:{headline:"Welcome to our business",body:"Tell customers what you do and why they should choose you."},seo:{title:name,description:""}}); 
 revalidatePath("/dashboard/website");
}
async function publishWebsite(formData: FormData){
 "use server";
 const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect("/login");
 const id=String(formData.get("id")||""); const {data:business}=await supabase.from("businesses").select("id").eq("owner_id",user.id).single(); if(!business) redirect("/onboarding");
 await supabase.from("websites").update({status:"published",published_at:new Date().toISOString(),current_version:1}).eq("id",id).eq("business_id",business.id); await supabase.from("website_pages").update({status:"published"}).eq("website_id",id);
 revalidatePath("/dashboard/website"); revalidatePath("/site");
}
export default async function WebsitePage(){
 const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect("/login");
 const {data:business}=await supabase.from("businesses").select("id,name").eq("owner_id",user.id).single(); if(!business) redirect("/onboarding");
 const {data:websites}=await supabase.from("websites").select("id,name,status,subdomain,custom_domain,published_at,current_version").eq("business_id",business.id).order("created_at",{ascending:false});
 return <main className="min-h-screen bg-ledger"><header className="border-b border-rule bg-white"><div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between"><div><Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link><h1 className="font-display text-2xl mt-1">Website</h1></div><div className="flex gap-3 text-xs text-ink/50"><Link href="/dashboard/portal" className="hover:text-ink">Customer portal</Link><Link href="/dashboard/billing" className="hover:text-ink">Plans & billing</Link></div></div></header>
 <section className="max-w-6xl mx-auto px-6 py-10"><div className="max-w-2xl mb-8"><p className="text-xs uppercase tracking-[.16em] text-vault">Website & customer portal</p><h2 className="font-display text-3xl mt-2">Build once. Publish when ready.</h2><p className="text-sm text-ink/55 mt-2">Website content, pages, SEO, publishing state and future custom domains are kept separate from the business database and storage layer.</p></div>
 <form action={createWebsite} className="bg-white border border-rule p-5 grid md:grid-cols-[1fr_1fr_auto] gap-3 mb-8"><input name="name" placeholder="Website name" className="border border-rule px-3 py-2.5 text-sm" /><input name="subdomain" placeholder="Subdomain, e.g. acme" className="border border-rule px-3 py-2.5 text-sm" /><button className="bg-ink text-mist px-5 py-2.5 text-sm">Create draft</button></form>
 <div className="space-y-4">{(websites??[]).map(site=><div key={site.id} className="bg-white border border-rule p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"><div><p className="font-medium">{site.name}</p><p className="text-xs text-ink/45 mt-1">{site.subdomain?site.subdomain+".bizstack.local": "No subdomain"} · version {site.current_version}</p><span className="inline-block mt-3 text-xs text-vault capitalize">{site.status}</span></div><div className="flex gap-2">{site.status!=="published"&&<form action={publishWebsite}><input type="hidden" name="id" value={site.id}/><button className="bg-vault text-mist px-4 py-2 text-sm">Publish</button></form>}{site.status==="published"&&<Link href={`/site/${site.subdomain}`} className="border border-rule px-4 py-2 text-sm">Preview</Link>}</div></div>)}{!(websites??[]).length&&<p className="text-sm text-ink/45">No website yet. Create a draft to begin.</p>}</div></section></main>;
}