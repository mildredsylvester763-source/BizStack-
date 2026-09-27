export type CommissionDraft={agentName:string;invoiceNumber:string;ratePercent?:number|null};
export function parseCommissionRequest(prompt:string):CommissionDraft{
  const text=prompt.trim();
  const agent=text.match(/(?:commission|payout)\s+(?:for|to)\s+([^,;]+?)(?=\s+(?:on|for invoice|invoice)\b|[,;]|$)/i)?.[1]?.trim() || text.match(/(?:agent|broker)\s*[:\-]?\s*([^,;]+?)(?=\s+(?:on|invoice|rate)\b|[,;]|$)/i)?.[1]?.trim() || '';
  const invoice=text.match(/(?:invoice)\s*#?\s*(INV[-\w]*)/i)?.[1] || '';
  const rate=text.match(/(?:rate|commission)\s*(?:at|of|is|=)?\s*(\d+(?:\.\d+)?)\s*%/i)?.[1];
  const ratePercent=rate?Number(rate):null;
  if(!agent||!invoice)throw new Error('Could not identify the agent and invoice. Example: “calculate 10% commission for John on invoice INV-0004”.');
  return {agentName:agent.replace(/\b(on|for invoice|invoice)\b.*$/i,'').trim(),invoiceNumber:invoice,ratePercent};
}