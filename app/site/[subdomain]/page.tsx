import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function PublicHome(props:{params: Promise<{subdomain:string}>}) {
 const params = await props.params;
 const supabase=await createClient();
 const {data:site}=await supabase.from("websites").select("id,name,subdomain,status,settings").eq("subdomain",params.subdomain).eq("status","published").maybeSingle();
 if(!site)notFound();
 const {data:page}=await supabase.from("website_pages").select("title,content,seo").eq("website_id",site.id).eq("slug","home").eq("status","published").maybeSingle();
 if(!page)notFound();
 const content=(page.content||{}) as Record<string,any>,sections=Array.isArray(content.sections)?content.sections:[{type:"hero",headline:content.headline,body:content.body,primaryCta:content.primaryCta,ctaUrl:content.ctaUrl}];
 return <PublicFrame site={site} title={page.seo?.title||page.title} sections={sections}/>;
}
function PublicFrame({site,title,sections}:{site:any;title:string;sections:any[]}){
 return <main className="min-h-screen bg-ledger text-ink"><header className="border-b border-rule bg-white sticky top-0 z-10"><div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between"><a href={"/site/"+site.subdomain} className="font-display text-xl">{site.name}</a><nav className="flex gap-5 text-sm">{(Array.isArray(site.settings?.navigation)&&site.settings.navigation.length?site.settings.navigation:["home","about","services","products","contact"]).map((s:string)=><a key={s} href={s==="home"?"/site/"+site.subdomain:"/site/"+site.subdomain+"/"+s} className="text-ink/55 hover:text-ink">{s.replace(/-/g," ")}</a>)}</nav></div></header><section className="max-w-6xl mx-auto px-6 py-16 space-y-8">{sections.map((s:any,i:number)=><section key={i} className={i===0?"bg-white border border-rule p-10 md:p-16":"bg-white border border-rule p-8"}><p className="text-xs uppercase tracking-[.16em] text-vault mb-3">{s.eyebrow||site.name}</p><h1 className={i===0?"font-display text-4xl md:text-6xl":"font-display text-3xl"}>{s.headline||s.heading||s.title||title}</h1><p className="mt-5 max-w-3xl text-lg text-ink/60 leading-8 whitespace-pre-line">{s.body||""}</p>{(s.primaryCta||s.button)&&<a href={s.ctaUrl||s.url||"/contact"} className="inline-block mt-7 bg-vault text-white px-5 py-3 text-sm">{s.primaryCta||s.button}</a>}</section>)}</section><footer className="border-t border-rule bg-white mt-16"><div className="max-w-6xl mx-auto px-6 py-8 text-xs text-ink/45 flex justify-between"><span>{site.name}</span><span>Powered by BizStack</span></div></footer></main>;
}