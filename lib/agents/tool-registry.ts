import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase-server";
import { runBizStackModel, type BizStackModelMessage } from "@/lib/ai/providers/router";
import { buildProjectGraph } from "@/lib/project-graph";
import { WEBSITE_DESIGN_BRIDGE_PATH, WEBSITE_DESIGN_BRIDGE_SOURCE } from "@/lib/website/design-bridge-source";
import { runWebsiteBuild } from "@/lib/ai/build-engine/runtime";
import { runInvoiceBuild } from "@/lib/ai/build-engine/invoice-runtime";
import { runProductInventoryBuild } from "@/lib/ai/build-engine/operations-runtime";
import { runSandboxCommand, sandboxConfigured, syncFiles } from "@/lib/sandbox/vercel";
import { syncConnectorResource } from "@/lib/connectors/sync-runtime";
import { executeRepair } from "@/lib/repair/engine";
import { generateWebsiteAsset, imageGenerationConfigured, type WebsiteAssetKind } from "@/lib/ai/assets/generation";

export type ToolDefinition = {
  toolKey: string;
  name: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  permission: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const emptyObject = (): Record<string, unknown> => ({
  type: "object",
  properties: {},
  additionalProperties: false
});

export const TOOL_REGISTRY: ToolDefinition[] = [
  { toolKey: "business.get_context", name: "Business Context", riskLevel: "low", permission: "read_business_context", description: "Read the business profile, settings and operating context.", inputSchema: emptyObject() },
  { toolKey: "customers.list", name: "Customer Directory", riskLevel: "low", permission: "read_customers", description: "Read customers for segmentation, service and follow-up decisions.", inputSchema: { type: "object", properties: { limit: { type: "number", minimum: 1, maximum: 100 } } } },
  { toolKey: "customers.create", name: "Create Customer", riskLevel: "low", permission: "create_customers", description: "Create a real customer record after checking likely duplicates.", inputSchema: { type: "object", properties: { name: { type: "string" }, company_name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, country: { type: "string" }, customer_type: { type: "string" } }, required: ["name"] } },
  { toolKey: "invoices.list_outstanding", name: "Outstanding Invoices", riskLevel: "low", permission: "read_invoices", description: "Read open invoices, amounts, statuses and due dates.", inputSchema: emptyObject() },
  { toolKey: "invoices.create_draft", name: "Create Invoice Draft", riskLevel: "medium", permission: "create_invoices", description: "Create a real invoice draft from a natural-language invoice instruction. It does not send the invoice.", inputSchema: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] } },
  { toolKey: "inventory.list_low_stock", name: "Low Stock Watch", riskLevel: "low", permission: "read_inventory", description: "Read products at or below their configured stock threshold.", inputSchema: emptyObject() },
  { toolKey: "products.create", name: "Create Product", riskLevel: "low", permission: "create_products", description: "Create a real catalog product and optional opening stock from a natural-language instruction.", inputSchema: { type: "object", properties: { name: { type: "string" }, sku: { type: "string" }, unit_price: { type: "number" }, cost_price: { type: "number" }, stock_quantity: { type: "number" }, low_stock_threshold: { type: "number" } }, required: ["name"] } },
  { toolKey: "money.summary", name: "Money Summary", riskLevel: "low", permission: "read_money", description: "Read receivables and recent recorded financial activity.", inputSchema: emptyObject() },
  { toolKey: "wallet.summary", name: "Wallet Summary", riskLevel: "low", permission: "read_wallet", description: "Read wallet balances, statuses and recent wallet transactions.", inputSchema: emptyObject() },
  { toolKey: "integrations.list", name: "Inspect Connections", riskLevel: "low", permission: "read_integrations", description: "Inspect real integrations and their actual connection state.", inputSchema: emptyObject() },
  { toolKey: "business.autonomy.status", name: "Business Autonomy Policy", riskLevel: "low", permission: "read_business_context", description: "Inspect the business automation permissions that determine which operational actions BizStack may execute automatically.", inputSchema: emptyObject() },
  { toolKey: "communications.inbox", name: "Unified Communications Inbox", riskLevel: "low", permission: "read_integrations", description: "Read recent customer communications across connected channels such as WhatsApp, SMS and email without treating them as login/authentication.", inputSchema: { type: "object", properties: { channel: { type: "string" }, limit: { type: "number", minimum: 1, maximum: 100 } } } },
  { toolKey: "integrations.test", name: "Test Integration", riskLevel: "medium", permission: "write_integrations", description: "Verify a connected integration against its real provider API, update connection health, and record an auditable health-check event.", inputSchema: { type: "object", properties: { integration_id: { type: "string" } }, required: ["integration_id"] } },
  { toolKey: "integrations.sync", name: "Sync Connected Resource", riskLevel: "medium", permission: "write_integrations", description: "Run a governed sync for a connected custom connector resource and persist the external records, cursor, run evidence and errors.", inputSchema: { type: "object", properties: { integration_id: { type: "string" }, resource_key: { type: "string" } }, required: ["integration_id","resource_key"] } },
  { toolKey: "website.build", name: "Build Website", riskLevel: "medium", permission: "build_websites", description: "Create or modify a real BizStack website from natural language, optionally compiling the same design into an editable software project.", inputSchema: { type: "object", properties: { prompt: { type: "string" }, website_id: { type: "string" }, project_id: { type: "string" }, publish: { type: "boolean" }, generate_assets: { type: "boolean" } }, required: ["prompt"] } },
  { toolKey: "website.blueprint.generate", name: "Website Blueprint", riskLevel: "low", permission: "build_websites", description: "Generate and persist a source-aware website sitemap, page structure, user flows, design direction and engineering dependencies without changing project source files.", inputSchema: { type: "object", properties: { project_id: { type: "string" }, brief: { type: "string" } }, required: ["project_id","brief"] } },
  { toolKey: "website.assets.list", name: "Website Asset Library", riskLevel: "low", permission: "build_websites", description: "Inspect existing bespoke website visual assets so the builder can reuse the business identity instead of creating generic replacements.", inputSchema: { type: "object", properties: { website_id: { type: "string" }, project_id: { type: "string" }, kind: { type: "string" }, limit: { type: "number", minimum: 1, maximum: 50 } } } },
  { toolKey: "website.asset.generate", name: "Generate Website Visual", riskLevel: "medium", permission: "build_websites", description: "Generate an original, business-specific image or brand asset and persist it into the BizStack website asset library. Never substitutes generic stock or copied brand visuals.", inputSchema: { type: "object", properties: { prompt: { type: "string" }, kind: { type: "string", enum: ["logo","hero","section_image","product_scene","background","illustration","og_image","favicon","custom"] }, website_id: { type: "string" }, project_id: { type: "string" }, build_run_id: { type: "string" }, name: { type: "string" }, alt_text: { type: "string" }, visual_direction: { type: "string" }, reference_context: { type: "string" } }, required: ["prompt","kind"] } },
  { toolKey: "website.live_data.configure", name: "Website Live Business Data", riskLevel: "medium", permission: "build_websites", description: "Configure a published website to read an allowlisted, non-sensitive slice of the business in near real time, such as public products, availability and business profile data. Private invoices, balances and customer records are never exposed by this surface.", inputSchema: { type: "object", properties: { website_id: { type: "string" }, enabled: { type: "boolean" }, sources: { type: "array", items: { type: "object" } } }, required: ["website_id","sources"] } },
  { toolKey: "events.create", name: "Create Business Event", riskLevel: "low", permission: "draft_actions", description: "Record an auditable internal action, recommendation or handoff.", inputSchema: { type: "object", properties: { event_type: { type: "string" }, summary: { type: "string" }, category: { type: "string" }, priority: { type: "string" }, action_type: { type: "string" } }, required: ["summary"] } },
  { toolKey: "projects.list", name: "Project Directory", riskLevel: "low", permission: "read_projects", description: "Inspect persistent software projects and their verified deployment state.", inputSchema: emptyObject() },
  { toolKey: "projects.create", name: "Create Software Project", riskLevel: "medium", permission: "create_projects", description: "Create a real editable software project with persistent files and an initial version snapshot.", inputSchema: { type: "object", properties: { name: { type: "string" }, slug: { type: "string" }, project_type: { type: "string" }, framework: { type: "string" }, runtime: { type: "string" }, files: { type: "array" } }, required: ["name"] } },
  { toolKey: "project.files.list", name: "Project Source Files", riskLevel: "low", permission: "read_project_files", description: "Read the real persistent source tree for a software project.", inputSchema: { type: "object", properties: { project_id: { type: "string" } }, required: ["project_id"] } },
  { toolKey: "project.files.write", name: "Write Project File", riskLevel: "medium", permission: "write_project_files", description: "Create or modify a real source file in a persistent software project.", inputSchema: { type: "object", properties: { project_id: { type: "string" }, path: { type: "string" }, content: { type: "string" }, language: { type: "string" } }, required: ["project_id","path","content"] } },
  { toolKey: "project.version.create", name: "Snapshot Project Version", riskLevel: "low", permission: "snapshot_projects", description: "Create an immutable project version snapshot before or after source changes.", inputSchema: { type: "object", properties: { project_id: { type: "string" }, message: { type: "string" } }, required: ["project_id"] } },
  { toolKey: "project.runtime.run", name: "Project Runtime", riskLevel: "medium", permission: "run_project_runtime", description: "Synchronize a real project into an isolated sandbox and run an allowed build, lint, test, or inspection command.", inputSchema: { type: "object", properties: { project_id: { type: "string" }, cmd: { type: "string" }, args: { type: "array", items: { type: "string" } } }, required: ["project_id","cmd"] } },
  { toolKey: "projects.deployments.list", name: "Project Deployments", riskLevel: "low", permission: "read_deployments", description: "Inspect recent deployment records, provider state, URLs, commits, and recorded failure evidence for a software project.", inputSchema: { type: "object", properties: { project_id: { type: "string" }, limit: { type: "number", minimum: 1, maximum: 20 } }, required: ["project_id"] } },
  { toolKey: "project.repairs.list", name: "Project Repair History", riskLevel: "low", permission: "read_project_history", description: "Inspect repair runs, diagnoses, applied changes, verification results, rollback state, and repair readiness for a software project.", inputSchema: { type: "object", properties: { project_id: { type: "string" }, limit: { type: "number", minimum: 1, maximum: 20 } }, required: ["project_id"] } },
  { toolKey: "project.runtime.verify", name: "Project Verification", riskLevel: "medium", permission: "run_project_runtime", description: "Synchronize the current project into the isolated sandbox and verify it with install, build, lint, and test commands when those scripts exist.", inputSchema: { type: "object", properties: { project_id: { type: "string" }, include_tests: { type: "boolean" } }, required: ["project_id"] } },
  { toolKey: "project.repair.execute", name: "Execute Project Repair", riskLevel: "high", permission: "write_project_files", description: "Execute an existing planned AI repair run for a project. The repair engine snapshots first, applies minimal patches, verifies the result in the sandbox, and rolls back failed repairs.", inputSchema: { type: "object", properties: { repair_id: { type: "string" }, project_id: { type: "string" } }, required: ["repair_id","project_id"] } },
  { toolKey: "project.versions.diff", name: "Project Version Diff", riskLevel: "low", permission: "read_project_history", description: "Compare two persisted project snapshots and return added, removed and changed files.", inputSchema: { type: "object", properties: { project_id: { type: "string" }, from_version: { type: "number" }, to_version: { type: "number" } }, required: ["project_id"] } },
  { toolKey: "website.design.apply", name: "Website Design Mode", riskLevel: "medium", permission: "write_project_files", description: "Apply a source-backed visual, content or responsive website change to a real project file, checkpoint it, and verify the project.", inputSchema: { type: "object", properties: { project_id: { type: "string" }, source_path: { type: "string" }, instruction: { type: "string" }, element: { type: "string" }, mode: { type: "string", enum: ["style","content","responsive"] } }, required: ["project_id","instruction"] } },
  { toolKey: "website.design.bridge", name: "Enable Live Design Selection", riskLevel: "medium", permission: "write_project_files", description: "Install the preview-only BizStack design-selection bridge into a supported website layout.", inputSchema: { type: "object", properties: { project_id: { type: "string" } }, required: ["project_id"] } },
  { toolKey: "website.seo.apply", name: "Website SEO/AEO Apply", riskLevel: "medium", permission: "write_project_files", description: "Apply saved source-backed SEO/AEO guidance to real website source, checkpoint it, and verify the project.", inputSchema: { type: "object", properties: { project_id: { type: "string" }, source_path: { type: "string" }, instruction: { type: "string" }, route: { type: "string" } }, required: ["project_id","instruction"] } },
];

