import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(){
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const {data:b}=await supabase.from("businesses").select("id,currency").eq("owner_id",user.id).single();
  if(!b)return NextResponse.json({error:"Business not found"},{status:404});
  const [{data:wallets},{data:tx},{data:beneficiaries},{data:limits}]=await Promise.all([
    supabase.from("wallets").select("*").eq("business_id",b.id).order("is_default",{ascending:false}).order("created_at"),
    supabase.from("wallet_transactions").select("*").eq("business_id",b.id).order("created_at",{ascending:false}).limit(100),
    supabase.from("wallet_beneficiaries").select("id,display_name,destination_type,masked_account,bank_name,currency,status").eq("business_id",b.id).order("display_name"),
    supabase.from("wallet_limits").select("*").eq("business_id",b.id).maybeSingle()
  ]);
  return NextResponse.json({business:b, wallets:wallets||[],transactions:tx||[],beneficiaries:beneficiaries||[],limits:limits||null});
}

export async function POST(request:Request){
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await request.json(); const action=String(body?.action||"");
  const {data:b}=await supabase.from("businesses").select("id,currency").eq("owner_id",user.id).single();
  if(!b)return NextResponse.json({error:"Business not found"},{status:404});

  if(action==="create_wallet"){
    const name=String(body?.name||"Operating Wallet").trim(); const currency=String(body?.currency||b.currency||"USD").toUpperCase();
    if(!name)return NextResponse.json({error:"Wallet name is required."},{status:400});
    const {data,error}=await supabase.from("wallets").insert({business_id:b.id,name,currency,wallet_type:String(body?.walletType||"operating"),is_default:!Boolean(body?.hasExistingWallet)}).select().single();
    if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({wallet:data});
  }

  if(action==="create_transfer"){
    const walletId=String(body?.walletId||""); const amount=Number(body?.amount); const currency=String(body?.currency||b.currency).toUpperCase();
    if(!walletId||!Number.isFinite(amount)||amount<=0)return NextResponse.json({error:"Valid wallet and amount are required."},{status:400});
    const {data:wallet}=await supabase.from("wallets").select("id,available_balance,currency,status").eq("id",walletId).eq("business_id",b.id).single();
    if(!wallet)return NextResponse.json({error:"Wallet not found."},{status:404});
    if(wallet.status!=="active")return NextResponse.json({error:"Wallet is not active."},{status:400});
    if(wallet.currency!==currency)return NextResponse.json({error:"Currency mismatch. Create an explicit FX conversion instead."},{status:400});
    const {data:limits}=await supabase.from("wallet_limits").select("*").eq("business_id",b.id).single();
    if(limits?.single_transfer_limit!=null && amount>Number(limits.single_transfer_limit))return NextResponse.json({error:"Transfer exceeds the configured single-transfer limit."},{status:400});
    if(Number(wallet.available_balance)<amount)return NextResponse.json({error:"Insufficient available wallet balance."},{status:400});
    const approvalRequired=Boolean(limits?.require_approval_above_threshold && limits?.approval_threshold!=null && amount>Number(limits.approval_threshold));
    const idem=crypto.randomUUID();
    const {data:row,error}=await supabase.from("wallet_transfer_requests").insert({business_id:b.id,source_wallet_id:walletId,beneficiary_id:body?.beneficiaryId||null,destination_wallet_id:body?.destinationWalletId||null,amount,currency,fee_estimate:0,status:approvalRequired?"awaiting_approval":"queued",idempotency_key:idem,approval_required:approvalRequired,scheduled_for:body?.scheduledFor||null,created_by:user.id,metadata:{channel:"wallet_ui"}}).select().single();
    if(error)return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json({request:row,providerAction:approvalRequired?"approval_required":"connect_provider_to_execute"});
  }

  if(action==="fund_wallet"){
    const walletId=String(body?.walletId||""); const amount=Number(body?.amount); const direction=body?.direction==="withdrawal"?"withdrawal":"deposit";
    const method=String(body?.method||"bank_transfer");
    if(!walletId||!Number.isFinite(amount)||amount<=0)return NextResponse.json({error:"Valid wallet and amount are required."},{status:400});
    const {data:wallet}=await supabase.from("wallets").select("id,currency,status").eq("id",walletId).eq("business_id",b.id).single();
    if(!wallet)return NextResponse.json({error:"Wallet not found."},{status:404});
    const {data:row,error}=await supabase.from("wallet_funding_requests").insert({business_id:b.id,wallet_id:walletId,direction,method,amount,currency:wallet.currency,status:"pending",idempotency_key:crypto.randomUUID(),created_by:user.id,metadata:{channel:"wallet_ui"}}).select().single();
    if(error)return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json({request:row,providerAction:"connect_provider_to_execute"});
  }

  return NextResponse.json({error:"Unsupported wallet action."},{status:400});
}