import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { runBizStackModel, type BizStackModelMessage } from "@/lib/ai/providers/router";
import { buildProjectGraph } from "@/lib/project-graph";

type SystemKind = "content" | "seo" | "growth";

const schemas: Record<SystemKind, object> = {
  content: {
    version: 1,
    collections: [{
      id: "string",
      name: "string",
      purpose: "string",
      fields: [{ name: "string", type: "string", required: true, public: true }],
      route_pattern: "string",
      reusable_sections: ["string"]
    }],
    content_principles: ["string"],
    editorial_workflow: ["string"]
  },
  seo: {
    version: 1,
    site_title_pattern: "string",
    meta_description_strategy: "string",
    canonical_strategy: "string",
    sitemap_strategy: "string",
    robots_strategy: "string",
    og_strategy: "string",
    structured_data: [{ type: "string", purpose: "string", pages: ["string"] }],
    internal_linking: ["string"],
    accessibility_and_indexing: ["string"]
  },
  growth: {
    version: 1,
    funnel: [{ stage: "string", goal: "string", event: "string", signal: "string" }],
    analytics_events: [{ name: "string", trigger: "string", properties: ["string"] }],
    experiments: [{ hypothesis: "string", variant_a: "string", variant_b: "string", success_signal: "string" }],
    dashboard_metrics: ["string"]
  }
};

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project, error } = await supabase.from("ai_projects").select("id,name,metadata").eq("id", projectId).single();
  if (error || !project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const metadata = project.metadata && typeof project.metadata === "object" ? project.metadata as Record<string, unknown> : {};
  return NextResponse.json({
    project: { id: project.id, name: project.name },
    systems: {
      content: metadata.content_system_plan ?? null,
      seo: metadata.seo_system ?? null,
      growth: metadata.growth_system ?? null
    }
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const body = await request.json().catch(() => ({}));
  const kind = String(body.kind || "").trim() as SystemKind;
  const brief = String(body.brief || "").trim();
  if (!["content","seo","growth"].includes(kind)) return NextResponse.json({ error: "Unsupported site system." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project, error: projectError } = await supabase
    .from("ai_projects")
    .select("id,business_id,name,framework,metadata,status")
    .eq("id", projectId)
    .single();
  if (projectError || !project || project.status === "deleted") return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const { data: business } = await supabase.from("businesses").select("id,name,industry,currency").eq("id", project.business_id).single();
  if (!business) return NextResponse.json({ error: "Business context is not available." }, { status: 404 });

  const { data: files } = await supabase.from("ai_project_files").select("path,content,language").eq("project_id", projectId).order("path");
  const graph = buildProjectGraph(projectId, (files ?? []).map(file => ({ path: String(file.path), content: file.content, language: file.language })));
  const metadata = project.metadata && typeof project.metadata === "object" ? project.metadata as Record<string, unknown> : {};

  const messages: BizStackModelMessage[] = [
    {
      role: "system",
      content: [
        "Create a production-oriented website system for a real business project.",
        "System type: " + kind,
        "Return only JSON matching this schema: " + JSON.stringify(schemas[kind]),
        "Do not invent private or sensitive business data.",
        "Respect the project's existing routes and framework.",
        kind === "content" ? "Design reusable content models and editorial structure without requiring a specific CMS vendor." :
        kind === "seo" ? "Cover modern search, structured data, canonicalization, crawl/index controls and answer-engine discoverability without making unsupported ranking guarantees." :
        "Design measurable analytics and experimentation foundations. Do not fabricate existing traffic or conversion numbers."
      ].join("\n")
    },
    {
      role: "user",
      content: [
        "Business: " + business.name,
        "Industry: " + (business.industry || "not specified"),
        "Project: " + project.name,
        "Framework: " + (project.framework || "not specified"),
        "Brief: " + (brief || "Derive the system from the current project."),
        "Blueprint: " + JSON.stringify(metadata.blueprint || {}),
        "Design system: " + JSON.stringify(metadata.design_system || {}),
        "Routes: " + JSON.stringify(graph.routes.slice(0, 50)),
        "Graph summary: " + JSON.stringify(graph.summary)
      ].join("\n")
    }
  ];

  let parsed: any = null;
  try {
    const result = await runBizStackModel(messages, []);
    parsed = JSON.parse(String(result.message?.content || ""));
  } catch {
    parsed = null;
  }

  const fallback = kind === "content"
    ? {
        version: 1,
        collections: [{ id: "pages", name: "Pages", purpose: "Reusable page content", fields: [{ name: "title", type: "text", required: true, public: true }, { name: "slug", type: "slug", required: true, public: true }, { name: "summary", type: "rich_text", required: false, public: true }], route_pattern: "/:slug", reusable_sections: ["Hero", "Feature grid", "CTA"] }],
        content_principles: ["Keep content separate from layout where possible.", "Use structured fields for reusable data."],
        editorial_workflow: ["Draft", "Review", "Publish"]
      }
    : kind === "seo"
      ? {
          version: 1,
          site_title_pattern: "{page} · {brand}",
          meta_description_strategy: "Write unique page-specific descriptions focused on intent and clear value.",
          canonical_strategy: "Use one canonical URL per indexable page and avoid duplicate parameterized copies.",
          sitemap_strategy: "Generate sitemap entries from published indexable routes.",
          robots_strategy: "Allow public pages and exclude private, preview and authenticated routes.",
          og_strategy: "Provide page-specific Open Graph title, description and image.",
          structured_data: [{ type: "Organization", purpose: "Business identity", pages: ["/"] }, { type: "WebSite", purpose: "Site identity", pages: ["/"] }],
          internal_linking: ["Link related pages contextually.", "Keep important pages reachable from primary navigation or hubs."],
          accessibility_and_indexing: ["Use descriptive headings.", "Provide meaningful link text.", "Do not hide important content from assistive technology or crawlers."]
        }
      : {
          version: 1,
          funnel: [{ stage: "Visit", goal: "Understand offer", event: "page_view", signal: "route + referrer" }, { stage: "Engage", goal: "Take a meaningful action", event: "primary_cta_click", signal: "cta_id + route" }],
          analytics_events: [{ name: "page_view", trigger: "route rendered", properties: ["route"] }, { name: "primary_cta_click", trigger: "primary action clicked", properties: ["route","cta_id"] }],
          experiments: [{ hypothesis: "A clearer primary CTA improves action rate.", variant_a: "Current CTA", variant_b: "More specific CTA", success_signal: "primary_cta_click_rate" }],
          dashboard_metrics: ["Unique visitors", "Primary action rate", "Top entry pages", "Top exit pages"]
        };

  const system = {
    ...(parsed && typeof parsed === "object" ? parsed : fallback),
    generated_at: new Date().toISOString(),
    source: parsed ? "ai" : "deterministic"
  };

  const metadataKey = kind === "content" ? "content_system_plan" : kind === "seo" ? "seo_system" : "growth_system";
  const nextMetadata = { ...metadata, [metadataKey]: system };
  const { error: updateError } = await supabase.from("ai_projects").update({ metadata: nextMetadata, updated_at: new Date().toISOString() }).eq("id", projectId).eq("business_id", business.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({ kind, system });
}
