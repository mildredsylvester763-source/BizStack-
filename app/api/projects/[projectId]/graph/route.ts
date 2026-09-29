import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { buildProjectGraph } from "@/lib/project-graph";

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await context.params;
  const { data: project, error: projectError } = await supabase
    .from("ai_projects")
    .select("id,business_id,name,project_type,status,framework,runtime,default_branch,preview_url,production_url,updated_at")
    .eq("id", projectId)
    .single();

  if (projectError || !project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const { data: files, error: filesError } = await supabase
    .from("ai_project_files")
    .select("path,content,language")
    .eq("project_id", projectId)
    .order("path");

  if (filesError) return NextResponse.json({ error: filesError.message }, { status: 500 });

  const graph = buildProjectGraph(projectId, files || []);
  return NextResponse.json({ project, graph });
}
