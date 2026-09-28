import { createClient } from "@/lib/supabase-server";
import { runWebsiteBuild } from "@/lib/ai/build-engine/runtime";
import { runInvoiceBuild } from "@/lib/ai/build-engine/invoice-runtime";
import { runProductInventoryBuild } from "@/lib/ai/build-engine/operations-runtime";

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
  { toolKey: "website.build", name: "Build Website", riskLevel: "medium", permission: "build_websites", description: "Create or modify a real BizStack website from a natural-language request.", inputSchema: { type: "object", properties: { prompt: { type: "string" }, website_id: { type: "string" } }, required: ["prompt"] } },
  { toolKey: "events.create", name: "Create Business Event", riskLevel: "low", permission: "draft_actions", description: "Record an auditable internal action, recommendation or handoff.", inputSchema: { type: "object", properties: { event_type: { type: "string" }, summary: { type: "string" }, category: { type: "string" }, priority: { type: "string" }, action_type: { type: "string" } }, required: ["summary"] } }
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
  if (/(record this|log this|create an action|create a task|note this|add to timeline)/.test(text)) {
    plan.push({ toolKey: "events.create", input: { event_type: "agent.requested_action", summary: input.trim(), category: "agent", priority: "normal", action_type: "agent_followup" } });
  }
  return plan;
}

export type RuntimeContext = {
  supabase: ReturnType<typeof createClient>;
  businessId: string;
  userId: string;
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

  if (toolKey === "website.build") {
    const prompt = String(input.prompt ?? "").trim();
    if (!prompt) throw new Error("Website instructions are required.");
    return await runWebsiteBuild({ businessId, userId, prompt, websiteId: input.website_id ? String(input.website_id) : null, mode: "auto_execute", publish: false });
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

  throw new Error(`Unknown tool: ${toolKey}`);
}
