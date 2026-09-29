"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

const ALLOWED_ACTIONS = new Set([
  "send_payment_reminder",
  "draft_customer_reply",
  "flag_low_stock",
  "draft_invoice_from_message",
]);

const ALLOWED_MODES = new Set([
  "draft_only",
  "ask_first",
  "auto_execute",
]);

export async function updateAutomationMode(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to change automation settings.");
  }

  const actionType = String(formData.get("action_type") ?? "");
  const mode = String(formData.get("mode") ?? "");

  if (!ALLOWED_ACTIONS.has(actionType)) {
    throw new Error("Invalid automation action.");
  }

  if (!ALLOWED_MODES.has(mode)) {
    throw new Error("Invalid automation mode.");
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (businessError || !business) {
    throw new Error("Business not found.");
  }

  const { error } = await supabase
    .from("automation_settings")
    .upsert(
      {
        business_id: business.id,
        action_type: actionType,
        mode,
      },
      { onConflict: "business_id,action_type" }
    );

  if (error) {
    throw new Error("Could not save automation setting.");
  }

  revalidatePath("/dashboard/settings/automation");
}
