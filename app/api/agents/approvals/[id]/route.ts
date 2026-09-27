import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { executeTool, getToolDefinition, type RuntimeContext } from "@/lib/agents/tool-registry";

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const decision = body?.decision === "reject" ? "reject" : "approve";
    const approvalId = context.params.id;

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", user.id)
      .single();
    if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });

    const { data: approval, error } = await supabase
      .from("ai_agent_approvals")
      .select("id,agent_run_id,status,proposed_payload,business_id")
      .eq("id", approvalId)
      .eq("business_id", business.id)
      .single();

    if (error || !approval) return NextResponse.json({ error: "Approval not found." }, { status: 404 });
    if (approval.status !== "pending") return NextResponse.json({ error: "Approval is already decided." }, { status: 409 });

    if (decision === "reject") {
      await supabase.from("ai_agent_approvals").update({
        status: "rejected",
        decided_by: user.id,
        decided_at: new Date().toISOString()
      }).eq("id", approval.id).eq("business_id", business.id);

      await supabase.from("ai_agent_runs").update({
        status: "cancelled",
        finished_at: new Date().toISOString(),
        output: { rejected: true, approval_id: approval.id }
      }).eq("id", approval.agent_run_id).eq("business_id", business.id);

      await supabase.from("events").insert({
        business_id: business.id,
        event_type: "agent.approval_rejected",
        summary: "An agent action was rejected.",
        evidence: { approval_id: approval.id, agent_run_id: approval.agent_run_id },
        status: "dismissed",
        priority: "normal",
        category: "agent",
        action_type: "reject_agent_action"
      });

      return NextResponse.json({ status: "rejected" });
    }

    const payload = (approval.proposed_payload ?? {}) as { tool_key?: string; input?: Record<string, unknown> };
    const toolKey = String(payload.tool_key ?? "");
    const definition = getToolDefinition(toolKey);
    if (!definition) return NextResponse.json({ error: "The requested tool is no longer available." }, { status: 409 });

    const contextForTool: RuntimeContext = { supabase, businessId: business.id, userId: user.id };
    const output = await executeTool(toolKey, payload.input ?? {}, contextForTool);

    await supabase.from("ai_agent_approvals").update({
      status: "approved",
      decided_by: user.id,
      decided_at: new Date().toISOString()
    }).eq("id", approval.id).eq("business_id", business.id);

    await supabase.from("ai_agent_run_steps").update({
      status: "succeeded",
      output,
      finished_at: new Date().toISOString()
    }).eq("agent_run_id", approval.agent_run_id).eq("approval_id", approval.id).eq("business_id", business.id);

    await supabase.from("ai_agent_runs").update({
      status: "succeeded",
      output: { approved: true, approval_id: approval.id, tool_key: toolKey, output },
      approval_required: true,
      finished_at: new Date().toISOString()
    }).eq("id", approval.agent_run_id).eq("business_id", business.id);

    await supabase.from("events").insert({
      business_id: business.id,
      event_type: "agent.approval_approved",
      summary: `Approved and executed ${definition.name}.`,
      evidence: { approval_id: approval.id, agent_run_id: approval.agent_run_id, tool_key: toolKey },
      status: "auto_handled",
      priority: "normal",
      category: "agent",
      action_type: "approve_agent_action"
    });

    return NextResponse.json({ status: "approved", output });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Approval execution failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
