import { createClient } from "@/lib/supabase-server";

export type EventStatus =
  | "info"
  | "needs_approval"
  | "auto_handled"
  | "dismissed";

export async function logEvent(
  businessId: string,
  eventType: string,
  summary: string,
  evidence: Record<string, unknown>,
  status: EventStatus
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("events").insert({
    business_id: businessId,
    event_type: eventType,
    summary,
    evidence,
    status
  });

  if (error) {
    throw new Error("Failed to log event: " + error.message);
  }
}