export function getToolDefinition(toolKey: string) {
  return TOOL_REGISTRY.find((tool) => tool.toolKey === toolKey) ?? null;
}

export function buildPlan(input: string): { toolKey: string; input: Record<string, unknown> }[] {
  const text = input.trim().toLowerCase();
  const plan: { toolKey: string; input: Record<string, unknown> }[] = [{ toolKey: "business.get_context", input: {} }];
  if (/(customer|client|buyer|churn|follow.?up|contact)/.test(text)) plan.push({ toolKey: "customers.list", input: { limit: 50 } });
  if (/(invoice|receivable|receivables|overdue|owe|debt|payment)/.test(text)) plan.push({ toolKey: "invoices.list_outstanding", input: {} });
  if (/(stock|inventory|reorder|product|warehouse|fulfil)/.test(text)) plan.push({ toolKey: "inventory.list_low_stock", input: {} });
  if (/(money|cash|revenue|expense|profit|financial|finance|balance)/.test(text)) plan.push({ toolKey: "money.summary", input: {} });
  if (/(wallet|bank balance|available funds|transfer)/.test(text)) plan.push({ toolKey: "wallet.summary", input: {} });
  if (/(connection|integration|connected|oauth|api|webhook)/.test(text)) plan.push({ toolKey: "integrations.list", input: {} });
  if (/(test|verify|health check|check.*connection|connection.*check).*(connection|integration|oauth|api|webhook)/.test(text)) plan.push({ toolKey: "integrations.test", input: {} });
  if (/(autonom|permission|approval|automation|what can you do automatically)/.test(text)) plan.push({ toolKey: "business.autonomy.status", input: {} });
  if (/(whatsapp|facebook messenger|messenger|sms|email|customer message|inbox|reply to customer)/.test(text)) plan.push({ toolKey: "communications.inbox", input: { limit: 50 } });
  if (/(build|create|make|edit|modify|code|app|application|website|project|repository|file|feature|terminal|preview)/.test(text)) plan.push({ toolKey: "projects.list", input: {} });
  if (/(design mode|typography|font size|font weight|border radius|shadow|spacing|visual style|visual change|responsive layout|change the content|redesign this|make this bigger|make this smaller)/.test(text) && /website|page|section|button|heading|image|form|design/.test(text)) {
    const sourceMatch = input.match(/source(?:\s+file)?:\s*([^\s,;]+\.(?:tsx|ts|jsx|js|css|scss))/i);
    plan.push({
      toolKey: "website.design.apply",
      input: {
        project_id: undefined,
        source_path: sourceMatch?.[1] ? sourceMatch[1].replace(/[.)]+$/, "") : "",
        instruction: input.trim(),
        element: "",
        mode: /responsive/.test(text) ? "responsive" : /content/.test(text) ? "content" : "style"
      }
    });
  }
  if (/(enable live selection|live canvas|select elements on canvas|click elements in preview|install design bridge|interactive design mode)/.test(text) && /website|design|preview|canvas/.test(text)) plan.push({ toolKey: "website.design.bridge", input: { project_id: undefined } });
  if (/(live|real.?time|sync|dynamic|update.*website|website.*business data|products.*website)/.test(text) && /website/.test(text)) plan.push({ toolKey: "website.live_data.configure", input: {} });
  if (/(record this|log this|create an action|create a task|note this|add to timeline)/.test(text)) {
    plan.push({ toolKey: "events.create", input: { event_type: "agent.requested_action", summary: input.trim(), category: "agent", priority: "normal", action_type: "agent_followup" } });
  }
  return plan;
}

