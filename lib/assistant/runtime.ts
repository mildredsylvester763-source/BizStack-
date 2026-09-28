import { createClient } from "@/lib/supabase-server";
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

type ModelMessage = Message & {
  tool_calls?: ToolCall[];
};

type OperatorResult = {
  conversationId: string;
  runId?: string;
  status: "succeeded" | "waiting_approval" | "failed";
  message: string;
  approval?: { id: string; runId: string; action: string; reason: string };
  toolResults?: Array<{ tool: string; output: unknown }>;
};

function providerConfigured() {
  return Boolean(process.env.BIZSTACK_AI_API_URL && process.env.BIZSTACK_AI_API_KEY);
}

function normalizeResponse(body: any): { message?: ModelMessage } {
  const raw = body?.choices?.[0]?.message ?? body?.output?.[0]?.content ?? body?.message ?? body;
  if (!raw || typeof raw !== "object") return {};
  if (Array.isArray(raw.content)) {
    const text = raw.content
      .filter((part: any) => typeof part?.text === "string")
      .map((part: any) => part.text)
      .join("");
    return { message: { ...raw, content: text } };
  }
  return { message: raw as ModelMessage };
}

async function askModel(messages: ModelMessage[]) {
  if (!providerConfigured()) {
    throw new Error(
      "The BizStack AI engine is not connected to a model provider yet. Configure BIZSTACK_AI_API_URL and BIZSTACK_AI_API_KEY on the server."
    );
  }

  const tools = TOOL_REGISTRY.map((tool) => ({
    type: "function",
    function: {
      name: tool.toolKey,
      description: tool.description,
      parameters: tool.inputSchema
    }
  }));

  const response = await fetch(process.env.BIZSTACK_AI_API_URL as string, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + process.env.BIZSTACK_AI_API_KEY
    },
    body: JSON.stringify({
      model: process.env.BIZSTACK_AI_MODEL || "default",
      temperature: 0.15,
      messages,
      tools,
      tool_choice: "auto"
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error("AI provider returned HTTP " + response.status + ": " + error.slice(0, 500));
  }

  return normalizeResponse(await response.json());
}

async function getBusiness(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id,name,industry,currency,workspace_id,organization_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !business) throw new Error("Business context is not available.");
  return business;
}

async function getOrCreateAgent(
  supabase: ReturnType<typeof createClient>,
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
    const changed = permissions.length !== (Array.isArray(existing.permissions) ? existing.permissions.length : 0);
    if (changed) {
      const { data: refreshed } = await supabase
        .from("ai_agents")
        .update({ permissions })
        .eq("id", existing.id)
        .select("id,name,status,autonomy_mode,permissions,system_config")
        .single();
      if (refreshed) return refreshed;
    }
    return { ...existing, permissions };
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
      system_config: { approval_policy: { critical_always: true, high_default: true }, max_tool_steps: 8 },
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
  supabase: ReturnType<typeof createClient>,
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

function systemPrompt(business: { name: string; industry?: string | null; currency?: string | null }) {
  return [
    "You are BizStack Operator, the autonomous operating assistant inside a business operating system.",
    "Do not behave like a generic chatbot or force the user to navigate separate modules.",
    "Understand the user's goal, inspect the real business data, choose the tools required, execute safe work, and explain what you actually changed.",
    "Use multiple tools when a request spans multiple parts of the business.",
    "Never invent business records, balances, integrations, credentials, payments, customers, products, or completed actions.",
    "When something is missing, ask only for the specific missing information needed to continue.",
    "Low-risk operational work should be executed when the necessary information is available.",
    "For sensitive external money movement, credential exposure, public publishing, destructive changes, or other high-risk actions, request approval rather than pretending the action was performed.",
    "For software-building requests, use the persistent project tools to inspect existing projects, create real editable projects, create or modify real source files, run verified commands in the isolated project runtime, and snapshot versions. Do not claim code, files, previews, terminals, deployments, or tests exist unless a tool actually created or verified them. Prefer inspect -> change -> run -> inspect failure -> change again when the request requires working code.",
    "For website requests, treat the website as a living business surface connected to CRM, catalogue, booking, payment and communications where applicable.",
    "Voice transcripts may be imperfect. Interpret them naturally and verify critical numbers or identities before sensitive actions.",
    "Business name: " + business.name,
    "Industry: " + (business.industry || "not specified"),
    "Base currency: " + (business.currency || "not specified")
  ].join("
");
}

function toolRequiresApproval(tool: ReturnType<typeof getToolDefinition>, agent: any) {
  if (!tool) return true;
  if (tool.riskLevel === "critical") return true;
  if (tool.riskLevel === "high") return true;
  const policy = agent?.system_config?.approval_policy ?? {};
  return Boolean(policy?.medium_requires_approval) && tool.riskLevel === "medium";
}

async function saveMessage(
  supabase: ReturnType<typeof createClient>,
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
  supabase: ReturnType<typeof createClient>,
  businessId: string,
  agentId: string,
  conversationId: string,
  input: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("ai_agent_runs")
    .insert({
      business_id: businessId,
      agent_id: agentId,
      conversation_id: conversationId,
      trigger_type: "chat",
      status: "running",
      input: { text: input, user_id: userId },
      plan: [],
      tool_calls: []
    })
    .select("id")
    .single();

  if (error || !data) throw new Error("Could not create the operator run.");
  return data.id as string;
}

async function executeOperatorTurn(args: {
  supabase: ReturnType<typeof createClient>;
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
    const { message } = await askModel(messages);
    if (!message) throw new Error("The AI provider returned no assistant message.");

    if (message.content || message.tool_calls?.length) {
      await saveMessage(supabase, conversationId, businessId, {
        role: "assistant",
        content: String(message.content ?? ""),
        metadata: { tool_calls: message.tool_calls ?? [] }
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

    for (const toolCall of message.tool_calls) {
      const toolName = toolCall.function?.name;
      const definition = getToolDefinition(toolName);
      if (!definition) throw new Error("The assistant requested an unknown tool: " + toolName);

      if (toolRequiresApproval(definition, agent)) {
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

        await saveMessage(supabase, conversationId, businessId, {
          role: "tool",
          content: JSON.stringify(output),
          toolName,
          toolCallId: toolCall.id
        });

        messages = [
          ...messages,
          {
            role: "assistant",
            content: String(message.content ?? ""),
            tool_calls: message.tool_calls
          },
          {
            role: "tool",
            content: JSON.stringify(output),
            tool_call_id: toolCall.id,
            name: toolName
          }
        ];
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
  }

  throw new Error("The operator reached its execution step limit before completing the task.");
}

export async function runUniversalAssistant({
  userId,
  conversationId,
  input,
  clientMessageId,
  projectId
}: {
  userId: string;
  conversationId?: string | null;
  input: string;
  clientMessageId?: string | null;
  projectId?: string | null;
}) : Promise<OperatorResult> {
  const supabase = createClient();
  const business = await getBusiness(supabase, userId);
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
    { role: "system", content: systemPrompt(business) },
    ...history
  ];

  const runId = await createRun(supabase, business.id, agent.id, conversationIdValue, input, userId);

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
  const supabase = createClient();
  const business = await getBusiness(supabase, userId);

  const { data: run, error: runError } = await supabase
    .from("ai_agent_runs")
    .select("id,agent_id,conversation_id,status,plan")
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
    userId
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
      { role: "system", content: systemPrompt(business) },
      ...history
    ]
  });
}
