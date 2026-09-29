// @ts-nocheck
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { runWebsiteBuild } from "@/lib/ai/build-engine/runtime";

async function ownerContext(){
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:business}=await supabase.from("businesses").select("id,name").eq("owner_id",user.id).single();
  if(!business) redirect("/onboarding");
  return {supabase,business,user};
}
const slugify=(v:string)=>v.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60);

async function buildWebsite(formData:FormData){
  "use server";
  const {supabase,business,user}=await ownerContext();
  const websiteId=String(formData.get("websiteId")||"");
  const prompt=String(formData.get("prompt")||"").trim();
  const mode=String(formData.get("mode")||"draft_only");
  const publish=mode==="publish";
  const result=await runWebsiteBuild({
    businessId:business.id,
    userId:user.id,
    prompt,
    websiteId,
    mode:publish?"ask_first":"auto_execute",
    publish
  });
  revalidatePath("/dashboard/website/"+websiteId);
  revalidatePath("/dashboard/website");
  if(result.status==="waiting_approval") revalidatePath("/dashboard/actions");
}

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
  revalidatePath("/dashboard/website/"+websiteId);
}

async function addPage(formData:FormData){
  "use server";
  const {supabase,business}=await ownerContext();
  const websiteId=String(formData.get("websiteId")||""), title=String(formData.get("title")||"New page").trim()||"New page";
  const slug=slugify(String(formData.get("slug")||title));
  const {data:site}=await supabase.from("websites").select("id").eq("id",websiteId).eq("business_id",business.id).single();
  if(!site) throw new Error("Website not found");
  await supabase.from("website_pages").insert({website_id:websiteId,slug,title,page_type:"standard",content:{headline:title,body:"Add the message, offer and information customers need.",primaryCta:"Contact us",ctaUrl:"/contact"},seo:{title,description:""},status:"draft",version:1});
  revalidatePath("/dashboard/website/"+websiteId);
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
  revalidatePath("/dashboard/website/"+websiteId);
  revalidatePath("/site");
}

