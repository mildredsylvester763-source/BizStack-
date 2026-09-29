import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { runSandboxCommand } from "@/lib/sandbox/vercel";

const ACTIONS: Record<string, { cmd: string; args: string[] }> = {
  install: { cmd: "npm", args: ["install", "--no-audit", "--no-fund"] },
  build: { cmd: "npm", args: ["run", "build"] },
  lint: { cmd: "npm", args: ["run", "lint"] },
  test: { cmd: "npm", args: ["test"] },
  dev: { cmd: "npm", args: ["run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"] }
};

export async function POST(request: Request, props: { params: Promise<{ projectId: string }> }) {
  const params = await props.params;
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";
    const spec = ACTIONS[action];
    if (!spec) return NextResponse.json({ error: "Unsupported terminal action." }, { status: 400 });

    const { data: project, error } = await supabase.from("ai_projects").select("id,status,business_id").eq("id", params.projectId).single();
    if (error || !project || project.status === "deleted") return NextResponse.json({ error: "Project not found." }, { status: 404 });

    const { data: canRun } = await supabase.rpc("user_can_business", {
      p_business_id: project.business_id,
      p_user_id: user.id,
      p_permission: "run_project_runtime"
    });
    if (!canRun) return NextResponse.json({ error: "You do not have permission to run this project." }, { status: 403 });

    const { data: session, error: sessionError } = await supabase.from("ai_terminal_sessions").insert({
      project_id: project.id, user_id: user.id, status: "running",
      command: spec.cmd + " " + spec.args.join(" "), working_directory: "/workspace",
      started_at: new Date().toISOString()
    }).select("id").single();
    if (sessionError) throw sessionError;

    const result = await runSandboxCommand(project.id, spec.cmd, spec.args, "/workspace", action === "dev");
    await supabase.from("ai_terminal_sessions").update({
      status: result.exitCode === 0 ? "completed" : "failed",
      exit_code: result.exitCode, output: result.stdout.slice(-120000),
      error_output: result.stderr.slice(-120000), sandbox_name: result.sandbox.name,
      finished_at: action === "dev" ? null : new Date().toISOString()
    }).eq("id", session.id);

    await supabase.from("ai_project_events").insert({
      project_id: project.id, event_type: "terminal.action", sequence_no: Date.now() % 2147483647,
      payload: { action, exitCode: result.exitCode, stdout: result.stdout.slice(-12000), stderr: result.stderr.slice(-12000), userId: user.id }
    });
    return NextResponse.json({ sessionId: session.id, action, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr, sandboxName: result.sandbox.name });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Terminal action failed." }, { status: 400 });
  }
}