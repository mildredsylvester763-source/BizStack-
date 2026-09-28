import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { executeBroadcastCampaign } from "@/lib/broadcasts/runtime";

async function decide(formData:FormData){
 "use server";
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const {data:business}=await supabase.from("businesses").select("id").eq("owner_id",user.id).single();if(!business)redirect("/onboarding");
 const id=String(formData.get("id")||"");const action=String(formData.get("action")||"");
 const {data:campaign}=await supabase.from("broadcast_campaigns").select("id,status").eq("id",id).eq("business_id",business.id).single();
 if(!campaign)throw new Error("Campaign not found.");
 if(action==="approve") await supabase.from("broadcast_campaigns").update({status:"approved",updated_at:new Date().toISOString()}).eq("id",id).eq("business_id",business.id);
 if(action==="cancel") await supabase.from("broadcast_campaigns").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",id).eq("business_id",business.id);
 if(action==="send") await executeBroadcastCampaign({supabase,businessId:business.id,campaignId:id});
 revalidatePath("/dashboard/broadcasts");
 revalidatePath("/dashboard/actions");
}

export default async function BroadcastsPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const {data:business}=await supabase.from("businesses").select("id,name").eq("owner_id",user.id).single();if(!business)redirect("/onboarding");
 const {data:campaigns}=await supabase.from("broadcast_campaigns").select("id,name,channel,message_template,status,opt_out_policy,scheduled_at,sent_count,blocked_count,failed_count,created_at").eq("business_id",business.id).order("created_at",{ascending:false});
 return <main className="min-h-screen bg-ledger"><header className="border-b border-rule bg-white"><div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center"><div><Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link><h1 className="font-display text-2xl mt-1">Broadcasts</h1></div><Link href="/dashboard/ai-builder" className="bg-ink text-white px-4 py-2 text-sm">Create with AI</Link></div></header><section className="max-w-6xl mx-auto px-6 py-8"><div className="bg-white border border-rule p-6 mb-6"><p className="text-xs uppercase tracking-[.16em] text-vault">Communications OS</p><h2 className="font-display text-3xl mt-2">Consent comes before the send button.</h2><p className="text-sm text-ink/55 mt-2">Broadcast execution re-checks opt-in immediately before delivery and records provider acceptance per recipient.</p></div><div className="space-y-4">{(campaigns??[]).map(c=><div key={c.id} className="bg-white border border-rule p-5"><div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4"><div className="flex-1"><div className="flex flex-wrap gap-2 items-center"><span className="text-xs uppercase text-vault">{c.channel}</span><span className="text-xs border border-rule px-2 py-1 capitalize">{c.status}</span></div><h3 className="font-display text-xl mt-2">{c.name}</h3><p className="text-sm text-ink/60 mt-2 whitespace-pre-wrap">{c.message_template}</p><p className="text-xs text-ink/40 mt-3">Policy: {c.opt_out_policy} · Sent {c.sent_count} · Blocked {c.blocked_count} · Failed {c.failed_count}</p></div><div className="flex flex-wrap gap-2">{c.status==="review"&&<form action={decide}><input type="hidden" name="id" value={c.id}/><input type="hidden" name="action" value="approve"/><button className="bg-vault text-white px-3 py-2 text-xs">Approve</button></form>}{c.status==="approved"&&<form action={decide}><input type="hidden" name="id" value={c.id}/><input type="hidden" name="action" value="send"/><button className="bg-ink text-white px-3 py-2 text-xs">Send now</button></form>}{["review","approved"].includes(c.status)&&<form action={decide}><input type="hidden" name="id" value={c.id}/><input type="hidden" name="action" value="cancel"/><button className="border border-rule px-3 py-2 text-xs">Cancel</button></form>}</div></div></div>)}{!(campaigns??[]).length&&<div className="bg-white border border-rule p-8 text-sm text-ink/45">No campaigns yet. Create one from AI Builder.</div>}</div></section></main>;
}
