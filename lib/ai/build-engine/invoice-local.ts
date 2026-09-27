export type InvoiceLineDraft={description:string;quantity:number;unitPrice:number};
export type InvoiceDraft={customerName:string;customerEmail?:string;dueDate?:string|null;paymentTerms:string;currency:string;reference?:string|null;purchaseOrder?:string|null;notes?:string|null;taxRate:number;lines:InvoiceLineDraft[]};

function money(value:string){ const n=Number(value.replace(/,/g,'')); return Number.isFinite(n)?n:null; }

export function parseInvoiceRequest(prompt:string,currency:string):InvoiceDraft{
  const text=prompt.trim(); const lower=text.toLowerCase();
  const customerMatch=text.match(/(?:for|to|bill(?:ing)?\s+to)\s+([A-Za-z0-9&.' -]{2,80}?)(?=\s+(?:for|with|including|email|due|in\s+\d+\s+days|on\s+\d{4}-\d{2}-\d{2}|ref(?:erence)?|po\b|vat\b|tax\b)|$)/i);
  const customerName=(customerMatch?.[1]||'').trim().replace(/[.,]$/,'');
  if(!customerName) throw new Error('Could not identify the customer. Use wording such as “create an invoice for Acme Ltd”.');
  const emailMatch=text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  const dueIn=text.match(/(?:due|payable)\s+(?:in\s+)?(\d{1,3})\s+days?/i);
  const explicitDate=text.match(/(?:due|payable|on)\s+(\d{4}-\d{2}-\d{2})/i);
  let dueDate:string|null=null;
  if(explicitDate) dueDate=explicitDate[1];
  else if(dueIn){ const d=new Date(); d.setDate(d.getDate()+Number(dueIn[1])); dueDate=d.toISOString().slice(0,10); }
  const taxMatch=text.match(/(?:vat|tax)\s*(?:at|of)?\s*(\d+(?:\.\d+)?)\s*%/i);
  const taxRate=taxMatch?Number(taxMatch[1]):0;

  const lines:InvoiceLineDraft[]=[];
  const linePatterns=[
    /(?:^|[;,]\s*|\band\s+)(\d+(?:\.\d+)?)\s*[x×]\s*([^;,]+?)\s+(?:at|@)\s*([₦$€£]?\s*[\d,]+(?:\.\d+)?)/gi,
    /(?:^|[;,]\s*|\band\s+)([^;,]+?)\s+(?:qty|quantity)\s*(\d+(?:\.\d+)?)\s*(?:at|@)\s*([₦$€£]?\s*[\d,]+(?:\.\d+)?)/gi,
    /(?:^|[;,]\s*|\band\s+)(\d+(?:\.\d+)?)\s+([^;,]+?)\s+([₦$€£]?\s*[\d,]+(?:\.\d+)?)(?=\s*(?:,|;|$))/gi
  ];
  for(const pattern of linePatterns){
    let match:RegExpExecArray|null;
    while((match=pattern.exec(text))!==null){
      let quantity:number,description:string,unitPrice:number|null;
      if(/^\d/.test(match[1])){ quantity=Number(match[1]); description=match[2].trim(); unitPrice=money(match[3].replace(/^[₦$€£]\s*/,'')); }
      else{ description=match[1].trim(); quantity=Number(match[2]); unitPrice=money(match[3].replace(/^[₦$€£]\s*/,'')); }
      if(description && unitPrice!==null && quantity>0 && unitPrice>0) lines.push({description,quantity,unitPrice});
    }
    if(lines.length) break;
  }

  if(!lines.length){
    const amountMatch=text.match(/(?:total|amount|price|for)\s*(?:of|is|=)?\s*[₦$€£]?\s*([\d,]+(?:\.\d+)?)/i);
    const amount=amountMatch?money(amountMatch[1]):null;
    if(amount&&amount>0) lines.push({description:'Services / goods requested',quantity:1,unitPrice:amount});
  }
  if(!lines.length) throw new Error('No billable line item and amount could be understood. Example: “invoice Acme Ltd for 2 logo design at 150000”.');
  return { customerName, customerEmail:emailMatch?.[0], dueDate, paymentTerms:dueDate?'Net '+(dueIn?.[1]||'specified')+' days':'Due on receipt', currency, reference: lower.includes('reference')?text.match(/reference\s+([^,;]+)/i)?.[1]?.trim()||null:null, purchaseOrder: lower.includes('po ')?text.match(/po\s*#?\s*([A-Za-z0-9-]+)/i)?.[1]||null:null, notes:null, taxRate, lines };
}