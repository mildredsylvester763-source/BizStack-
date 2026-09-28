// @ts-nocheck
import { createClient } from "@/lib/supabase-server";
import MenuOrderClient from "./MenuOrderClient";

export default async function PublicMenuPage({params}:{params:{slug:string}}){
 const supabase=createClient();
 const {data:menu}=await supabase.from("digital_menus").select("id,name,currency,qr_token,kitchen_flow_enabled,status").eq("slug",params.slug).eq("status","published").single();
 if(!menu)return <main className="min-h-screen bg-ledger grid place-items-center p-6"><div className="text-center"><h1 className="font-display text-3xl">Menu not available</h1><p className="text-sm text-ink/50 mt-2">This menu is not published.</p></div></main>;
 const {data:items}=await supabase.from("menu_items").select("id,name,description,price,category,preparation_minutes,sort_order,available").eq("menu_id",menu.id).eq("available",true).order("sort_order");
 return <main className="min-h-screen bg-ledger"><header className="border-b border-rule bg-white"><div className="max-w-3xl mx-auto px-5 py-6"><p className="text-[10px] uppercase tracking-[.18em] text-vault">Digital menu</p><h1 className="font-display text-4xl mt-2">{menu.name}</h1><p className="text-sm text-ink/45 mt-2">Select items and send the order directly to the kitchen queue.</p></div></header><section className="max-w-3xl mx-auto px-5 py-8"><MenuOrderClient slug={params.slug} currency={menu.currency} items={items||[]} /><div className="mt-8 bg-white border border-rule p-5"><p className="text-xs uppercase tracking-[.12em] text-vault">Customer ordering API</p><p className="text-sm text-ink/55 mt-2">The same menu can be embedded into other clients through <code>/api/public/menu/{params.slug}/order</code>; prices are resolved server-side.</p></div></section></main>;
}
