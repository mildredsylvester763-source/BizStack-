import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { Card } from "@/components/ui/Card";

const ACTION_TYPES = [
  { key: "send_payment_reminder", label: "Send payment reminders", description: "Nudge customers when an invoice is overdue." },
  { key: "draft_customer_reply", label: "Draft customer replies", description: "Write a reply to incoming customer messages." },
  { key: "flag_low_stock", label: "Flag low stock", description: "Warn when a product is running low." },
  { key: "draft_invoice_from_message", label: "Draft invoices from messages", description: "Turn a chat message into an invoice draft." }
];
const MODES = [
  { value: "draft_only", label: "Draft only" },
  { value: "ask_first", label: "Ask before doing" },
  { value: "auto_execute", label: "Do automatically" }
];

async function updateMode(formData: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("automation_settings").upsert(
    { business_id: formData.get("business_id") as string, action_type: formData.get("action_type") as string, mode: formData.get("mode") as string },
    { onConflict: "business_id,action_type" }
  );
  revalidatePath("/dashboard/settings/automation");
}

export default async function AutomationSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: business } = await supabase.from("businesses").select("id, name").eq("owner_id", user.id).single();
  if (!business) redirect("/onboarding");
  const { data: settings } = await supabase.from("automation_settings").select("action_type, mode").eq("business_id", business.id);
  const modeFor = (t: string) => settings?.find((s: { action_type: string; mode: string }) => s.action_type === t)?.mode ?? "ask_first";

  return (
    <section className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="font-display text-2xl text-text mb-1">Automation settings</h1>
      <p className="text-textMuted mb-8">Choose how much BizStack does on its own.</p>
      <Card className="divide-y divide-line">
        {ACTION_TYPES.map((action) => (
          <div key={action.key} className="p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-text font-medium">{action.label}</p>
              <p className="text-sm text-textMuted mt-0.5">{action.description}</p>
            </div>
            <form action={updateMode} className="shrink-0">
              <input type="hidden" name="business_id" value={business.id} />
              <input type="hidden" name="action_type" value={action.key} />
              <select name="mode" defaultValue={modeFor(action.key)} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="border border-line rounded-lg px-4 py-2 text-sm bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary/40">
                {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </form>
          </div>
        ))}
      </Card>
    </section>
  );
}
