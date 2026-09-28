import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase-server";
import {
  getOrCreateSandbox,
  readSandboxFile,
  runSandboxCommand,
  sandboxConfigured,
  sandboxPreviewDomain,
  stopSandbox,
  syncFiles
} from "@/lib/sandbox/vercel";

const ALLOWED_COMMANDS = new Set(["npm","npx","node","pnpm","yarn","next","tsc","eslint","git","python","python3","cat","ls","find","pwd","grep","rg","head","tail"]);

function validCommand(cmd: unknown, args: unknown) {
  if (typeof cmd !== "string" || !/^[a-zA-Z0-9._+:/-]{1,80}$/.test(cmd)) {
    throw new Error("Command name is invalid.");
  }
  if (!Array.isArray(args) || args.length > 20 || args.some(a => typeof a !== "string" || a.length > 500)) {
    throw new Error("Command arguments are invalid.");
  }
  if (!ALLOWED_COMMANDS.has(cmd)) throw new Error("Command is not allowed by the Builder runtime policy.");
  return { cmd, args: args as string[] };
}

async function loadProject(supabase: ReturnType<typeof createClient>, projectId: string) {
  const { data, error } = await supabase
    .from("ai_projects")
    .select("id,name,slug,status,business_id,framework,runtime")
    .eq("id", projectId)
    .single();
  if (error || !data || data.status === "deleted") throw new Error("Project not found.");
  return data;
}

async function loadFiles(supabase: ReturnType<typeof createClient>, projectId: string) {
  const { data, error } = await supabase
    .from("ai_project_files")
    .select("path,content,is_binary")
    .eq("project_id", projectId)
    .order("path");
  if (error) throw error;
  return (data ?? [])
    .filter(row => !row.is_binary && typeof row.content === "string")
    .map(row => ({ path: row.path as string, content: row.content as string }));
}

export async function POST(
  request: Request,
  context: { params: { projectId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!sandboxConfigured()) {
      return NextResponse.json({
        error: "Vercel Sandbox runtime is not configured on the server.",
        code: "SANDBOX_NOT_CONFIGURED"
      }, { status: 503 });
    }

    const project = await loadProject(supabase, context.params.projectId);
    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "sync";

    if (action === "sync") {
      const files = await loadFiles(supabase, project.id);
      const sandbox = await syncFiles(project.id, files);
      const domain = sandboxPreviewDomain(sandbox, 3000);

      const { data: session, error } = await supabase.from("ai_preview_sessions").insert({
        project_id: project.id,
        provider: "vercel_sandbox",
        sandbox_provider: "vercel_sandbox",
        sandbox_name: sandbox.name,
        dev_port: 3000,
        sandbox_domain: domain,
        status: "created",
        started_at: new Date().toISOString(),
        build_output: { synced_files: files.length }
      }).select("id,project_id,sandbox_name,sandbox_domain,status,dev_port,started_at").single();

      if (error) throw error;

      await supabase.from("ai_project_events").insert({
        project_id: project.id,
        event_type: "sandbox.synced",
        sequence_no: Date.now(),
        payload: { session_id: session?.id, files: files.length, sandbox_name: sandbox.name }
      });

      return NextResponse.json({ sandbox: { name: sandbox.name, domain, port: 3000 }, session });
    }

    if (action === "run") {
      const { cmd, args } = validCommand(body.cmd, body.args ?? []);
      const cwd = typeof body.cwd === "string" && body.cwd.startsWith("/") ? body.cwd : "/workspace";
      const detached = body.detached === true;
      const startedAt = new Date().toISOString();

      const { sandbox, exitCode, stdout, stderr } = await runSandboxCommand(project.id, cmd, args, cwd, detached);

      const { data: session, error } = await supabase.from("ai_terminal_sessions").insert({
        project_id: project.id,
        user_id: user.id,
        sandbox_name: sandbox.name,
        sandbox_provider: "vercel_sandbox",
        status: exitCode === 0 ? "completed" : "failed",
        working_directory: cwd,
        command: [cmd, ...args].join(" "),
        exit_code: exitCode,
        output: stdout.slice(0, 50000),
        error_output: stderr.slice(0, 50000),
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        metadata: { detached }
      }).select("id,project_id,sandbox_name,status,working_directory,command,exit_code,output,error_output,started_at,finished_at").single();

      if (error) throw error;

      await supabase.from("ai_project_events").insert({
        project_id: project.id,
        event_type: "sandbox.command",
        sequence_no: Date.now(),
        payload: { session_id: session?.id, cmd, args, exit_code: exitCode }
      });

      return NextResponse.json({
        session,
        sandbox: {
          name: sandbox.name,
          preview_url: detached ? sandboxPreviewDomain(sandbox, 3000) : null
        }
      });
    }

    if (action === "pull") {
      const paths = Array.isArray(body.paths) ? body.paths.filter((p: unknown) => typeof p === "string").slice(0, 100) as string[] : [];
      if (!paths.length) return NextResponse.json({ error: "paths is required." }, { status: 400 });

      const pulled: Array<{ path: string; content_sha: string }> = [];
      for (const path of paths) {
        if (path.includes("..") || path.length > 500) continue;
        const content = await readSandboxFile(project.id, path);
        if (content === null) continue;
        const checksum = createHash("sha256").update(content, "utf8").digest("hex");
        const { data: current } = await supabase
          .from("ai_project_files")
          .select("id,version_no")
          .eq("project_id", project.id)
          .eq("path", path)
          .maybeSingle();

        const { error } = await supabase.from("ai_project_files").upsert({
          id: current?.id,
          project_id: project.id,
          path,
          content,
          content_sha: checksum,
          language: path.split(".").pop() ?? null,
          size_bytes: Buffer.byteLength(content, "utf8"),
          is_binary: false,
          version_no: Number(current?.version_no ?? 0) + 1,
          updated_by: user.id,
          updated_at: new Date().toISOString()
        }, { onConflict: "project_id,path" });

        if (error) throw error;
        pulled.push({ path, content_sha: checksum });
      }

      return NextResponse.json({ pulled });
    }

    if (action === "stop") {
      await stopSandbox(project.id);
      await supabase.from("ai_preview_sessions")
        .update({ status: "stopped", stopped_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("project_id", project.id)
        .eq("sandbox_provider", "vercel_sandbox")
        .in("status", ["created","building","ready"]);
      return NextResponse.json({ stopped: true });
    }

    return NextResponse.json({ error: "Unsupported runtime action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Project runtime failed."
    }, { status: 400 });
  }
}
