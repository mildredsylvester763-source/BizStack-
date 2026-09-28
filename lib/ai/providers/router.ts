import type { ToolCall } from "@/lib/ai/providers/types";

export type ProviderName = "anthropic" | "openai" | "gemini" | "mistral";

export type BizStackModelMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: ToolCall[];
};

export type BizStackTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ProviderResponse = {
  message?: BizStackModelMessage;
  provider: ProviderName;
  model: string;
};

type ProviderConfig = {
  name: ProviderName;
  apiKey: string;
  model: string;
  baseUrl: string;
  priority: number;
};

function env(name: string) {
  return process.env[name]?.trim() || "";
}

function configuredProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];

  const anthropicKey = env("BIZSTACK_ANTHROPIC_API_KEY");
  if (anthropicKey) {
    providers.push({
      name: "anthropic",
      apiKey: anthropicKey,
      model: env("BIZSTACK_ANTHROPIC_MODEL") || "claude-sonnet-4-6",
      baseUrl: env("BIZSTACK_ANTHROPIC_API_URL") || "https://api.anthropic.com/v1/messages",
      priority: Number(env("BIZSTACK_ANTHROPIC_PRIORITY") || 10)
    });
  }

  const openaiKey = env("BIZSTACK_OPENAI_API_KEY");
  if (openaiKey) {
    providers.push({
      name: "openai",
      apiKey: openaiKey,
      model: env("BIZSTACK_OPENAI_MODEL") || "gpt-5",
      baseUrl: env("BIZSTACK_OPENAI_API_URL") || "https://api.openai.com/v1/chat/completions",
      priority: Number(env("BIZSTACK_OPENAI_PRIORITY") || 20)
    });
  }

  const geminiKey = env("BIZSTACK_GEMINI_API_KEY");
  if (geminiKey) {
    providers.push({
      name: "gemini",
      apiKey: geminiKey,
      model: env("BIZSTACK_GEMINI_MODEL") || "gemini-2.5-flash",
      baseUrl: env("BIZSTACK_GEMINI_API_URL") || "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      priority: Number(env("BIZSTACK_GEMINI_PRIORITY") || 30)
    });
  }

  const mistralKey = env("BIZSTACK_MISTRAL_API_KEY");
  if (mistralKey) {
    providers.push({
      name: "mistral",
      apiKey: mistralKey,
      model: env("BIZSTACK_MISTRAL_MODEL") || "mistral-large-latest",
      baseUrl: env("BIZSTACK_MISTRAL_API_URL") || "https://api.mistral.ai/v1/chat/completions",
      priority: Number(env("BIZSTACK_MISTRAL_PRIORITY") || 40)
    });
  }

  return providers.sort((a, b) => a.priority - b.priority);
}

function latestUserText(messages: BizStackModelMessage[]) {
  return messages.filter((m) => m.role === "user").at(-1)?.content.toLowerCase() || "";
}

function classifyTask(messages: BizStackModelMessage[]) {
  const text = latestUserText(messages);
  const coding = /(build|code|coding|developer|debug|bug|fix|refactor|typescript|javascript|react|next\.js|api|database|sql|github|deploy|website|app|application|terminal|test|compile|error)/i.test(text);
  const visual = /(image|photo|screenshot|design|visual|ui|ux|diagram|look at|picture)/i.test(text);
  const longContext = text.length > 7000 || messages.reduce((n, m) => n + m.content.length, 0) > 30000;
  const fast = /(classify|extract|tag|categorize|simple|quick|summarize briefly|short answer)/i.test(text);
  return { coding, visual, longContext, fast };
}

