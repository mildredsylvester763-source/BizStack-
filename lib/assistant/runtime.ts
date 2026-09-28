import { createClient } from "@/lib/supabase-server";
import { runBizStackModel, type BizStackModelMessage, type BizStackTool } from "@/lib/ai/providers/router";
import { executeTool, getToolDefinition, TOOL_REGISTRY, type RuntimeContext } from "@/lib/agents/tool-registry";

type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
};

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type ModelMessage = BizStackModelMessage;

type OperatorResult = {
  conversationId: string;
  runId?: string;
  status: "succeeded" | "waiting_approval" | "failed";
  message: string;
  approval?: { id: string; runId: string; action: string; reason: string };
  toolResults?: Array<{ tool: string; output: unknown }>;
};

function toProviderTools(): BizStackTool[] {
  return TOOL_REGISTRY.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.toolKey,
      description: tool.description,
      parameters: tool.inputSchema as Record<string, unknown>
    }
  }));
}

async function askModel(messages: ModelMessage[]) {
  return runBizStackModel(messages, toProviderTools());
}

async function getBusiness(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  requestedBusinessId?: string | null
) {
  let query = supabase
    .from("businesses")
    .select("id,name,industry,currency,workspace_id,organization_id")
    .eq("owner_id", userId);

  if (requestedBusinessId) {
    query = query.eq("id", requestedBusinessId);
  } else {
    query = query.order("created_at", { ascending: true }).limit(1);
  }

  const { data: business, error } = await query.maybeSingle();
  if (error || !business) throw new Error("Business context is not available.");
  return business;
}

async function getOrCreateAgent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string
) {
  const { data: existing } = await supabase
    .from("ai_agents")
    .select("id,name,status,autonomy_mode,permissions,system_config")
    .eq("business_id", businessId)
    .eq("slug", "bizstack-operator")
    .maybeSingle();

  if (existing) {
    const requiredPermissions = TOOL_REGISTRY.map((tool) => tool.permission);
    const permissions = Array.from(new Set([...(Array.isArray(existing.permissions) ? existing.permissions : []), ...requiredPermissions]));
    const currentConfig = existing.system_config && typeof existing.system_config === "object" ? existing.system_config : {};
    const currentMax = Number((currentConfig as any)?.max_tool_steps ?? 0);
    const system_config = currentMax >= 12 ? currentConfig : { ...currentConfig, max_tool_steps: 12 };
    const changed = permissions.length !== (Array.isArray(existing.permissions) ? existing.permissions.length : 0) || currentMax < 12;
    if (changed) {
      const { data: refreshed } = await supabase
        .from("ai_agents")
        .update({ permissions, system_config })
        .eq("id", existing.id)
        .select("id,name,status,autonomy_mode,permissions,system_config")
        .single();
      if (refreshed) return refreshed;
    }
    return { ...existing, permissions, system_config };
  }

  const { data: created, error } = await supabase
    .from("ai_agents")
    .insert({
      business_id: businessId,
      name: "BizStack Operator",
      slug: "bizstack-operator",
      role: "general_operations",
      description: "Universal autonomous business operator.",
      status: "active",
      autonomy_mode: "auto_execute",
      system_config: { approval_policy: { critical_always: true, high_default: true }, max_tool_steps: 12 },
      permissions: TOOL_REGISTRY.map((tool) => tool.permission),
      triggers: ["chat", "voice", "manual", "event"],
      memory_config: { enabled: true, retain_runtime_memory: true }
    })
    .select("id,name,status,autonomy_mode,permissions,system_config")
    .single();

  if (error || !created) throw new Error("Could not initialize the BizStack Operator.");
  return created;
}

async function getConversationMessages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationId: string
): Promise<ModelMessage[]> {
  const { data } = await supabase
    .from("ai_messages")
    .select("role,content,tool_name,tool_call_id,metadata")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(50);

  return (data ?? []).map((row) => ({
    role: row.role as ModelMessage["role"],
    content: row.content,
    tool_call_id: row.tool_call_id ?? undefined,
    name: row.tool_name ?? undefined,
    ...(Array.isArray(row.metadata?.tool_calls) ? { tool_calls: row.metadata.tool_calls } : {})
  }));
}

