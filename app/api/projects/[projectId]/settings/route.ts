import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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

    const metadata = isObject(project.metadata) ? project.metadata : {};
    const settings = body.settings;
    if (typeof settings.appName !== "string" || typeof settings.defaultRoute !== "string") {
      return NextResponse.json({ error: "appName and defaultRoute are required." }, { status: 400 });
    }
    if (!/^\/[A-Za-z0-9_./:[\\]-]*$/.test(settings.defaultRoute)) {
      return NextResponse.json({ error: "defaultRoute must be a valid application route." }, { status: 400 });
    }

    const nextMetadata = { ...metadata, settings };
    const { error } = await supabase
      .from("ai_projects")
      .update({ metadata: nextMetadata, updated_at: new Date().toISOString() })
      .eq("id", projectId)
      .eq("business_id", project.business_id);

    if (error) throw error;
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Project settings could not be saved." }, { status: 400 });
  }
}
