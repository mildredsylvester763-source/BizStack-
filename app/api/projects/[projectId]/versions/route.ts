import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(
  request: Request,
  context: { params: { projectId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : "Snapshot";

    const { data: project, error: projectError } = await supabase
      .from("ai_projects")
      .select("id,name,slug,business_id,status")
      .eq("id", context.params.projectId)
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
