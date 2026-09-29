import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { runSandboxCommand, sandboxPreviewDomain } from "@/lib/sandbox/vercel";

export async function POST(_request: Request, props: { params: Promise<{ projectId: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: project, error } = await supabase.from("ai_projects").select("id,status,business_id").eq("id", params.projectId).single();
    if (error || !project || project.status === "deleted") return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const { data: canPreview } = await supabase.rpc("user_can_business", { p_business_id: project.business_id, p_user_id: user.id, p_permission: "run_project_runtime" });
    if (!canPreview) return NextResponse.json({ error: "You do not have permission to preview this project." }, { status: 403 });

    const { data: version } = await supabase.from("ai_project_versions").select("id,version_no").eq("project_id", project.id).order("version_no", { ascending: false }).limit(1).maybeSingle();
    const { data: session, error: sessionError } = await supabase.from("ai_preview_sessions").insert({
      project_id: project.id, version_id: version?.id ?? null, status: "building",
      provider: "vercel_sandbox", sandbox_provider: "vercel_sandbox", dev_port: 3000,
      started_at: new Date().toISOString()
    }).select("id").single();
    if (sessionError) throw sessionError;

    const install = await runSandboxCommand(project.id, "npm", ["install", "--no-audit", "--no-fund"], "/workspace", false);
    if (install.exitCode !== 0) {
      await supabase.from("ai_preview_sessions").update({ status: "failed", error_message: install.stderr.slice(-10000), updated_at: new Date().toISOString() }).eq("id", session.id);
      return NextResponse.json({ error: "Preview dependencies failed.", stderr: install.stderr }, { status: 400 });
    }

    const start = await runSandboxCommand(project.id, "npm", ["run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"], "/workspace", true);
    if (start.exitCode !== 0) {
      await supabase.from("ai_preview_sessions").update({ status: "failed", error_message: start.stderr.slice(-10000), updated_at: new Date().toISOString() }).eq("id", session.id);
      return NextResponse.json({ error: "Preview server failed to start.", stderr: start.stderr }, { status: 400 });
    }

    const url = sandboxPreviewDomain(start.sandbox, 3000);
    await supabase.from("ai_preview_sessions").update({
      status: "ready", preview_url: url, sandbox_name: start.sandbox.name, sandbox_domain: url, updated_at: new Date().toISOString()
    }).eq("id", session.id);
    await supabase.from("ai_projects").update({ preview_url: url, updated_at: new Date().toISOString() }).eq("id", project.id);
    await supabase.from("ai_project_events").insert({
      project_id: project.id, event_type: "preview.ready", sequence_no: Date.now() % 2147483647,
      payload: { previewUrl: url, versionId: version?.id ?? null, userId: user.id }
    });
    return NextResponse.json({ sessionId: session.id, url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Preview failed." }, { status: 400 });
  }
}