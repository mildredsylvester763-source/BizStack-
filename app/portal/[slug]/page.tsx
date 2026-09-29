import { createAdminClient } from "@/lib/supabase-admin";
import PortalClient from "./portal-client";

export default async function PublicPortal({params}:{params:Promise<{slug:string}>}){
 const { slug } = await params;
 const admin=createAdminClient();
 const {data:portal}=await admin.from("customer_portals").select("id,name,slug,status,settings").eq("slug",slug).maybeSingle();
 if(!portal || portal.status!=="published") return <main className="min-h-screen grid place-items-center bg-[#f5f4ef] text-[#151515]"><div className="text-center p-8"><h1 className="text-xl font-semibold">Portal unavailable</h1><p className="text-sm text-black/45 mt-2">This customer portal is not currently published.</p></div></main>;
 return <PortalClient slug={portal.slug} initial={{authenticated:false,portal}}/>;
}
