import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

async function ownerContext(){
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:business}=await supabase.from("businesses").select("id,name").eq("owner_id",user.id).single();
  if(!business) redirect("/onboarding");
  return {supabase,business};
}
const slugify=(v:string)=>v.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60);

async function savePage(formData:FormData){
  "use server";
  const {supabase,business}=await ownerContext();
  const websiteId=String(formData.get("websiteId")||""), pageId=String(formData.get("pageId")||"");
  const title=String(formData.get("title")||"").trim(), slug=slugify(String(formData.get("slug")||title));
  const headline=String(formData.get("headline")||"").trim(), body=String(formData.get("body")||"").trim();
  const primaryCta=String(formData.get("primaryCta")||"").trim(), ctaUrl=String(formData.get("ctaUrl")||"").trim();
  const seoTitle=String(formData.get("seoTitle")||title).trim(), seoDescription=String(formData.get("seoDescription")||"").trim();
  if(!websiteId||!pageId||!title||!slug) throw new Error("Page title and slug are required");
  const {data:site}=await supabase.from("websites").select("id").eq("id",websiteId).eq("business_id",business.id).single();
  if(!site) throw new Error("Website not found");
  const {error}=await supabase.from("website_pages").update({
    title,slug,content:{headline,body,primaryCta,ctaUrl,sections:[
      {type:"hero",headline,body,primaryCta,ctaUrl},
      {type:"rich_text",heading:title==="Home"?"Why customers choose us":"About this page",body},
      {type:"cta",heading:primaryCta||"Ready to get started?",button:primaryCta||"Contact us",url:ctaUrl||"/contact"}
    ]},
    seo:{title:seoTitle,description:seoDescription},
    status:"draft",
    version:1
  }).eq("id",pageId).eq("website_id",websiteId);
  if(error) throw new Error(error.message);
  await supabase.from("websites").update({status:"draft",updated_at:new Date().toISOString()}).eq("id",websiteId).eq("business_id",business.id);
  revalidatePath(`/dashboard/website/${websiteId}`);
  revalidatePath(`/site`);
}

async function addPage(formData:FormData){
  "use server";
  const {supabase,business}=await ownerContext();
  const websiteId=String(formData.get("websiteId")||""), title=String(formData.get("title")||"New page").trim()||"New page";
  const slug=slugify(String(formData.get("slug")||title));
  const {data:site}=await supabase.from("websites").select("id").eq("id",websiteId).eq("business_id",business.id).single();
  if(!site) throw new Error("Website not found");
  await supabase.from("website_pages").insert({website_id:websiteId,slug,title,page_type:"standard",content:{headline:title,body:"Add the message, offer and information customers need.",primaryCta:"Contact us",ctaUrl:"/contact"},seo:{title,description:""},status:"draft",version:1});
  revalidatePath(`/dashboard/website/${websiteId}`);
}

async function publishWebsite(formData:FormData){
  "use server";
  const {supabase,business}=await ownerContext();
  const websiteId=String(formData.get("websiteId")||"");
  const {data:site}=await supabase.from("websites").select("id,current_version").eq("id",websiteId).eq("business_id",business.id).single();
  if(!site) throw new Error("Website not found");
  const next=(site.current_version||0)+1;
  await supabase.from("website_pages").update({status:"published"}).eq("website_id",websiteId);
  await supabase.from("websites").update({status:"published",published_at:new Date().toISOString(),current_version:next}).eq("id",websiteId).eq("business_id",business.id);
  revalidatePath(`/dashboard/website/${websiteId}`);
  revalidatePath("/site");
}