function systemPrompt(business: { name: string; industry?: string | null; currency?: string | null }, projectId?: string | null) {
  return [
    "You are BizStack Operator, the autonomous operating assistant inside a business operating system.",
    "Do not behave like a generic chatbot or force the user to navigate separate modules.",
    "Understand the user's goal, inspect the real business data, choose the tools required, execute safe work, and explain what you actually changed.",
    "Use multiple tools when a request spans multiple parts of the business.",
    "Never invent business records, balances, integrations, credentials, payments, customers, products, or completed actions.",
    "When something is missing, ask only for the specific missing information needed to continue.",
    "Low-risk operational work should be executed when the necessary information is available.",
    "Business operations are first-class work, separate from software building. When the user asks to operate invoices, customers, products, inventory, money records, communications, or other business modules, work directly against the real business data through governed tools. Do not turn a business operation into a website task.",
    "Respect the business automation policy. A configured auto_execute policy permits the matching medium-risk operational action to run without an extra per-action approval; draft_only and ask_first remain governed. Never treat a website connection as permission to expose private business data publicly.",

    "For sensitive external money movement, credential exposure, public publishing, destructive changes, or other high-risk actions, request approval rather than pretending the action was performed.",
    "For software-building requests, behave like an autonomous engineering loop, not a code generator. Prefer this sequence when applicable: inspect the project and source tree -> plan -> write the smallest safe change -> run project.runtime.verify -> inspect the actual failure evidence -> list the relevant repair run -> execute the governed repair when approval permits -> verify again -> snapshot the verified state -> deploy only when explicitly requested and permitted. Do not stop merely because source files were written. Do not claim code, files, previews, terminals, deployments, repairs, or tests exist unless a tool actually created or verified them.",
    "After modifying a software project, verification is required before declaring the coding task complete whenever the project can be executed. If verification fails, diagnose from the real output rather than guessing. Preserve the existing feature set during repairs and rely on the governed repair engine's rollback behavior.",

    "For website requests, treat the website as a living business surface connected to CRM, catalogue, booking, payment and communications where applicable.",
    "Voice transcripts may be imperfect. Interpret them naturally and verify critical numbers or identities before sensitive actions.",
    "Business name: " + business.name,
    "Industry: " + (business.industry || "not specified"),
    "Base currency: " + (business.currency || "not specified"),
    "Active software project: " + (projectId || "none") + ". If the user is asking about software, prefer this project unless they explicitly name another project."
  ].join("\n");
}

async function toolRequiresApproval(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  tool: ReturnType<typeof getToolDefinition>,
  agent: any
) {
  if (!tool) return true;
  if (tool.riskLevel === "critical") return true;
  if (tool.riskLevel === "high") return true;

  const policy = agent?.system_config?.approval_policy ?? {};
  const defaultRequiresApproval = Boolean(policy?.medium_requires_approval) && tool.riskLevel === "medium";
  if (tool.riskLevel !== "medium") return defaultRequiresApproval;

  const actionTypeByTool: Record<string, string> = {
    "invoices.create_draft": "create_invoice",
    "products.create": "create_product",
    "integrations.sync": "sync_integration",
    "project.runtime.run": "run_project_runtime",
    "project.runtime.verify": "run_project_runtime",
    "website.build": "build_website",
    "communications.inbox": "read_communications"
  };
  const actionType = actionTypeByTool[tool.toolKey];
  if (!actionType) return defaultRequiresApproval;

  const { data: automation } = await supabase
    .from("automation_settings")
    .select("mode,limit_value")
    .eq("business_id", businessId)
    .eq("action_type", actionType)
    .maybeSingle();

  if (automation?.mode === "auto_execute") return false;
  if (automation?.mode === "draft_only") return true;
  return defaultRequiresApproval;
}

async function saveMessage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationId: string,
  businessId: string,
  message: { role: "user" | "assistant" | "tool"; content: string; toolName?: string; toolCallId?: string; metadata?: Record<string, unknown> },
  clientMessageId?: string
) {
  const { error } = await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    business_id: businessId,
    sender_user_id: message.role === "user" ? undefined : null,
    role: message.role,
    content: message.content,
    tool_name: message.toolName ?? null,
    tool_call_id: message.toolCallId ?? null,
    metadata: message.metadata ?? {},
    client_message_id: clientMessageId ?? null
  });
  if (error && !String(error.message).includes("duplicate")) throw error;
}

async function createRun(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  agentId: string,
  conversationId: string,
  input: string,
  userId: string,
  projectId?: string | null
) {
  const { data, error } = await supabase
    .from("ai_agent_runs")
    .insert({
      business_id: businessId,
      agent_id: agentId,
      conversation_id: conversationId,
      trigger_type: "chat",
      status: "running",
      input: { text: input, user_id: userId, project_id: projectId || null },
      plan: [],
      tool_calls: []
    })
    .select("id")
    .single();

  if (error || !data) throw new Error("Could not create the operator run.");
  return data.id as string;
}

