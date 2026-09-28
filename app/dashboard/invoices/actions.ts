"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { logEvent } from "@/lib/events";
import { calculateInvoiceTotal } from "@/lib/invoices";

export type InvoiceLineInput = {
  description: string;
  quantity: number;
  unit_price: number;
};

export type CreateInvoiceInput = {
  customerId: string;
  dueDate: string | null;
  currency: string;
  items: InvoiceLineInput[];
};

export type CreateInvoiceResult = {
  invoiceId: string;
};

type InvoiceActionRow = {
  id: string;
  invoice_number: string;
  status: string;
  currency: string;
  customer_id: string | null;
};

type CustomerActionRow = {
  id: string;
  name: string;
};

async function getBusinessContext() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!business) {
    redirect("/onboarding");
  }

  return { supabase, business };
}

async function loadInvoiceForAction(
  supabase: ReturnType<typeof createClient>,
  businessId: string,
  invoiceId: string
) {
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, currency, customer_id")
    .eq("id", invoiceId)
    .eq("business_id", businessId)
    .single();

  if (invoiceError || !invoice) {
    throw new Error("Invoice not found.");
  }

  const { data: items, error: itemsError } = await supabase
    .from("invoice_items")
    .select("quantity, unit_price")
    .eq("invoice_id", invoiceId);

  if (itemsError) {
    throw new Error("Unable to load invoice items: " + itemsError.message);
  }

  let customer: CustomerActionRow | null = null;
  if (invoice.customer_id) {
    const { data: customerRow } = await supabase
      .from("customers")
      .select("id, name")
      .eq("id", invoice.customer_id)
      .eq("business_id", businessId)
      .maybeSingle();
    customer = customerRow as CustomerActionRow | null;
  }

  return {
    invoice: invoice as InvoiceActionRow,
    customer,
    items: (items ?? []) as { quantity: number; unit_price: number }[]
  };
}

export async function createInvoice(
  input: CreateInvoiceInput
): Promise<CreateInvoiceResult> {
  const { supabase, business } = await getBusinessContext();
  const customerId = String(input.customerId ?? "");
  const currency = String(input.currency ?? "USD").trim() || "USD";
  const dueDate = input.dueDate ? String(input.dueDate) : null;
  const items = (Array.isArray(input.items) ? input.items : []).map((item) => ({
    description: String(item.description ?? "").trim(),
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price)
  }));

  if (!customerId) {
    throw new Error("Choose a customer before creating the invoice.");
  }

  if (
    items.length === 0 ||
    items.some(
      (item) =>
        !item.description ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isFinite(item.unit_price) ||
        item.unit_price < 0
    )
  ) {
    throw new Error("Add at least one valid invoice line.");
  }

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, name")
    .eq("id", customerId)
    .eq("business_id", business.id)
    .single();

  if (customerError || !customer) {
    throw new Error("That customer could not be found for this business.");
  }

  const { data: invoiceNumber, error: numberError } = await supabase.rpc("next_invoice_number", {
    p_business_id: business.id
  });

  if (numberError || !invoiceNumber) {
    throw new Error("Unable to number this invoice: " + (numberError?.message ?? "Unknown error"));
  }
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      business_id: business.id,
      customer_id: customer.id,
      invoice_number: invoiceNumber,
      status: "draft",
      due_date: dueDate,
      currency
    })
    .select("id, invoice_number")
    .single();

  if (invoiceError || !invoice) {
    throw new Error("Unable to create invoice: " + (invoiceError?.message ?? "Unknown error"));
  }

  const { error: itemsError } = await supabase.from("invoice_items").insert(
    items.map((item) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price
    }))
  );

  if (itemsError) {
    await supabase.from("invoices").delete().eq("id", invoice.id).eq("business_id", business.id);
    throw new Error("Unable to save invoice lines: " + itemsError.message);
  }

  const { data: calculatedInvoice, error: calculationError } = await supabase.rpc(
    "recalculate_invoice_totals",
    { p_invoice_id: invoice.id }
  );
  if (calculationError || !calculatedInvoice) {
    await supabase.from("invoices").delete().eq("id", invoice.id).eq("business_id", business.id);
    throw new Error("Unable to calculate invoice totals: " + (calculationError?.message ?? "Unknown error"));
  }

  const total = Number(calculatedInvoice.total ?? calculateInvoiceTotal(items));
  await logEvent(
    business.id,
    "invoice.created",
    "Invoice " + invoice.invoice_number + " created for " + customer.name + " — " + total + " " + currency,
    {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      customer_id: customer.id,
      total,
      currency
    },
    "info"
  );

  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/actions");
  return { invoiceId: invoice.id };
}

export async function markInvoiceSent(invoiceId: string) {
  const { supabase, business } = await getBusinessContext();
  const { invoice, customer, items } = await loadInvoiceForAction(
    supabase,
    business.id,
    invoiceId
  );

  if (invoice.status !== "draft") {
    return;
  }

  const { error } = await supabase
    .from("invoices")
    .update({ status: "sent" })
    .eq("id", invoiceId)
    .eq("business_id", business.id);

  if (error) {
    throw new Error("Unable to mark invoice as sent: " + error.message);
  }

  const total = calculateInvoiceTotal(items);
  await logEvent(
    business.id,
    "invoice.sent",
    "Invoice " + invoice.invoice_number + " sent to " + (customer?.name ?? "customer"),
    {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      customer_id: invoice.customer_id,
      total,
      currency: invoice.currency
    },
    "info"
  );

  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/invoices/" + invoiceId);
  revalidatePath("/dashboard/actions");
}

export async function markInvoicePaid(invoiceId: string) {
  const { supabase, business } = await getBusinessContext();
  const { invoice, customer, items } = await loadInvoiceForAction(
    supabase,
    business.id,
    invoiceId
  );

  if (invoice.status !== "sent" && invoice.status !== "overdue") {
    return;
  }

  const remaining = Math.max(0, Number((Number(invoice.status === "paid" ? 0 : 0))));
  const currentTotal = calculateInvoiceTotal(items);
  const { error } = await supabase.rpc("record_invoice_payment", {
    p_invoice_id: invoiceId,
    p_amount: Math.max(0, currentTotal),
    p_method: "manual",
    p_reference: "Marked paid from invoice action",
    p_payment_date: new Date().toISOString()
  });

  if (error) {
    throw new Error("Unable to record invoice payment: " + error.message);
  }

  const total = currentTotal;
  await logEvent(
    business.id,
    "invoice.paid",
    total + " " + invoice.currency + " received from " + (customer?.name ?? "customer") + " for invoice " + invoice.invoice_number,
    {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      customer_id: invoice.customer_id,
      total,
      currency: invoice.currency,
      paid_at: new Date().toISOString()
    },
    "info"
  );

  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/invoices/" + invoiceId);
  revalidatePath("/dashboard/actions");
}
