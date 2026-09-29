import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import OperatorCockpit from "./operator-cockpit";

export default async function AIBuilderPage() {
  const supabase=await await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const {data:business}=await supabase.from("businesses").select("id,name").eq("owner_id",user.id).single();
  if(!business)redirect("/onboarding");
  const {data:conversation}=await supabase.from("ai_conversations").select("id,title").eq("business_id",business.id).order("last_message_at",{ascending:false}).limit(1).maybeSingle();
  const {data:messages}=conversation?.id?await supabase.from("ai_messages").select("id,role,content,metadata").eq("conversation_id",conversation.id).order("created_at",{ascending:true}).limit(80):{data:[]};
  return <main className="min-h-screen bg-[#080a0d]">
    <header className="h-12 border-b border-white/[.07] bg-[#0b0d10] text-white">
      <div className="max-w-[1500px] mx-auto px-4 h-full flex items-center justify-between">
        <div className="flex items-center gap-4"><Link href="/dashboard" className="text-[10px] text-white/30 hover:text-white">← BizStack</Link><span className="text-[10px] text-white/15">/</span><span className="text-[10px] text-white/55">Operator</span></div>
        <div className="flex items-center gap-3 text-[9px] text-white/25"><Link href="/dashboard/integrations" className="hover:text-white">Connections</Link><span>{business.name}</span></div>
      </div>
    </header>
    <section className="max-w-[1500px] mx-auto p-3 md:p-5">
      <OperatorCockpit businessId={business.id} businessName={business.name} initialConversationId={conversation?.id??null} initialMessages={(messages??[]).filter((m:any)=>m.role==="user"||m.role==="assistant").map((m:any)=>({id:m.id,role:m.role,content:m.content,metadata:m.metadata}))}/>
    </section>
  </main>;
}
