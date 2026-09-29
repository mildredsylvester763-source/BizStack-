import { createClient } from "@/lib/supabase-server";

export type WebsiteAssetKind =
  | "logo"
  | "hero"
  | "section_image"
  | "product_scene"
  | "background"
  | "illustration"
  | "og_image"
  | "favicon"
  | "custom";

type GenerateWebsiteAssetArgs = {
  supabase?: Awaited<ReturnType<typeof createClient>>;
  businessId: string;
  userId: string;
  websiteId?: string | null;
  projectId?: string | null;
  buildRunId?: string | null;
  kind: WebsiteAssetKind;
  name?: string;
  prompt: string;
  altText?: string | null;
  visualDirection?: string | null;
  referenceContext?: string | null;
};

const BUCKET = "bizstack-website-assets";

function env(name: string) {
  return process.env[name]?.trim() || "";
}

export function imageGenerationConfigured() {
  return Boolean(env("BIZSTACK_OPENAI_API_KEY") || env("OPENAI_API_KEY"));
}

function buildCreativePrompt(args: GenerateWebsiteAssetArgs, business: any) {
  const kindRules: Record<WebsiteAssetKind, string> = {
    logo: "Create an original brand mark/logo concept with a distinctive symbol and clean professional geometry. Use transparent background. Do not imitate or resemble an existing company logo. Avoid tiny unreadable lettering; the mark must still work at small sizes.",
    hero: "Create a bespoke hero visual for this exact business and audience. Use strong editorial or cinematic composition, realistic or art-directed depending on the brief, with intentional negative space for website copy. Do not look like generic stock photography.",
    section_image: "Create a bespoke section visual that directly communicates the requested business idea. It should feel art-directed for this brand, not like a generic stock image.",
    product_scene: "Create a premium product scene around the described product. Preserve the product's described identity and make the environment brand-specific rather than generic.",
    background: "Create a distinctive background texture or atmospheric visual that supports the brand system without becoming a generic SaaS gradient.",
    illustration: "Create an original illustration system for the specified business. Use a coherent visual language, custom shapes and composition rather than common template graphics.",
    og_image: "Create a distinctive social preview composition for this exact brand, with deliberate hierarchy and room for readable title treatment. Avoid copied social-media templates.",
    favicon: "Create a simple original icon derived from the brand identity. It must remain legible at favicon scale and must not imitate another brand.",
    custom: "Create an original visual tailored to the exact request and business context. Do not fall back to generic stock or template imagery."
  };

  return [
    "You are BizStack's bespoke visual art director.",
    "The visual must be made specifically for this business and this website.",
    "Never use a generic stock-photo aesthetic, common SaaS gradient, placeholder illustration, copied brand mark, or recognizable existing company's visual identity.",
    "Do not invent a partnership, trademark, credential, certification, product claim, or real person.",
    "Prefer specificity: business context, audience, location/culture when supplied, materials, environment, mood, composition, palette and visual metaphor should all come from the brief.",
    "Do not add arbitrary text unless the requested asset is specifically a wordmark or title treatment. Never produce fake UI text or fake brand names.",
    kindRules[args.kind],
    "Business name: " + String(business.name || "Business"),
    "Industry: " + String(business.industry || "not specified"),
    "Base currency: " + String(business.currency || "not specified"),
    args.visualDirection ? "Visual direction: " + args.visualDirection : "",
    args.referenceContext ? "Reference/context: " + args.referenceContext : "",
    "Asset type: " + args.kind,
    "Specific request: " + args.prompt
  ].filter(Boolean).join("\n");
}

export async function generateWebsiteAsset(args: GenerateWebsiteAssetArgs) {
  const supabase = args.supabase ?? await createClient();
  const apiKey = env("BIZSTACK_OPENAI_API_KEY") || env("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("Website visual generation is not configured. Add BIZSTACK_OPENAI_API_KEY or OPENAI_API_KEY on the server.");
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id,name,industry,currency")
    .eq("id", args.businessId)
    .eq("owner_id", args.userId)
    .single();

  if (businessError || !business) throw new Error("Business context is not available for visual generation.");

  if (args.websiteId) {
    const { data: website } = await supabase
      .from("websites")
      .select("id")
      .eq("id", args.websiteId)
      .eq("business_id", args.businessId)
      .maybeSingle();
    if (!website) throw new Error("Website target was not found for this business.");
  }

  if (args.projectId) {
    const { data: project } = await supabase
      .from("ai_projects")
      .select("id")
      .eq("id", args.projectId)
      .eq("business_id", args.businessId)
      .neq("status", "deleted")
      .maybeSingle();
    if (!project) throw new Error("Software project target was not found for this business.");
  }

  const model = env("BIZSTACK_IMAGE_MODEL") || "gpt-5.6";
  const prompt = buildCreativePrompt(args, business);
  const assetId = crypto.randomUUID();
  const storagePath = [
    args.businessId,
    args.websiteId || "unassigned",
    args.projectId || "no-project",
    assetId + ".png"
  ].join("/");

  const { data: pending, error: pendingError } = await supabase
    .from("ai_website_assets")
    .insert({
      id: assetId,
      business_id: args.businessId,
      website_id: args.websiteId || null,
      project_id: args.projectId || null,
      build_run_id: args.buildRunId || null,
      created_by: args.userId,
      kind: args.kind,
      name: (args.name || (args.kind + " visual")).slice(0, 160),
      prompt,
      storage_path: storagePath,
      mime_type: "image/png",
      alt_text: args.altText || null,
      model,
      status: "generating",
      metadata: {
        generation_source: "bizstack_ai_builder",
        bespoke: true
      }
    })
    .select("id")
    .single();

  if (pendingError || !pending) throw new Error(pendingError?.message || "Could not create the visual asset record.");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + apiKey
      },
      body: JSON.stringify({
        model,
        input: prompt,
        tools: [{ type: "image_generation" }]
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Image provider returned HTTP " + response.status + ": " + (await response.text()).slice(0, 600));
    }

    const body = await response.json();
    const call = Array.isArray(body?.output)
      ? body.output.find((item: any) => item?.type === "image_generation_call")
      : null;
    const base64 = typeof call?.result === "string" ? call.result : "";

    if (!base64) throw new Error("Image provider returned no generated image.");

    const imageBytes = Buffer.from(base64, "base64");
    if (!imageBytes.length) throw new Error("Generated image data was empty.");

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, imageBytes, {
        contentType: "image/png",
        cacheControl: "31536000",
        upsert: false
      });

    if (uploadError) throw new Error("Could not persist generated visual: " + uploadError.message);

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = publicData.publicUrl;

    await supabase
      .from("ai_website_assets")
      .update({
        status: "active",
        updated_at: new Date().toISOString(),
        metadata: {
          generation_source: "bizstack_ai_builder",
          bespoke: true,
          provider_response_id: body?.id || null,
          byte_size: imageBytes.length
        }
      })
      .eq("id", assetId)
      .eq("business_id", args.businessId);

    return {
      id: assetId,
      kind: args.kind,
      name: args.name || args.kind + " visual",
      public_url: publicUrl,
      storage_path: storagePath,
      mime_type: "image/png",
      model,
      bespoke: true,
      prompt
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed.";
    await supabase
      .from("ai_website_assets")
      .update({
        status: "failed",
        error_message: message,
        updated_at: new Date().toISOString()
      })
      .eq("id", assetId)
      .eq("business_id", args.businessId);
    throw new Error(message);
  }
}
