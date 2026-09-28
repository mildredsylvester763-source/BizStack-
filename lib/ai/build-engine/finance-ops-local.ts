export type DualCurrencyDraft={baseCurrency:string;secondaryCurrencies:string[]};
export type LoanReadinessDraft={requestedAmount:number;currency:string;purpose:string;termMonths?:number|null};
export type ObligationDraft={type:"rent"|"utility"|"fleet"|"generator_fuel"|"cold_storage"|"subscription"|"other";title:string;counterparty?:string|null;amount:number;currency:string;frequency:"once"|"weekly"|"monthly"|"quarterly"|"yearly";nextDueDate?:string|null;notes?:string|null};
export type PayrollAdvanceDraft={employeeName:string;amount:number;currency:string;recoveryPeriods:number;startDate?:string|null;notes?:string|null};

const validCurrencies=new Set(["NGN","USD","GBP","EUR","CAD","AUD","KES","GHS","ZAR","INR","AED","CNY","JPY","CHF","XOF","XAF"]);
const pickCurrencies=(text:string)=>Array.from(new Set((text.match(/\b(NGN|USD|GBP|EUR|CAD|AUD|KES|GHS|ZAR|INR|AED|CNY|JPY|CHF|XOF|XAF)\b/gi)||[]).map(v=>v.toUpperCase()))).filter(v=>validCurrencies.has(v));

export function parseDualCurrencyRequest(prompt:string,defaultCurrency:string):DualCurrencyDraft{
 const codes=pickCurrencies(prompt);
 const baseMatch=prompt.match(/(?:base|home|primary)\s+(?:currency\s*)?(?:is|=|:)?\s*(NGN|USD|GBP|EUR|CAD|AUD|KES|GHS|ZAR|INR|AED|CNY|JPY|CHF|XOF|XAF)/i);
 const base=(baseMatch?.[1]||codes[0]||defaultCurrency).toUpperCase();
 const secondary=codes.filter(v=>v!==base);
 if(!validCurrencies.has(base))throw new Error("Unsupported base currency.");
 if(!secondary.length)throw new Error("Add at least one secondary currency. Example: “enable NGN as base and USD, GBP as secondary books”.");
 return {baseCurrency:base,secondaryCurrencies:secondary};
}

export function parseLoanReadinessRequest(prompt:string,defaultCurrency:string):LoanReadinessDraft{
 const amountMatch=prompt.match(/(?:loan|funding|finance|financing|credit)\s*(?:of|for|amount)?\s*[₦$€£]?\s*([\d,]+(?:\.\d+)?)/i)||prompt.match(/[₦$€£]?\s*([\d,]+(?:\.\d+)?)/);
 const requestedAmount=amountMatch?Number(amountMatch[1].replace(/,/g,"")):0;
 if(!Number.isFinite(requestedAmount)||requestedAmount<=0)throw new Error("A positive financing amount is required.");
 const currency=pickCurrencies(prompt)[0]||defaultCurrency;
 const term=prompt.match(/(\d{1,3})\s*(?:month|months|mo)\b/i);
 const purpose=prompt.match(/(?:for|to fund|purpose)\s+(.+?)(?=\s+(?:for|over|within|term)\b|$)/i)?.[1]?.trim()||"Business expansion or working capital";
 return {requestedAmount,currency,purpose,termMonths:term?Number(term[1]):null};
}

export function parseObligationRequest(prompt:string,defaultCurrency:string):ObligationDraft{
 const lower=prompt.toLowerCase();
 const type:ObligationDraft["type"]=/rent|landlord|lease/.test(lower)?"rent":/utility|electric|water|internet|power/.test(lower)?"utility":/fleet|vehicle|delivery|car/.test(lower)?"fleet":/generator|diesel|fuel|petrol/.test(lower)?"generator_fuel":/cold.?storage|freezer|warehouse/.test(lower)?"cold_storage":/subscription|saas|software/.test(lower)?"subscription":"other";
 const amountMatch=prompt.match(/[₦$€£]?\s*([\d,]+(?:\.\d+)?)/);
 const amount=amountMatch?Number(amountMatch[1].replace(/,/g,"")):0;
 if(!Number.isFinite(amount)||amount<0)throw new Error("A valid obligation amount is required.");
 const currency=pickCurrencies(prompt)[0]||defaultCurrency;
 const frequency:ObligationDraft["frequency"]=/weekly|week/.test(lower)?"weekly":/quarterly|quarter/.test(lower)?"quarterly":/yearly|annual|year/.test(lower)?"yearly":/once|one.?off|single/.test(lower)?"once":"monthly";
 const dateMatch=prompt.match(/(?:due|on|next)\s+(\d{4}-\d{2}-\d{2})/i);
 const title=prompt.match(/(?:rent|utility|fleet|generator|fuel|cold storage|subscription)\s*(?:for|:|-)?\s*([^,;]+?)(?=\s+(?:at|amount|monthly|weekly|quarterly|yearly|due|on|\$|₦)|,|;|$)/i)?.[1]?.trim()||type.replace(/_/g," ");
 const counterparty=prompt.match(/(?:to|for)\s+([A-Za-z0-9&.' -]{2,80}?)(?=\s+(?:at|amount|monthly|weekly|quarterly|yearly|due|on)|,|;|$)/i)?.[1]?.trim()||null;
 return {type,title,counterparty,amount,currency,frequency,nextDueDate:dateMatch?.[1]||null,notes:null};
}

export function parsePayrollAdvanceRequest(prompt:string,defaultCurrency:string):PayrollAdvanceDraft{
 const employeeMatch=prompt.match(/(?:advance|salary advance|payroll advance)\s+(?:to|for)\s+([A-Za-z0-9.' -]{2,80}?)(?=\s+(?:of|amount|for|over|recover|repay|due)|\s+[₦$€£]|,|$)/i);
 const employeeName=(employeeMatch?.[1]||"").trim();
 if(!employeeName)throw new Error("Name the staff member receiving the advance.");
 const amountMatch=prompt.match(/[₦$€£]?\s*([\d,]+(?:\.\d+)?)/);
 const amount=amountMatch?Number(amountMatch[1].replace(/,/g,"")):0;
 if(!Number.isFinite(amount)||amount<=0)throw new Error("A positive payroll advance amount is required.");
 const currency=pickCurrencies(prompt)[0]||defaultCurrency;
 const periodsMatch=prompt.match(/(?:over|within|in)\s+(\d+)\s+(?:pay|payroll|salary)?\s*(?:periods?|months?)/i);
 const start=prompt.match(/(?:start|begin|from)\s+(\d{4}-\d{2}-\d{2})/i)?.[1]||null;
 const notes=prompt.match(/(?:note|notes)\s*[:\-]\s*(.+)$/i)?.[1]?.trim()||null;
 return {employeeName,amount,currency,recoveryPeriods:periodsMatch?Math.max(1,Number(periodsMatch[1])):1,startDate:start,notes};
}
