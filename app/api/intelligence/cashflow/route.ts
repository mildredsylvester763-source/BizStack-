import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { buildCashflowSnapshot } from "@/lib/business-intelligence";

export async function GET(){
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const {data:business}=await supabase.from("businesses").select("id,currency").eq("owner_id",user.id).single();
  if(!business)return NextResponse.json({error:"Business not found."},{status:404});
  const {data:rule}=await supabase.from("cashflow_alert_rules").select("*").eq("business_id",business.id).maybeSingle();
  const horizon=rule?.horizon_days??14, minimumBuffer=Number(rule?.minimum_buffer??0);
  const until=new Date(Date.now()+horizon*86400000).toISOString().slice(0,10);
  const since=new Date(Date.now()-30*86400000).toISOString();
  const [{data:tx},{data:invoices},{data:registers}]=await Promise.all([
    supabase.from("financial_transactions").select("direction,amount,status").eq("business_id",business.id).gte("occurred_at",since).eq("status","posted"),
    supabase.from("invoices").select("total,paid_amount,due_date,status").eq("business_id",business.id).in("status",["sent","overdue"]).not("due_date","is",null).lte("due_date",until),
    supabase.from("cash_register_sessions").select("expected_cash").eq("business_id",business.id).eq("status","open")
  ]);
  const inflows=(tx||[]).filter(x=>x.direction==="inflow").reduce((s,x)=>s+Number(x.amount||0),0);
  const outflows=(tx||[]).filter(x=>x.direction==="outflow").reduce((s,x)=>s+Number(x.amount||0),0);
  const currentBalance=inflows-outflows+(registers||[]).reduce((s,x)=>s+Number(x.expected_cash||0),0);
  const expectedCollections=(invoices||[]).reduce((s,x)=>s+Math.max(0,Number(x.total||0)-Number(x.paid_amount||0)),0);
  const snapshot=buildCashflowSnapshot({currentBalance,recentInflows:inflows,recentOutflows:outflows,expectedInvoiceCollections:expectedCollections,expectedObligations:0,horizonDays:horizon,minimumBuffer});
  return NextResponse.json({currency:business.currency||"USD",rule:rule||null,snapshot});
}
