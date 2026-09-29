import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { runBizStackModel, type BizStackModelMessage } from "@/lib/ai/providers/router";
import { buildProjectGraph } from "@/lib/project-graph";

function normalize(value: any, name: string) {
  const pages = Array.isArray(value?.pages) && value.pages.length ? value.pages : [{
    id: "home", path: "/", name: "Home", priority: "primary",
    purpose: "Introduce the business and drive the primary action.",
    sections: [
      { id: "hero", name: "Hero", purpose: "State value proposition.", data: [], primary_action: "Primary CTA" },
      { id: "proof", name: "Proof", purpose: "Build trust.", data: [] },
      { id: "next-step", name: "Next step", purpose: "Move visitors forward.", data: [], primary_action: "Contact / purchase / book" }
    ]
  }];
  return {
    version: 1,
    title: typeof value?.title === "string" ? value.title : name + " Website Blueprint",
    summary: typeof value?.summary === "string" ? value.summary : "Source-aware website structure and implementation plan.",
    audience: Array.isArray(value?.audience) ? value.audience.map(String).slice(0, 20) : [],
    goals: Array.isArray(value?.goals) ? value.goals.map(String).slice(0, 20) : [],
    pages: pages.slice(0, 40),
    flows: Array.isArray(value?.flows) ? value.flows.slice(0, 20) : [],
    design_direction: value?.design_direction || {},
    content_system: value?.content_system || {},
    engineering_notes: value?.engineering_notes || {},
    generated_at: new Date().toISOString()
  };
}

async function contextFor(projectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: project, error } = await supabase
    .from("ai_projects")
    .select("id,business_id,name,framework,metadata")
    .eq("id", projectId)
    .neq("status", "deleted")
    .maybeSingle();

  if (error || !project) throw new Error("Project not found.");

  const { data: business } = await supabase
    .from("businesses")
    .select("id,name,industry,currency")
    .eq("id", project.business_id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!business) throw new Error("Project access denied.");

  const { data: files } = await supabase
    .from("ai_project_files")
    .select("path,content,language")
    .eq("project_id", projectId)
    .order("path");

  const graph = buildProjectGraph(projectId, (files || []).map((f) => ({
    path: String(f.path), content: f.content, language: f.language
  })));

  return { supabase, project, business, graph };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { project } = await contextFor((await params).projectId);
    return NextResponse.json({ blueprint: project.metadata?.blueprint || null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load blueprint." }, { status: 400 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const projectId = (await params).projectId;
    const body = await request.json().catch(() => ({}));
    const brief = typeof body?.brief === "string" ? body.brief.trim() : "";
    if (!brief) return NextResponse.json({ error: "Add a website brief before generating the blueprint." }, { status: 400 });

    const { supabase, project, business, graph } = await contextFor(projectId);
    const schema = {
      title: "string", summary: "string", audience: ["string"], goals: ["string"],
      pages: [{ id: "string", path: "/example", name: "string", purpose: "string", priority: "primary|secondary|utility",
        sections: [{ id: "string", name: "string", purpose: "string", data: ["string"], primary_action: "string" }] }],
      flows: [{ id: "string", name: "string", steps: ["string"], outcome: "string" }],
      design_direction: { style: "string", visual_principles: ["string"], typography: "string", color_direction: "string", motion: "string", responsive_strategy: "string" },
      content_system: { cms_candidates: ["string"], reusable_components: ["string"], dynamic_data_candidates: ["string"] },
      engineering_notes: { auth: ["string"], integrations: ["string"], data_dependencies: ["string"], verification: ["string"] }
    };

    const messages: BizStackModelMessage[] = [
      {
        role: "system",
        content: "Create an implementation-ready website blueprint, not a moodboard. Connect pages, sections, business data, integrations, auth and verification. Do not invent private records. Return only JSON matching: " + JSON.stringify(schema)
      },
      {
        role: "user",
        content: [
          "Business: " + business.name,
          "Industry: " + (business.industry || "not specified"),
          "Project: " + project.name,
          "Framework: " + (project.framework || "not specified"),
          "Existing routes: " + JSON.stringify(graph.routes),
          "Existing graph: " + JSON.stringify(graph.summary),
          "Brief: " + brief
        ].join("\n")
      }
    ];

    let raw = "";
    try {
      const result = await runBizStackModel(messages, []);
      raw = String(result.message?.content || "").trim();
    } catch {}

    const cleaned = raw.replace(/^\`\`\`json\s*/i, "").replace(/^\`\`\`\s*/i, "").replace(/\s*\`\`\`$/i, "").trim();
    let parsed: any = null;
    try { parsed = cleaned ? JSON.parse(cleaned) : null; } catch {}

    const blueprint = normalize(parsed, project.name);
    const metadata = { ...(project.metadata && typeof project.metadata === "object" ? project.metadata : {}), blueprint };
    const { error } = await supabase
      .from("ai_projects")
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq("id", project.id)
      .eq("business_id", project.business_id);

    if (error) throw error;
    return NextResponse.json({ blueprint, generated_by: raw ? "ai" : "deterministic-fallback", graph_summary: graph.summary });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not generate blueprint." }, { status: 400 });
  }
}
