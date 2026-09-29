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
  const supabase = await createClient();

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
    <main className="min-h-screen bg-[#f3f0e8] text-[#171918]">
      <header className="sticky top-0 z-30 border-b border-black/[.08] bg-[#f8f6f0]/90 backdrop-blur-xl">
        <div className="max-w-[1280px] mx-auto h-[72px] px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link href="/dashboard" className="font-display text-xl tracking-tight">
            {business.name}
          </Link>
          <Link href="/dashboard" className="rounded-full border border-black/10 bg-white/60 px-3 py-2 text-[11px] text-black/55 hover:text-black">
            Back to dashboard
          </Link>
        </div>
      </header>

      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <h1 className="font-display text-[42px] sm:text-[54px] leading-[.98] tracking-[-.035em]">Automation settings</h1>
        <p className="text-[15px] leading-6 text-black/50 mt-4 mb-9 max-w-2xl">
          Choose how much BizStack does on its own for each kind of action.
        </p>

        <div className="rounded-[28px] border border-black/[.08] bg-[#fcfaf5] shadow-[0_20px_70px_rgba(25,24,20,.05)] overflow-hidden divide-y divide-black/[.07]">
          {ACTION_TYPES.map((action) => (
            <div key={action.key} className="p-5 sm:px-7 sm:py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-white/40 transition-colors">
              <div>
                <p className="font-medium">{action.label}</p>
                <p className="text-sm text-black/45 mt-1 leading-5">{action.description}</p>
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
                  className="rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-black/[.04]"
                >
                  {MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-xl bg-[#171918] text-white px-4 py-2.5 text-sm hover:bg-[#202725] transition-colors"
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