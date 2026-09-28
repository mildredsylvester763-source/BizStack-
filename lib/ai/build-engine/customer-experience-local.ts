export type SmsWalletDraft={currency:string;lowBalance:number};
export type AppointmentDraft={customerName:string;serviceName:string;startsAt:string;durationMinutes:number;price:number;currency:string;depositType:"none"|"fixed"|"percentage";depositValue:number;notes?:string|null};
export type MenuDraft={name:string;slug:string;currency:string;kitchenFlowEnabled:boolean;items:Array<{name:string;price:number;category?:string;preparationMinutes?:number;description?:string}>};
export type WaiverDraft={name:string;title:string;body:string;required:boolean};

const currencies=(text:string)=>text.match(/\b(NGN|USD|GBP|EUR|CAD|AUD|KES|GHS|ZAR|INR|AED)\b/i)?.[1]?.toUpperCase()||null;
const slug=(v:string)=>v.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60);

export function parseSmsWalletRequest(prompt:string,defaultCurrency:string):SmsWalletDraft{
 const threshold=prompt.match(/(?:low\s+balance|alert)\s*(?:at|of|=|:)\s*(\d+(?:\.\d+)?)/i);
 return {currency:currencies(prompt)||defaultCurrency,lowBalance:threshold?Number(threshold[1]):100};
}
export function parseAppointmentRequest(prompt:string,defaultCurrency:string):AppointmentDraft{
 const customer=(prompt.match(/(?:appointment|booking|book)\s+(?:for|with)\s+([^,;]+?)(?=\s+(?:for|at|on|from)\b|[,;]|$)/i)?.[1]||"").trim();
 const service=(prompt.match(/(?:service|appointment)\s*(?:called|for)?\s*([^,;]+?)(?=\s+(?:for|with|at|on|from)\b|[,;]|$)/i)?.[1]||"").trim();
 if(!customer)throw new Error("Name the customer for the appointment.");
 if(!service)throw new Error("Name the appointment service.");
 const dt=prompt.match(/(?:at|on|from)\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)/i)?.[1];
 if(!dt)throw new Error("Use an ISO appointment time, for example 2026-10-05T14:30.");
 const duration=Number(prompt.match(/(\d+)\s*(?:min|mins|minutes)/i)?.[1]||30);
 const amount=Number((prompt.match(/(?:price|fee|cost)\s*[₦$€£]?\s*([\d,]+(?:\.\d+)?)/i)?.[1]||"0").replace(/,/g,""));
 const depPct=prompt.match(/deposit\s*(?:of|at)?\s*(\d+(?:\.\d+)?)\s*%/i);
 const depFixed=prompt.match(/deposit\s*(?:of|at)?\s*[₦$€£]?\s*([\d,]+(?:\.\d+)?)/i);
 const depositType=depPct?"percentage":depFixed?"fixed":"none";
 const depositValue=depPct?Number(depPct[1]):depFixed?Number(depFixed[1].replace(/,/g,"")):0;
 return {customerName:customer,serviceName:service,startsAt:dt,durationMinutes:duration,price:amount,currency:currencies(prompt)||defaultCurrency,depositType,depositValue,notes:prompt.match(/notes?\s*[:\-]\s*(.+)$/i)?.[1]||null};
}
export function parseMenuRequest(prompt:string,defaultCurrency:string):MenuDraft{
 const name=(prompt.match(/(?:menu|qr menu|digital menu)\s*(?:called|named|for)?\s*[:\-]?\s*([^,;]+?)(?=\s+(?:items?|currency|kitchen|category)\b|[,;]|$)/i)?.[1]||"Main Menu").trim();
 const itemText=prompt.match(/items?\s*[:\-]\s*(.+)$/i)?.[1]||"";
 const items=itemText.split(/\s*;\s*|\s*,\s*(?=[A-Za-z])/).map((raw)=>{const m=raw.trim().match(/^(.+?)\s+(?:at|@|price)\s*[₦$€£]?\s*([\d,]+(?:\.\d+)?)(?:\s+(?:category|cat)\s*[:\-]\s*(.+))?$/i);if(!m)return null;return{name:m[1].trim(),price:Number(m[2].replace(/,/g,"")),category:m[3]?.trim(),preparationMinutes:Number(prompt.match(/prep\s*(?:time)?\s*(\d+)\s*min/i)?.[1]||0)}}).filter(Boolean) as MenuDraft["items"];
 if(!items.length)throw new Error("Add menu items like “items: Jollof Rice at 5000, Grilled Chicken at 8000”.");
 return {name,slug:slug(name),currency:currencies(prompt)||defaultCurrency,kitchenFlowEnabled:!/kitchen\s*(?:off|false|disabled)/i.test(prompt),items};
}
export function parseWaiverRequest(prompt:string):WaiverDraft{
 const name=(prompt.match(/(?:waiver|consent)\s*(?:called|named)?\s*[:\-]?\s*([^,;]+?)(?=\s+(?:title|body|required)\b|[,;]|$)/i)?.[1]||"Customer Waiver").trim();
 const title=prompt.match(/title\s*[:\-]\s*([^;]+)/i)?.[1]?.trim()||name;
 const body=prompt.match(/body\s*[:\-]\s*(.+?)(?:\s+(?:required\s*[:=])|$)/i)?.[1]?.trim()||"By signing this waiver, the customer acknowledges the stated terms and consents to the described activity or service.";
 const required=!/required\s*[:=]\s*(?:false|no)/i.test(prompt);
 return {name,title,body,required};
}
