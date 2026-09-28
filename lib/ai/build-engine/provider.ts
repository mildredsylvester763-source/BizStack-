import type { BuildContext, BuildProviderResult, WebsiteSpec } from "@/lib/ai/build-engine/types";
import { normalizeLocalWebsiteSpec } from "@/lib/ai/build-engine/website-local";
import { getConfiguredAiProviders, runBizStackModel, type BizStackModelMessage } from "@/lib/ai/providers/router";

function extractJson(value: unknown): unknown {
  if (typeof value === "object" && value !== null) return value;
  if (typeof value !== "string") return null;
  const fenced = value.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/i)?.[1] ?? value;
  try { return JSON.parse(fenced); } catch {
    const first = value.indexOf("{");
    const last = value.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try { return JSON.parse(value.slice(first, last + 1)); } catch {}
    }
    return null;
  }
}

function systemPrompt() {
  return [
    "You are the BizStack structured website compiler.",
    "Return ONLY one valid JSON object matching the requested WebsiteSpec shape.",
    "Do not use markdown fences and do not add commentary.",
    "Never invent credentials, domains, payment confirmations, connected accounts, legal claims, or real-world availability.",
    "Use the supplied business and existing website context.",
    "Keep colors valid CSS values and keep page slugs URL-safe.",
    "Every page must have a slug, title, pageType, seo object, and sections array.",
    "WebsiteSpec shape:",
    JSON.stringify({
      name: "string",
      subdomain: "string",
      theme: { style: "modern", primary: "#111827", accent: "#d97706", surface: "#f8fafc", typography: "clean" },
      navigation: ["Home"],
      features: ["string"],
      pages: [{ slug: "home", title: "Home", pageType: "home", seo: { title: "string", description: "string" }, sections: [{ id: "hero", type: "hero", heading: "string", body: "string", items: [], button: "string", url: "#contact" }] }],
      forms: [{ key: "contact", name: "Contact", fields: ["name", "email", "message"], destination: "crm" }],
      integrations: [{ key: "example", provider: "example", required: false, status: "credential_required" }],
      seo: { siteTitle: "string", description: "string", keywords: ["string"] }
    })
  ].join("\n");
}

export async function generateWebsiteSpec(prompt: string, context: BuildContext): Promise<BuildProviderResult> {
  if (!getConfiguredAiProviders().length && !(process.env.BIZSTACK_AI_API_URL && process.env.BIZSTACK_AI_API_KEY)) {
    return {
      providerKey: "local-interpreter",
      status: "fallback",
      spec: normalizeLocalWebsiteSpec(prompt, context),
      model: "deterministic-local"
    };
  }

  const messages: BizStackModelMessage[] = [
    { role: "system", content: systemPrompt() },
    {
      role: "user",
      content: JSON.stringify({
        prompt,
        context: {
          business: context.business,
          website_id: context.websiteId ?? null,
          existing_website: context.existingWebsite ?? null
        }
      })
    }
  ];

  try {
    const result = await runBizStackModel(messages, []);
    const candidate = extractJson(result.message?.content) as WebsiteSpec | null;
    if (!candidate?.pages?.length) {
      return {
        providerKey: result.provider,
        status: "failed",
        error: "BizStack AI returned no usable website specification.",
        spec: normalizeLocalWebsiteSpec(prompt, context),
        model: result.model,
        raw: result.message
      };
    }
    return {
      providerKey: result.provider,
      status: "available",
      spec: candidate,
      raw: result.message,
      model: result.model
    };
  } catch (error) {
    return {
      providerKey: "bizstack-ai",
      status: "failed",
      error: error instanceof Error ? error.message : "BizStack AI website compilation failed.",
      spec: normalizeLocalWebsiteSpec(prompt, context)
    };
  }
}
