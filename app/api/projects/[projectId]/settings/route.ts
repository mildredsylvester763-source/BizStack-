import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const ALLOWED_GROUPS = new Set([
  "identity",
  "platform",
  "navigation",
  "appearance",
  "responsive",
  "accessibility",
  "localization",
  "seo",
  "analytics",
  "runtime",
  "data",
  "auth",
  "security",
  "api",
  "integrations",
  "automation",
  "environment",
  "domains",
  "publishing",
  "releases",
  "mobile",
  "developer"
]);

const SENSITIVE_KEY = /(password|secret|token|private.?key|client.?secret|access.?key|service.?role|authorization)/i;

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validRoute(value: unknown) {
  return typeof value === "string" && /^\/[A-Za-z0-9_./:[\\]-]*$/.test(value);
}

function validHttpUrl(value: unknown) {
  if (!value) return true;
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validEnum(value: unknown, allowed: string[]) {
  return typeof value === "string" && allowed.includes(value);
}

function containsSensitiveKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSensitiveKey);
  if (!isObject(value)) return false;
  for (const [key, nested] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) return true;
    if (containsSensitiveKey(nested)) return true;
  }
  return false;
}

function collectSettings(settings: Record<string, any>) {
  const groups = Object.keys(settings).filter((key) => key !== "_meta");
  const unknown = groups.filter((key) => !ALLOWED_GROUPS.has(key));
  return { groups, unknown };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const projectId = (await params).projectId;
    const body = await request.json().catch(() => ({}));
    if (!isObject(body.settings)) {
      return NextResponse.json({ error: "settings must be an object." }, { status: 400 });
    }

    const settings = body.settings;
    const { unknown } = collectSettings(settings);

    if (unknown.length) {
      return NextResponse.json({
        error: "Unknown settings section.",
        sections: unknown
      }, { status: 400 });
    }

    if (containsSensitiveKey(settings)) {
      return NextResponse.json({
        error: "Credentials and secrets must be stored through the project's integration or environment-secret system, not project settings."
      }, { status: 400 });
    }

    const serialized = JSON.stringify(settings);
    if (serialized.length > 250_000) {
      return NextResponse.json({ error: "Project settings payload is too large." }, { status: 413 });
    }

    const { data: project, error: projectError } = await supabase
      .from("ai_projects")
      .select("id,business_id,metadata")
      .eq("id", projectId)
      .neq("status", "deleted")
      .maybeSingle();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", project.business_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!business) return NextResponse.json({ error: "Project access denied." }, { status: 403 });

    const identity = isObject(settings.identity) ? settings.identity : {};
    const platform = isObject(settings.platform) ? settings.platform : {};
    const seo = isObject(settings.seo) ? settings.seo : {};
    const publishing = isObject(settings.publishing) ? settings.publishing : {};
    const domains = isObject(settings.domains) ? settings.domains : {};
    const developer = isObject(settings.developer) ? settings.developer : {};
    const mobile = isObject(settings.mobile) ? settings.mobile : {};

    if (typeof identity.appName !== "string" || identity.appName.trim().length < 1) {
      return NextResponse.json({ error: "An application/site name is required." }, { status: 400 });
    }

    if (identity.appName.length > 160 || String(identity.shortName || "").length > 40) {
      return NextResponse.json({ error: "Application names are too long for project identity settings." }, { status: 400 });
    }

    if (!validRoute(platform.defaultRoute)) {
      return NextResponse.json({ error: "Default route must begin with / and contain only valid route characters." }, { status: 400 });
    }

    if (!validHttpUrl(identity.iconUrl) || !validHttpUrl(identity.splashUrl) || !validHttpUrl(identity.socialImageUrl)) {
      return NextResponse.json({ error: "Icon, splash and social image URLs must be valid HTTP(S) URLs." }, { status: 400 });
    }

    if (!validHttpUrl(seo.canonicalBase)) {
      return NextResponse.json({ error: "Canonical base URL must be a valid HTTP(S) URL." }, { status: 400 });
    }

    if (seo.indexing !== undefined && !validEnum(seo.indexing, ["index", "noindex"])) {
      return NextResponse.json({ error: "Invalid SEO indexing policy." }, { status: 400 });
    }

    if (platform.shell !== undefined && !validEnum(platform.shell, ["website", "web-app", "mobile-app", "full-stack", "api"])) {
      return NextResponse.json({ error: "Invalid product shell." }, { status: 400 });
    }

    if (platform.target !== undefined && !validEnum(platform.target, ["web", "android", "ios", "android-ios", "server"])) {
      return NextResponse.json({ error: "Invalid project target." }, { status: 400 });
    }

    if (publishing.releaseChannel !== undefined && !validEnum(publishing.releaseChannel, ["development", "preview", "production"])) {
      return NextResponse.json({ error: "Invalid release channel." }, { status: 400 });
    }

    if (developer.buildOutput !== undefined && typeof developer.buildOutput !== "string") {
      return NextResponse.json({ error: "Build output must be text." }, { status: 400 });
    }

    if (domains.primaryDomain !== undefined && domains.primaryDomain !== "" && typeof domains.primaryDomain !== "string") {
      return NextResponse.json({ error: "Primary domain must be text." }, { status: 400 });
    }

    if (mobile.packageId !== undefined && typeof mobile.packageId !== "string") {
      return NextResponse.json({ error: "Android package ID must be text." }, { status: 400 });
    }

    if (mobile.iosBundleId !== undefined && typeof mobile.iosBundleId !== "string") {
      return NextResponse.json({ error: "iOS bundle identifier must be text." }, { status: 400 });
    }

    const metadata = isObject(project.metadata) ? project.metadata : {};
    const nextMetadata = {
      ...metadata,
      settings: {
        ...settings,
        _meta: {
          savedAt: new Date().toISOString(),
          savedBy: user.id,
          schemaVersion: 2
        }
      }
    };

    const { error } = await supabase
      .from("ai_projects")
      .update({
        metadata: nextMetadata,
        updated_at: new Date().toISOString()
      })
      .eq("id", projectId)
      .eq("business_id", project.business_id);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      settings: nextMetadata.settings
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Project settings could not be saved."
    }, { status: 400 });
  }
}
