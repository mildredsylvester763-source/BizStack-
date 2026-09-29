import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { runBizStackModel, type BizStackModelMessage } from "@/lib/ai/providers/router";
import { buildProjectGraph } from "@/lib/project-graph";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project, error } = await supabase.from("ai_projects").select("id,name,metadata").eq("id", projectId).single();
  if (error || !project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const metadata = project.metadata && typeof project.metadata === "object" ? project.metadata as Record<string, unknown> : {};
  return NextResponse.json({ variants: metadata.design_variants ?? null, project: { id: project.id, name: project.name } });
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
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

  const { data: business } = await supabase.from("businesses").select("id,name,industry,currency").eq("id", project.business_id).single();
  if (!business) return NextResponse.json({ error: "Business context is not available." }, { status: 404 });

  const { data: files } = await supabase.from("ai_project_files").select("path,content,language").eq("project_id", projectId).order("path");
  const graph = buildProjectGraph(projectId, (files ?? []).map(file => ({ path: String(file.path), content: file.content, language: file.language })));
  const metadata = project.metadata && typeof project.metadata === "object" ? project.metadata as Record<string, unknown> : {};
  const blueprint = metadata.blueprint ?? {};
  const designSystem = metadata.design_system ?? {};

  const schema = {
    version: 1,
    variants: [{
      id: "string",
      name: "string",
      positioning: "string",
      visual_mood: "string",
      typography_direction: "string",
      color_direction: "string",
      layout_strategy: "string",
      component_strategy: "string",
      motion_direction: "string",
      best_for: "string",
      implementation_notes: ["string"]
    }]
  };

  const messages: BizStackModelMessage[] = [
    {
      role: "system",
      content: [
        "Create three genuinely differentiated visual directions for a real website project.",
        "Return only JSON matching this schema: " + JSON.stringify(schema),
        "Do not copy or imitate named competitors.",
        "Variants must preserve the business purpose and information architecture while differing materially in visual hierarchy, typography, spatial rhythm and composition.",
        "Make each direction implementable with the project's existing framework and source tree."
      ].join("\n")
    },
    {
      role: "user",
      content: [
        "Business: " + business.name,
        "Industry: " + (business.industry || "not specified"),
        "Project: " + project.name,
        "Framework: " + (project.framework || "not specified"),
        "Brief: " + (brief || "Explore premium design directions for the current site."),
        "Saved blueprint: " + JSON.stringify(blueprint),
        "Saved design system: " + JSON.stringify(designSystem),
        "Project graph: " + JSON.stringify(graph.summary),
        "Routes: " + JSON.stringify(graph.routes.slice(0, 30))
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

  const variants = Array.isArray(parsed?.variants) && parsed.variants.length
    ? parsed.variants.slice(0, 3)
    : [
      {
        id: "editorial",
        name: "Editorial Precision",
        positioning: "Clear premium storytelling with strong content hierarchy.",
        visual_mood: "Confident, refined, spacious",
        typography_direction: "High-contrast display headings with restrained body text.",
        color_direction: "Neutral foundation with one decisive brand accent.",
        layout_strategy: "Large narrative sections, deliberate whitespace and strong alignment.",
        component_strategy: "Simple components with distinctive spacing and states.",
        motion_direction: "Quiet transitions and selective reveal.",
        best_for: "Brand-led businesses and premium services.",
        implementation_notes: ["Preserve existing routes.", "Use the saved design system as the implementation baseline."]
      },
      {
        id: "commerce",
        name: "Commerce Clarity",
        positioning: "Fast scanning, strong calls to action and product-first hierarchy.",
        visual_mood: "Crisp, energetic, highly navigable",
        typography_direction: "Compact headings with clear numeric and CTA hierarchy.",
        color_direction: "Bright accents on a controlled surface palette.",
        layout_strategy: "Modular grids, strong cards and visible action zones.",
        component_strategy: "Reusable commerce primitives with responsive states.",
        motion_direction: "Snappy micro-interactions around actions.",
        best_for: "Stores, catalogs and transactional websites.",
        implementation_notes: ["Keep critical actions obvious on mobile.", "Reuse existing business data bindings."]
      },
      {
        id: "immersive",
        name: "Immersive Signature",
        positioning: "Visually memorable composition without sacrificing usability.",
        visual_mood: "Atmospheric, expressive, premium",
        typography_direction: "Strong type scale with intentional asymmetry.",
        color_direction: "Layered surfaces with an expressive accent family.",
        layout_strategy: "Hero-led composition, overlapping sections and selective depth.",
        component_strategy: "Fewer but more distinctive visual primitives.",
        motion_direction: "Purposeful transitions and soft depth changes.",
        best_for: "Creative brands and businesses where identity is central.",
        implementation_notes: ["Protect accessibility and reduced-motion behavior.", "Keep responsive hierarchy explicit."]
      }
    ];

  const designVariants = {
    version: 1,
    generated_at: new Date().toISOString(),
    variants,
    source: parsed ? "ai" : "deterministic"
  };

  const nextMetadata = { ...metadata, design_variants: designVariants };
  const { error: updateError } = await supabase.from("ai_projects").update({ metadata: nextMetadata, updated_at: new Date().toISOString() }).eq("id", projectId).eq("business_id", business.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({ designVariants });
}