function chooseProvider(messages: BizStackModelMessage[], providers: ProviderConfig[]) {
  if (!providers.length) throw new Error("No BizStack AI provider is configured on the server.");

  const requested = env("BIZSTACK_AI_PROVIDER").toLowerCase();
  if (requested && requested !== "auto") {
    const explicit = providers.find((p) => p.name === requested);
    if (explicit) return explicit;
  }

  const task = classifyTask(messages);
  const collaboration = (env("BIZSTACK_AI_COLLABORATION") || "auto").toLowerCase();
  const hasToolEvidence = messages.some((m) => m.role === "tool");

  // BizStack can deliberately use a second provider after real tool/runtime evidence
  // exists. This makes the providers collaborators rather than isolated fallbacks.
  if (collaboration !== "single" && hasToolEvidence && providers.length > 1) {
    const requestedReviewer = env("BIZSTACK_AI_REVIEW_PROVIDER").toLowerCase();
    if (requestedReviewer) {
      const reviewer = providers.find((p) => p.name === requestedReviewer);
      if (reviewer) return reviewer;
    }

    const primary = choosePrimaryProvider(task, providers);
    const alternatives = providers.filter((p) => p.name !== primary.name);
    if (alternatives.length) {
      return alternatives.sort((a, b) => reviewScore(b, task) - reviewScore(a, task) || a.priority - b.priority)[0];
    }
  }

  return choosePrimaryProvider(task, providers);
}

function choosePrimaryProvider(
  task: ReturnType<typeof classifyTask>,
  providers: ProviderConfig[]
) {
  return providers
    .slice()
    .sort((a, b) => suitabilityScore(b, task) - suitabilityScore(a, task) || a.priority - b.priority)[0];
}

function suitabilityScore(provider: ProviderConfig, task: ReturnType<typeof classifyTask>) {
  let score = 100 - provider.priority;

  if (task.coding) {
    if (provider.name === "openai") score += /codex|gpt/i.test(provider.model) ? 55 : 35;
    if (provider.name === "anthropic") score += 50;
    if (provider.name === "gemini") score += 20;
    if (provider.name === "mistral") score += 15;
  }
  if (task.visual) {
    if (provider.name === "gemini") score += 55;
    if (provider.name === "anthropic") score += 35;
    if (provider.name === "openai") score += 30;
  }
  if (task.longContext) {
    if (provider.name === "gemini") score += 45;
    if (provider.name === "anthropic") score += 40;
    if (provider.name === "openai") score += 30;
  }
  if (task.fast && provider.name === "mistral") score += 45;

  return score;
}

function reviewScore(provider: ProviderConfig, task: ReturnType<typeof classifyTask>) {
  let score = 100 - provider.priority;
  if (task.coding && provider.name === "anthropic") score += 50;
  if (task.coding && provider.name === "openai") score += 45;
  if (task.visual && provider.name === "gemini") score += 50;
  if (task.longContext && provider.name === "gemini") score += 45;
  if (task.fast && provider.name === "mistral") score += 30;
  return score;
}

function openAiMessages(messages: BizStackModelMessage[]) {
  return messages.map((message) => {
    if (message.role !== "tool") return message;
    return {
      role: "tool",
      content: message.content,
      tool_call_id: message.tool_call_id || ""
    };
  });
}

function openAiTools(tools: BizStackTool[]) {
  return tools;
}

function normalizeOpenAi(body: any): BizStackModelMessage | undefined {
  const message = body?.choices?.[0]?.message;
  if (!message) return undefined;
  return {
    role: "assistant",
    content: typeof message.content === "string" ? message.content : "",
    tool_calls: Array.isArray(message.tool_calls)
      ? message.tool_calls.map((call: any) => ({
          id: String(call.id),
          type: "function",
          function: {
            name: String(call.function?.name || ""),
            arguments: String(call.function?.arguments || "{}")
          }
        }))
      : undefined
  };
}

function anthropicMessages(messages: BizStackModelMessage[]) {
  const system = messages.find((m) => m.role === "system")?.content || "";
  const rest = messages.filter((m) => m.role !== "system");
  const converted = rest.map((m) => {
    if (m.role === "assistant" && m.tool_calls?.length) {
      return {
        role: "assistant",
        content: [
          ...(m.content ? [{ type: "text", text: m.content }] : []),
          ...m.tool_calls.map((call) => ({
            type: "tool_use",
            id: call.id,
            name: call.function.name,
            input: (() => {
              try { return JSON.parse(call.function.arguments || "{}"); } catch { return {}; }
            })()
          }))
        ]
      };
    }
    if (m.role === "tool") {
      return {
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: m.tool_call_id || "",
          content: m.content
        }]
      };
    }
    return {
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content
    };
  });
  return { system, messages: converted };
}

