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
  task?: TaskProfile;
  attemptedProviders?: ProviderName[];
};

type ProviderConfig = {
  name: ProviderName;
  apiKey: string;
  model: string;
  baseUrl: string;
  priority: number;
};

export type TaskProfile = {
  coding: boolean;
  architecture: boolean;
  debugging: boolean;
  testing: boolean;
  security: boolean;
  visual: boolean;
  document: boolean;
  reasoning: boolean;
  longContext: boolean;
  fast: boolean;
  task: string;
};

function env(name: string) {
  return process.env[name]?.trim() || "";
}

function numberEnv(name: string, fallback: number, min: number, max: number) {
  const value = Number(env(name));
  return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback;
}

function configuredProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];
  const add = (
    name: ProviderName,
    keyName: string,
    modelName: string,
    urlName: string,
    defaultModel: string,
    defaultUrl: string,
    priorityName: string,
    defaultPriority: number
  ) => {
    const apiKey = env(keyName);
    if (!apiKey) return;
    providers.push({
      name,
      apiKey,
      model: env(modelName) || defaultModel,
      baseUrl: env(urlName) || defaultUrl,
      priority: numberEnv(priorityName, defaultPriority, -1000, 1000)
    });
  };

  add("anthropic", "BIZSTACK_ANTHROPIC_API_KEY", "BIZSTACK_ANTHROPIC_MODEL", "BIZSTACK_ANTHROPIC_API_URL", "claude-sonnet-4-6", "https://api.anthropic.com/v1/messages", "BIZSTACK_ANTHROPIC_PRIORITY", 10);
  add("openai", "BIZSTACK_OPENAI_API_KEY", "BIZSTACK_OPENAI_MODEL", "BIZSTACK_OPENAI_API_URL", "gpt-5", "https://api.openai.com/v1/chat/completions", "BIZSTACK_OPENAI_PRIORITY", 20);
  add("gemini", "BIZSTACK_GEMINI_API_KEY", "BIZSTACK_GEMINI_MODEL", "BIZSTACK_GEMINI_API_URL", "gemini-2.5-flash", "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", "BIZSTACK_GEMINI_PRIORITY", 30);
  add("mistral", "BIZSTACK_MISTRAL_API_KEY", "BIZSTACK_MISTRAL_MODEL", "BIZSTACK_MISTRAL_API_URL", "mistral-large-latest", "https://api.mistral.ai/v1/chat/completions", "BIZSTACK_MISTRAL_PRIORITY", 40);

  return providers.sort((a, b) => a.priority - b.priority);
}

function latestUserText(messages: BizStackModelMessage[]) {
  return messages.filter((m) => m.role === "user").at(-1)?.content.toLowerCase() || "";
}

