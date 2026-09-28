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
   const {data:existing}=await admin.from("customers").select("id").eq("business_id",businessId).or("name.ilike."+String(body.name).replace(/,/g," ")+" ,email.ilike."+email.replace(/,/g," ")).limit(1);
   if(existing?.length)return NextResponse.json({data:existing[0],existing:true});
   const {data,error}=await admin.from("customers").insert({business_id:businessId,name:String(body.name),email:body.email||null,phone:body.phone||null,company_name:body.companyName||null,country:body.country||null,city:body.city||null,status:"active",tags:body.tags||[],address:{},metadata:{created_via:"finance_api"}}).select("id,name,email,phone,company_name,status").single();
   if(error)throw error;return NextResponse.json({data,error:null},{status:201});
  }
  if(resource==="transaction"){
   requireScope(key.scopes,"transactions:write");
   if(!body.amount||!body.direction)throw new Error("Transaction amount and direction are required.");
   if(body.externalId){
    const {data:existing}=await admin.from("financial_transactions").select("id,direction,amount,currency,status").eq("business_id",businessId).eq("external_id",body.externalId).maybeSingle();
    if(existing)return NextResponse.json({data:existing,existing:true});
   }
   const {data,error}=await admin.from("financial_transactions").insert({business_id:businessId,financial_account_id:body.financialAccountId||null,source_type:"finance_api",external_id:body.externalId||null,external_reference:body.externalReference||null,direction:body.direction,amount:Number(body.amount),currency:String(body.currency||"USD"),base_amount:body.baseAmount??null,base_currency:body.baseCurrency??null,fx_rate:body.fxRate??null,status:"posted",occurred_at:body.occurredAt||new Date().toISOString(),counterparty_name:body.counterpartyName||null,description:body.description||null,tax_amount:Number(body.taxAmount||0),fee_amount:Number(body.feeAmount||0),reconciled:false,reconciliation_status:"unmatched",metadata:{created_via:"finance_api",client_id:key.client_id}}).select("id,external_id,direction,amount,currency,status,occurred_at").single();
   if(error)throw error;return NextResponse.json({data},{status:201});
  }
  return fail(new Error("Unknown finance API resource."),400);
 }catch(error){return fail(error,400);}
}