async function callAnthropic(config: ProviderConfig, messages: BizStackModelMessage[], tools: BizStackTool[]) {
  const converted = anthropicMessages(messages);
  const response = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: Number(env("BIZSTACK_AI_MAX_TOKENS") || 8192),
      system: converted.system,
      messages: converted.messages,
      tools: tools.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters
      }))
    }),
    cache: "no-store"
  });
  if (!response.ok) throw new Error("Anthropic returned HTTP " + response.status + ": " + (await response.text()).slice(0, 600));
  const body = await response.json();
  const blocks = Array.isArray(body?.content) ? body.content : [];
  const text = blocks.filter((x: any) => x?.type === "text").map((x: any) => x.text).join("");
  const calls = blocks.filter((x: any) => x?.type === "tool_use").map((x: any) => ({
    id: String(x.id),
    type: "function" as const,
    function: { name: String(x.name), arguments: JSON.stringify(x.input ?? {}) }
  }));
  return {
    message: {
      role: "assistant" as const,
      content: text,
      tool_calls: calls.length ? calls : undefined
    },
    provider: config.name,
    model: config.model
  };
}

async function callOpenAiCompatible(config: ProviderConfig, messages: BizStackModelMessage[], tools: BizStackTool[]) {
  const response = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + config.apiKey
    },
    body: JSON.stringify({
      model: config.model,
      temperature: Number(env("BIZSTACK_AI_TEMPERATURE") || 0.15),
      messages: openAiMessages(messages),
      tools: openAiTools(tools),
      tool_choice: "auto"
    }),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(config.name + " returned HTTP " + response.status + ": " + (await response.text()).slice(0, 600));
  const body = await response.json();
  const message = normalizeOpenAi(body);
  if (!message) throw new Error(config.name + " returned no assistant message.");
  return { message, provider: config.name, model: config.model };
}

export async function runBizStackModel(messages: BizStackModelMessage[], tools: BizStackTool[]): Promise<ProviderResponse> {
  const providers = configuredProviders();

  // Keep the legacy single-endpoint configuration working while migrating to provider-specific keys.
  if (!providers.length && env("BIZSTACK_AI_API_URL") && env("BIZSTACK_AI_API_KEY")) {
    const response = await fetch(env("BIZSTACK_AI_API_URL"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + env("BIZSTACK_AI_API_KEY")
      },
      body: JSON.stringify({
        model: env("BIZSTACK_AI_MODEL") || "default",
        temperature: 0.15,
        messages,
        tools,
        tool_choice: "auto"
      }),
      cache: "no-store"
    });
    if (!response.ok) throw new Error("Configured AI endpoint returned HTTP " + response.status + ": " + (await response.text()).slice(0, 600));
    const body = await response.json();
    const message = normalizeOpenAi(body);
    if (!message) throw new Error("Configured AI endpoint returned no assistant message.");
    return { message, provider: "openai", model: env("BIZSTACK_AI_MODEL") || "default" };
  }

  const provider = chooseProvider(messages, providers);
  try {
    if (provider.name === "anthropic") return await callAnthropic(provider, messages, tools);
    return await callOpenAiCompatible(provider, messages, tools);
  } catch (error) {
    const remaining = providers.filter((p) => p.name !== provider.name);
    if (!remaining.length) throw error;
    const fallback = remaining.find((p) => p.name === "anthropic") || remaining[0];
    if (fallback.name === "anthropic") return await callAnthropic(fallback, messages, tools);
    return await callOpenAiCompatible(fallback, messages, tools);
  }
}

export function getConfiguredAiProviders() {
  return configuredProviders().map((provider) => ({
    provider: provider.name,
    model: provider.model,
    priority: provider.priority
  }));
}
