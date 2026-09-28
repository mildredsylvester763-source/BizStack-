export type ProductPhotoDraft={productName:string;assetType:"product_photo"|"lifestyle"|"background_removal"|"variant"|"social_crop";style:string;prompt:string;sourceImageRef?:string|null};
export type MarketplaceListingDraft={title:string;description:string;listingType:"product"|"service"|"wholesale"|"partnership"|"procurement";category:string;price?:number|null;currency?:string|null;quantityAvailable?:number|null;country?:string|null;region?:string|null;tags:string[]};
export type FinanceApiDraft={clientName:string;clientType:"external_app"|"school"|"church"|"cooperative"|"accountant"|"partner";scopes:string[]};

const slug=(v:string)=>v.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80);

export function parseProductPhotoRequest(prompt:string):ProductPhotoDraft{
  const lower=prompt.toLowerCase();
  const productName=(prompt.match(/(?:product|item)\s*(?:called|named|:)?\s*([^,;]+?)(?=\s+(?:style|photo|lifestyle|background|variant|prompt)\b|[,;]|$)/i)?.[1]||"").trim();
  if(!productName)throw new Error("Name the catalog product for the photo studio.");
  const assetType= /background\s*remove|remove\s+background/i.test(prompt)?"background_removal":/lifestyle|in\s+use|scene/i.test(lower)?"lifestyle":/variant|colorway|angle/i.test(lower)?"variant":/social|instagram|facebook|square/i.test(lower)?"social_crop":"product_photo";
  const style=prompt.match(/style\s*[:\-]\s*([^,;]+)/i)?.[1]?.trim()||"clean commercial studio photography";
  const custom=prompt.match(/(?:brief|prompt)\s*[:\-]\s*(.+)$/i)?.[1]?.trim();
  const generatedPrompt=custom||`Commercial ${assetType.replace(/_/g," ")} of the real product “${productName}”, ${style}. Preserve the actual product identity, proportions, materials and branding. Do not invent logos, certifications or product specifications.`;
  const sourceImageRef=prompt.match(/(?:source|reference)\s*[:\-]\s*([^,;]+)/i)?.[1]?.trim()||null;
  return {productName,assetType,style,prompt:generatedPrompt,sourceImageRef};
}

export function parseMarketplaceListingRequest(prompt:string):MarketplaceListingDraft{
  const listingType=(/wholesale/i.test(prompt)?"wholesale":/partnership/i.test(prompt)?"partnership":/procurement/i.test(prompt)?"procurement":/product|goods|inventory/i.test(prompt)?"product":"service") as MarketplaceListingDraft["listingType"];
  const title=(prompt.match(/(?:listing|sell|offer|service|product)\s*(?:called|named|for|:)?\s*([^,;]+?)(?=\s+(?:description|price|category|quantity|country|region|tags?)\b|[,;]|$)/i)?.[1]||"B2B Listing").trim();
  const description=prompt.match(/description\s*[:\-]\s*([^;]+)/i)?.[1]?.trim()||null;
  const amount=prompt.match(/(?:price|at|rate)\s*[₦$€£]?\s*([\d,]+(?:\.\d+)?)/i)?.[1];
  const price=amount?Number(amount.replace(/,/g,"")):null;
  const currency=prompt.match(/\b(NGN|USD|GBP|EUR|CAD|AUD|KES|GHS|ZAR|INR|AED)\b/i)?.[1]?.toUpperCase()||null;
  const qty=prompt.match(/(?:quantity|stock|available)\s*(?:of|=|:)\s*([\d,]+(?:\.\d+)?)/i)?.[1];
  const category=prompt.match(/category\s*[:\-]\s*([^,;]+)/i)?.[1]?.trim()||"general";
  const country=prompt.match(/country\s*[:\-]\s*([^,;]+)/i)?.[1]?.trim()||null;
  const region=prompt.match(/region\s*[:\-]\s*([^,;]+)/i)?.[1]?.trim()||null;
  const tagRaw=prompt.match(/tags?\s*[:\-]\s*([^;]+)/i)?.[1]||"";
  const tags=tagRaw.split(/[,|]/).map(v=>v.trim()).filter(Boolean).slice(0,20);
  return {title,description:description||"Business-to-business marketplace listing.",listingType,category,price, currency, quantityAvailable:qty?Number(qty.replace(/,/g,"")):null,country,region,tags};
}

export function parseFinanceApiRequest(prompt:string):FinanceApiDraft{
  const lower=prompt.toLowerCase();
  const clientName=(prompt.match(/(?:client|integration|partner)\s*(?:called|named|for|:)?\s*([^,;]+?)(?=\s+(?:type|scopes?|permissions?)\b|[,;]|$)/i)?.[1]||"External Finance Client").trim();
  const clientType=(/school/i.test(lower)?"school":/church/i.test(lower)?"church":/cooperative|coop|ajo/i.test(lower)?"cooperative":/accountant/i.test(lower)?"accountant":/partner/i.test(lower)?"partner":"external_app") as FinanceApiDraft["clientType"];
  const scopesRaw=prompt.match(/(?:scopes?|permissions?)\s*[:\-]\s*(.+)$/i)?.[1]||"customers:read,invoices:read,invoices:write,transactions:read,transactions:write,reports:read";
  const allowed=new Set(["customers:read","customers:write","invoices:read","invoices:write","transactions:read","transactions:write","reports:read","products:read","products:write"]);
  const scopes=Array.from(new Set(scopesRaw.split(/[,|]/).map(v=>v.trim()).filter(v=>allowed.has(v)))).slice(0,20);
  if(!scopes.length)throw new Error("No valid finance API scopes were requested.");
  return {clientName,clientType,scopes};
}
