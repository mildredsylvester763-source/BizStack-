import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { buildProjectGraph } from "@/lib/project-graph";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project, error } = await supabase.from("ai_projects").select("id,name,metadata").eq("id", projectId).single();
  if (error || !project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const metadata = project.metadata && typeof project.metadata === "object" ? project.metadata as Record<string, unknown> : {};
  return NextResponse.json({ library: metadata.component_library ?? null, project: { id: project.id, name: project.name } });
}

export async function POST(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project, error: projectError } = await supabase
    .from("ai_projects")
    .select("id,business_id,name,metadata,status")
    .eq("id", projectId)
    .single();
  if (projectError || !project || project.status === "deleted") return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const { data: files, error: fileError } = await supabase
    .from("ai_project_files")
    .select("path,content,language")
    .eq("project_id", projectId)
    .order("path");
  if (fileError) return NextResponse.json({ error: fileError.message }, { status: 400 });

  const graph = buildProjectGraph(projectId, (files ?? []).map(file => ({
    path: String(file.path),
    content: file.content,
    language: file.language
  })));

  const components = graph.nodes
    .filter(node => node.kind === "component")
    .slice(0, 120)
    .map((node, index) => ({
      id: node.id,
      name: node.label,
      path: node.path,
      route: node.route || null,
      role: node.evidence?.slice(0, 3).join(" · ") || "Reusable source component",
      reuse_prompt: "Reuse " + node.label + " from " + node.path + " on the requested page without duplicating its source implementation.",
      order: index
    }));

  const library = {
    version: 1,
    generated_at: new Date().toISOString(),
    source: "project_graph",
    components
  };

  const metadata = project.metadata && typeof project.metadata === "object" ? project.metadata as Record<string, unknown> : {};
  const nextMetadata = { ...metadata, component_library: library };
  const { error: updateError } = await supabase
    .from("ai_projects")
    .update({ metadata: nextMetadata, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("business_id", project.business_id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
  return NextResponse.json({ library });
}
