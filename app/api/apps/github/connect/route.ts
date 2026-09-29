import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "GITHUB_CLIENT_ID is not configured on the server." }, { status: 503 });

  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).single();
  if (!business) return NextResponse.json({ error: "Business context is not available." }, { status: 404 });

  const config = {
    setup_stage: "awaiting_authorization",
    oauth_authorize_url: "https://github.com/login/oauth/authorize",
    oauth_token_url: "https://github.com/login/oauth/access_token",
    oauth_client_id: clientId,
    oauth_scopes: ["repo", "read:user", "user:email"],
    app_key: "github"
  };

  const { data: existing } = await supabase.from("integrations")
    .select("id")
    .eq("business_id", business.id)
    .eq("provider", "github")
    .eq("connection_type", "oauth")
    .maybeSingle();

  let integrationId = existing?.id;
  if (!integrationId) {
    const { data: integration, error } = await supabase.from("integrations").insert({
      business_id: business.id,
      provider: "github",
      category: "developer",
      connection_type: "oauth",
      display_name: "GitHub",
      status: "pending",
      sync_mode: "near_realtime",
      capabilities: {
        repositories: true,
        branches: true,
        commits: true,
        pull_requests: true,
        issues: true,
        source_files: true,
        webhooks: true
      },
      config
    }).select("id").single();
    if (error || !integration) return NextResponse.json({ error: error?.message || "Could not create GitHub connection." }, { status: 500 });
    integrationId = integration.id;
  } else {
    await supabase.from("integrations").update({ config, status: "pending", error_message: null }).eq("id", integrationId).eq("business_id", business.id);
  }

  const state = crypto.randomBytes(32).toString("hex");
  const redirectUri = new URL("/api/integrations/oauth/callback", req.url).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { data: attempt, error: attemptError } = await supabase.from("integration_connection_attempts").insert({
    business_id: business.id,
    integration_id: integrationId,
    attempt_type: "oauth",
    status: "awaiting_authorization",
    state_token: state,
    redirect_uri: redirectUri,
    expires_at: expires
  }).select("id").single();
  if (attemptError || !attempt) return NextResponse.json({ error: attemptError?.message || "Could not start GitHub authorization." }, { status: 500 });

  const { error: stateError } = await supabase.from("integration_oauth_states").insert({
    business_id: business.id,
    integration_id: integrationId,
    attempt_id: attempt.id,
    state_token: state,
    provider: "github",
    redirect_uri: redirectUri,
    scopes: config.oauth_scopes,
    expires_at: expires
  });
  if (stateError) return NextResponse.json({ error: stateError.message }, { status: 500 });

  const auth = new URL(config.oauth_authorize_url);
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("state", state);
  auth.searchParams.set("scope", config.oauth_scopes.join(" "));

  return NextResponse.json({ ok: true, authorizationUrl: auth.toString() });
}