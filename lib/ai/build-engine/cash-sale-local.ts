export type CashSaleLineDraft={productName:string;quantity:number;unitPrice?:number|null};
export type CashSaleDraft={customerName?:string|null;paymentMethod:'cash'|'card'|'bank_transfer'|'mobile_money'|'other';amountReceived?:number|null;notes?:string|null;lines:CashSaleLineDraft[]};

function money(v:string){const n=Number(v.replace(/,/g,''));return Number.isFinite(n)?n:null;}
export function parseCashSaleRequest(prompt:string):CashSaleDraft{
  const text=prompt.trim();
  const lower=text.toLowerCase();
  const paymentMethod:CashSaleDraft['paymentMethod']=/bank transfer|transfer/i.test(text)?'bank_transfer':/card|pos/i.test(text)?'card':/mobile money|momo/i.test(text)?'mobile_money':/other payment/i.test(text)?'other':'cash';
  const receivedMatch=text.match(/(?:cash received|received|paid|amount received)\s*(?:is|of|:|=)?\s*[₦$€£]?\s*([\d,]+(?:\.\d+)?)/i);
  const amountReceived=receivedMatch?money(receivedMatch[1]):null;
  const customerMatch=text.match(/(?:customer|client|for)\s*[:\-]?\s*([A-Za-z0-9&.' -]{2,80}?)(?=\s+(?:buying|bought|for|cash|paid|received|qty|quantity)|[,;]|$)/i);
  const customerName=customerMatch?.[1]?.trim()||null;
  const notes=text.match(/(?:note|notes)\s*[:\-]\s*(.+)$/i)?.[1]?.trim()||null;
  const lines:CashSaleLineDraft[]=[];
  const patterns=[
    /(?:^|[;,]\s*|\band\s+)(\d+(?:\.\d+)?)\s*[x×]\s*([^;,]+?)(?=\s+(?:at|@)\s*[₦$€£]?\s*[\d,]+|[,;]|$)\s*(?:at|@)?\s*[₦$€£]?\s*([\d,]+(?:\.\d+)?)?/gi,
    /(?:^|[;,]\s*|\band\s+)([^;,]+?)\s+(?:qty|quantity)\s*(\d+(?:\.\d+)?)\s*(?:at|@)\s*[₦$€£]?\s*([\d,]+(?:\.\d+)?)/gi
  ];
  for(const p of patterns){
    let m:RegExpExecArray|null;
    while((m=p.exec(text))!==null){
      const qty=Number(m[1].match(/^\d/) ? m[1] : m[2]);
      const name=(m[1].match(/^\d/) ? m[2] : m[1]).trim();
      const priceRaw=m[1].match(/^\d/) ? m[3] : m[3];
      const unitPrice=priceRaw?money(priceRaw):null;
      if(name&&qty>0)lines.push({productName:name,quantity:qty,unitPrice});
    }
    if(lines.length)break;
  }
  if(!lines.length){
    const simple=text.match(/(?:buy|bought|sell|sold)\s+(\d+(?:\.\d+)?)\s+(.+?)(?:\s+at\s+[₦$€£]?\s*([\d,]+(?:\.\d+)?))?(?:\s+for\s+|\s+cash|\s+paid|$)/i);
    if(simple){
      lines.push({productName:simple[2].trim(),quantity:Number(simple[1]),unitPrice:simple[3]?money(simple[3]):null});
    }
  }
  if(!lines.length)throw new Error('No sale line could be understood. Example: “cash sale 2 Premium Hoodie at 25000, cash received 60000”.');
  return {customerName,paymentMethod,amountReceived,notes,lines};
}
