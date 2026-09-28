import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { executeRepair } from "@/lib/repair/engine";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: { projectId: string } }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const repairId = typeof body.repairId === "string" ? body.repairId : "";
    if (!repairId) return NextResponse.json({ error: "repairId is required." }, { status: 400 });

    const { data: project } = await supabase.from("ai_projects")
      .select("id,business_id,status")
      .eq("id", context.params.projectId)
      .maybeSingle();
    if (!project || project.status === "deleted") return NextResponse.json({ error: "Project not found." }, { status: 404 });

    const { data: canRepair } = await supabase.rpc("user_can_business", {
      p_business_id: project.business_id,
      p_user_id: user.id,
      p_permission: "write_project_files"
    });
    if (!canRepair) return NextResponse.json({ error: "You do not have permission to repair this project." }, { status: 403 });

    const { data: repair, error } = await supabase
      .from("ai_repair_runs")
      .select("id,project_id,status")
      .eq("id", repairId)
      .eq("project_id", context.params.projectId)
      .single();

    if (error || !repair) return NextResponse.json({ error: "Repair run not found." }, { status: 404 });

    const result = await executeRepair(repair.id, user.id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Repair execution failed.";
    const status = /not configured|not found|not ready/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
