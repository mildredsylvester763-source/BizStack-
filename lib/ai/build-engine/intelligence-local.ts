export type VoiceAgentDraft={name:string;greeting:string;instructions:string;provider?:string|null;phoneNumber?:string|null};
export type BroadcastDraft={name:string;channel:"sms"|"whatsapp"|"email";message:string;strictConsent:boolean;scheduledAt?:string|null};
export type CarbonDraft={activityType:"electricity"|"generator_fuel"|"vehicle_fuel"|"delivery"|"air_travel"|"waste"|"refrigeration"|"water"|"other";quantity:number;unit:string;factor:number;date?:string|null;notes?:string|null};

export function parseVoiceAgentRequest(prompt:string):VoiceAgentDraft{
 const name=(prompt.match(/(?:phone agent|voice agent|answering agent)\s*(?:called|named)?\s*[:\-]?\s*([^,;]+?)(?=\s+(?:greeting|instructions|provider|phone)\b|[,;]|$)/i)?.[1]||"BizStack Phone Agent").trim();
 const greeting=prompt.match(/greeting\s*[:\-]\s*([^;]+)/i)?.[1]?.trim()||"Thanks for calling. How can I help you today?";
 const instructions=prompt.match(/(?:instructions|system)\s*[:\-]\s*(.+?)(?:\s+(?:provider|phone)\s*[:\-]|$)/i)?.[1]?.trim()||"Answer questions about the business, capture customer intent, use approved BizStack tools when configured, and escalate when outside the configured boundary.";
 const provider=prompt.match(/provider\s*[:\-]\s*([^,;]+)/i)?.[1]?.trim()||null;
 const phoneNumber=prompt.match(/(?:phone|number)\s*[:\-]\s*(\+?[\d ()-]{7,})/i)?.[1]?.trim()||null;
 return {name,greeting,instructions,provider,phoneNumber};
}
export function parseBroadcastRequest(prompt:string):BroadcastDraft{
 const channel=(/whatsapp/i.test(prompt)?"whatsapp":/email/i.test(prompt)?"email":"sms") as BroadcastDraft["channel"];
 const name=(prompt.match(/(?:campaign|broadcast)\s*(?:called|named)?\s*[:\-]?\s*([^,;]+?)(?=\s+(?:message|channel|audience|scheduled)\b|[,;]|$)/i)?.[1]||"Business broadcast").trim();
 const message=prompt.match(/message\s*[:\-]\s*(.+?)(?:\s+(?:channel|audience|scheduled)\s*[:\-]|$)/i)?.[1]?.trim();
 if(!message)throw new Error("A broadcast message is required.");
 const scheduledAt=prompt.match(/(?:scheduled|schedule)\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)/i)?.[1]||null;
 return {name,channel,message,strictConsent:!/allow unknown|include unknown/i.test(prompt),scheduledAt};
}
export function parseCarbonRequest(prompt:string):CarbonDraft{
 const lower=prompt.toLowerCase();
 const activityType:CarbonDraft["activityType"]=/electricity|kwh|power/.test(lower)?"electricity":/generator|diesel|petrol/.test(lower)?"generator_fuel":/vehicle|car|van|truck/.test(lower)?"vehicle_fuel":/delivery|courier/.test(lower)?"delivery":/flight|air travel|airplane/.test(lower)?"air_travel":/waste|landfill|trash/.test(lower)?"waste":/refrigeration|freezer|cold storage/.test(lower)?"refrigeration":/water/.test(lower)?"water":"other";
 const quantityMatch=prompt.match(/([\d,]+(?:\.\d+)?)\s*(kwh|l|litres?|liters?|kg|km|hours?)/i);
 const quantity=quantityMatch?Number(quantityMatch[1].replace(/,/g,"")):0;
 if(quantity<=0)throw new Error("Add an activity quantity.");
 const unit=(quantityMatch?.[2]||"unit").toLowerCase();
 const factorMatch=prompt.match(/(?:factor|kgco2e|co2e)\s*(?:of|=|:)\s*([\d.]+)/i);
 const defaults:any={electricity:0.5,generator_fuel:2.68,vehicle_fuel:2.31,delivery:0.21,air_travel:0.25,waste:0.5,refrigeration:0.1,water:0.0003,other:0};
 return {activityType,quantity,unit,factor:factorMatch?Number(factorMatch[1]):defaults[activityType],date:prompt.match(/(?:on|date)\s+(\d{4}-\d{2}-\d{2})/i)?.[1]||null,notes:prompt.match(/notes?\s*[:\-]\s*(.+)$/i)?.[1]||null};
}
