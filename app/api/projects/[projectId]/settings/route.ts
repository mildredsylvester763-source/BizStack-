import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

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
    if (!isObject(body.settings)) return NextResponse.json({ error: "settings must be an object." }, { status: 400 });

    const { data: project, error: projectError } = await supabase
      .from("ai_projects")
      .select("id,business_id,metadata")
      .eq("id", projectId)
      .neq("status", "deleted")
      .maybeSingle();

    if (projectError || !project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", project.business_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!business) return NextResponse.json({ error: "Project access denied." }, { status: 403 });

    const settings = body.settings;
    const identity = isObject(settings.identity) ? settings.identity : {};
    const platform = isObject(settings.platform) ? settings.platform : {};
    const seo = isObject(settings.seo) ? settings.seo : {};

    if (typeof identity.appName !== "string" || identity.appName.trim().length < 1) {
      return NextResponse.json({ error: "An application/site name is required." }, { status: 400 });
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

    const metadata = isObject(project.metadata) ? project.metadata : {};
    const nextMetadata = {
      ...metadata,
      settings: {
        ...settings,
        _meta: { savedAt: new Date().toISOString(), savedBy: user.id }
      }
    };

    const { error } = await supabase
      .from("ai_projects")
      .update({ metadata: nextMetadata, updated_at: new Date().toISOString() })
      .eq("id", projectId)
      .eq("business_id", project.business_id);

    if (error) throw error;
    return NextResponse.json({ ok: true, settings: nextMetadata.settings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Project settings could not be saved." }, { status: 400 });
  }
}