function classifyTask(messages: BizStackModelMessage[]): TaskProfile {
  const text = latestUserText(messages);
  const allText = messages.map((m) => m.content).join("\n").toLowerCase();

  const coding = /(build|code|coding|developer|typescript|javascript|react|next\\.js|api|database|sql|github|deploy|website|app|application|terminal|compile|repository|source file|refactor)/i.test(text);
  const architecture = /(architect|architecture|system design|design the backend|schema design|data model|orchestration|service boundary)/i.test(text);
  const debugging = /(debug|bug|broken|failure|error|exception|crash|fix|repair|regression|doesn't work|not working)/i.test(text);
  const testing = /(test|testing|unit test|integration test|e2e|verify|verification|coverage|lint|compile)/i.test(text);
  const security = /(security|secure|vulnerability|permission|authorization|authentication|rls|csrf|xss|secret|credential|audit)/i.test(text);
  const visual = /(image|photo|screenshot|design|visual|ui|ux|diagram|look at|picture|layout|frontend)/i.test(text);
  const document = /(document|pdf|contract|invoice|receipt|spreadsheet|file|extract|ocr|summarize document)/i.test(text);
  const longContext = allText.length > 30000 || messages.length > 30 || text.length > 7000;
  const fast = /(classify|extract|tag|categorize|simple|quick|short answer|briefly)/i.test(text);

  let task = "general";
  if (security) task = "security";
  else if (debugging) task = "debugging";
  else if (architecture) task = "architecture";
  else if (testing) task = "testing";
  else if (coding) task = "coding";
  else if (visual) task = "visual";
  else if (document) task = "document";
  else if (reasoningFromText(text)) task = "reasoning";
  else if (fast) task = "fast";

  return { coding, architecture, debugging, testing, security, visual, document, reasoning: reasoningFromText(text), longContext, fast, task };
}

function reasoningFromText(text: string) {
  return /(reason|analy[sz]e|compare|tradeoff|why|strategy|plan|investigate|derive|evaluate|decide)/i.test(text);
}

function providerOrderOverride(task: TaskProfile, providers: ProviderConfig[]) {
  const configured = env("BIZSTACK_AI_PROVIDER_ORDER");
  if (!configured) return providers;
  const order = configured.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  const rank = new Map(order.map((name, index) => [name, index]));
  return providers.slice().sort((a, b) => (rank.get(a.name) ?? 999) - (rank.get(b.name) ?? 999) || a.priority - b.priority);
}

function providerPreference(task: TaskProfile, provider: ProviderConfig) {
  let score = 100 - provider.priority;

  // These are routing heuristics, not claims that a provider is universally better.
  if (task.coding) {
    if (provider.name === "openai") score += /codex|gpt/i.test(provider.model) ? 55 : 35;
    if (provider.name === "anthropic") score += 50;
    if (provider.name === "gemini") score += 20;
    if (provider.name === "mistral") score += 15;
  }
  if (task.architecture || task.reasoning) {
    if (provider.name === "anthropic") score += 35;
    if (provider.name === "openai") score += 35;
    if (provider.name === "gemini") score += 25;
    if (provider.name === "mistral") score += 20;
  }
  if (task.debugging || task.testing) {
    if (provider.name === "anthropic") score += 35;
    if (provider.name === "openai") score += 35;
    if (provider.name === "mistral") score += 20;
    if (provider.name === "gemini") score += 20;
  }
  if (task.security) {
    if (provider.name === "anthropic") score += 35;
    if (provider.name === "openai") score += 35;
    if (provider.name === "gemini") score += 20;
    if (provider.name === "mistral") score += 20;
  }
  if (task.visual && provider.name === "gemini") score += 40;
  if (task.longContext) {
    if (provider.name === "gemini") score += 35;
    if (provider.name === "anthropic") score += 35;
    if (provider.name === "openai") score += 30;
  }
  if (task.document && provider.name === "gemini") score += 20;
  if (task.fast && provider.name === "mistral") score += 35;

  return score;
}

function choosePrimaryProvider(task: TaskProfile, providers: ProviderConfig[]) {
  const ordered = providerOrderOverride(task, providers);
  return ordered.slice().sort((a, b) => providerPreference(task, b) - providerPreference(task, a) || a.priority - b.priority)[0];
}

function chooseProvider(messages: BizStackModelMessage[], providers: ProviderConfig[]) {
  if (!providers.length) throw new Error("No BizStack AI provider is configured on the server.");

  const requested = env("BIZSTACK_AI_PROVIDER").toLowerCase();
  if (requested && requested !== "auto") {
    const explicit = providers.find((p) => p.name === requested);
    if (explicit) return explicit;
  }

  const task = classifyTask(messages);
  return choosePrimaryProvider(task, providers);
}

function openAiMessages(messages: BizStackModelMessage[]) {
  return messages.map((message) => {
    if (message.role !== "tool") {
      const clean: Record<string, unknown> = {
        role: message.role,
        content: message.content
      };
      if (message.tool_calls?.length) clean.tool_calls = message.tool_calls;
      return clean;
    }
    return {
      role: "tool",
      content: message.content,
      tool_call_id: message.tool_call_id || ""
    };
  });
}

function normalizeOpenAi(body: any): BizStackModelMessage | undefined {
  const message = body?.choices?.[0]?.message;
  if (!message) return undefined;

  const calls = Array.isArray(message.tool_calls)
    ? message.tool_calls.map((call: any, index: number) => ({
        id: String(call.id || "call_" + index),
        type: "function" as const,
        function: {
          name: String(call.function?.name || ""),
          arguments: String(call.function?.arguments || "{}")
        }
      })).filter((call: ToolCall) => call.function.name)
    : undefined;

  return {
    role: "assistant",
    content: typeof message.content === "string" ? message.content : "",
    tool_calls: calls?.length ? calls : undefined
  };
}

function anthropicMessages(messages: BizStackModelMessage[]) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
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
    return { role: m.role === "assistant" ? "assistant" : "user", content: m.content };
  });
  return { system, messages: converted };
}

function providerTimeoutMs() {
  return numberEnv("BIZSTACK_AI_TIMEOUT_MS", 60000, 5000, 180000);
}

