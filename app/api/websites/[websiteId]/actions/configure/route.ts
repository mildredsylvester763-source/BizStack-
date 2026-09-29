import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const ALLOWED_ACTIONS = new Set(["booking_request", "order_request", "quote_request", "lead_capture", "support_request"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  try {
    const { websiteId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { actions?: unknown };
    const actions = Array.isArray(body.actions) ? body.actions : [];
    const { data: website, error: websiteError } = await supabase
      .from("websites")
      .select("id,business_id")
      .eq("id", websiteId)
      .single();
    if (websiteError || !website) return NextResponse.json({ error: "Website not found." }, { status: 404 });

    const { data: allowed } = await supabase.rpc("user_can_business", {
      p_business_id: website.business_id,
      p_user_id: user.id,
      p_permission: "read_business_context"
    });
    if (!allowed) return NextResponse.json({ error: "You do not have access to this business." }, { status: 403 });

    for (const raw of actions) {
      const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
      const actionKey = String(item.action_key ?? "").trim();
      if (!ALLOWED_ACTIONS.has(actionKey)) return NextResponse.json({ error: "Unsupported website action." }, { status: 400 });
      const authMode = String(item.auth_mode ?? "public");
      if (!["public", "authenticated"].includes(authMode)) return NextResponse.json({ error: "Unsupported authentication mode." }, { status: 400 });

      const { error } = await supabase.from("website_action_bindings").upsert({
        business_id: website.business_id,
        website_id: websiteId,
        action_key: actionKey,
        enabled: item.enabled !== false,
        auth_mode: authMode,
        rate_limit_per_minute: Math.max(1, Math.min(1000, Number(item.rate_limit_per_minute ?? 30))),
        require_idempotency: item.require_idempotency !== false,
        config: item.config && typeof item.config === "object" ? item.config : {},
        created_by: user.id,
        updated_at: new Date().toISOString()
      }, { onConflict: "website_id,action_key" });
      if (error) throw error;
    }

    return NextResponse.json({ websiteId, actionsConfigured: actions.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not configure website actions." }, { status: 400 });
  }
}
