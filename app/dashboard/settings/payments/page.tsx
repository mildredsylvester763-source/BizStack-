import { redirect, revalidatePath } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { BizIcon, BizPanel, BizSection, BizStatus } from "@/components/ui/BizStackVisual";

async function saveBankDetails(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
  if (!business) return;
  await supabase.from("businesses").update({
    bank_name: String(formData.get("bank_name") || "").trim() || null,
    bank_account_name: String(formData.get("bank_account_name") || "").trim() || null,
    bank_account_number: String(formData.get("bank_account_number") || "").trim() || null
  }).eq("id", business.id);
  revalidatePath("/dashboard/settings/payments");
}

export default async function PaymentSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase.from("businesses").select("id,name,bank_name,bank_account_name,bank_account_number").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");

  const { data: processors } = await supabase.from("integrations").select("provider,status,display_name,account_label").eq("business_id",business.id).in("provider",["stripe","payment-processor"]);

  return <div className="biz-content max-w-5xl">
    <BizSection title="Payment Settings" subtitle="Control the payment methods your invoices can expose to customers.">
      <div className="grid lg:grid-cols-[1fr_360px] gap-3">
        <BizPanel title="Bank transfer details" subtitle="Shown only when bank transfer is selected on an invoice.">
          <form action={saveBankDetails} className="p-4 space-y-3">
            <label className="block"><span className="text-[8px] text-white/25 uppercase tracking-[.14em]">Bank name</span><input name="bank_name" defaultValue={business.bank_name||""} placeholder="e.g. Access Bank" className="mt-2 w-full rounded-xl border border-white/[.08] bg-white/[.025] px-3 py-3 text-[9px] text-white outline-none"/></label>
            <label className="block"><span className="text-[8px] text-white/25 uppercase tracking-[.14em]">Account name</span><input name="bank_account_name" defaultValue={business.bank_account_name||""} placeholder="Business account name" className="mt-2 w-full rounded-xl border border-white/[.08] bg-white/[.025] px-3 py-3 text-[9px] text-white outline-none"/></label>
            <label className="block"><span className="text-[8px] text-white/25 uppercase tracking-[.14em]">Account number</span><input name="bank_account_number" defaultValue={business.bank_account_number||""} placeholder="Account number" className="mt-2 w-full rounded-xl border border-white/[.08] bg-white/[.025] px-3 py-3 text-[9px] text-white outline-none"/></label>
            <button className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 py-3 text-[8px] font-semibold text-white">Save bank details</button>
          </form>
        </BizPanel>

        <div className="space-y-3">
          <BizPanel title="Invoice payment methods" subtitle="Customers can choose among methods selected during invoice creation.">
            <div className="p-4 space-y-2">
              {[["bank_transfer","Bank transfer","Uses the bank details above.","cyan"],["qr","QR payment","Shows an invoice-specific QR code.","purple"],["card","Card payment","Selectable; real checkout requires a verified processor.","blue"]].map(([key,label,detail,tone])=><div key={key} className="rounded-2xl border border-white/[.06] bg-white/[.02] p-3 flex items-center gap-3"><BizIcon tone={tone as any} size="sm">{key==="bank_transfer"?"₦":key==="qr"?"▦":"▣"}</BizIcon><div className="min-w-0 flex-1"><div className="text-[8px] text-white/65">{label}</div><div className="text-[7px] leading-3.5 text-white/20 mt-1">{detail}</div></div><BizStatus tone="green">Available</BizStatus></div>)}
            </div>
          </BizPanel>

          <BizPanel title="Card processor" subtitle="Provider status for card checkout.">
            <div className="p-4">
              {(processors||[]).length===0 ? <><BizStatus tone="orange">Not connected</BizStatus><p className="mt-2 text-[8px] leading-4 text-white/25">Connect Stripe or another supported payment processor before enabling real card collection.</p><a href="/dashboard/integrations" className="mt-3 inline-flex"><span className="biz-button border border-white/10 bg-white/[.04] text-white/60">Open integrations</span></a></> :
              (processors||[]).map((p:any)=><div key={p.provider} className="flex items-center gap-2"><BizIcon tone="green" size="sm">▣</BizIcon><div><div className="text-[8px] text-white/65">{p.display_name||p.provider}</div><div className="text-[7px] text-white/20">{p.account_label||"Connected processor"}</div></div><span className="ml-auto"><BizStatus tone={p.status==="connected"?"green":"orange"}>{p.status}</BizStatus></span></div>)}
            </div>
          </BizPanel>
        </div>
      </div>
    </BizSection>
  </div>;
}