async function executeOperatorTurn(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  businessId: string;
  userId: string;
  conversationId: string;
  agent: any;
  runId: string;
  messages: ModelMessage[];
  projectId?: string | null;
}) : Promise<OperatorResult> {
  const { supabase, businessId, userId, conversationId, agent, runId, projectId = null } = args;
  let messages = args.messages;
  const results: Array<{ tool: string; output: unknown }> = [];
  const maxSteps = Math.min(Number(agent?.system_config?.max_tool_steps ?? 8), 12);

  for (let iteration = 0; iteration < maxSteps; iteration += 1) {
    const modelResult = await askModel(messages);
    const message = modelResult.message;
    if (!message) throw new Error("The AI provider returned no assistant message.");

    if (message.content || message.tool_calls?.length) {
      await saveMessage(supabase, conversationId, businessId, {
        role: "assistant",
        content: String(message.content ?? ""),
        metadata: {
          tool_calls: message.tool_calls ?? [],
          ai_provider: modelResult.provider,
          ai_model: modelResult.model,
          task: modelResult.task ?? null,
          attempted_providers: modelResult.attemptedProviders ?? [modelResult.provider]
        }
      });
    }

    if (!message.tool_calls?.length) {
      const finalText = String(message.content ?? "").trim() || "I completed the requested work.";
      await supabase.from("ai_agent_runs").update({
        status: "succeeded",
        output: { message: finalText, tool_results: results },
        tool_calls: results.map((item) => ({ tool_key: item.tool, status: "succeeded" })),
        finished_at: new Date().toISOString()
      }).eq("id", runId).eq("business_id", businessId);

      await supabase.from("ai_conversations").update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq("id", conversationId).eq("business_id", businessId);

      return { conversationId, runId, status: "succeeded", message: finalText, toolResults: results };
    }

    const pendingToolMessages: ModelMessage[] = [];

    for (const toolCall of message.tool_calls) {
      const toolName = toolCall.function?.name;
      const definition = getToolDefinition(toolName);
      if (!definition) throw new Error("The assistant requested an unknown tool: " + toolName);

      if (await toolRequiresApproval(supabase, businessId, definition, agent)) {
        const parsed = (() => {
          try { return JSON.parse(toolCall.function.arguments || "{}"); } catch { return {}; }
        })();

        const { data: approval, error } = await supabase.from("ai_agent_approvals").insert({
          business_id: businessId,
          agent_run_id: runId,
          requested_action: definition.name,
          risk_level: definition.riskLevel,
          reason: `BizStack needs approval before it performs: ${definition.name}.`,
          proposed_payload: { tool_key: toolName, input: parsed, conversation_id: conversationId }
        }).select("id,requested_action,reason").single();

        if (error || !approval) throw new Error("Could not create the approval request.");

        await supabase.from("ai_agent_runs").update({
          status: "waiting_approval",
          approval_required: true,
          plan: { pending_tool: { id: toolCall.id, tool_key: toolName, input: parsed } },
          output: { waiting_for_approval: true, approval_id: approval.id }
        }).eq("id", runId).eq("business_id", businessId);

        return {
          conversationId,
          runId,
          status: "waiting_approval",
          message: `I’ve prepared the next action. It needs your approval before I execute it: ${definition.name}.`,
          approval: { id: approval.id, runId, action: approval.requested_action, reason: approval.reason },
          toolResults: results
        };
      }

      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(toolCall.function.arguments || "{}");
      } catch {
        throw new Error(`I could not parse the arguments for ${definition.name}.`);
      }

      const { data: step } = await supabase.from("ai_agent_run_steps").insert({
        business_id: businessId,
        agent_run_id: runId,
        sequence_no: iteration + 1,
        step_type: "tool_call",
        tool_key: toolName,
        status: "running",
        input: parsedArgs,
        requires_approval: false,
        started_at: new Date().toISOString()
      }).select("id").single();

      const toolContext: RuntimeContext = { supabase, businessId, userId, projectId };
      try {
        const output = await executeTool(toolName, parsedArgs, toolContext);
        results.push({ tool: toolName, output });

        if (step?.id) {
          await supabase.from("ai_agent_run_steps").update({
            status: "succeeded",
            output,
            finished_at: new Date().toISOString()
          }).eq("id", step.id).eq("business_id", businessId);
        }

        const serializedOutput = JSON.stringify(output);
        await saveMessage(supabase, conversationId, businessId, {
          role: "tool",
          content: serializedOutput,
          toolName,
          toolCallId: toolCall.id
        });

        pendingToolMessages.push({
          role: "tool",
          content: serializedOutput,
          tool_call_id: toolCall.id,
          name: toolName
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Tool execution failed.";
        if (step?.id) {
          await supabase.from("ai_agent_run_steps").update({
            status: "failed",
            error_message: errorMessage,
            finished_at: new Date().toISOString()
          }).eq("id", step.id).eq("business_id", businessId);
        }
        throw error;
      }
    }

    // Provider tool-call protocols require the assistant tool-call message to be
    // followed by all corresponding tool results, in the same turn.
    messages = [
      ...messages,
      {
        role: "assistant",
        content: String(message.content ?? ""),
        tool_calls: message.tool_calls
      },
      ...pendingToolMessages
    ];
  }

  throw new Error("The operator reached its execution step limit before completing the task.");
}

export async function runUniversalAssistant({
  userId,
  businessId,
  conversationId,
  input,
  clientMessageId,
  projectId
}: {
  userId: string;
  businessId?: string | null;
  conversationId?: string | null;
  input: string;
  clientMessageId?: string | null;
  projectId?: string | null;
}) : Promise<OperatorResult> {
  const supabase = await createClient();
  const business = await getBusiness(supabase, userId, businessId);
  const agent = await getOrCreateAgent(supabase, business.id);

  let conversationIdValue = conversationId || null;
  if (conversationIdValue) {
    const { data: existing } = await supabase.from("ai_conversations")
      .select("id")
      .eq("id", conversationIdValue)
      .eq("business_id", business.id)
      .single();
    if (!existing) conversationIdValue = null;
  }

  if (!conversationIdValue) {
    const { data: conversation, error } = await supabase.from("ai_conversations").insert({
      business_id: business.id,
      created_by: userId,
      agent_id: agent.id,
      title: input.trim().slice(0, 80) || "New conversation",
      last_message_at: new Date().toISOString()
    }).select("id").single();
    if (error || !conversation) throw new Error("Could not create the assistant conversation.");
    conversationIdValue = conversation.id;
  }

  if (!conversationIdValue) throw new Error("Assistant conversation could not be established.");

  await saveMessage(supabase, conversationIdValue, business.id, {
    role: "user",
    content: input.trim()
  }, clientMessageId ?? undefined);

  const history = await getConversationMessages(supabase, conversationIdValue);
  const messages: ModelMessage[] = [
    { role: "system", content: systemPrompt(business, projectId) },
    ...history
  ];

  const runId = await createRun(supabase, business.id, agent.id, conversationIdValue, input, userId, projectId);

  try {
    return await executeOperatorTurn({
      supabase,
      businessId: business.id,
      userId,
      conversationId: conversationIdValue,
      agent,
      runId,
      messages,
      projectId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assistant run failed.";
    await supabase.from("ai_agent_runs").update({
      status: "failed",
      error_message: message,
      finished_at: new Date().toISOString()
    }).eq("id", runId).eq("business_id", business.id);
    throw new Error(message);
  }
}

export async function approveOperatorRun({
  userId,
  runId
}: {
  userId: string;
  runId: string;
}) : Promise<OperatorResult> {
  const supabase = await createClient();
  const business = await getBusiness(supabase, userId);

  const { data: run, error: runError } = await supabase
    .from("ai_agent_runs")
    .select("id,agent_id,conversation_id,status,plan,input")
    .eq("id", runId)
    .eq("business_id", business.id)
    .single();

  if (runError || !run || run.status !== "waiting_approval" || !run.conversation_id) {
    throw new Error("Approval request is no longer available.");
  }

  const { data: approval, error: approvalError } = await supabase
    .from("ai_agent_approvals")
    .select("id,status,proposed_payload")
    .eq("agent_run_id", run.id)
    .eq("business_id", business.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (approvalError || !approval) throw new Error("Approval request is no longer pending.");

  const pending = run.plan?.pending_tool;
  const toolName = String(pending?.tool_key ?? approval.proposed_payload?.tool_key ?? "");
  const toolCallId = String(pending?.id ?? "approved_" + approval.id);
  const input = (pending?.input ?? approval.proposed_payload?.input ?? {}) as Record<string, unknown>;
  const projectId = typeof run.input?.project_id === "string" ? run.input.project_id : null;
  const definition = getToolDefinition(toolName);
  if (!definition) throw new Error("Approved tool no longer exists.");

  await supabase.from("ai_agent_approvals").update({
    status: "approved",
    decided_by: userId,
    decided_at: new Date().toISOString()
  }).eq("id", approval.id).eq("business_id", business.id);

  const output = await executeTool(toolName, input, {
    supabase,
    businessId: business.id,
    userId,
    projectId
  });

  await saveMessage(supabase, run.conversation_id, business.id, {
    role: "tool",
    content: JSON.stringify(output),
    toolName,
    toolCallId
  });

  const history = await getConversationMessages(supabase, run.conversation_id);
  const agent = await getOrCreateAgent(supabase, business.id);
  await supabase.from("ai_agent_runs").update({ status: "running", approval_required: false }).eq("id", run.id).eq("business_id", business.id);

  return await executeOperatorTurn({
    supabase,
    businessId: business.id,
    userId,
    conversationId: run.conversation_id,
    agent,
    runId: run.id,
    messages: [
      { role: "system", content: systemPrompt(business, projectId) },
      ...history
    ]
  });
}
