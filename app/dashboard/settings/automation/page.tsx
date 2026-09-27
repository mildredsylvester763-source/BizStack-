import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { updateAutomationMode } from "./actions";

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

export default async function AutomationSettingsPage() {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("owner_id", user.id)
    .single();

  if (!business) redirect("/onboarding");

  const { data: settings } = await supabase
    .from("automation_settings")
    .select("action_type, mode")
    .eq("business_id", business.id);

  const modeFor = (actionType: string) =>
    settings?.find((setting) => setting.action_type === actionType)?.mode ?? "ask_first";

  return (
    <main className="min-h-screen bg-ledger">
      <header className="border-b border-rule bg-white">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/dashboard" className="font-display text-lg text-ink">
            {business.name}
          </Link>
          <Link href="/dashboard" className="text-sm text-ink/45 hover:text-ink">
            Back to dashboard
          </Link>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display text-3xl text-ink mb-1">Automation settings</h1>
        <p className="text-ink/60 mb-10">
          Choose how much BizStack does on its own for each kind of action.
        </p>

        <div className="divide-y divide-rule border-t border-b border-rule">
          {ACTION_TYPES.map((action) => (
            <div key={action.key} className="py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-ink font-medium">{action.label}</p>
                <p className="text-sm text-ink/55 mt-0.5">{action.description}</p>
              </div>

              <form action={updateAutomationMode} className="shrink-0 flex items-center gap-2">
                <input type="hidden" name="action_type" value={action.key} />
                <label htmlFor={"mode-" + action.key} className="sr-only">
                  Automation mode for {action.label}
                </label>
                <select
                  id={"mode-" + action.key}
                  name="mode"
                  defaultValue={modeFor(action.key)}
                  className="border border-rule px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-vault/25"
                >
                  {MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="border border-rule bg-white px-4 py-2 text-sm text-ink hover:border-vault hover:text-vault transition-colors"
                >
                  Save
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
