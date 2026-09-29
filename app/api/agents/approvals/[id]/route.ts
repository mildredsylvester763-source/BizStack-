import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { decideAgentApproval, type ApprovalDecision } from "@/lib/agents/approvals";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const decision: ApprovalDecision = body?.decision === "reject" ? "reject" : "approve";

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (!business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    const result = await decideAgentApproval({
      approvalId: (await context.params).id,
      businessId: business.id,
      userId: user.id,
      decision
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Approval execution failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}