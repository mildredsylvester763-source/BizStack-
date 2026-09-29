import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

async function saveBankDetails(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
  if (!business) return;
  await supabase.from("businesses").update({
    bank_name: (formData.get("bank_name") as string) || null,
    bank_account_name: (formData.get("bank_account_name") as string) || null,
    bank_account_number: (formData.get("bank_account_number") as string) || null
  }).eq("id", business.id);
  revalidatePath("/dashboard/settings/payments");
}

export default async function PaymentSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase
    .from("businesses")
    .select("bank_name, bank_account_name, bank_account_number")
    .eq("owner_id", user.id)
    .single();
  if (!business) redirect("/onboarding");

  return (
    <section className="max-w-xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl text-text mb-1">Payment methods</h1>
      <p className="text-textMuted mb-8">
        Bank details shown to customers on invoices that accept bank transfer.
        Card payments will connect to a real processor in a later module.
      </p>
      <Card className="p-6">
        <form action={saveBankDetails} className="space-y-4">
          <Input name="bank_name" label="Bank name" defaultValue={business.bank_name ?? ""} />
          <Input name="bank_account_name" label="Account name" defaultValue={business.bank_account_name ?? ""} />
          <Input name="bank_account_number" label="Account number" defaultValue={business.bank_account_number ?? ""} />
          <Button type="submit">Save</Button>
        </form>
      </Card>
    </section>
  );
}
