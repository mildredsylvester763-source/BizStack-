import { createClient } from "@/lib/supabase-server";

export type ToolDefinition = {
  toolKey: string;
  name: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  permission: string;
  description: string;
};

export const TOOL_REGISTRY: ToolDefinition[] = [
  {
    toolKey: "business.get_context",
    name: "Business Context",
    riskLevel: "low",
    permission: "read_business_context",
    description: "Read the business profile and operating settings."
  },
  {
    toolKey: "customers.list",
    name: "Customer Directory",
    riskLevel: "low",
    permission: "read_customers",
    description: "Read customers for segmentation, service and follow-up decisions."
  },
  {
    toolKey: "invoices.list_outstanding",
    name: "Outstanding Invoices",
    riskLevel: "low",
    permission: "read_invoices",
    description: "Read open invoices, amounts and due dates."
  },
  {
    toolKey: "inventory.list_low_stock",
    name: "Low Stock Watch",
    riskLevel: "low",
    permission: "read_inventory",
    description: "Read products below their configured stock threshold."
  },
  {
    toolKey: "money.summary",
    name: "Money Summary",
    riskLevel: "low",
    permission: "read_money",
    description: "Read receivables and recent financial activity for planning."
  },
  {
    toolKey: "events.create",
    name: "Create Business Event",
    riskLevel: "low",
    permission: "draft_actions",
    description: "Record an auditable internal action, recommendation or handoff."
  }
];

export function getToolDefinition(toolKey: string) {
  return TOOL_REGISTRY.find((tool) => tool.toolKey === toolKey) ?? null;
}

export function buildPlan(input: string): { toolKey: string; input: Record<string, unknown> }[] {
  const text = input.trim().toLowerCase();
  const plan: { toolKey: string; input: Record<string, unknown> }[] = [
    { toolKey: "business.get_context", input: {} }
  ];

  if (/(customer|client|buyer|churn|follow.?up|contact)/.test(text)) {
    plan.push({ toolKey: "customers.list", input: { limit: 50 } });
  }
  if (/(invoice|receivable|receivables|overdue|owe|debt|payment)/.test(text)) {
    plan.push({ toolKey: "invoices.list_outstanding", input: {} });
  }
  if (/(stock|inventory|reorder|product|warehouse|fulfil)/.test(text)) {
    plan.push({ toolKey: "inventory.list_low_stock", input: {} });
  }
  if (/(money|cash|revenue|expense|profit|financial|finance|balance)/.test(text)) {
    plan.push({ toolKey: "money.summary", input: {} });
  }
  if (/(record this|log this|create an action|create a task|note this|add to timeline)/.test(text)) {
    plan.push({
      toolKey: "events.create",
      input: {
        event_type: "agent.requested_action",
        summary: input.trim(),
        category: "agent",
        priority: "normal",
        action_type: "agent_followup"
      }
    });
  }

  return plan;
}

export type RuntimeContext = {
  supabase: ReturnType<typeof createClient>;
  businessId: string;
  userId: string;
};

export async function executeTool(
  toolKey: string,
  input: Record<string, unknown>,
  context: RuntimeContext
): Promise<Record<string, unknown> | Record<string, unknown>[]> {
  const { supabase, businessId } = context;

  if (toolKey === "business.get_context") {
    const [{ data: business }, { data: settings }] = await Promise.all([
      supabase
        .from("businesses")
        .select("id,name,industry,currency,address,contact_email,contact_phone")
        .eq("id", businessId)
        .single(),
      supabase
        .from("business_settings")
        .select("tax_mode,default_tax_rate,default_tax_name,tax_registration_number,tax_jurisdiction,tax_inclusive,invoice_settings,module_settings,sync_settings")
        .eq("business_id", businessId)
        .maybeSingle()
    ]);
    return { business: business ?? null, settings: settings ?? null };
  }

  if (toolKey === "customers.list") {
    const rawLimit = Number(input.limit ?? 50);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 100);
    const { data, error } = await supabase
      .from("customers")
      .select("id,name,company_name,email,phone,status,customer_type,country,preferred_channel,last_contact_at,created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  if (toolKey === "invoices.list_outstanding") {
    const { data, error } = await supabase
      .from("invoices")
      .select("id,invoice_number,customer_id,status,due_date,currency,subtotal,total,paid_amount,created_at,customers(name,company_name)")
      .eq("business_id", businessId)
      .in("status", ["sent", "partially_paid", "overdue"])
      .order("due_date", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  if (toolKey === "inventory.list_low_stock") {
    const { data, error } = await supabase
      .from("products")
      .select("id,name,sku,unit,stock_quantity,low_stock_threshold,unit_price,cost_price,is_active")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("stock_quantity", { ascending: true });
    if (error) throw error;
    return (data ?? []).filter((product) => Number(product.stock_quantity ?? 0) <= Number(product.low_stock_threshold ?? 0));
  }

  if (toolKey === "money.summary") {
    const [{ data: invoices }, { data: payments }] = await Promise.all([
      supabase
        .from("invoices")
        .select("id,status,total,paid_amount,due_date,currency")
        .eq("business_id", businessId),
      supabase
        .from("invoice_payments")
        .select("id,invoice_id,amount,payment_date,method,reference")
        .eq("business_id", businessId)
        .order("payment_date", { ascending: false })
        .limit(100)
    ]);

    const rows = invoices ?? [];
    const outstanding = rows
      .filter((row) => ["sent", "partially_paid", "overdue"].includes(String(row.status)))
      .reduce((sum, row) => sum + Math.max(0, Number(row.total ?? 0) - Number(row.paid_amount ?? 0)), 0);
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

  if (toolKey === "events.create") {
    const summary = String(input.summary ?? "").trim();
    const eventType = String(input.event_type ?? "agent.action");
    if (!summary) throw new Error("Event summary is required.");

    const { data, error } = await supabase
      .from("events")
      .insert({
        business_id: businessId,
        event_type: eventType,
        summary,
        evidence: { source: "ai_agent", requested_by: context.userId },
        status: String(input.status ?? "info"),
        priority: String(input.priority ?? "normal"),
        category: String(input.category ?? "agent"),
        action_type: input.action_type ? String(input.action_type) : null
      })
      .select("id,event_type,summary,status,priority,category,action_type,created_at")
      .single();
    if (error) throw error;
    return data ?? {};
  }

  throw new Error(`Unknown tool: ${toolKey}`);
}
