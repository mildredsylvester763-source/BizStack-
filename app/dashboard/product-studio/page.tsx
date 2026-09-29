// @ts-nocheck
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { runProductPhotoBuild } from "@/lib/ai/build-engine/platform-runtime";

async function createJob(formData:FormData){
 "use server";
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const {data:business}=await supabase.from("businesses").select("id").eq("owner_id",user.id).single();if(!business)redirect("/onboarding");
 await runProductPhotoBuild({businessId:business.id,userId:user.id,prompt:String(formData.get("prompt")||""),mode:"draft_only"});
 revalidatePath("/dashboard/product-studio");
}

export default async function ProductStudioPage(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const {data:business}=await supabase.from("businesses").select("id,name").eq("owner_id",user.id).single();if(!business)redirect("/onboarding");
 const {data:jobs}=await supabase.from("product_media_assets").select("id,asset_type,prompt,style,provider,status,output_ref,error_message,created_at,product:products(name,sku)").eq("business_id",business.id).order("created_at",{ascending:false}).limit(50);
 return <main className="min-h-screen bg-ledger"><header className="border-b border-rule bg-white"><div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center"><div><Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link><h1 className="font-display text-2xl mt-1">Product Photo Studio</h1></div><Link href="/dashboard/ai-builder" className="text-xs text-vault">AI Builder</Link></div></header><section className="max-w-6xl mx-auto px-6 py-8"><div className="bg-ink text-mist p-6"><p className="text-xs uppercase tracking-[.16em] text-mist/55">Catalog media engine</p><h2 className="font-display text-3xl mt-2">Generate product-image briefs tied to real inventory.</h2><p className="text-sm text-mist/65 mt-2">The studio never invents the underlying product. A generation provider can be plugged into the queued jobs later through environment configuration.</p><form action={createJob} className="mt-5"><textarea name="prompt" required rows={5} placeholder="Create a clean commercial product photo for product Premium Hoodie, style: premium studio, background removal, source: storage://..." className="w-full bg-white/10 border border-white/15 px-4 py-3 text-sm text-white placeholder:text-white/30"/><button className="mt-3 bg-vault text-white px-5 py-3 text-sm">Create photo job</button></form></div><div className="bg-white border border-rule mt-6"><div className="p-5 border-b border-rule"><p className="text-xs uppercase tracking-[.16em] text-vault">Media jobs</p></div><div className="divide-y divide-rule">{(jobs??[]).map(j=><div key={j.id} className="p-5"><div className="flex flex-col md:flex-row md:justify-between gap-3"><div><p className="font-medium">{j.product?.name||"Unknown product"} {j.product?.sku?"· "+j.product.sku:""}</p><p className="text-xs text-vault mt-1">{j.asset_type} · {j.provider||"not configured"} · {j.status}</p><p className="text-sm text-ink/60 mt-3">{j.prompt}</p></div><div className="text-xs text-ink/40 md:text-right">{new Date(j.created_at).toLocaleString()}</div></div>{j.error_message&&<p className="text-xs text-red-700 mt-3">{j.error_message}</p>}</div>)}{!(jobs??[]).length&&<p className="p-6 text-sm text-ink/45">No media jobs yet.</p>}</div></div></section></main>;
}
