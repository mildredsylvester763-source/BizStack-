import { createClient } from "@/lib/supabase-server";
import { buildPlan, executeTool, getToolDefinition, type RuntimeContext } from "@/lib/agents/tool-registry";

type AutonomyMode = "draft_only" | "ask_first" | "auto_execute";

function normalizeMode(value: unknown): AutonomyMode {
  if (value === "auto_execute" || value === "draft_only") return value;
  return "ask_first";
}

function permissionAllows(agent: { permissions?: unknown }, permission: string) {
  const permissions = Array.isArray(agent.permissions) ? agent.permissions.map(String) : [];
  return permissions.includes(permission);
}

async function persistMemory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  agentId: string,
  key: string,
  content: string
) {
  const { data: existing } = await supabase
    .from("ai_agent_memory")
    .select("id")
    .eq("business_id", businessId)
    .eq("agent_id", agentId)
    .eq("memory_key", key)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("ai_agent_memory")
      .update({
        memory_type: "runtime",
        content,
        updated_at: new Date().toISOString()
      })
      .eq("id", existing.id)
      .eq("business_id", businessId);
    return;
  }

  await supabase.from("ai_agent_memory").insert({
    business_id: businessId,
    agent_id: agentId,
    memory_type: "runtime",
    memory_key: key,
    content
  });
}

