export type ProductDraft = {
  name: string;
  sku?: string | null;
  description?: string | null;
  unit: string;
  unitPrice: number;
  costPrice?: number | null;
  stockQuantity: number;
  lowStockThreshold: number;
};

export type MoneyDraft = {
  direction: "inflow" | "outflow";
  amount: number;
  currency: string;
  description: string;
  counterpartyName?: string | null;
  accountName?: string | null;
  occurredAt: string;
  fxRate?: number | null;
};

function parseNumber(raw: string) {
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function parseProductRequest(prompt: string, _currency: string): ProductDraft {
  const text = prompt.trim();
  const nameMatch = text.match(
    /(?:create|add|make)\s+(?:a\s+)?(?:new\s+)?product\s*(?:called|named)?\s*[:\-]?\s*([^,;]+?)(?=\s+(?:sku|price|at|cost|stock|quantity|low stock|description)\b|[,;]|$)/i
  );
  const name = (nameMatch?.[1] || "").trim().replace(/\s+/g, " ");
  if (!name) {
    throw new Error("Could not identify the product name. Example: “create product Premium Hoodie, price 25000, stock 20”.");
  }

  const priceMatch = text.match(
    /(?:unit\s+price|price|sell(?:ing)?\s+price|at)\s*(?:is|of|=)?\s*[₦$€£]?\s*([\d,]+(?:\.\d+)?)/i
  );
  const costMatch = text.match(
    /(?:cost|buy(?:ing)?\s+cost)\s*(?:is|of|=)?\s*[₦$€£]?\s*([\d,]+(?:\.\d+)?)/i
  );
  const stockMatch = text.match(
    /(?:opening\s+stock|initial\s+stock|stock|quantity)\s*(?:is|of|=|:)?\s*([\d,]+(?:\.\d+)?)/i
  );
  const lowMatch = text.match(
    /(?:low\s*stock(?:\s+threshold)?|reorder\s+level)\s*(?:is|of|=|:)?\s*([\d,]+(?:\.\d+)?)/i
  );
  const sku = text.match(/(?:sku|product\s*code)\s*[:#-]?\s*([A-Za-z0-9._-]+)/i)?.[1] || null;
  const description = text.match(/description\s*[:\-]\s*([^;]+)/i)?.[1]?.trim() || null;
  const unit = text.match(/(?:per|unit)\s*[:\-]?\s*(item|unit|kg|g|litre|liter|box|pack|hour|day)/i)?.[1] || "unit";

  const unitPrice = priceMatch ? parseNumber(priceMatch[1]) : null;
  if (unitPrice === null || unitPrice < 0) {
    throw new Error("Product price is missing. Example: “price 25000”.");
  }

  const stockQuantity = stockMatch ? (parseNumber(stockMatch[1]) ?? 0) : 0;
  const lowStockThreshold = lowMatch ? (parseNumber(lowMatch[1]) ?? 5) : 5;
  const costPrice = costMatch ? parseNumber(costMatch[1]) : null;

  if (stockQuantity < 0 || lowStockThreshold < 0) {
    throw new Error("Stock values cannot be negative.");
  }

  return { name, sku, description, unit, unitPrice, costPrice, stockQuantity, lowStockThreshold };
}

export function parseMoneyRequest(prompt: string, currency: string): MoneyDraft {
  const text = prompt.trim();

  const amountMatch = text.match(
    /[₦$€£]?\s*([\d,]+(?:\.\d+)?)\s*(?:ngn|usd|gbp|eur|cad|aud|kes|ghs|zar|inr|aed)?/i
  );
  const amount = amountMatch ? parseNumber(amountMatch[1]) : null;
  if (amount === null || amount <= 0) {
    throw new Error("A positive money amount is required.");
  }

  const currencyCode =
    text.match(/\b(NGN|USD|GBP|EUR|CAD|AUD|KES|GHS|ZAR|INR|AED)\b/i)?.[1]?.toUpperCase() || null;
  const symbolCurrency =
    text.includes("₦") ? "NGN" :
    text.includes("£") ? "GBP" :
    text.includes("€") ? "EUR" :
    text.includes("$") ? "USD" :
    null;
  const transactionCurrency = currencyCode || symbolCurrency || currency;

  const fxMatch = text.match(/(?:fx\s*rate|exchange\s*rate|rate)\s*(?:of|is|=|at|:)\s*([\d,.]+)/i);
  const fxRate = fxMatch ? parseNumber(fxMatch[1]) : null;

  const outflow = /(expense|spent|spend|paid|payment|purchase|bought|fuel|rent|salary|wage|cost|fee|withdraw)/i.test(text);
  const inflow = /(income|sale|sold|received|revenue|deposit|customer paid|payment received|cash sale)/i.test(text);

  if (!outflow && !inflow) {
    throw new Error("Tell BizStack whether the money came in or went out. Example: “record an expense of 50000 for fuel”.");
  }

  const direction: MoneyDraft["direction"] = outflow ? "outflow" : "inflow";

  const accountRaw =
    text.match(
      /(?:from|using|through|into)\s+(?:my\s+)?(?:account\s+)?([A-Za-z0-9&.' -]{2,60}?)(?=\s+(?:for|on|today|yesterday|at\s+|,|$))/i
    )?.[1]?.trim() || null;
  const accountName = accountRaw?.replace(/\s+account$/i, "").trim() || null;

  const counterpartyName =
    text.match(
      /(?:to|from|for)\s+(?:vendor|supplier|customer|client)?\s*[:\-]?\s*([A-Za-z0-9&.' -]{2,80}?)(?=\s+(?:for|using|through|from|on|today|yesterday|,|$))/i
    )?.[1]?.trim() || null;

  const descMatch = text.match(/(?:description|because)\s*[:\-]?\s*(.+)$/i);
  const forMatch = text.match(/\bfor\s+(.+?)(?=\s+(?:from|using|through|into)\b|$)/i);
  const description = (descMatch?.[1] || forMatch?.[1] || "").trim() ||
    (direction === "outflow" ? "Business expense" : "Business income");

  return {
    direction,
    amount,
    currency: transactionCurrency,
    description,
    counterpartyName,
    accountName,
    occurredAt: new Date().toISOString(),
    fxRate,
  };
}