function retryCount() {
  return numberEnv("BIZSTACK_AI_RETRIES", 1, 0, 3);
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callAnthropic(config: ProviderConfig, messages: BizStackModelMessage[], tools: BizStackTool[]) {
  const converted = anthropicMessages(messages);
  const response = await fetchWithTimeout(config.baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: numberEnv("BIZSTACK_AI_MAX_TOKENS", 8192, 256, 32768),
      system: converted.system,
      messages: converted.messages,
      tools: tools.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters
      }))
    }),
    cache: "no-store"
  }, providerTimeoutMs());

  if (!response.ok) throw new Error("Anthropic returned HTTP " + response.status + ": " + (await response.text()).slice(0, 600));
  const body = await response.json();
  const blocks = Array.isArray(body?.content) ? body.content : [];
  const text = blocks.filter((x: any) => x?.type === "text").map((x: any) => x.text).join("");
  const calls = blocks.filter((x: any) => x?.type === "tool_use").map((x: any, index: number) => ({
    id: String(x.id || "call_" + index),
    type: "function" as const,
    function: { name: String(x.name || ""), arguments: JSON.stringify(x.input ?? {}) }
  })).filter((call: ToolCall) => call.function.name);

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
  const response = await fetchWithTimeout(config.baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + config.apiKey
    },
    body: JSON.stringify({
      model: config.model,
      temperature: numberEnv("BIZSTACK_AI_TEMPERATURE", 0.15, 0, 1),
      messages: openAiMessages(messages),
      tools,
      tool_choice: "auto"
    }),
    cache: "no-store"
  }, providerTimeoutMs());

  if (!response.ok) throw new Error(config.name + " returned HTTP " + response.status + ": " + (await response.text()).slice(0, 600));
  const body = await response.json();
  const message = normalizeOpenAi(body);
  if (!message) throw new Error(config.name + " returned no assistant message.");
  return { message, provider: config.name, model: config.model };
}

async function callWithRetries(
  provider: ProviderConfig,
  messages: BizStackModelMessage[],
  tools: BizStackTool[]
): Promise<ProviderResponse> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryCount(); attempt += 1) {
    try {
      const result = provider.name === "anthropic"
        ? await callAnthropic(provider, messages, tools)
        : await callOpenAiCompatible(provider, messages, tools);
      return result;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const status = Number(message.match(/HTTP (\\d{3})/)?.[1] || 0);
      const retryable = !status || isRetryableStatus(status);
      if (!retryable || attempt >= retryCount()) break;
      await new Promise((resolve) => setTimeout(resolve, Math.min(1500 * 2 ** attempt, 5000)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("AI provider request failed.");
}

export async function runBizStackModel(messages: BizStackModelMessage[], tools: BizStackTool[]): Promise<ProviderResponse> {
  const providers = configuredProviders();
  const task = classifyTask(messages);

  // Preserve the legacy single-endpoint configuration while provider-specific keys are migrated.
  if (!providers.length && env("BIZSTACK_AI_API_URL") && env("BIZSTACK_AI_API_KEY")) {
    const response = await fetchWithTimeout(env("BIZSTACK_AI_API_URL"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + env("BIZSTACK_AI_API_KEY")
      },
      body: JSON.stringify({
        model: env("BIZSTACK_AI_MODEL") || "default",
        temperature: numberEnv("BIZSTACK_AI_TEMPERATURE", 0.15, 0, 1),
        messages: openAiMessages(messages),
        tools,
        tool_choice: "auto"
      }),
      cache: "no-store"
    }, providerTimeoutMs());

    if (!response.ok) throw new Error("Configured AI endpoint returned HTTP " + response.status + ": " + (await response.text()).slice(0, 600));
    const body = await response.json();
    const message = normalizeOpenAi(body);
    if (!message) throw new Error("Configured AI endpoint returned no assistant message.");
    return { message, provider: "openai", model: env("BIZSTACK_AI_MODEL") || "default", task };
  }

  if (!providers.length) throw new Error("No BizStack AI provider is configured on the server.");

  const primary = chooseProvider(messages, providers);
  const collaboration = (env("BIZSTACK_AI_COLLABORATION") || "auto").toLowerCase();
  const candidates = [primary, ...providers.filter((p) => p.name !== primary.name).sort((a, b) => providerPreference(task, b) - providerPreference(task, a))];

  // A request can explicitly opt into a provider, but automatic mode still owns selection.
  const attempted: ProviderName[] = [];
  let lastError: unknown;

  for (const provider of candidates) {
    attempted.push(provider.name);
    try {
      const result = await callWithRetries(provider, messages, tools);
      return { ...result, task, attemptedProviders: attempted };
    } catch (error) {
      lastError = error;
      if (collaboration === "single") break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("All configured BizStack AI providers failed.");
}

export function getConfiguredAiProviders() {
  return configuredProviders().map((provider) => ({
    provider: provider.name,
    model: provider.model,
    priority: provider.priority
  }));
}

export function getAiRoutingProfile(messages: BizStackModelMessage[]) {
  const providers = configuredProviders();
  const task = classifyTask(messages);
  const primary = providers.length ? choosePrimaryProvider(task, providers) : null;
  return {
    task,
    primary: primary ? { provider: primary.name, model: primary.model } : null,
    providers: providers.map((p) => ({ provider: p.name, model: p.model, priority: p.priority }))
  };
}
