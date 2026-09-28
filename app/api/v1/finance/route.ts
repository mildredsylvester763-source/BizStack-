// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { authenticateFinanceApi, requireScope } from "@/lib/finance-api/auth";
export const runtime="nodejs";
function fail(error:unknown,status=401){return NextResponse.json({error:error instanceof Error?error.message:"Finance API request failed"},{status});}
export async function GET(req:NextRequest){
 try{
  const {admin,key,businessId}=await authenticateFinanceApi(req);
  const scope=req.nextUrl.searchParams.get("resource")||"summary";
  if(scope==="customers"){
   requireScope(key.scopes,"customers:read");
   const {data,error}=await admin.from("customers").select("id,name,email,phone,company_name,status,country,city,created_at,updated_at").eq("business_id",businessId).order("created_at",{ascending:false}).limit(200);
   if(error)throw error;return NextResponse.json({data:data||[]});
  }
  if(scope==="invoices"){
   requireScope(key.scopes,"invoices:read");
   const {data,error}=await admin.from("invoices").select("id,invoice_number,status,issue_date,due_date,currency,subtotal,tax_amount,total,paid_amount,customer_id").eq("business_id",businessId).order("created_at",{ascending:false}).limit(200);
   if(error)throw error;return NextResponse.json({data:data||[]});
  }
  if(scope==="transactions"){
   requireScope(key.scopes,"transactions:read");
   const {data,error}=await admin.from("financial_transactions").select("id,external_id,external_reference,direction,amount,currency,base_amount,base_currency,fx_rate,status,occurred_at,counterparty_name,description,reconciled,reconciliation_status").eq("business_id",businessId).order("occurred_at",{ascending:false}).limit(200);
   if(error)throw error;return NextResponse.json({data:data||[]});
  }
  const {data:transactions}=await admin.from("financial_transactions").select("direction,amount,base_amount,currency,occurred_at").eq("business_id",businessId).eq("status","posted").gte("occurred_at",new Date(Date.now()-90*86400000).toISOString());
  const revenue=(transactions||[]).filter(x=>x.direction==="inflow").reduce((s,x)=>s+Number(x.base_amount??x.amount??0),0);
  const expenses=(transactions||[]).filter(x=>x.direction==="outflow").reduce((s,x)=>s+Number(x.base_amount??x.amount??0),0);
  requireScope(key.scopes,"reports:read");
  return NextResponse.json({businessId,periodDays:90,revenue,expenses,netCashflow:revenue-expenses});
 }catch(error){return fail(error);}
}
export async function POST(req:NextRequest){
 try{
  const {admin,key,businessId}=await authenticateFinanceApi(req);
  const body=await req.json().catch(()=>({}));
  const resource=String(body.resource||"");
  if(resource==="customer"){
   requireScope(key.scopes,"customers:write");
   if(!body.name)throw new Error("Customer name is required.");
   const email=String(body.email||"");
   let existing:any[]=[];
   if(email){
    const {data:emailMatches}=await admin.from("customers").select("id").eq("business_id",businessId).ilike("email",email).limit(1);
    existing=emailMatches||[];
   }
   if(!existing.length){
    const {data:nameMatches}=await admin.from("customers").select("id").eq("business_id",businessId).ilike("name",String(body.name)).limit(1);
    existing=nameMatches||[];
   }
   if(existing.length)return NextResponse.json({data:existing[0],existing:true});
   const {data,error}=await admin.from("customers").insert({business_id:businessId,name:String(body.name),email:body.email||null,phone:body.phone||null,company_name:body.companyName||null,country:body.country||null,city:body.city||null,status:"active",tags:body.tags||[],address:{},metadata:{created_via:"finance_api"}}).select("id,name,email,phone,company_name,status").single();
   if(error)throw error;return NextResponse.json({data,error:null},{status:201});
  }
  if(resource==="invoice"){
   requireScope(key.scopes,"invoices:write");
   if(!body.customerId||!body.lines?.length)throw new Error("customerId and at least one invoice line are required.");
   const {data:customer}=await admin.from("customers").select("id").eq("id",body.customerId).eq("business_id",businessId).single();
   if(!customer)throw new Error("Customer does not belong to this business.");
   const lines=(body.lines||[]).map((line:any)=>({description:String(line.description||"").trim(),quantity:Number(line.quantity||1),unit_price:Number(line.unitPrice||0)}));
   if(lines.some((line:any)=>!line.description||line.quantity<=0||line.unit_price<0))throw new Error("Invoice lines contain invalid quantities or prices.");
   const subtotal=lines.reduce((sum:number,line:any)=>sum+(line.quantity*line.unit_price),0);
   const discountType=body.discountType==="percentage"||body.discountType==="fixed"?body.discountType:"none";
   const discountValue=Math.max(0,Number(body.discountValue||0));
   const discountAmount=discountType==="percentage"?Math.min(subtotal,subtotal*Math.min(discountValue,100)/100):Math.min(subtotal,discountValue);
   const taxRate=Math.max(0,Math.min(100,Number(body.taxRate||0)));
   const taxAmount=Math.max(0,(subtotal-discountAmount)*taxRate/100);
   const total=subtotal-discountAmount+taxAmount;
   const invoiceNumber="INV-API-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).slice(2,7).toUpperCase();
   const {data:invoice,error:ie}=await admin.from("invoices").insert({
    business_id:businessId,customer_id:customer.id,invoice_number:invoiceNumber,status:"draft",
    due_date:body.dueDate||null,currency:String(body.currency||"USD"),issue_date:body.issueDate||new Date().toISOString().slice(0,10),
    payment_terms:String(body.paymentTerms||"Due on receipt"),reference:body.reference||null,purchase_order:body.purchaseOrder||null,
    notes:body.notes||null,terms_and_conditions:body.terms||null,discount_type:discountType,discount_value:discountValue,
    tax_rate:taxRate,subtotal,discount_amount:discountAmount,tax_amount:taxAmount,total,paid_amount:0,
    tax_enabled:taxRate>0,tax_name:taxRate>0?(body.taxName||"Tax"):null,tax_treatment:"none",tax_inclusive:false
   }).select("id,invoice_number,status,total,currency,due_date,customer_id").single();
   if(ie||!invoice)throw new Error(ie?.message||"Could not create API invoice.");
   const {error:lineError}=await admin.from("invoice_items").insert(lines.map((line:any)=>({invoice_id:invoice.id,description:line.description,quantity:line.quantity,unit_price:line.unit_price})));
   if(lineError){await admin.from("invoices").delete().eq("id",invoice.id).eq("business_id",businessId);throw lineError;}
   return NextResponse.json({data:{invoice,lines}},{status:201});
  }
  if(resource==="transaction"){
   requireScope(key.scopes,"transactions:write");
   if(!body.amount||!body.direction)throw new Error("Transaction amount and direction are required.");
   if(body.externalId){
    const {data:existing}=await admin.from("financial_transactions").select("id,direction,amount,currency,status").eq("business_id",businessId).eq("external_id",body.externalId).maybeSingle();
    if(existing)return NextResponse.json({data:existing,existing:true});
   }
   const {data,error}=await admin.from("financial_transactions").insert({business_id:businessId,financial_account_id:body.financialAccountId||null,source_type:"api",external_id:body.externalId||null,external_reference:body.externalReference||null,direction:body.direction,amount:Number(body.amount),currency:String(body.currency||"USD"),base_amount:body.baseAmount??null,base_currency:body.baseCurrency??null,fx_rate:body.fxRate??null,status:"posted",occurred_at:body.occurredAt||new Date().toISOString(),counterparty_name:body.counterpartyName||null,description:body.description||null,tax_amount:Number(body.taxAmount||0),fee_amount:Number(body.feeAmount||0),reconciled:false,reconciliation_status:"unmatched",metadata:{created_via:"finance_api",client_id:key.client_id}}).select("id,external_id,direction,amount,currency,status,occurred_at").single();
   if(error)throw error;return NextResponse.json({data},{status:201});
  }
  return fail(new Error("Unknown finance API resource."),400);
 }catch(error){return fail(error,400);}
}