export default async function WebsiteEditor(props:{params: Promise<{id:string}>,searchParams: Promise<{page?:string}>}) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const {supabase,business}=await ownerContext();
  const {data:site}=await supabase.from("websites").select("id,name,status,subdomain,custom_domain,current_version,settings").eq("id",params.id).eq("business_id",business.id).single();
  if(!site) notFound();
  const {data:pages}=await supabase.from("website_pages").select("id,slug,title,page_type,content,seo,status,version,updated_at").eq("website_id",site.id).order("created_at");
  const page=pages?.find(p=>p.id===searchParams?.page)||pages?.find(p=>p.slug==="home")||pages?.[0];
  const content=(page?.content||{}) as Record<string,any>, seo=(page?.seo||{}) as Record<string,any>, settings=(site.settings||{}) as Record<string,any>;
  const {data:builds}=await supabase.from("ai_build_runs").select("id,status,provider_status,request_text,result,error_message,created_at").eq("business_id",business.id).eq("capability_key","website").order("created_at",{ascending:false}).limit(5);
  const latestBuild=builds?.[0];
  return <main className="min-h-screen bg-ledger">
    <header className="border-b border-rule bg-white"><div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center gap-4"><div><Link href="/dashboard/website" className="text-xs text-ink/45">← Websites</Link><h1 className="font-display text-2xl mt-1">{site.name}</h1><p className="text-xs text-ink/45 mt-1">{site.subdomain?site.subdomain+".bizstack.local":"No public subdomain"} · v{site.current_version}</p></div><div className="flex gap-2"><Link href="/dashboard/ai-builder" className="border border-indigo-200 bg-indigo-50 text-indigo-800 px-4 py-2 text-sm">Open AI Builder</Link>{page&&<Link href={page.slug==="home"?"/site/"+site.subdomain:"/site/"+site.subdomain+"/"+page.slug} className="border border-rule px-4 py-2 text-sm">Open preview</Link>}<form action={publishWebsite}><input type="hidden" name="websiteId" value={site.id}/><button className="bg-vault text-white px-4 py-2 text-sm">Publish saved changes</button></form></div></div></header>
    <section className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="bg-ink text-mist p-6 rounded-sm">
        <p className="text-xs uppercase tracking-[.16em] text-mist/60">BizStack AI Build Engine</p>
        <h2 className="font-display text-3xl mt-2">Describe what you want changed. The engine builds the structure.</h2>
        <p className="text-sm text-mist/65 mt-2 max-w-3xl">The request is compiled into a website specification, persisted as an artifact, checked by structural tests, and then written into real website pages. A configured AI provider can improve interpretation later; the local compiler works without external AI credentials.</p>
        <form action={buildWebsite} className="mt-5 space-y-3">
          <input type="hidden" name="websiteId" value={site.id}/>
          <textarea name="prompt" required rows={5} placeholder="Example: Make this a premium dark website for a Lagos catering company. Add services, a menu/store page, booking with deposits, FAQ, WhatsApp CTA and a strong contact flow." className="w-full bg-white/10 border border-white/15 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none"/>
          <div className="flex flex-wrap gap-2 items-center">
            <button name="mode" value="draft" className="bg-white text-ink px-5 py-2.5 text-sm font-medium">Build and save draft</button>
            <button name="mode" value="publish" className="bg-vault text-white px-5 py-2.5 text-sm font-medium">Build and request publish</button>
          </div>
        </form>
      </div>

      {latestBuild&&<div className="bg-white border border-rule p-5"><div className="flex justify-between gap-4"><div><p className="text-xs uppercase tracking-[.16em] text-vault">Latest build run</p><p className="font-medium mt-1 capitalize">{latestBuild.status.replace("_"," ")}</p><p className="text-xs text-ink/45 mt-1">{latestBuild.request_text}</p></div><div className="text-right text-xs text-ink/45"><div>Provider: {latestBuild.provider_status}</div><div className="mt-1">{new Date(latestBuild.created_at).toLocaleString()}</div></div></div>{latestBuild.error_message&&<p className="mt-4 text-sm text-red-700">{latestBuild.error_message}</p>}{latestBuild.result?.metrics&&<div className="mt-4 grid grid-cols-3 md:grid-cols-6 gap-2">{Object.entries(latestBuild.result.metrics).map(([key,value])=><div key={key} className="border border-rule p-3"><div className="text-[10px] uppercase text-ink/35">{key}</div><div className="text-lg mt-1">{String(value)}</div></div>)}</div>}</div>}

      <div className="grid lg:grid-cols-[280px_1fr] gap-6"><aside className="bg-white border border-rule p-5 h-fit"><p className="text-xs uppercase tracking-[.16em] text-vault">Pages</p><div className="mt-4 space-y-2">{(pages||[]).map(p=><Link key={p.id} href={"/dashboard/website/"+site.id+"?page="+p.id} className={"block border px-3 py-3 text-sm "+(page?.id===p.id?"border-vault bg-mist":"border-rule")}><div className="flex justify-between"><span>{p.title}</span><span className="text-[10px] uppercase text-ink/35">{p.status}</span></div><p className="text-xs text-ink/40 mt-1">/{p.slug}</p></Link>)}</div><form action={addPage} className="mt-5 border-t border-rule pt-5 space-y-2"><input type="hidden" name="websiteId" value={site.id}/><input name="title" placeholder="New page title" className="w-full border border-rule px-3 py-2 text-sm"/><input name="slug" placeholder="slug" className="w-full border border-rule px-3 py-2 text-sm"/><button className="w-full bg-ink text-white px-3 py-2 text-sm">Add page</button></form></aside>
      <article className="bg-white border border-rule p-6">{page?<><div className="mb-7"><p className="text-xs uppercase tracking-[.16em] text-vault">Visual content model</p><h2 className="font-display text-2xl mt-1">Edit {page.title}</h2><p className="text-sm text-ink/50 mt-2">Every field below becomes structured website content, not a fake preview.</p></div><form action={savePage} className="space-y-6"><input type="hidden" name="websiteId" value={site.id}/><input type="hidden" name="pageId" value={page.id}/><div className="grid md:grid-cols-2 gap-5"><label className="text-sm">Page title<input name="title" defaultValue={page.title} className="mt-2 w-full border border-rule px-3 py-2.5"/></label><label className="text-sm">URL slug<input name="slug" defaultValue={page.slug} className="mt-2 w-full border border-rule px-3 py-2.5"/></label></div><label className="block text-sm">Hero headline<input name="headline" defaultValue={content.headline||content.sections?.[0]?.heading||""} className="mt-2 w-full border border-rule px-3 py-2.5 text-lg"/></label><label className="block text-sm">Main message<textarea name="body" defaultValue={content.body||content.sections?.[0]?.body||""} rows={8} className="mt-2 w-full border border-rule px-3 py-3 leading-6"/></label><div className="grid md:grid-cols-2 gap-5"><label className="text-sm">Primary CTA label<input name="primaryCta" defaultValue={content.primaryCta||content.sections?.[0]?.button||""} className="mt-2 w-full border border-rule px-3 py-2.5"/></label><label className="text-sm">CTA destination<input name="ctaUrl" defaultValue={content.ctaUrl||content.sections?.[0]?.url||""} placeholder="/contact or https://..." className="mt-2 w-full border border-rule px-3 py-2.5"/></label></div><div className="border-t border-rule pt-6"><p className="font-medium">SEO</p><div className="grid md:grid-cols-2 gap-5 mt-4"><label className="text-sm">Search title<input name="seoTitle" defaultValue={seo.title||page.title} className="mt-2 w-full border border-rule px-3 py-2.5"/></label><label className="text-sm">Meta description<textarea name="seoDescription" defaultValue={seo.description||""} rows={3} className="mt-2 w-full border border-rule px-3 py-2.5"/></label></div></div><div className="flex justify-between items-center border-t border-rule pt-6"><span className="text-xs text-ink/45">Last saved: {new Date(page.updated_at).toLocaleString()}</span><button className="bg-ink text-white px-6 py-3 text-sm">Save page</button></div></form></>:<p className="text-sm text-ink/45">Create a page to start building.</p>}</article></div>
    </section></main>;
}