export type RuntimeContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  businessId: string;
  userId: string;
  projectId?: string | null;
};

export async function executeTool(toolKey: string, input: Record<string, unknown>, context: RuntimeContext): Promise<Record<string, unknown> | Record<string, unknown>[]> {
  const { supabase, businessId, userId } = context;

  if (toolKey === "business.get_context") {
    const [{ data: business }, { data: settings }] = await Promise.all([
      supabase.from("businesses").select("id,name,industry,currency,address,contact_email,contact_phone,workspace_id,organization_id").eq("id", businessId).single(),
      supabase.from("business_settings").select("tax_mode,default_tax_rate,default_tax_name,tax_registration_number,tax_jurisdiction,tax_inclusive,invoice_settings,module_settings,sync_settings").eq("business_id", businessId).maybeSingle()
    ]);
    return { business: business ?? null, settings: settings ?? null };
  }

  if (toolKey === "customers.list") {
    const rawLimit = Number(input.limit ?? 50);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 100);
    const { data, error } = await supabase.from("customers").select("id,name,company_name,email,phone,status,customer_type,country,preferred_channel,last_contact_at,created_at").eq("business_id", businessId).order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  if (toolKey === "customers.create") {
    const name = String(input.name ?? "").trim();
    if (!name) throw new Error("Customer name is required.");
    const email = String(input.email ?? "").trim() || null;
    const phone = String(input.phone ?? "").trim() || null;
    let duplicateQuery = supabase.from("customers").select("id,name,company_name,email,phone").eq("business_id", businessId);
    if (email) duplicateQuery = duplicateQuery.eq("email", email);
    else if (phone) duplicateQuery = duplicateQuery.eq("phone", phone);
    else duplicateQuery = duplicateQuery.ilike("name", name);
    const { data: duplicate } = await duplicateQuery.limit(1).maybeSingle();
    if (duplicate) return { created: false, duplicate: true, customer: duplicate };
    const { data, error } = await supabase.from("customers").insert({
      business_id: businessId,
      name,
      company_name: String(input.company_name ?? "").trim() || null,
      email,
      phone,
      country: String(input.country ?? "").trim() || null,
      customer_type: String(input.customer_type ?? "customer").trim() || "customer",
      created_by: userId
    }).select("id,name,company_name,email,phone,country,customer_type,status,created_at").single();
    if (error) throw error;
    return { created: true, customer: data };
  }

  if (toolKey === "invoices.list_outstanding") {
    const { data, error } = await supabase.from("invoices").select("id,invoice_number,customer_id,status,due_date,currency,subtotal,total,paid_amount,created_at,customers(name,company_name)").eq("business_id", businessId).in("status", ["sent", "partially_paid", "overdue"]).order("due_date", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  if (toolKey === "invoices.create_draft") {
    const prompt = String(input.prompt ?? "").trim();
    if (!prompt) throw new Error("Invoice instructions are required.");
    return await runInvoiceBuild({ businessId, userId, prompt, mode: "draft_only" });
  }

  if (toolKey === "inventory.list_low_stock") {
    const { data, error } = await supabase.from("products").select("id,name,sku,unit,stock_quantity,low_stock_threshold,unit_price,cost_price,is_active").eq("business_id", businessId).eq("is_active", true).order("stock_quantity", { ascending: true });
    if (error) throw error;
    return (data ?? []).filter((product) => Number(product.stock_quantity ?? 0) <= Number(product.low_stock_threshold ?? 0));
  }

  if (toolKey === "products.create") {
    const name = String(input.name ?? "").trim();
    if (!name) throw new Error("Product name is required.");
    const details = [
      `Create product ${name}`,
      input.sku ? `SKU ${String(input.sku)}` : "",
      input.unit_price !== undefined ? `price ${Number(input.unit_price)}` : "",
      input.cost_price !== undefined ? `cost ${Number(input.cost_price)}` : "",
      input.stock_quantity !== undefined ? `stock ${Number(input.stock_quantity)}` : "",
      input.low_stock_threshold !== undefined ? `low stock ${Number(input.low_stock_threshold)}` : ""
    ].filter(Boolean).join(", ");
    return await runProductInventoryBuild({ businessId, userId, prompt: details, mode: "auto_execute" });
  }

  if (toolKey === "money.summary") {
    const [{ data: invoices }, { data: payments }] = await Promise.all([
      supabase.from("invoices").select("id,status,total,paid_amount,due_date,currency").eq("business_id", businessId),
      supabase.from("invoice_payments").select("id,invoice_id,amount,payment_date,method,reference").eq("business_id", businessId).order("payment_date", { ascending: false }).limit(100)
    ]);
    const rows = invoices ?? [];
    const outstanding = rows.filter((row) => ["sent", "partially_paid", "overdue"].includes(String(row.status))).reduce((sum, row) => sum + Math.max(0, Number(row.total ?? 0) - Number(row.paid_amount ?? 0)), 0);
    const collected = (payments ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    return {
      invoice_count: rows.length,
      outstanding_receivables: outstanding,
      recorded_payments_in_sample: collected,
      open_invoices: rows.filter((row) => ["sent", "partially_paid", "overdue"].includes(String(row.status))).length,
      overdue_invoices: rows.filter((row) => String(row.status) === "overdue").length,
      recent_payments: payments ?? []
    };
  }

  if (toolKey === "wallet.summary") {
    const [{ data: wallets }, { data: transactions }] = await Promise.all([
      supabase.from("wallets").select("id,name,wallet_type,currency,balance,available_balance,status").eq("business_id", businessId).order("created_at", { ascending: true }),
      supabase.from("wallet_transactions").select("id,wallet_id,type,direction,status,amount,currency,fee,net_amount,counterparty_name,created_at").eq("business_id", businessId).order("created_at", { ascending: false }).limit(50)
    ]);
    return { wallets: wallets ?? [], recent_transactions: transactions ?? [] };
  }

  if (toolKey === "integrations.list") {
    const { data, error } = await supabase.from("integrations").select("id,display_name,provider,category,connection_type,status,sync_mode,error_message,config,created_at,updated_at").eq("business_id", businessId).order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  if (toolKey === "business.autonomy.status") {
    const { data: settings, error } = await supabase.from("automation_settings").select("action_type,mode,limit_value").eq("business_id", businessId).order("action_type", { ascending: true });
    if (error) throw error;
    return { autonomy_mode: "permissioned", policies: settings ?? [], note: "Only actions explicitly configured for auto_execute should bypass the normal approval gate; critical/high-risk actions remain governed." };
  }

  if (toolKey === "communications.inbox") {
    const rawLimit = Number(input.limit ?? 50);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 100);
    let query = supabase.from("communication_messages")
      .select("id,customer_id,integration_id,channel,direction,status,provider_message_id,subject,body,template_name,sent_at,delivered_at,read_at,error_message,metadata,created_at,customers(name,email,phone)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(limit);
    const channel = String(input.channel ?? "").trim().toLowerCase();
    if (channel) query = query.eq("channel", channel);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  if (toolKey === "integrations.test") {
    const integrationId = String(input.integration_id ?? "").trim();
    if (!integrationId) throw new Error("integration_id is required.");
    const { data: integration, error } = await supabase.from("integrations").select("id,business_id,provider,status,config").eq("id",integrationId).eq("business_id",businessId).single();
    if (error || !integration) throw new Error("Integration not found.");
    const { verifyIntegrationHealth } = await import("@/lib/integrations/health");
    return await verifyIntegrationHealth(supabase, integration, businessId);
  }

  if (toolKey === "integrations.sync") {
    const integrationId = String(input.integration_id ?? "").trim();
    const resourceKey = String(input.resource_key ?? "").trim();
    if (!integrationId || !resourceKey) throw new Error("integration_id and resource_key are required.");
    return await syncConnectorResource({ supabase, businessId, integrationId, resourceKey });
  }

  if (toolKey === "website.blueprint.generate") {
    const projectId = String(input.project_id ?? "").trim();
    const brief = String(input.brief ?? "").trim();
    if (!projectId || !brief) throw new Error("project_id and brief are required.");

    const { data: project, error: projectError } = await supabase
      .from("ai_projects")
      .select("id,business_id,name,framework,metadata,status")
      .eq("id", projectId)
      .eq("business_id", businessId)
      .neq("status", "deleted")
      .single();
    if (projectError || !project) throw new Error("Project not found.");

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id,name,industry,currency")
      .eq("id", businessId)
      .single();
    if (businessError || !business) throw new Error("Business context is not available.");

    const { data: files } = await supabase
      .from("ai_project_files")
      .select("path,content,language")
      .eq("project_id", projectId)
      .order("path");
    const graph = buildProjectGraph(projectId, (files ?? []).map((f) => ({ path: String(f.path), content: f.content, language: f.language })));

    const schema = {
      title: "string",
      summary: "string",
      audience: ["string"],
      goals: ["string"],
      pages: [{ id: "string", path: "/example", name: "string", purpose: "string", priority: "primary|secondary|utility", sections: [{ id: "string", name: "string", purpose: "string", data: ["string"], primary_action: "string" }] }],
      flows: [{ id: "string", name: "string", steps: ["string"], outcome: "string" }],
      design_direction: { style: "string", visual_principles: ["string"], typography: "string", color_direction: "string", motion: "string", responsive_strategy: "string" },
      content_system: { cms_candidates: ["string"], reusable_components: ["string"], dynamic_data_candidates: ["string"] },
      engineering_notes: { auth: ["string"], integrations: ["string"], data_dependencies: ["string"], verification: ["string"] }
    };
    const messages: BizStackModelMessage[] = [
      { role: "system", content: "Create an implementation-ready website blueprint. Return only JSON matching: " + JSON.stringify(schema) },
      { role: "user", content: [
        "Business: " + business.name,
        "Industry: " + (business.industry || "not specified"),
        "Project: " + project.name,
        "Framework: " + (project.framework || "not specified"),
        "Existing routes: " + JSON.stringify(graph.routes),
        "Existing graph: " + JSON.stringify(graph.summary),
        "Brief: " + brief
      ].join("\n") }
    ];
    let raw = "";
    try {
      const result = await runBizStackModel(messages, []);
      raw = String(result.message?.content || "").trim();
    } catch {}
    let parsed: any = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch {}
    const blueprint = {
      version: 1,
      title: typeof parsed?.title === "string" ? parsed.title : project.name + " Website Blueprint",
      summary: typeof parsed?.summary === "string" ? parsed.summary : "Source-aware website structure and implementation plan.",
      audience: Array.isArray(parsed?.audience) ? parsed.audience.map(String).slice(0, 20) : [],
      goals: Array.isArray(parsed?.goals) ? parsed.goals.map(String).slice(0, 20) : [],
      pages: Array.isArray(parsed?.pages) && parsed.pages.length ? parsed.pages.slice(0, 40) : [{ id: "home", path: "/", name: "Home", priority: "primary", purpose: "Introduce the business.", sections: [] }],
      flows: Array.isArray(parsed?.flows) ? parsed.flows.slice(0, 20) : [],
      design_direction: parsed?.design_direction || {},
      content_system: parsed?.content_system || {},
      engineering_notes: parsed?.engineering_notes || {},
      generated_at: new Date().toISOString()
    };
    const metadata = { ...(project.metadata && typeof project.metadata === "object" ? project.metadata : {}), blueprint };
    const { error: updateError } = await supabase.from("ai_projects").update({ metadata, updated_at: new Date().toISOString() }).eq("id", projectId).eq("business_id", businessId);
    if (updateError) throw updateError;
    return { blueprint, generated_by: raw ? "ai" : "deterministic-fallback", graph_summary: graph.summary };
  }


  if (toolKey === "website.design.bridge") {
    const projectId = String(input.project_id ?? context.projectId ?? "").trim();
    if (!projectId) throw new Error("project_id is required.");

    const { data: project, error: projectError } = await supabase
      .from("ai_projects")
      .select("id,business_id,name,status")
      .eq("id", projectId)
      .eq("business_id", businessId)
      .neq("status", "deleted")
      .single();
    if (projectError || !project) throw new Error("Project not found.");

    const { data: files, error: filesError } = await supabase
      .from("ai_project_files")
      .select("id,path,content,language,is_binary,version_no")
      .eq("project_id", projectId)
      .order("path");
    if (filesError) throw filesError;

    const bridge = (files ?? []).find((file: any) => String(file.path) === WEBSITE_DESIGN_BRIDGE_PATH);
    const layoutCandidates = [
      "app/layout.tsx",
      "app/layout.ts",
      "app/layout.jsx",
      "app/layout.js",
      "src/app/layout.tsx",
      "src/app/layout.ts",
      "src/app/layout.jsx",
      "src/app/layout.js",
      "pages/_app.tsx",
      "pages/_app.js"
    ];
    const layout = (files ?? []).find((file: any) => layoutCandidates.includes(String(file.path)) && !file.is_binary && typeof file.content === "string");
    if (!layout) throw new Error("No supported application layout file was found. Design Mode needs a known application root to install live selection.");

    const alreadyImported = /BizStackDesignBridge/.test(String(layout.content));
    if (bridge && alreadyImported) return { installed: true, bridge_path: WEBSITE_DESIGN_BRIDGE_PATH, layout_path: layout.path, changed: false };

    await executeTool("project.version.create", { project_id: projectId, message: "Design Mode checkpoint before installing live selection bridge" }, context);

    if (!bridge) {
      const checksum = createHash("sha256").update(WEBSITE_DESIGN_BRIDGE_SOURCE, "utf8").digest("hex");
      const { error: bridgeError } = await supabase.from("ai_project_files").upsert({
        project_id: projectId,
        path: WEBSITE_DESIGN_BRIDGE_PATH,
        content: WEBSITE_DESIGN_BRIDGE_SOURCE,
        content_sha: checksum,
        language: "typescriptreact",
        size_bytes: Buffer.byteLength(WEBSITE_DESIGN_BRIDGE_SOURCE, "utf8"),
        is_binary: false,
        version_no: 1,
        updated_by: userId,
        updated_at: new Date().toISOString()
      }, { onConflict: "project_id,path" });
      if (bridgeError) throw bridgeError;
    }

    const layoutMessages: BizStackModelMessage[] = [
      {
        role: "system",
        content: [
          "Patch a real application root layout to install BizStackDesignBridge.",
          "Return ONLY JSON.",
          "The JSON object must contain a content field with the complete updated source file and a summary field.",
          "Do not return markdown or a diff.",
          "Preserve all existing imports, providers, metadata, structure, data fetching and behavior.",
          "Add the BizStackDesignBridge import and render <BizStackDesignBridge /> inside the root layout.",
          "Use the project's existing import alias when possible; otherwise use a correct relative import.",
          "Do not add dependencies."
        ].join("\n")
      },
      {
        role: "user",
        content: "Layout path: " + String(layout.path) + "\nCurrent layout:\n" + String(layout.content)
      }
    ];

    const result = await runBizStackModel(layoutMessages, []);
    const raw = String(result.message?.content || "").trim();
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch {}
    const updatedLayout = typeof parsed?.content === "string" ? parsed.content : "";
    if (!updatedLayout || !/BizStackDesignBridge/.test(updatedLayout)) {
      throw new Error("The bridge installer could not produce a valid layout patch.");
    }

    const checksum = createHash("sha256").update(updatedLayout, "utf8").digest("hex");
    const { error: layoutError } = await supabase.from("ai_project_files").upsert({
      id: layout.id,
      project_id: projectId,
      path: layout.path,
      content: updatedLayout,
      content_sha: checksum,
      language: layout.language || "typescriptreact",
      size_bytes: Buffer.byteLength(updatedLayout, "utf8"),
      is_binary: false,
      version_no: Number(layout.version_no ?? 0) + 1,
      updated_by: userId,
      updated_at: new Date().toISOString()
    }, { onConflict: "project_id,path" });
    if (layoutError) throw layoutError;

    let verification: Record<string, unknown> | null = null;
    try {
      verification = await executeTool("project.runtime.verify", { project_id: projectId, include_tests: false }, context) as Record<string, unknown>;
    } catch (error) {
      verification = { ok: false, error: error instanceof Error ? error.message : "Verification failed." };
    }

    return { installed: true, changed: true, bridge_path: WEBSITE_DESIGN_BRIDGE_PATH, layout_path: layout.path, verification };
  }

  if (toolKey === "website.design.apply") {
    const projectId = String(input.project_id ?? context.projectId ?? "").trim();
    const instruction = String(input.instruction ?? "").trim();
    let sourcePath = String(input.source_path ?? "").trim().replace(/\\+/g, "/").replace(/^\\+/, "");
    const mode = String(input.mode ?? "style").trim();
    if (!projectId || !instruction) throw new Error("project_id and instruction are required.");

    const { data: project, error: projectError } = await supabase
      .from("ai_projects")
      .select("id,business_id,name,framework,status")
      .eq("id", projectId)
      .eq("business_id", businessId)
      .neq("status", "deleted")
      .single();
    if (projectError || !project) throw new Error("Project not found.");

    const { data: files, error: filesError } = await supabase
      .from("ai_project_files")
      .select("id,path,content,language,is_binary,version_no")
      .eq("project_id", projectId)
      .order("path");
    if (filesError) throw filesError;

    if (!sourcePath) {
      const match = instruction.match(/source(?:\\s+file)?:\\s*([^\\s,;]+\\.(?:tsx|ts|jsx|js|css|scss))/i);
      sourcePath = match?.[1]?.replace(/[.)]+$/, "") || "";
    }
    if (!sourcePath) {
      const pageCandidate = (files ?? []).find((file: any) => /(^|\/)page\.(tsx|ts|jsx|js)$/.test(String(file.path)));
      sourcePath = pageCandidate?.path ? String(pageCandidate.path) : "";
    }

    const current = (files ?? []).find((file: any) => String(file.path) === sourcePath);
    if (!current || current.is_binary || typeof current.content !== "string") throw new Error("A writable source file could not be resolved for Design Mode.");

    const schema = {
      summary: "string",
      content: "complete updated source file as a plain string",
      affected_areas: ["string"],
      verification_focus: ["string"]
    };
    const messages: BizStackModelMessage[] = [
      {
        role: "system",
        content: [
          "You are BizStack Design Mode operating on real source code.",
          "Return ONLY JSON matching this schema: " + JSON.stringify(schema),
          "The content field MUST contain the complete updated source file, not a diff and not markdown.",
          "Preserve all unrelated behavior, imports, data bindings, accessibility, responsive logic and business functionality.",
          "Do not invent APIs, components, dependencies or assets that are not already present.",
          "Make the smallest robust source change that satisfies the design instruction.",
          "The selected file is the authoritative source of truth."
        ].join("\n")
      },
      {
        role: "user",
        content: [
          "Project: " + project.name,
          "Framework: " + (project.framework || "unknown"),
          "Mode: " + mode,
          "Source path: " + sourcePath,
          "Design instruction: " + instruction,
          "Current source:\n" + current.content
        ].join("\n\n")
      }
    ];

    const result = await runBizStackModel(messages, []);
    const raw = String(result.message?.content || "").trim();
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch {
      const unfenced = raw.replace(/^\s*\```(?:json)?/i, "").replace(/\`\`\`\s*$/i, "").trim();
      try { parsed = JSON.parse(unfenced); } catch {}
    }
    const updatedSource = typeof parsed?.content === "string" ? parsed.content : "";
    if (!updatedSource || updatedSource.length > 2_000_000) throw new Error("Design Mode returned an invalid source update.");
    if (updatedSource === current.content) return { applied: false, reason: "No source change was necessary.", source_path: sourcePath, summary: parsed?.summary || "No change." };

    await executeTool("project.version.create", { project_id: projectId, message: "Design Mode checkpoint before " + sourcePath }, context);

    const checksum = createHash("sha256").update(updatedSource, "utf8").digest("hex");
    const { data: saved, error: saveError } = await supabase.from("ai_project_files").upsert({
      id: current.id,
      project_id: projectId,
      path: sourcePath,
      content: updatedSource,
      content_sha: checksum,
      language: current.language || null,
      size_bytes: Buffer.byteLength(updatedSource, "utf8"),
      is_binary: false,
      version_no: Number((current as any).version_no ?? 0) + 1,
      updated_by: userId,
      updated_at: new Date().toISOString()
    }, { onConflict: "project_id,path" }).select("id,path,content_sha,language,size_bytes,version_no,updated_at").single();
    if (saveError) throw saveError;

    let verification: Record<string, unknown> | null = null;
    try {
      verification = await executeTool("project.runtime.verify", { project_id: projectId, include_tests: false }, context) as Record<string, unknown>;
    } catch (error) {
      verification = { ok: false, error: error instanceof Error ? error.message : "Verification failed." };
    }

    return {
      applied: true,
      project_id: projectId,
      source_path: sourcePath,
      summary: String(parsed?.summary || "Design change applied."),
      affected_areas: Array.isArray(parsed?.affected_areas) ? parsed.affected_areas.map(String).slice(0, 20) : [],
      verification_focus: Array.isArray(parsed?.verification_focus) ? parsed.verification_focus.map(String).slice(0, 20) : [],
      file: saved,
      verification
    };
  }

  if (toolKey === "website.build") {
    const prompt = String(input.prompt ?? "").trim();
    if (!prompt) throw new Error("Website instructions are required.");
    return await runWebsiteBuild({
      businessId,
      userId,
      prompt,
      websiteId: input.website_id ? String(input.website_id) : null,
      projectId: input.project_id ? String(input.project_id) : null,
      mode: "auto_execute",
      publish: input.publish === true,
      generateAssets: input.generate_assets !== false
    });
  }

  if (toolKey === "website.assets.list") {
    const limit = Math.min(Math.max(Number(input.limit ?? 30), 1), 50);
    let query = supabase.from("ai_website_assets")
      .select("id,website_id,project_id,kind,name,public_url:storage_path,storage_path,mime_type,width,height,alt_text,model,status,metadata,created_at")
      .eq("business_id", businessId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (input.website_id) query = query.eq("website_id", String(input.website_id));
    if (input.project_id) query = query.eq("project_id", String(input.project_id));
    if (input.kind) query = query.eq("kind", String(input.kind));
    const { data, error } = await query;
    if (error) throw error;
    const assets = (data ?? []).map((asset: any) => {
      const publicUrl = supabase.storage.from("bizstack-website-assets").getPublicUrl(String(asset.storage_path)).data.publicUrl;
      return { ...asset, public_url: publicUrl };
    });
    return { configured: imageGenerationConfigured(), assets };
  }

  if (toolKey === "website.asset.generate") {
    const prompt = String(input.prompt ?? "").trim();
    const kind = String(input.kind ?? "").trim() as WebsiteAssetKind;
    const allowed: WebsiteAssetKind[] = ["logo","hero","section_image","product_scene","background","illustration","og_image","favicon","custom"];
    if (!prompt) throw new Error("A visual generation brief is required.");
    if (!allowed.includes(kind)) throw new Error("Unsupported website visual asset kind.");
    const asset = await generateWebsiteAsset({
      supabase,
      businessId,
      userId,
      websiteId: input.website_id ? String(input.website_id) : null,
      projectId: input.project_id ? String(input.project_id) : context.projectId || null,
      buildRunId: input.build_run_id ? String(input.build_run_id) : null,
      kind,
      name: input.name ? String(input.name) : undefined,
      prompt,
      altText: input.alt_text ? String(input.alt_text) : null,
      visualDirection: input.visual_direction ? String(input.visual_direction) : null,
      referenceContext: input.reference_context ? String(input.reference_context) : null
    });
    return { generated: true, asset };
  }

  if (toolKey === "website.live_data.configure") {
    const websiteId = String(input.website_id ?? "").trim();
    if (!websiteId) throw new Error("Website ID is required.");
    const { data: website, error: websiteError } = await supabase.from("websites").select("id,settings,status").eq("id", websiteId).eq("business_id", businessId).single();
    if (websiteError || !website) throw new Error("Website not found for this business.");
    const allowed = new Set(["business_profile","products","inventory_availability"]);
    const rawSources = Array.isArray(input.sources) ? input.sources : [];
    const sources = rawSources.map((source) => {
      const item = source && typeof source === "object" ? source as Record<string, unknown> : {};
      const key = String(item.key ?? "").trim();
      if (!allowed.has(key)) throw new Error("Unsupported live website data source: " + key);
      const fields = Array.isArray(item.fields) ? item.fields.map(String) : [];
      return { key, fields: fields.slice(0, 30), refresh: String(item.refresh ?? "near_realtime") };
    });
    const enabled = input.enabled !== false;
    for (const source of sources) {
      const { error: bindingError } = await supabase.from("website_business_bindings").upsert({
        business_id: businessId,
        website_id: websiteId,
        source_key: source.key,
        enabled,
        exposure: "public",
        fields: source.fields,
        sync_mode: source.refresh === "cached" ? "cached" : "near_realtime",
        updated_at: new Date().toISOString()
      }, { onConflict: "website_id,source_key" });
      if (bindingError) throw bindingError;
    }
    const selectedKeys = sources.map((source) => source.key);
    if (selectedKeys.length) {
      await supabase.from("website_business_bindings")
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq("website_id", websiteId)
        .eq("business_id", businessId)
        .not("source_key", "in", "(" + selectedKeys.join(",") + ")");
    }
    await supabase.from("events").insert({ business_id: businessId, event_type: "website.live_data_configured", summary: "Configured governed live business data for website.", evidence: { website_id: websiteId, sources }, status: "auto_handled", priority: "normal", category: "website" });
    return { websiteId, enabled, sources, privacy: "Only allowlisted public business data is exposed. Private invoices, financial balances and customer records stay inside BizStack/customer portals." };
  }

  if (toolKey === "events.create") {
    const summary = String(input.summary ?? "").trim();
    if (!summary) throw new Error("Event summary is required.");
    const { data, error } = await supabase.from("events").insert({
      business_id: businessId,
      event_type: String(input.event_type ?? "agent.action"),
      summary,
      evidence: { source: "bizstack_operator", requested_by: context.userId },
      status: String(input.status ?? "info"),
      priority: String(input.priority ?? "normal"),
      category: String(input.category ?? "agent"),
      action_type: input.action_type ? String(input.action_type) : null
    }).select("id,event_type,summary,status,priority,category,action_type,created_at").single();
    if (error) throw error;
    return data ?? {};
  }

  if (toolKey === "projects.list") {
    const { data, error } = await supabase
      .from("ai_projects")
      .select("id,name,slug,project_type,status,default_branch,framework,runtime,repository_name,preview_url,production_url,metadata,created_at,updated_at")
      .eq("business_id", businessId)
      .neq("status", "deleted")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return { projects: data ?? [] };
  }

  if (toolKey === "projects.create") {
    const name = String(input.name ?? "").trim();
    const slug = String(input.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")).toLowerCase();
    if (!name || !slug) throw new Error("Project name and slug are required.");
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) throw new Error("Project slug must use lowercase letters, numbers, and hyphens.");
    const { data: existing } = await supabase
      .from("ai_projects")
      .select("id,name,slug")
      .eq("business_id", businessId)
      .eq("slug", slug)
      .maybeSingle();
    if (existing) return { created: false, project: existing, reason: "already_exists" };

    const { data: project, error } = await supabase.from("ai_projects").insert({
      business_id: businessId,
      name,
      slug,
      project_type: String(input.project_type ?? "app"),
      framework: input.framework ? String(input.framework) : null,
      runtime: input.runtime ? String(input.runtime) : null,
      created_by: userId
    }).select("id,name,slug,project_type,status,default_branch,framework,runtime,metadata,created_at,updated_at").single();
    if (error) throw error;

    const requestedFiles = Array.isArray(input.files) ? input.files : [];
    const written: Array<Record<string, unknown>> = [];
    for (const raw of requestedFiles.slice(0, 100)) {
      const row = raw as Record<string, unknown>;
      const path = String(row.path ?? "").trim().replace(/\\+/g, "/").replace(/^\\+/, "");
      const source = String(row.content ?? "");
      if (!path || path.includes("..") || path.length > 500) throw new Error("Invalid project file path: " + path);
      if (source.length > 2_000_000) throw new Error("Project file is too large: " + path);
      const checksum = createHash("sha256").update(source, "utf8").digest("hex");
      const { data: saved, error: saveError } = await supabase.from("ai_project_files").insert({
        project_id: project.id,
        path,
        content: source,
        content_sha: checksum,
        language: row.language ? String(row.language) : null,
        size_bytes: Buffer.byteLength(source, "utf8"),
        version_no: 1,
        updated_by: userId
      }).select("id,path,content_sha,language,size_bytes,version_no").single();
      if (saveError) throw saveError;
      written.push(saved);
    }

    const { data: snapshotFiles, error: snapshotError } = await supabase
      .from("ai_project_files")
      .select("path,content,content_sha,language,size_bytes,is_binary,version_no")
      .eq("project_id", project.id)
      .order("path", { ascending: true });
    if (snapshotError) throw snapshotError;

    const { data: version, error: versionError } = await supabase.from("ai_project_versions").insert({
      project_id: project.id,
      version_no: 1,
      message: "Initial project snapshot",
      snapshot: { format: "bizstack-project-snapshot/v1", files: snapshotFiles ?? [], captured_at: new Date().toISOString() },
      created_by: userId
    }).select("id,version_no,message,created_at").single();
    if (versionError) throw versionError;

    return { created: true, project, files: written, initial_version: version };
  }

  if (toolKey === "project.files.list") {
    const projectId = String(input.project_id ?? "").trim();
    if (!projectId) throw new Error("project_id is required.");
    const { data: project, error: projectError } = await supabase.from("ai_projects").select("id,name,slug,status").eq("id", projectId).single();
    if (projectError || !project || project.status === "deleted") throw new Error("Project not found.");
    const { data, error } = await supabase.from("ai_project_files").select("id,path,content,content_sha,language,size_bytes,is_binary,version_no,updated_at").eq("project_id", projectId).order("path", { ascending: true });
    if (error) throw error;
    return { project, files: data ?? [] };
  }

  if (toolKey === "project.files.write") {
    const projectId = String(input.project_id ?? "").trim();
    const path = String(input.path ?? "").trim().replace(/\\+/g, "/").replace(/^\\+/, "");
    const source = String(input.content ?? "");
    if (!projectId || !path || path.includes("..") || path.length > 500) throw new Error("Invalid project file input.");
    if (source.length > 2_000_000) throw new Error("Project file is too large.");
    const { data: project, error: projectError } = await supabase.from("ai_projects").select("id,status").eq("id", projectId).single();
    if (projectError || !project || project.status === "deleted") throw new Error("Project not found.");
    const { data: current } = await supabase.from("ai_project_files").select("id,version_no").eq("project_id", projectId).eq("path", path).maybeSingle();
    const checksum = createHash("sha256").update(source, "utf8").digest("hex");
    const { data, error } = await supabase.from("ai_project_files").upsert({
      id: current?.id,
      project_id: projectId,
      path,
      content: source,
      content_sha: checksum,
      language: input.language ? String(input.language) : null,
      size_bytes: Buffer.byteLength(source, "utf8"),
      is_binary: false,
      version_no: Number(current?.version_no ?? 0) + 1,
      updated_by: userId,
      updated_at: new Date().toISOString()
    }, { onConflict: "project_id,path" }).select("id,path,content_sha,language,size_bytes,version_no,updated_at").single();
    if (error) throw error;
    return { saved: true, file: data };
  }

  if (toolKey === "projects.deployments.list") {
    const projectId = String(input.project_id ?? "").trim();
    if (!projectId) throw new Error("project_id is required.");
    const rawLimit = Number(input.limit ?? 10);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 10, 1), 20);
    const { data: project, error: projectError } = await supabase.from("ai_projects")
      .select("id,name,slug,status")
      .eq("id", projectId)
      .eq("business_id", businessId)
      .single();
    if (projectError || !project || project.status === "deleted") throw new Error("Project not found.");
    const { data, error } = await supabase.from("ai_deployments")
      .select("id,project_id,version_id,provider,environment,status,provider_deployment_id,deployment_url,git_ref,git_commit_sha,error_summary,build_logs,requested_by,started_at,finished_at,created_at,updated_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return { project, deployments: data ?? [] };
  }

  if (toolKey === "project.repairs.list") {
    const projectId = String(input.project_id ?? "").trim();
    if (!projectId) throw new Error("project_id is required.");
    const rawLimit = Number(input.limit ?? 10);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 10, 1), 20);
    const { data: project, error: projectError } = await supabase.from("ai_projects")
      .select("id,name,slug,status")
      .eq("id", projectId)
      .eq("business_id", businessId)
      .single();
    if (projectError || !project || project.status === "deleted") throw new Error("Project not found.");
    const { data, error } = await supabase.from("ai_repair_runs")
      .select("id,project_id,deployment_id,source_run_id,status,failure_class,diagnosis,repair_plan,applied_changes,verification,attempt_no,created_by,created_at,updated_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return { project, repairs: data ?? [] };
  }

  if (toolKey === "project.runtime.verify") {
    const projectId = String(input.project_id ?? "").trim();
    if (!projectId) throw new Error("project_id is required.");
    if (!sandboxConfigured()) throw new Error("Project runtime is not configured.");

    const { data: project, error: projectError } = await supabase.from("ai_projects")
      .select("id,name,status,framework,runtime")
      .eq("id", projectId)
      .eq("business_id", businessId)
      .single();
    if (projectError || !project || project.status === "deleted") throw new Error("Project not found.");

    const { data: files, error: filesError } = await supabase.from("ai_project_files")
      .select("path,content,is_binary")
      .eq("project_id", projectId)
      .order("path", { ascending: true });
    if (filesError) throw filesError;

    const sourceFiles = (files ?? [])
      .filter((row: any) => !row.is_binary && typeof row.content === "string")
      .map((row: any) => ({ path: String(row.path), content: String(row.content) }));
    const sandbox = await syncFiles(projectId, sourceFiles);

    const packageFile = sourceFiles.find((file) => file.path === "package.json");
    let packageJson: any = null;
    if (packageFile) {
      try { packageJson = JSON.parse(packageFile.content); } catch { throw new Error("package.json is not valid JSON."); }
    }
    if (!packageJson?.scripts?.build) throw new Error("Project does not expose a package build script.");

    const has = (name: string) => typeof packageJson?.scripts?.[name] === "string";
    const results: Array<Record<string, unknown>> = [];

    const installCommand: [string, string[]] =
      sourceFiles.some((file) => file.path === "package-lock.json") ? ["npm", ["ci"]] :
      sourceFiles.some((file) => file.path === "pnpm-lock.yaml") ? ["pnpm", ["install", "--frozen-lockfile"]] :
      sourceFiles.some((file) => file.path === "yarn.lock") ? ["yarn", ["install", "--frozen-lockfile"]] :
      ["npm", ["install", "--no-audit", "--no-fund"]];

    const runCheck = async (name: string, cmd: string, args: string[]) => {
      const result = await runSandboxCommand(projectId, cmd, args, "/workspace", false);
      const row = { name, command: [cmd, ...args].join(" "), exit_code: result.exitCode, stdout: result.stdout.slice(-20000), stderr: result.stderr.slice(-20000) };
      results.push(row);
      return result.exitCode === 0;
    };

    const installed = await runCheck("install", installCommand[0], installCommand[1]);
    if (!installed) {
      await supabase.from("ai_project_events").insert({
        project_id: projectId,
        event_type: "verification.failed",
        sequence_no: Date.now() % 2147483647,
        payload: { sandbox: sandbox.name, results }
      });
      return { ok: false, project, sandbox: sandbox.name, results, failed_step: "install" };
    }

    const built = await runCheck("build", "npm", ["run", "build"]);
    if (!built) {
      await supabase.from("ai_project_events").insert({
        project_id: projectId,
        event_type: "verification.failed",
        sequence_no: Date.now() % 2147483647,
        payload: { sandbox: sandbox.name, results }
      });
      return { ok: false, project, sandbox: sandbox.name, results, failed_step: "build" };
    }

    if (has("lint")) await runCheck("lint", "npm", ["run", "lint"]);
    const includeTests = input.include_tests !== false;
    if (includeTests && has("test")) await runCheck("test", "npm", ["test"]);

    const ok = results.every((row: any) => Number(row.exit_code) === 0);
    await supabase.from("ai_project_events").insert({
      project_id: projectId,
      event_type: ok ? "verification.succeeded" : "verification.failed",
      sequence_no: Date.now() % 2147483647,
      payload: { sandbox: sandbox.name, results }
    });
    return { ok, project, sandbox: sandbox.name, results };
  }

  if (toolKey === "project.repair.execute") {
    const repairId = String(input.repair_id ?? "").trim();
    const projectId = String(input.project_id ?? "").trim();
    if (!repairId || !projectId) throw new Error("repair_id and project_id are required.");

    const { data: repair, error: repairError } = await supabase
      .from("ai_repair_runs")
      .select("id,project_id,status")
      .eq("id", repairId)
      .eq("project_id", projectId)
      .single();
    if (repairError || !repair) throw new Error("Repair run not found.");
    if (!["queued","planned","awaiting_approval"].includes(String(repair.status))) {
      throw new Error("Repair run is not ready for execution.");
    }

    const result = await executeRepair(repairId, userId);
    await supabase.from("ai_project_events").insert({
      project_id: projectId,
      event_type: result.ok ? "repair.verified" : "repair.failed",
      sequence_no: Date.now() % 2147483647,
      payload: { repair_id: repairId, result }
    });
    return result;
  }

  if (toolKey === "project.versions.diff") {
    const projectId = String(input.project_id ?? "").trim();
    if (!projectId) throw new Error("project_id is required.");
    const { data: project, error: projectError } = await supabase.from("ai_projects").select("id,name,status").eq("id", projectId).eq("business_id", businessId).single();
    if (projectError || !project || project.status === "deleted") throw new Error("Project not found.");
    const fromNo = Number(input.from_version ?? 0);
    const toNo = Number(input.to_version ?? 0);
    const { data: versions, error } = await supabase.from("ai_project_versions").select("version_no,snapshot").eq("project_id", projectId).order("version_no", { ascending: true });
    if (error) throw error;
    const list = versions ?? [];
    const from = fromNo ? list.find((v) => Number(v.version_no) === fromNo) : list.at(-2);
    const to = toNo ? list.find((v) => Number(v.version_no) === toNo) : list.at(-1);
    if (!to) throw new Error("Target project version was not found.");
    const map = (snapshot: any) => new Map((Array.isArray(snapshot?.files) ? snapshot.files : []).map((f: any) => [String(f.path), String(f.content ?? "")]));
    const before = map(from?.snapshot);
    const after = map(to.snapshot);
    const paths = Array.from(new Set([...before.keys(), ...after.keys()])).sort();
    const changes = paths.map((path) => {
      const a = before.get(path); const b = after.get(path);
      return { path, status: a === undefined ? "added" : b === undefined ? "removed" : a === b ? "unchanged" : "changed", before: a ?? null, after: b ?? null };
    }).filter((x) => x.status !== "unchanged");
    return { project, from_version: from?.version_no ?? null, to_version: to.version_no, changed_files: changes.length, changes };
  }

  if (toolKey === "project.runtime.run") {
    const projectId = String(input.project_id ?? "").trim();
    const cmd = String(input.cmd ?? "").trim();
    const args = Array.isArray(input.args) ? input.args.map(String) : [];
    if (!projectId || !cmd) throw new Error("project_id and cmd are required.");
    if (!sandboxConfigured()) throw new Error("Project runtime is not configured.");
    const { data: project, error: projectError } = await supabase.from("ai_projects").select("id,name,status").eq("id", projectId).eq("business_id", businessId).single();
    if (projectError || !project || project.status === "deleted") throw new Error("Project not found.");
    const { data: files, error: filesError } = await supabase.from("ai_project_files").select("path,content,is_binary").eq("project_id", projectId).order("path");
    if (filesError) throw filesError;
    const sourceFiles = (files ?? []).filter((row) => !row.is_binary && typeof row.content === "string").map((row) => ({ path: String(row.path), content: String(row.content) }));
    const sandbox = await syncFiles(projectId, sourceFiles);
    const result = await runSandboxCommand(projectId, cmd, args, "/workspace", false);
    await supabase.from("ai_project_events").insert({ project_id: projectId, event_type: "agent.runtime", sequence_no: Date.now(), payload: { command: [cmd, ...args].join(" "), exit_code: result.exitCode, stdout: result.stdout.slice(0, 20000), stderr: result.stderr.slice(0, 20000), sandbox_name: sandbox.name } });
    return { project: { id: project.id, name: project.name }, sandbox: sandbox.name, command: [cmd, ...args].join(" "), exit_code: result.exitCode, stdout: result.stdout.slice(0, 50000), stderr: result.stderr.slice(0, 50000) };
  }

  if (toolKey === "project.version.create") {
    const projectId = String(input.project_id ?? "").trim();
    if (!projectId) throw new Error("project_id is required.");
    const { data: project, error: projectError } = await supabase.from("ai_projects").select("id,name,slug,status").eq("id", projectId).single();
    if (projectError || !project || project.status === "deleted") throw new Error("Project not found.");
    const [{ data: files, error: filesError }, { data: latest, error: latestError }] = await Promise.all([
      supabase.from("ai_project_files").select("path,content,content_sha,language,size_bytes,version_no").eq("project_id", projectId).order("path", { ascending: true }),
      supabase.from("ai_project_versions").select("version_no").eq("project_id", projectId).order("version_no", { ascending: false }).limit(1).maybeSingle()
    ]);
    if (filesError) throw filesError;
    if (latestError) throw latestError;
    const versionNo = Number(latest?.version_no ?? 0) + 1;
    const { data: version, error } = await supabase.from("ai_project_versions").insert({
      project_id: projectId,
      version_no: versionNo,
      message: String(input.message ?? "Operator snapshot").slice(0, 500),
      snapshot: { format: "bizstack-project-snapshot/v1", project, files: files ?? [], captured_at: new Date().toISOString() },
      created_by: userId
    }).select("id,project_id,version_no,message,created_at").single();
    if (error) throw error;
    return { snapshot_created: true, version };
  }

    throw new Error(`Unknown tool: ${toolKey}`);
}