import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase-server";

function normalizePath(value: string) {
  const path = value.trim().replace(/\\+/g, "/").replace(/^\/+/, "");
  if (!path || path.length > 500 || path.includes("..") || path.includes("\0")) {
    throw new Error("Invalid project file path.");
  }
  return path;
}

export async function GET(
  _request: Request,
  context: { params: { projectId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: project, error: projectError } = await supabase
      .from("ai_projects")
      .select("id,name,slug,business_id,status")
      .eq("id", context.params.projectId)
      .single();

    if (projectError || !project || project.status === "deleted") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("ai_project_files")
      .select("id,path,content,content_sha,language,size_bytes,is_binary,version_no,updated_by,created_at,updated_at")
      .eq("project_id", project.id)
      .order("path", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ project, files: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load project files." }, { status: 400 });
  }
}

export async function PUT(
  request: Request,
  context: { params: { projectId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const path = normalizePath(typeof body.path === "string" ? body.path : "");
    const content = typeof body.content === "string" ? body.content : "";
    if (content.length > 2_000_000) return NextResponse.json({ error: "Project file is too large for this editor endpoint." }, { status: 413 });

    const { data: project, error: projectError } = await supabase
      .from("ai_projects")
      .select("id,business_id,status")
      .eq("id", context.params.projectId)
      .single();

    if (projectError || !project || project.status === "deleted") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const language = typeof body.language === "string" ? body.language : null;
    const checksum = createHash("sha256").update(content, "utf8").digest("hex");

    const { data: existing } = await supabase
      .from("ai_project_files")
      .select("id,version_no")
      .eq("project_id", project.id)
      .eq("path", path)
      .maybeSingle();

    const nextVersion = Number(existing?.version_no ?? 0) + 1;
    const { data, error } = await supabase
      .from("ai_project_files")
      .upsert({
        id: existing?.id,
        project_id: project.id,
        path,
        content,
        content_sha: checksum,
        language,
        size_bytes: Buffer.byteLength(content, "utf8"),
        is_binary: false,
        version_no: nextVersion,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "project_id,path" })
      .select("id,path,content,content_sha,language,size_bytes,is_binary,version_no,updated_by,created_at,updated_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ file: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save project file." }, { status: 400 });
  }
}
