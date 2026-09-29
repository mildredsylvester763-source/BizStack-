import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: project } = await supabase.from("ai_projects").select("id,name,slug,business_id,status").eq("id", (await context.params).projectId).single();
    if (!project || project.status === "deleted") return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const { data, error } = await supabase.from("ai_project_versions")
      .select("id,project_id,version_no,message,source_run_id,created_by,created_at")
      .eq("project_id", project.id)
      .order("version_no", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ project, versions: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load project versions." }, { status: 400 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : "Snapshot";
    const restoreVersionId = typeof body.restoreVersionId === "string" ? body.restoreVersionId : null;

    const { data: project, error: projectError } = await supabase
      .from("ai_projects")
      .select("id,name,slug,business_id,status")
      .eq("id", (await context.params).projectId)
      .single();

    if (projectError || !project || project.status === "deleted") {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const [{ data: files, error: filesError }, { data: latestVersion, error: versionError }] = await Promise.all([
      supabase.from("ai_project_files").select("path,content,content_sha,language,size_bytes,version_no").eq("project_id", project.id).order("path", { ascending: true }),
      supabase.from("ai_project_versions").select("version_no").eq("project_id", project.id).order("version_no", { ascending: false }).limit(1).maybeSingle()
    ]);

    if (filesError) throw filesError;
    if (versionError) throw versionError;

    if (restoreVersionId) {
      const { data: sourceVersion, error: sourceError } = await supabase
        .from("ai_project_versions")
        .select("id,version_no,message,snapshot")
        .eq("id", restoreVersionId)
        .eq("project_id", project.id)
        .single();
      if (sourceError || !sourceVersion) return NextResponse.json({ error: "Version to restore was not found." }, { status: 404 });
      const sourceFiles = Array.isArray((sourceVersion.snapshot as any)?.files) ? (sourceVersion.snapshot as any).files : [];
      for (const file of sourceFiles) {
        if (!file?.path) continue;
        const { error } = await supabase.from("ai_project_files").upsert({
          project_id: project.id,
          path: file.path,
          content: typeof file.content === "string" ? file.content : null,
          content_sha: file.content_sha ?? null,
          language: file.language ?? null,
          size_bytes: Number(file.size_bytes ?? 0),
          is_binary: Boolean(file.is_binary),
          version_no: Number(file.version_no ?? 1),
          updated_by: user.id,
          updated_at: new Date().toISOString()
        }, { onConflict: "project_id,path" });
        if (error) throw error;
      }
      const versionNo = Number(latestVersion?.version_no ?? 0) + 1;
      const restoredSnapshot = {
        format: "bizstack-project-snapshot/v1",
        project: { id: project.id, name: project.name, slug: project.slug },
        restored_from_version_id: sourceVersion.id,
        files: sourceFiles,
        captured_at: new Date().toISOString()
      };
      const { data: restored, error: restoreError } = await supabase.from("ai_project_versions").insert({
        project_id: project.id,
        version_no: versionNo,
        message: message || ("Restored version " + sourceVersion.version_no),
        snapshot: restoredSnapshot,
        created_by: user.id
      }).select("id,project_id,version_no,message,created_by,created_at").single();
      if (restoreError) throw restoreError;
      return NextResponse.json({ version: restored, restoredFrom: sourceVersion.version_no, snapshot: restoredSnapshot });
    }

    const versionNo = Number(latestVersion?.version_no ?? 0) + 1;
    const snapshot = {
      format: "bizstack-project-snapshot/v1",
      project: { id: project.id, name: project.name, slug: project.slug },
      files: files ?? [],
      captured_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("ai_project_versions")
      .insert({
        project_id: project.id,
        version_no: versionNo,
        message,
        snapshot,
        created_by: user.id,
      })
      .select("id,project_id,version_no,message,created_by,created_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ version: data, snapshot });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create project version." }, { status: 400 });
  }
}