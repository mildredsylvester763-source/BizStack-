export type CustomerDraft={name:string;email?:string|null;phone?:string|null;companyName?:string|null;customerType:'individual'|'business';city?:string|null;stateRegion?:string|null;country?:string|null;notes?:string|null;tags:string[]};

export function parseCustomerRequest(prompt:string):CustomerDraft{
  const text=prompt.trim();
  const nameMatch=text.match(/(?:create|add|save|register)\s+(?:a\s+)?(?:new\s+)?(?:customer|client)\s*(?:named|called)?\s*[:\-]?\s*([^,;]+?)(?=\s+(?:email|phone|tel|company|business|location|city|state|country|note|tag)\b|[,;]|$)/i);
  const name=(nameMatch?.[1]||'').trim().replace(/\s+/g,' ');
  if(!name) throw new Error('Could not identify the customer name. Example: “create customer John Doe, email john@example.com, phone +234…”');
  const email=text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0]?.toLowerCase()||null;
  const phone=text.match(/(?:phone|tel|mobile|whatsapp)\s*[:=\-]?\s*([+()\d][+()\d\s-]{6,})/i)?.[1]?.trim()||null;
  const companyName=text.match(/(?:company|business|organization)\s*[:=\-]?\s*([^,;]+)/i)?.[1]?.trim()||null;
  const city=text.match(/city\s*[:=\-]?\s*([^,;]+)/i)?.[1]?.trim()||null;
  const stateRegion=text.match(/(?:state|region)\s*[:=\-]?\s*([^,;]+)/i)?.[1]?.trim()||null;
  const country=text.match(/country\s*[:=\-]?\s*([^,;]+)/i)?.[1]?.trim()||null;
  const notes=text.match(/(?:note|notes)\s*[:=\-]?\s*([^;]+)/i)?.[1]?.trim()||null;
  const tagMatch=text.match(/tags?\s*[:=\-]?\s*([^;]+)/i);
  const tags=tagMatch?tagMatch[1].split(/[,|]/).map(v=>v.trim()).filter(Boolean).slice(0,20):[];
  const customerType=companyName||/\b(ltd|limited|inc|llc|corp|company|business|agency|enterprise)\b/i.test(name)?'business':'individual';
  return {name,email,phone,companyName,customerType,city,stateRegion,country,notes,tags};
}