export async function runAgent({
  agentId,
  businessId,
  userId,
  input
}: {
  agentId: string;
  businessId: string;
  userId: string;
  input: string;
}) {
  const supabase = await createClient();
  const { data: agent, error: agentError } = await supabase
    .from("ai_agents")
    .select("id,name,status,autonomy_mode,permissions,tools")
    .eq("id", agentId)
    .eq("business_id", businessId)
    .single();

  if (agentError || !agent) throw new Error("Agent not found.");
  if (agent.status !== "active") throw new Error("Agent is not active.");

  const { data: run, error: runError } = await supabase
    .from("ai_agent_runs")
    .insert({
      business_id: businessId,
      agent_id: agent.id,
      trigger_type: "manual",
      status: "running",
      input: { text: input },
      plan: {}
    })
    .select("id")
    .single();

  if (runError || !run) throw new Error("Could not create agent run.");

  const plan = buildPlan(input);
  const mode = normalizeMode(agent.autonomy_mode);
  const toolCalls: Record<string, unknown>[] = [];
  const outputs: Record<string, unknown>[] = [];
  let sequence = 1;
  let waitingApprovalId: string | null = null;

  const { data: bindingRows } = await supabase
    .from("ai_agent_tool_bindings")
    .select("tool_id,enabled")
    .eq("business_id", businessId)
    .eq("agent_id", agent.id)
    .eq("enabled", true);

  let boundToolKeys = new Set<string>();
  if (bindingRows?.length) {
    const toolIds = bindingRows.map((row) => row.tool_id);
    const { data: boundTools } = await supabase
      .from("ai_tools")
      .select("id,tool_key")
      .in("id", toolIds);
    boundToolKeys = new Set((boundTools ?? []).map((tool) => String(tool.tool_key)));
  }

  const planStep = await supabase.from("ai_agent_run_steps").insert({
    business_id: businessId,
    agent_run_id: run.id,
    sequence_no: sequence++,
    step_type: "plan",
    status: "succeeded",
    input: { text: input },
    output: { tool_count: plan.length, mode }
  });
  if (planStep.error) {
    await supabase.from("ai_agent_runs").update({
      status: "failed",
      error_message: planStep.error.message,
      finished_at: new Date().toISOString()
    }).eq("id", run.id).eq("business_id", businessId);
    throw new Error("Could not persist the agent plan.");
  }

  const context: RuntimeContext = { supabase, businessId, userId };

  try {
    for (const step of plan) {
      const definition = getToolDefinition(step.toolKey);
      if (!definition) continue;

      if (bindingRows?.length && !boundToolKeys.has(step.toolKey)) {
        await supabase.from("ai_agent_run_steps").insert({
          business_id: businessId,
          agent_run_id: run.id,
          sequence_no: sequence++,
          step_type: "tool_call",
          tool_key: step.toolKey,
          status: "skipped",
          input: step.input,
          output: {},
          error_message: "Agent tool is not enabled in the agent binding policy.",
          finished_at: new Date().toISOString()
        });
        continue;
      }

      if (!permissionAllows(agent, definition.permission)) {
        await supabase.from("ai_agent_run_steps").insert({
          business_id: businessId,
          agent_run_id: run.id,
          sequence_no: sequence++,
          step_type: "tool_call",
          tool_key: step.toolKey,
          status: "skipped",
          input: step.input,
          output: {},
          error_message: "Agent permission does not include this tool.",
          finished_at: new Date().toISOString()
        });
        continue;
      }

      if (definition.riskLevel !== "low" && mode !== "auto_execute") {
        const { data: approval, error: approvalError } = await supabase
          .from("ai_agent_approvals")
          .insert({
            business_id: businessId,
            agent_run_id: run.id,
            requested_action: definition.name,
            risk_level: definition.riskLevel,
            reason: `Agent ${agent.name} requested a restricted action.`,
            proposed_payload: { tool_key: step.toolKey, input: step.input }
          })
          .select("id")
          .single();

        if (approvalError || !approval) throw new Error("Could not create approval request.");

        const approvalStep = await supabase.from("ai_agent_run_steps").insert({
          business_id: businessId,
          agent_run_id: run.id,
          sequence_no: sequence++,
          step_type: "approval",
          tool_key: step.toolKey,
          status: "waiting_approval",
          input: step.input,
          output: { requested_action: definition.name },
          requires_approval: true,
          approval_id: approval.id
        });

        if (approvalStep.error) throw new Error("Could not persist the approval step.");

        waitingApprovalId = approval.id;
        break;
      }

      if (definition.toolKey === "events.create" && mode === "draft_only") {
        const draft = {
          type: "draft",
          tool_key: definition.toolKey,
          payload: step.input,
          message: "Draft created; no business event was written because the agent is in draft-only mode."
        };
        outputs.push(draft);
        await supabase.from("ai_agent_run_steps").insert({
          business_id: businessId,
          agent_run_id: run.id,
          sequence_no: sequence++,
          step_type: "tool_call",
          tool_key: step.toolKey,
          status: "skipped",
          input: step.input,
          output: draft,
          finished_at: new Date().toISOString()
        });
        continue;
      }

      const { data: inserted, error: stepInsertError } = await supabase
        .from("ai_agent_run_steps")
        .insert({
          business_id: businessId,
          agent_run_id: run.id,
          sequence_no: sequence++,
          step_type: "tool_call",
          tool_key: step.toolKey,
          status: "running",
          input: step.input,
          started_at: new Date().toISOString()
        })
        .select("id")
        .single();

      if (stepInsertError || !inserted) {
        throw new Error("Could not persist the agent tool step.");
      }

      try {
        const output = await executeTool(step.toolKey, step.input, context);
        outputs.push({ tool_key: step.toolKey, output });
        toolCalls.push({ tool_key: step.toolKey, input: step.input, status: "succeeded" });

        await supabase
          .from("ai_agent_run_steps")
          .update({
            status: "succeeded",
            output,
            finished_at: new Date().toISOString()
          })
          .eq("id", inserted.id)
          .eq("business_id", businessId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Tool execution failed.";
        toolCalls.push({ tool_key: step.toolKey, input: step.input, status: "failed", error: message });

        await supabase
          .from("ai_agent_run_steps")
          .update({
            status: "failed",
            error_message: message,
            finished_at: new Date().toISOString()
          })
          .eq("id", inserted.id)
          .eq("business_id", businessId);

        throw new Error(message);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent execution failed.";
    await supabase
      .from("ai_agent_runs")
      .update({
        status: "failed",
        plan: { steps: plan, mode },
        tool_calls: toolCalls,
        output: { error: message, outputs },
        finished_at: new Date().toISOString()
      })
      .eq("id", run.id)
      .eq("business_id", businessId);
    throw new Error(message);
  }

  if (waitingApprovalId) {
    const update = await supabase
      .from("ai_agent_runs")
      .update({
        status: "waiting_approval",
        plan: { steps: plan, mode },
        tool_calls: toolCalls,
        output: { waiting_for_approval: true, approval_id: waitingApprovalId, outputs },
        approval_required: true
      })
      .eq("id", run.id)
      .eq("business_id", businessId);

    if (update.error) throw new Error("Could not persist the waiting-approval state.");

    await supabase.from("events").insert({
      business_id: businessId,
      event_type: "agent.approval_requested",
      summary: `${agent.name} is waiting for approval before a restricted action can run.`,
      evidence: { agent_id: agent.id, run_id: run.id, approval_id: waitingApprovalId },
      status: "needs_approval",
      priority: "high",
      category: "agent",
      action_type: "approve_agent_action"
    });

    await persistMemory(
      supabase,
      businessId,
      agent.id,
      "last_run_status",
      JSON.stringify({ status: "waiting_approval", run_id: run.id, approval_id: waitingApprovalId })
    );

    return { runId: run.id, status: "waiting_approval", approvalId: waitingApprovalId, outputs };
  }

  const finalOutput = {
    agent: agent.name,
    mode,
    summary: `Completed ${plan.length} planned step${plan.length === 1 ? "" : "s"} with ${outputs.length} tool result${outputs.length === 1 ? "" : "s"}.`,
    outputs
  };

  const finalUpdate = await supabase
    .from("ai_agent_runs")
    .update({
      status: "succeeded",
      plan: { steps: plan, mode },
      tool_calls: toolCalls,
      output: finalOutput,
      approval_required: false,
      finished_at: new Date().toISOString()
    })
    .eq("id", run.id)
    .eq("business_id", businessId);

  if (finalUpdate.error) throw new Error("Could not finalize the agent run.");

  await persistMemory(
    supabase,
    businessId,
    agent.id,
    "last_run_status",
    JSON.stringify({ status: "succeeded", run_id: run.id, summary: finalOutput.summary })
  );
  await persistMemory(
    supabase,
    businessId,
    agent.id,
    "last_request",
    input.slice(0, 1000)
  );

  return { runId: run.id, status: "succeeded", output: finalOutput };
}