export default async function WebsiteEditor({params}:{params:{id:string}}){
  const {supabase,business}=await ownerContext();
  const {data:site}=await supabase.from("websites").select("id,name,status,subdomain,custom_domain,current_version,settings").eq("id",params.id).eq("business_id",business.id).single();
  if(!site) notFound();
  const {data:pages}=await supabase.from("website_pages").select("id,slug,title,page_type,content,seo,status,version,updated_at").eq("website_id",site.id).order("created_at");
  const page=pages?.find(p=>p.slug==="home")||pages?.[0];
  const content=(page?.content||{}) as Record<string,any>, seo=(page?.seo||{}) as Record<string,any>, settings=(site.settings||{}) as Record<string,any>;
  return <main className="min-h-screen bg-ledger"><header className="border-b border-rule bg-white"><div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center gap-4"><div><Link href="/dashboard/website" className="text-xs text-ink/45">← Websites</Link><h1 className="font-display text-2xl mt-1">{site.name}</h1><p className="text-xs text-ink/45 mt-1">{site.subdomain?site.subdomain+".bizstack.local":"No public subdomain"} · v{site.current_version}</p></div><div className="flex gap-2">{page&&<Link href={`/site/${site.subdomain}/${page.slug==="home"?"":page.slug}`} className="border border-rule px-4 py-2 text-sm">Open preview</Link>}<form action={publishWebsite}><input type="hidden" name="websiteId" value={site.id}/><button className="bg-vault text-white px-4 py-2 text-sm">Publish changes</button></form></div></div></header>
<section className="max-w-7xl mx-auto px-6 py-8 grid lg:grid-cols-[280px_1fr] gap-6"><aside className="bg-white border border-rule p-5 h-fit"><p className="text-xs uppercase tracking-[.16em] text-vault">Pages</p><div className="mt-4 space-y-2">{(pages||[]).map(p=><Link key={p.id} href={`/dashboard/website/${site.id}?page=${p.id}`} className="block border border-rule px-3 py-3 text-sm"><div className="flex justify-between"><span>{p.title}</span><span className="text-[10px] uppercase text-ink/35">{p.status}</span></div><p className="text-xs text-ink/40 mt-1">/{p.slug}</p></Link>)}</div><form action={addPage} className="mt-5 border-t border-rule pt-5 space-y-2"><input type="hidden" name="websiteId" value={site.id}/><input name="title" placeholder="New page title" className="w-full border border-rule px-3 py-2 text-sm"/><input name="slug" placeholder="slug" className="w-full border border-rule px-3 py-2 text-sm"/><button className="w-full bg-ink text-white px-3 py-2 text-sm">Add page</button></form></aside>
<article className="bg-white border border-rule p-6">{page?<><div className="mb-7"><p className="text-xs uppercase tracking-[.16em] text-vault">Visual content model</p><h2 className="font-display text-2xl mt-1">Edit {page.title}</h2><p className="text-sm text-ink/50 mt-2">Every field below becomes structured website content, not a fake preview. Publishing promotes the saved page into the public site.</p></div><form action={savePage} className="space-y-6"><input type="hidden" name="websiteId" value={site.id}/><input type="hidden" name="pageId" value={page.id}/><div className="grid md:grid-cols-2 gap-5"><label className="text-sm">Page title<input name="title" defaultValue={page.title} className="mt-2 w-full border border-rule px-3 py-2.5"/></label><label className="text-sm">URL slug<input name="slug" defaultValue={page.slug} className="mt-2 w-full border border-rule px-3 py-2.5"/></label></div><label className="block text-sm">Hero headline<input name="headline" defaultValue={content.headline||""} className="mt-2 w-full border border-rule px-3 py-2.5 text-lg"/></label><label className="block text-sm">Main message<textarea name="body" defaultValue={content.body||""} rows={8} className="mt-2 w-full border border-rule px-3 py-3 leading-6"/></label><div className="grid md:grid-cols-2 gap-5"><label className="text-sm">Primary CTA label<input name="primaryCta" defaultValue={content.primaryCta||""} className="mt-2 w-full border border-rule px-3 py-2.5"/></label><label className="text-sm">CTA destination<input name="ctaUrl" defaultValue={content.ctaUrl||""} placeholder="/contact or https://..." className="mt-2 w-full border border-rule px-3 py-2.5"/></label></div><div className="border-t border-rule pt-6"><p className="font-medium">SEO</p><div className="grid md:grid-cols-2 gap-5 mt-4"><label className="text-sm">Search title<input name="seoTitle" defaultValue={seo.title||page.title} className="mt-2 w-full border border-rule px-3 py-2.5"/></label><label className="text-sm">Meta description<textarea name="seoDescription" defaultValue={seo.description||""} rows={3} className="mt-2 w-full border border-rule px-3 py-2.5"/></label></div></div><div className="flex justify-between items-center border-t border-rule pt-6"><span className="text-xs text-ink/45">Last saved: {new Date(page.updated_at).toLocaleString()}</span><button className="bg-ink text-white px-6 py-3 text-sm">Save page</button></div></form></>:<p className="text-sm text-ink/45">Create a page to start building.</p>}</article></section></main>;
}