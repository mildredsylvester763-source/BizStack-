import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

async function getBusiness() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, business: null };

  const { data: business } = await supabase
    .from("businesses")
    .select("id,name")
    .eq("owner_id", user.id)
    .single();

  return { supabase, user, business };
}

export async function GET(request: Request) {
  const { supabase, user, business } = await getBusiness();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!business) return NextResponse.json({ error: "Business context is not available." }, { status: 400 });

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");
  const projectId = url.searchParams.get("projectId");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 40), 1), 100);

  const { data: conversations, error } = await supabase
    .from("ai_conversations")
    .select("id,title,last_message_at,created_at,updated_at,metadata")
    .eq("business_id", business.id)
    .order("last_message_at", { ascending: false })
    .limit(limit);

  const scopedConversations = projectId
    ? (conversations ?? []).filter((item) => item.metadata?.project_id === projectId)
    : (conversations ?? []);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!conversationId) return NextResponse.json({ conversations: scopedConversations.map(({ metadata: _metadata, ...item }) => item) });

  const belongsToBusiness = scopedConversations.some((item) => item.id === conversationId);
  if (!belongsToBusiness) {
    const { data: existing } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const { data: messages, error: messagesError } = await supabase
    .from("ai_messages")
    .select("id,role,content,metadata,created_at")
    .eq("conversation_id", conversationId)
    .eq("business_id", business.id)
    .order("created_at", { ascending: true })
    .limit(100);

  if (messagesError) return NextResponse.json({ error: messagesError.message }, { status: 500 });

  return NextResponse.json({
    conversations: scopedConversations.map(({ metadata: _metadata, ...item }) => item),
    messages: (messages ?? []).filter((item) => item.role === "user" || item.role === "assistant")
  });
}
