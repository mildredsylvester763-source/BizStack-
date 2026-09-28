// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime="nodejs";

export async function POST(req:NextRequest,{params}:{params:{slug:string}}){
 const admin=createAdminClient();
 const body=await req.json().catch(()=>({}));
 const {data:menu,error:me}=await admin.from("digital_menus").select("id,business_id,name,currency,status").eq("slug",params.slug).eq("status","published").single();
 if(me||!menu)return NextResponse.json({error:"Menu not found"},{status:404});
 const requested=Array.isArray(body.items)?body.items:[];
 if(!requested.length)return NextResponse.json({error:"At least one menu item is required."},{status:400});
 const ids=requested.map((x:any)=>String(x.menuItemId||"")).filter(Boolean);
 const {data:items}=await admin.from("menu_items").select("id,name,price,available").eq("menu_id",menu.id).in("id",ids);
 const map=new Map((items||[]).map((x:any)=>[x.id,x]));
 const normalized:any[]=[];
 for(const item of requested){
  const menuItem=map.get(String(item.menuItemId||""));
  const quantity=Math.max(1,Number(item.quantity||1));
  if(!menuItem||!menuItem.available)return NextResponse.json({error:"One or more selected items are unavailable."},{status:400});
  normalized.push({menuItemId:menuItem.id,name:menuItem.name,quantity,unitPrice:Number(menuItem.price),lineTotal:Number(menuItem.price)*quantity});
 }
 const total=normalized.reduce((s:number,x:any)=>s+x.lineTotal,0);
 const orderNumber="K-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).slice(2,6).toUpperCase();
 const {data:order,error:oe}=await admin.from("kitchen_orders").insert({business_id:menu.business_id,menu_id:menu.id,order_number:orderNumber,status:"queued",payment_status:"unpaid",total,currency:menu.currency,table_label:body.tableLabel||null,items:normalized,notes:body.notes||null}).select("id,order_number,status,total,currency,items").single();
 if(oe||!order)return NextResponse.json({error:oe?.message||"Could not create kitchen order."},{status:400});
 await admin.from("events").insert({business_id:menu.business_id,event_type:"menu.order.created",summary:"QR menu order "+order.order_number+" was created.",evidence:{kitchen_order_id:order.id,menu_id:menu.id,total},status:"info",priority:"normal",category:"commerce"});
 return NextResponse.json({ok:true,order});
}
