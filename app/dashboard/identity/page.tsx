import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function IdentityPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id,name").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const { data: verifications } = await supabase.from("customer_identity_verifications").select("id,customer_id,verification_type,status,provider,verified_at,expires_at,created_at,customer:customers(name,company_name)").eq("business_id", business.id).order("created_at", { ascending: false }).limit(100);
  return <main className="min-h-screen bg-ledger"><header className="border-b border-rule bg-white"><div className="max-w-6xl mx-auto px-6 py-5"><Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link><h1 className="font-display text-2xl mt-1">Identity & verification</h1></div></header>
  <section className="max-w-6xl mx-auto px-6 py-10"><div className="max-w-3xl mb-8"><p className="text-xs uppercase tracking-[.16em] text-vault">Trust layer</p><h2 className="font-display text-3xl mt-2">Verification is not the same as a customer record.</h2><p className="text-sm text-ink/55 mt-3 leading-6">Creating “Harry” or any other customer only creates a business record. Email verification proves control of an email address; it does not prove that the person is who they claim to be. Stronger checks such as government ID, business registration, tax ID, address or bank ownership can be connected through approved verification providers when a business actually requires them.</p></div>
  <div className="bg-white border border-rule p-5 mb-6 grid md:grid-cols-3 gap-4 text-sm"><div><p className="text-ink/40 text-xs">Customer record</p><p className="mt-1">Business-created identity</p></div><div><p className="text-ink/40 text-xs">Contact verification</p><p className="mt-1">Email / phone / WhatsApp ownership</p></div><div><p className="text-ink/40 text-xs">KYC / business verification</p><p className="mt-1">External evidence and provider result</p></div></div>
  <div className="space-y-3">{(verifications || []).map((v:any)=><div key={v.id} className="bg-white border border-rule p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div><p className="font-medium">{v.customer?.name || v.customer?.company_name || "Customer"}</p><p className="text-xs text-ink/45 mt-1">{v.verification_type.replaceAll("_"," ")} · {v.provider || "provider not connected"}</p></div><span className="text-xs capitalize text-vault">{v.status}</span></div>)}{!(verifications || []).length&&<div className="bg-white border border-dashed border-rule p-8 text-sm text-ink/45">No verification checks have been created yet.</div>}</div></section></main>;
}