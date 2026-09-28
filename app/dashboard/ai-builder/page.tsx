import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import AssistantClient from "./assistant-client";

export default async function AIBuilderPage() {
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");

  const {data:business}=await supabase
    .from("businesses")
    .select("id,name")
    .eq("owner_id",user.id)
    .single();

  if(!business)redirect("/onboarding");

  const {data:conversation}=await supabase
    .from("ai_conversations")
    .select("id,title")
    .eq("business_id",business.id)
    .order("last_message_at",{ascending:false})
    .limit(1)
    .maybeSingle();

  const {data:messages}=conversation?.id
    ? await supabase
        .from("ai_messages")
        .select("id,role,content,metadata")
        .eq("conversation_id",conversation.id)
        .order("created_at",{ascending:true})
        .limit(50)
    : {data:[]};

  return <main className="min-h-screen bg-ledger">
    <header className="border-b border-rule bg-white">
      <div className="max-w-7xl mx-auto px-5 md:px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-xs text-ink/45">← Dashboard</Link>
          <h1 className="font-display text-2xl mt-1">BizStack Operator</h1>
          <p className="text-xs text-ink/45 mt-1">AI business operating interface</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-ink/45">
          <Link href="/dashboard/website" className="hover:text-ink">Website</Link>
          <Link href="/dashboard/integrations" className="hover:text-ink">Connections</Link>
        </div>
      </div>
    </header>

    <section className="max-w-7xl mx-auto px-5 md:px-6 py-7 md:py-10">
      <div className="max-w-4xl mb-7">
        <p className="text-xs uppercase tracking-[.18em] text-vault">The business assistant</p>
        <h2 className="font-display text-4xl md:text-5xl mt-2">You tell it the outcome. BizStack handles the route.</h2>
        <p className="text-sm md:text-base text-ink/55 mt-3 leading-7">
          The assistant can inspect your real business data, choose connected capabilities, perform safe operations,
          keep the conversation in context and pause when an action genuinely needs your approval.
        </p>
      </div>

      <AssistantClient
        businessId={business.id}
        businessName={business.name}
        initialConversationId={conversation?.id ?? null}
        initialMessages={(messages ?? []).filter((m:any)=>m.role==="user"||m.role==="assistant").map((m:any)=>({id:m.id,role:m.role,content:m.content,metadata:m.metadata}))}
      />
    </section>
  </main>;
}
