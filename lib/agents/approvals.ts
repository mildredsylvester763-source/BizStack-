import { createClient } from "@/lib/supabase-server";
import { executeTool, getToolDefinition, type RuntimeContext } from "@/lib/agents/tool-registry";

export type ApprovalDecision = "approve" | "reject";

export async function decideAgentApproval({
  approvalId,
  businessId,
  userId,
  decision
}: {
  approvalId: string;
  businessId: string;
  userId: string;
  decision: ApprovalDecision;
}) {
  const supabase = await createClient();

  const { data: approval, error } = await supabase
    .from("ai_agent_approvals")
    .select("id,agent_run_id,status,proposed_payload,business_id")
    .eq("id", approvalId)
    .eq("business_id", businessId)
    .single();

  if (error || !approval) throw new Error("Approval not found.");
  if (approval.status !== "pending") throw new Error("Approval is already decided.");

  if (decision === "reject") {
    await supabase.from("ai_agent_approvals").update({
      status: "rejected",
      decided_by: userId,
      decided_at: new Date().toISOString()
    }).eq("id", approval.id).eq("business_id", businessId);

    await supabase.from("ai_agent_runs").update({
      status: "cancelled",
      finished_at: new Date().toISOString(),
      output: { rejected: true, approval_id: approval.id }
    }).eq("id", approval.agent_run_id).eq("business_id", businessId);

    await supabase.from("events").insert({
      business_id: businessId,
      event_type: "agent.approval_rejected",
      summary: "An agent action was rejected.",
      evidence: { approval_id: approval.id, agent_run_id: approval.agent_run_id },
      status: "dismissed",
      priority: "normal",
      category: "agent",
      action_type: "reject_agent_action"
    });

    return { status: "rejected" as const };
  }

  const payload = (approval.proposed_payload ?? {}) as {
    tool_key?: string;
    input?: Record<string, unknown>;
  };
  const toolKey = String(payload.tool_key ?? "");
  const definition = getToolDefinition(toolKey);

  if (!definition) throw new Error("The requested tool is no longer available.");

  const context: RuntimeContext = {
    supabase,
    businessId,
    userId
  };

  const output = await executeTool(toolKey, payload.input ?? {}, context);

  await supabase.from("ai_agent_approvals").update({
    status: "approved",
    decided_by: userId,
    decided_at: new Date().toISOString()
  }).eq("id", approval.id).eq("business_id", businessId);

  await supabase.from("ai_agent_run_steps").update({
    status: "succeeded",
    output,
    finished_at: new Date().toISOString()
  }).eq("agent_run_id", approval.agent_run_id).eq("approval_id", approval.id).eq("business_id", businessId);

  await supabase.from("ai_agent_runs").update({
    status: "succeeded",
    output: {
      approved: true,
      approval_id: approval.id,
      tool_key: toolKey,
      output
    },
    approval_required: true,
    finished_at: new Date().toISOString()
  }).eq("id", approval.agent_run_id).eq("business_id", businessId);

  await supabase.from("events").insert({
    business_id: businessId,
    event_type: "agent.approval_approved",
    summary: `Approved and executed ${definition.name}.`,
    evidence: {
      approval_id: approval.id,
      agent_run_id: approval.agent_run_id,
      tool_key: toolKey
    },
    status: "auto_handled",
    priority: "normal",
    category: "agent",
    action_type: "approve_agent_action"
  });

  return { status: "approved" as const, output };
}