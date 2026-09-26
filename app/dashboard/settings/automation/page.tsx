import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

const ACTION_TYPES = [
  {
    value: "send_payment_reminder",
    label: "Send payment reminders",
    description: "Follow up with customers when an invoice becomes overdue."
  },
  {
    value: "draft_customer_reply",
    label: "Draft customer replies",
    description: "Prepare helpful replies from your business context and history."
  },
  {
    value: "flag_low_stock",
    label: "Flag low stock",
    description: "Notify you when a product appears close to its reorder point."
  },
  {
    value: "draft_invoice_from_message",
    label: "Draft invoices from messages",
    description: "Turn a customer request into an invoice draft for your review."
  }
] as const;

const MODES = ["draft_only", "ask_first", "auto_execute"] as const;
type Mode = (typeof MODES)[number];

type SettingRow = {
  action_type: string;
  mode: string;
  limit_value: number | null;
};

async function saveAutomationSetting(formData: FormData) {
  "use server";

  const actionType = String(formData.get("action_type") ?? "");
  const mode = String(formData.get("mode") ?? "");

  if (
    !ACTION_TYPES.some((action) => action.value === actionType) ||
    !MODES.includes(mode as Mode)
  ) {
    return;
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!business) {
    redirect("/onboarding");
  }

  const { error } = await supabase.from("automation_settings").upsert(
    {
      business_id: business.id,
      action_type: actionType,
      mode
    },
    { onConflict: "business_id,action_type" }
  );

  if (error) {
    throw new Error("Unable to save this automation setting: " + error.message);
  }

  revalidatePath("/dashboard/settings/automation");
}

export default async function AutomationSettingsPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (!business) {
    redirect("/onboarding");
  }

  const { data: settings, error } = await supabase
    .from("automation_settings")
    .select("action_type, mode, limit_value")
    .eq("business_id", business.id);

  if (error) {
    throw new Error("Unable to load automation settings: " + error.message);
  }

  const settingByAction = new Map(
    ((settings ?? []) as SettingRow[]).map((setting) => [setting.action_type, setting])
  );

  return (
    <main className="min-h-screen">
      <header className="flex flex-col gap-4 border-b border-line px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/dashboard" className="font-display text-lg text-ink hover:text-moss">
            {business.name}
          </Link>
          <p className="text-xs text-ink/50">Automation Settings</p>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-ink/60 hover:text-ink">Dashboard</Link>
          <Link href="/dashboard/actions" className="text-ink/60 hover:text-ink">
            Action Center
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <div className="mb-10">
          <p className="mb-3 text-xs uppercase tracking-[0.18em] text-moss">Module 2</p>
          <h1 className="font-display text-3xl text-ink">Automation Settings</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">
            Choose how much autonomy BizStack has for each kind of action. New controls
            default to asking first, so nothing important happens without your say-so.
          </p>
        </div>

        <div className="space-y-3">
          {ACTION_TYPES.map((action) => {
            const setting = settingByAction.get(action.value);
            const currentMode = MODES.includes(setting?.mode as Mode)
              ? (setting?.mode as Mode)
              : "ask_first";

            return (
              <form
                key={action.value}
                action={saveAutomationSetting}
                className="flex flex-col gap-5 border border-line bg-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <input type="hidden" name="action_type" value={action.value} />
                <div>
                  <h2 className="font-display text-base text-ink">{action.label}</h2>
                  <p className="mt-1 max-w-xl text-sm leading-5 text-ink/60">
                    {action.description}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <select
                    name="mode"
                    defaultValue={currentMode}
                    className="border border-line rounded-sm bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-moss"
                    aria-label={action.label + " autonomy mode"}
                  >
                    <option value="draft_only">Draft only</option>
                    <option value="ask_first">Ask before doing</option>
                    <option value="auto_execute">Do automatically</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded-sm bg-moss px-3 py-2 text-xs text-paper hover:bg-moss/90"
                  >
                    Save
                  </button>
                </div>
              </form>
            );
          })}
        </div>
      </section>
    </main>
  );
}
