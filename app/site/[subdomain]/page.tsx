import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function PublicSite({params}:{params:{subdomain:string}}){
 const supabase=createClient();
 const {data:site}=await supabase.from("websites").select("id,name,subdomain,custom_domain,status").eq("subdomain",params.subdomain).eq("status","published").maybeSingle();
 if(!site) notFound();
 const {data:home}=await supabase.from("website_pages").select("title,content,seo").eq("website_id",site.id).eq("slug","home").eq("status","published").maybeSingle();
 const content=(home?.content??{}) as {headline?:string;body?:string};
 return <main className="min-h-screen bg-ledger"><header className="border-b border-rule bg-white"><div className="max-w-5xl mx-auto px-6 py-5 font-display text-xl">{site.name}</div></header><section className="max-w-5xl mx-auto px-6 py-24"><p className="text-xs uppercase tracking-[.16em] text-vault mb-3">Business website</p><h1 className="font-display text-5xl text-ink">{content.headline||site.name}</h1><p className="mt-6 max-w-2xl text-lg text-ink/60 leading-relaxed">{content.body||"Welcome."}</p></section></main>;
}