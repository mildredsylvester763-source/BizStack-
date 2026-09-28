export type ThriftDraft={name:string;amount:number;currency:string;frequency:"weekly"|"monthly"|"quarterly";payoutMethod:"rotating"|"fixed"|"auction"|"custom";nextDate?:string|null;rules?:string|null};
export type SuccessorDraft={email:string;name?:string|null;role:"successor"|"emergency_admin"|"accountant"|"trusted_operator";delayHours:number;permissions:string[]};
export type ComplianceDraft={name:string;authority?:string|null;category:string;jurisdiction?:string|null;dueDate?:string|null;recurrence:"once"|"monthly"|"quarterly"|"half_yearly"|"yearly";priority:"low"|"normal"|"high"|"critical";ownerEmail?:string|null};

const currency=(text:string,def:string)=>text.match(/\b(NGN|USD|GBP|EUR|CAD|AUD|KES|GHS|ZAR|INR|AED)\b/i)?.[1]?.toUpperCase()||def;

export function parseThriftRequest(prompt:string,def:string):ThriftDraft{
 const name=(prompt.match(/(?:thrift|ajo|esusu|savings)\s*(?:group)?\s*(?:called|named|:)?\s*([^,;]+?)(?=\s+(?:contribution|frequency|payout|next)\b|[,;]|$)/i)?.[1]||"Savings Group").trim();
 const amount=Number((prompt.match(/(?:contribution|save|amount)\s*[₦$€£]?\s*([\d,]+(?:\.\d+)?)/i)?.[1]||"0").replace(/,/g,""));
 if(amount<=0)throw new Error("A positive contribution amount is required.");
 const frequency:ThriftDraft["frequency"]=/weekly|week/.test(prompt.toLowerCase())?"weekly":/quarterly|quarter/.test(prompt.toLowerCase())?"quarterly":"monthly";
 const payoutMethod:ThriftDraft["payoutMethod"]=/auction/.test(prompt.toLowerCase())?"auction":/fixed/.test(prompt.toLowerCase())?"fixed":/custom/.test(prompt.toLowerCase())?"custom":"rotating";
 return {name,amount,currency:currency(prompt,def),frequency,payoutMethod,nextDate:prompt.match(/(?:next|start|on)\s+(\d{4}-\d{2}-\d{2})/i)?.[1]||null,rules:prompt.match(/rules?\s*[:\-]\s*(.+)$/i)?.[1]||null};
}
export function parseSuccessorRequest(prompt:string):SuccessorDraft{
 const email=prompt.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase();
 if(!email)throw new Error("A valid successor or emergency-contact email is required.");
 const role=(/emergency/i.test(prompt)?"emergency_admin":/accountant/i.test(prompt)?"accountant":/operator/i.test(prompt)?"trusted_operator":"successor") as SuccessorDraft["role"];
 const delayHours=Math.min(720,Math.max(0,Number(prompt.match(/(?:delay|wait)\s*(\d+)\s*hours?/i)?.[1]||24)));
 const permissions=Array.from(new Set((prompt.match(/(?:permissions?|access)\s*[:\-]\s*(.+)$/i)?.[1]||"view_business,financial_reports,customer_records").split(/[,|]/).map(v=>v.trim()).filter(Boolean))).slice(0,20);
 const name=prompt.match(/(?:for|name)\s+([A-Za-z][A-Za-z .'-]{1,60})(?=\s+(?:with|role|email|access)|,|$)/i)?.[1]?.trim()||null;
 return {email,name,role,delayHours,permissions};
}
export function parseComplianceRequest(prompt:string):ComplianceDraft{
 const name=(prompt.match(/(?:compliance|filing|renewal|permit|tax)\s*(?:item|calendar entry|requirement)?\s*(?:called|named|:)?\s*([^,;]+?)(?=\s+(?:authority|due|by|jurisdiction|category|priority|owner)\b|[,;]|$)/i)?.[1]||"Compliance requirement").trim();
 const authority=prompt.match(/authority\s*[:\-]\s*([^,;]+)/i)?.[1]?.trim()||null;
 const jurisdiction=prompt.match(/jurisdiction\s*[:\-]\s*([^,;]+)/i)?.[1]?.trim()||null;
 const dueDate=prompt.match(/(?:due|by)\s+(\d{4}-\d{2}-\d{2})/i)?.[1]||null;
 const recurrence:ComplianceDraft["recurrence"]=/half.?year|semi.?annual/i.test(prompt)?"half_yearly":/quarter/i.test(prompt)?"quarterly":/month/i.test(prompt)?"monthly":/year|annual/i.test(prompt)?"yearly":"once";
 const priority=(/critical|urgent/i.test(prompt)?"critical":/high/i.test(prompt)?"high":/low/i.test(prompt)?"low":"normal") as ComplianceDraft["priority"];
 const category=prompt.match(/category\s*[:\-]\s*([^,;]+)/i)?.[1]?.trim()||"general";
 const ownerEmail=prompt.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase()||null;
 return {name,authority,jurisdiction,dueDate,recurrence,priority,ownerEmail};
}
