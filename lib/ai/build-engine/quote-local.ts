export type QuoteLineDraft={description:string;quantity:number;unitPrice:number};
export type QuoteDraft={customerName:string;customerEmail?:string;expiryDate?:string|null;paymentTerms:string;currency:string;reference?:string|null;purchaseOrder?:string|null;notes?:string|null;terms?:string|null;discountType:'percentage'|'fixed'|null;discountValue:number;taxRate:number;lines:QuoteLineDraft[]};

function money(value:string){const n=Number(value.replace(/,/g,''));return Number.isFinite(n)?n:null;}
function has(text:string,words:string[]){return words.some(w=>text.includes(w));}

export function parseQuoteRequest(prompt:string,currency:string):QuoteDraft{
 const text=prompt.trim(),lower=text.toLowerCase();
 const customerMatch=text.match(/(?:quote|quotation|estimate|proposal)(?:\s+for|\s+to)?\s+([A-Za-z0-9&.' -]{2,80}?)(?=\s+(?:for|with|including|email|expires|valid|due|tax|vat|discount|ref(?:erence)?|po\b)|[,;]|$)/i);
 const customerName=(customerMatch?.[1]||'').trim().replace(/[.,]$/,'');
 if(!customerName)throw new Error('Could not identify the customer. Example: “create a quote for Acme Ltd for 2 design packages at 150000”.');
 const email=text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0]||undefined;
 const validDays=text.match(/(?:valid|expires?)\s+(?:for\s+)?(\d{1,3})\s+days?/i);
 const explicit=text.match(/(?:expires?|valid until|expiry)\s+(\d{4}-\d{2}-\d{2})/i);
 let expiryDate:string|null=null;
 if(explicit)expiryDate=explicit[1];
 else if(validDays){const d=new Date();d.setDate(d.getDate()+Number(validDays[1]));expiryDate=d.toISOString().slice(0,10);}
 const taxMatch=text.match(/(?:vat|tax)\s*(?:at|of)?\s*(\d+(?:\.\d+)?)\s*%/i);
 const taxRate=taxMatch?Number(taxMatch[1]):0;
 const discountPercent=text.match(/discount\s*(?:of|at)?\s*(\d+(?:\.\d+)?)\s*%/i);
 const discountFixed=text.match(/discount\s*(?:of|at)?\s*[₦$€£]?\s*([\d,]+(?:\.\d+)?)(?!\s*%)/i);
 let discountType:null|'percentage'|'fixed'=null,discountValue=0;
 if(discountPercent){discountType='percentage';discountValue=Number(discountPercent[1]);}
 else if(discountFixed){discountType='fixed';discountValue=money(discountFixed[1])||0;}
 const lines:QuoteLineDraft[]=[];
 const patterns=[
  /(?:^|[;,]\s*|\band\s+)(\d+(?:\.\d+)?)\s*[x×]\s*([^;,]+?)\s+(?:at|@)\s*([₦$€£]?\s*[\d,]+(?:\.\d+)?)/gi,
  /(?:^|[;,]\s*|\band\s+)([^;,]+?)\s+(?:qty|quantity)\s*(\d+(?:\.\d+)?)\s*(?:at|@)\s*([₦$€£]?\s*[\d,]+(?:\.\d+)?)/gi,
  /(?:^|[;,]\s*|\band\s+)(\d+(?:\.\d+)?)\s+([^;,]+?)\s+([₦$€£]?\s*[\d,]+(?:\.\d+)?)(?=\s*(?:,|;|$))/gi
 ];
 for(const p of patterns){
  let m:RegExpExecArray|null;
  while((m=p.exec(text))!==null){
   let quantity:number,description:string,unitPrice:number|null;
   if(/^\d/.test(m[1])){quantity=Number(m[1]);description=m[2].trim();unitPrice=money(m[3].replace(/^[₦$€£]\s*/,''));}
   else{description=m[1].trim();quantity=Number(m[2]);unitPrice=money(m[3].replace(/^[₦$€£]\s*/,''));}
   if(description&&unitPrice!==null&&quantity>0&&unitPrice>=0)lines.push({description,quantity,unitPrice});
  }
  if(lines.length)break;
 }
 if(!lines.length){
  const amount=text.match(/(?:total|amount|price|for)\s*(?:of|is|=)?\s*[₦$€£]?\s*([\d,]+(?:\.\d+)?)/i);
  const n=amount?money(amount[1]):null;
  if(n!==null&&n>0)lines.push({description:'Quoted goods or services',quantity:1,unitPrice:n});
 }
 if(!lines.length)throw new Error('No billable quote line and amount could be understood.');
 const reference=lower.includes('reference')?text.match(/reference\s+([^,;]+)/i)?.[1]?.trim()||null:null;
 const purchaseOrder=lower.includes('po ')?text.match(/po\s*#?\s*([A-Za-z0-9-]+)/i)?.[1]||null:null;
 const notes=text.match(/(?:note|notes)\s*[:\-]\s*([^;]+)/i)?.[1]?.trim()||null;
 const terms=text.match(/(?:terms|conditions)\s*[:\-]\s*([^;]+)/i)?.[1]?.trim()||null;
 return {customerName,customerEmail:email,expiryDate,paymentTerms:'Due on acceptance',currency,reference,purchaseOrder,notes,terms,discountType,discountValue,taxRate,lines};
}
