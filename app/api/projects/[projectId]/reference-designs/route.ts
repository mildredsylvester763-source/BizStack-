import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { hydrateAttachmentContent } from "@/lib/ai/attachments";
import { runBizStackModel, type BizStackModelMessage } from "@/lib/ai/providers/router";
import { buildProjectGraph } from "@/lib/project-graph";

type ReferenceDesign = {
  id: string;
  attachment_id: string;
  name: string;
  kind: string;
  summary: string;
  layout_observations: string[];
  typography_observations: string[];
  color_observations: string[];
  component_observations: string[];
  responsive_observations: string[];
  implementation_guidance: string[];
  generated_at: string;
  source: string;
};

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project, error } = await supabase.from("ai_projects").select("id,name,metadata").eq("id", projectId).single();
  if (error || !project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const metadata = project.metadata && typeof project.metadata === "object" ? project.metadata as Record<string, unknown> : {};
  return NextResponse.json({ references: metadata.reference_designs ?? [], project: { id: project.id, name: project.name } });
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const body = await request.json().catch(() => ({}));
  const attachmentId = String(body.attachmentId || "").trim();
  const instruction = String(body.instruction || "").trim();
  if (!attachmentId) return NextResponse.json({ error: "attachmentId is required." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project, error: projectError } = await supabase
    .from("ai_projects")
    .select("id,business_id,name,framework,metadata,status")
    .eq("id", projectId)
    .single();
  if (projectError || !project || project.status === "deleted") return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const { data: files } = await supabase
    .from("ai_project_files")
    .select("path,content,language")
    .eq("project_id", projectId)
    .order("path");

  const graph = buildProjectGraph(projectId, (files ?? []).map(file => ({
    path: String(file.path),
    content: file.content,
    language: file.language
  })));

  const { references, parts } = await hydrateAttachmentContent(supabase, project.business_id, [attachmentId]);
  const reference = references[0];
  if (!reference) return NextResponse.json({ error: "Reference attachment not found." }, { status: 404 });
  if (reference.project_id && reference.project_id !== projectId) return NextResponse.json({ error: "Reference attachment is not linked to this project." }, { status: 403 });

  const schema = {
    summary: "string",
    layout_observations: ["string"],
    typography_observations: ["string"],
    color_observations: ["string"],
    component_observations: ["string"],
    responsive_observations: ["string"],
    implementation_guidance: ["string"]
  };

  let parsed: any = null;
  try {
    const messages: BizStackModelMessage[] = [
      {
        role: "system",
        content: [
          "You are BizStack Reference Studio.",
          "Analyze a user-supplied design reference for implementation guidance.",
          "Return ONLY JSON matching this schema: " + JSON.stringify(schema),
          "Describe observable design characteristics, not hidden implementation you cannot know.",
          "Do not identify or copy a named brand.",
          "Turn the reference into concrete, source-friendly implementation guidance for the existing project.",
          "Preserve accessibility, responsiveness and business functionality."
        ].join("\n")
      },
      {
        role: "user",
        content: [
          "Project: " + project.name,
          "Framework: " + (project.framework || "unknown"),
          "Reference file: " + reference.name,
          "User instruction: " + (instruction || "Analyze this reference and explain how BizStack could adapt its design language without copying it."),
          "Project graph: " + JSON.stringify(graph.summary)
        ].join("\n\n") + "\n\nReference attachment follows:"
      },
      ...parts.map((part) => ({
        role: "user" as const,
        content: [part]
      }))
    ];
    const result = await runBizStackModel(messages, []);
    parsed = JSON.parse(String(result.message?.content || ""));
  } catch {
    parsed = null;
  }

  const design: ReferenceDesign = {
    id: crypto.randomUUID(),
    attachment_id: reference.id,
    name: reference.name,
    kind: reference.kind,
    summary: String(parsed?.summary || "Reference stored for source-backed visual analysis."),
    layout_observations: Array.isArray(parsed?.layout_observations) ? parsed.layout_observations.map(String).slice(0, 12) : [],
    typography_observations: Array.isArray(parsed?.typography_observations) ? parsed.typography_observations.map(String).slice(0, 12) : [],
    color_observations: Array.isArray(parsed?.color_observations) ? parsed.color_observations.map(String).slice(0, 12) : [],
    component_observations: Array.isArray(parsed?.component_observations) ? parsed.component_observations.map(String).slice(0, 12) : [],
    responsive_observations: Array.isArray(parsed?.responsive_observations) ? parsed.responsive_observations.map(String).slice(0, 12) : [],
    implementation_guidance: Array.isArray(parsed?.implementation_guidance) ? parsed.implementation_guidance.map(String).slice(0, 16) : [],
    generated_at: new Date().toISOString(),
    source: parsed ? "ai" : "stored_reference"
  };

  const metadata = project.metadata && typeof project.metadata === "object" ? project.metadata as Record<string, unknown> : {};
  const current = Array.isArray(metadata.reference_designs) ? metadata.reference_designs : [];
  const nextMetadata = {
    ...metadata,
    reference_designs: [design, ...current].slice(0, 12)
  };

  const { error: updateError } = await supabase
    .from("ai_projects")
    .update({ metadata: nextMetadata, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("business_id", project.business_id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({ reference: design, references: nextMetadata.reference_designs });
}
