import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { parseWhatsAppOrder } from "@/lib/business-intelligence";

export async function POST(request:Request){
  const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await request.json(); const message=String(body?.message||"").trim();
  if(!message)return NextResponse.json({error:"message is required."},{status:400});
  const {data:b}=await supabase.from("businesses").select("id,currency").eq("owner_id",user.id).single();
  if(!b)return NextResponse.json({error:"Business not found."},{status:404});
  const {data:products}=await supabase.from("products").select("id,name,sku,unit_price,stock_quantity").eq("business_id",b.id);
  const parsed=parseWhatsAppOrder(message,products||[]);
  const {data:event,error}=await supabase.from("whatsapp_order_events").insert({
    business_id:b.id,customer_id:body?.customerId||null,sender:String(body?.sender||"manual"),
    message_text:message,parsed_items:parsed.items,status:parsed.unresolved.length?"needs_review":"parsed"
  }).select("id").single();
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({eventId:event.id,currency:b.currency||"USD",...parsed});
}
