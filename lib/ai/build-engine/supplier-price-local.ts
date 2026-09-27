export type SupplierPriceDraft={supplierName:string;productName:string;newCost:number;currency:string};

function amount(v:string){const n=Number(v.replace(/,/g,''));return Number.isFinite(n)?n:null;}

export function parseSupplierPriceRequest(prompt:string,businessCurrency:string):SupplierPriceDraft{
  const text=prompt.trim();
  const supplierMatch=text.match(/(?:supplier|vendor)\s*[:\-]?\s*([^,;]+?)(?=\s+(?:raised|increased|price|cost|for|product|now|to)\b|[,;]|$)/i);
  const productMatch=text.match(/(?:product|item)\s*[:\-]?\s*([^,;]+?)(?=\s+(?:to|at|price|cost|now|for)\b|[,;]|$)/i);
  const amountMatch=text.match(/(?:to|at|price|cost|now)\s*[₦$€£]?\s*([\d,]+(?:\.\d+)?)/i);
  const supplierName=supplierMatch?.[1]?.trim()||'';
  const productName=productMatch?.[1]?.trim()||'';
  const newCost=amountMatch?amount(amountMatch[1]):null;
  const currencyCode=text.match(/\b(NGN|USD|GBP|EUR|CAD|AUD|KES|GHS|ZAR|INR|AED)\b/i)?.[1]?.toUpperCase();
  const symbol=text.includes('₦')?'NGN':text.includes('£')?'GBP':text.includes('€')?'EUR':text.includes('$')?'USD':null;
  if(!supplierName||!productName||newCost===null||newCost<0)throw new Error('Could not understand supplier, product and new cost. Example: “Supplier Acme raised product Premium Hoodie to ₦18000”.');
  return {supplierName,productName,newCost,currency:currencyCode||symbol||businessCurrency||'USD'};
}