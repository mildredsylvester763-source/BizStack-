export type BusinessDocumentDraft={documentType:'business_plan'|'grant_draft'|'loan_pack'|'cfo_brief';title:string;audience:string|null;funderName:string|null;goal:string;fundingAmount:number|null};

function amount(v:string){const n=Number(v.replace(/,/g,''));return Number.isFinite(n)?n:null;}

export function parseBusinessDocumentRequest(prompt:string):BusinessDocumentDraft{
  const text=prompt.trim(),lower=text.toLowerCase();
  const documentType:BusinessDocumentDraft['documentType']=/grant/i.test(text)?'grant_draft':/loan|lender/i.test(text)?'loan_pack':/cfo|fractional cfo/i.test(text)?'cfo_brief':'business_plan';
  const title=(text.match(/(?:titled|title|called)\s*[\"']?([^\"',;]+)[\"']?/i)?.[1]?.trim())||({business_plan:'Business Plan',grant_draft:'Grant Application Draft',loan_pack:'Loan Application Pack',cfo_brief:'CFO Brief'}[documentType]);
  const audience=text.match(/(?:for|targeted at|audience)\s+([^,;]+)/i)?.[1]?.trim()||null;
  const funder=text.match(/(?:funder|grant(?:or)?|lender)\s*[:\-]?\s*([^,;]+)/i)?.[1]?.trim()||null;
  const goal=text.match(/(?:goal|purpose|for)\s*[:\-]?\s*([^;]+)/i)?.[1]?.trim()||'Support business growth, operational resilience and measurable outcomes.';
  const fundingText=text.match(/(?:funding|budget|loan amount|grant amount)\s*(?:of|is|=|:)?\s*[₦$€£]?\s*([\d,]+(?:\.\d+)?)/i)?.[1];
  return {documentType,title,audience,funderName:funder,goal,fundingAmount:fundingText?amount(fundingText):null};
}