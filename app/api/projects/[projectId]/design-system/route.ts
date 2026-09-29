import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { runBizStackModel, type BizStackModelMessage } from "@/lib/ai/providers/router";
import { buildProjectGraph } from "@/lib/project-graph";

type Params = { projectId: string };

export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project, error } = await supabase
    .from("ai_projects")
    .select("id,business_id,metadata,name")
    .eq("id", projectId)
    .single();

  if (error || !project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const { data: business } = await supabase
    .from("businesses")
    .select("id,name,industry,currency")
    .eq("id", project.business_id)
    .single();

  if (!business) return NextResponse.json({ error: "Business context is not available." }, { status: 404 });

  return NextResponse.json({
    designSystem: project.metadata && typeof project.metadata === "object"
      ? (project.metadata as Record<string, unknown>).design_system ?? null
      : null,
    project: { id: project.id, name: project.name },
    business: { id: business.id, name: business.name, industry: business.industry, currency: business.currency }
  });
}

export async function POST(request: Request, { params }: { params: Promise<Params> }) {
  const { projectId } = await params;
  const body = await request.json().catch(() => ({}));
  const brief = String(body.brief || "").trim();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project, error: projectError } = await supabase
    .from("ai_projects")
    .select("id,business_id,name,framework,metadata,status")
    .eq("id", projectId)
    .single();
  if (projectError || !project || project.status === "deleted") return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const { data: business } = await supabase
    .from("businesses")
    .select("id,name,industry,currency")
    .eq("id", project.business_id)
    .single();
  if (!business) return NextResponse.json({ error: "Business context is not available." }, { status: 404 });

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

  const blueprint = project.metadata && typeof project.metadata === "object"
    ? (project.metadata as Record<string, unknown>).blueprint ?? null
    : null;

  const schema = {
    version: 1,
    name: "string",
    philosophy: "string",
    colors: {
      primary: "hex",
      secondary: "hex",
      accent: "hex",
      background: "hex",
      surface: "hex",
      text: "hex",
      muted_text: "hex",
      border: "hex",
      success: "hex",
      warning: "hex",
      danger: "hex"
    },
    typography: {
      heading_family: "string",
      body_family: "string",
      base_size: "string",
      heading_scale: ["string"],
      body_weight: "string",
      heading_weight: "string",
      letter_spacing: "string"
    },
    spacing: {
      unit: "string",
      scale: ["string"],
      section_gap: "string",
      content_max_width: "string"
    },
    radii: {
      control: "string",
      card: "string",
      modal: "string",
      pill: "string"
    },
    shadows: {
      card: "string",
      floating: "string",
      focus: "string"
    },
    components: {
      buttons: "string",
      inputs: "string",
      cards: "string",
      navigation: "string",
      tables: "string"
    },
    motion: {
      principle: "string",
      duration: "string",
      easing: "string",
      reduced_motion: "string"
    },
    accessibility: ["string"]
  };

  const messages: BizStackModelMessage[] = [
    {
      role: "system",
      content: [
        "Create a premium, production-ready website design system for BizStack.",
        "Return only JSON matching this schema: " + JSON.stringify(schema),
        "The design system must be coherent across mobile, tablet and desktop.",
        "Favor strong hierarchy, refined spacing, restrained color use, readable typography and deliberate interaction states.",
        "Do not imitate a named competitor or copy proprietary brand styling.",
        "Use valid CSS-friendly values. Prefer an accessible contrast system.",
        "This is a source-backed system: preserve existing product identity and existing architecture."
      ].join("\n")
    },
    {
      role: "user",
      content: [
        "Business: " + business.name,
        "Industry: " + (business.industry || "not specified"),
        "Project: " + project.name,
        "Framework: " + (project.framework || "not specified"),
        "Brief: " + (brief || "Create a refined system from the current project."),
        "Saved blueprint: " + JSON.stringify(blueprint || {}),
        "Project graph: " + JSON.stringify(graph.summary),
        "Routes: " + JSON.stringify(graph.routes.slice(0, 30))
      ].join("\n")
    }
  ];

  let parsed: any = null;
  try {
    const result = await runBizStackModel(messages, []);
    const raw = String(result.message?.content || "").trim();
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  const designSystem = {
    version: 1,
    name: typeof parsed?.name === "string" ? parsed.name : project.name + " Design System",
    philosophy: typeof parsed?.philosophy === "string" ? parsed.philosophy : "Clear hierarchy, confident typography and restrained visual depth.",
    colors: parsed?.colors || {},
    typography: parsed?.typography || {},
    spacing: parsed?.spacing || {},
    radii: parsed?.radii || {},
    shadows: parsed?.shadows || {},
    components: parsed?.components || {},
    motion: parsed?.motion || {},
    accessibility: Array.isArray(parsed?.accessibility) ? parsed.accessibility.map(String).slice(0, 20) : [],
    generated_at: new Date().toISOString(),
    source: parsed ? "ai" : "deterministic"
  };

  const metadata = {
    ...(project.metadata && typeof project.metadata === "object" ? project.metadata : {}),
    design_system: designSystem
  };

  const { error: updateError } = await supabase
    .from("ai_projects")
    .update({ metadata, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("business_id", business.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({ designSystem });
}
