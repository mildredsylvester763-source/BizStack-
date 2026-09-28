import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

async function getBusiness(supabase: Awaited<ReturnType<typeof createClient>>, businessId?: string) {
  let query = supabase
    .from("businesses")
    .select("id,name,workspace_id,organization_id")
    .order("created_at", { ascending: true })
    .limit(1);

  if (businessId) query = query.eq("id", businessId);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Business context is not available.");
  return data;
}

export async function GET(request: Request) {
  try {
    const supabase = await await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const businessId = new URL(request.url).searchParams.get("businessId") || undefined;
    const business = await getBusiness(supabase, businessId);

    const { data, error } = await supabase
      .from("ai_projects")
      .select("id,name,slug,project_type,status,default_branch,framework,runtime,repository_name,preview_url,production_url,metadata,created_by,created_at,updated_at")
      .eq("business_id", business.id)
      .neq("status", "deleted")
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ business, projects: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load projects." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    const projectType = typeof body.projectType === "string" ? body.projectType : "app";
    const framework = typeof body.framework === "string" ? body.framework : null;
    const runtime = typeof body.runtime === "string" ? body.runtime : null;
    if (!name || !slug) return NextResponse.json({ error: "Project name and slug are required." }, { status: 400 });
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) {
      return NextResponse.json({ error: "Project slug must use 2-63 lowercase letters, numbers, or hyphens." }, { status: 400 });
    }

    const business = await getBusiness(supabase, typeof body.businessId === "string" ? body.businessId : undefined);
    const { data, error } = await supabase
      .from("ai_projects")
      .insert({
        business_id: business.id,
        workspace_id: business.workspace_id,
        name,
        slug,
        project_type: projectType,
        framework,
        runtime,
        created_by: user.id,
      })
      .select("id,name,slug,project_type,status,default_branch,framework,runtime,metadata,created_by,created_at,updated_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ project: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create project." }, { status: 400 });
  }
}
