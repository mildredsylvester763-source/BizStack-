import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { runUniversalAssistant } from "@/lib/assistant/runtime";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const input = typeof body?.input === "string" ? body.input.trim() : "";
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId : null;
    const clientMessageId = typeof body?.clientMessageId === "string" ? body.clientMessageId : null;
    const projectId = typeof body?.context?.projectId === "string" ? body.context.projectId : null;
    const businessId = typeof body?.context?.businessId === "string" ? body.context.businessId : null;

    if (!input) return NextResponse.json({ error: "Tell BizStack what you want handled." }, { status: 400 });
    if (input.length > 12000) return NextResponse.json({ error: "That request is too long for one operator turn." }, { status: 400 });

    const result = await runUniversalAssistant({
      userId: user.id,
      businessId,
      conversationId,
      input,
      clientMessageId,
      projectId
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assistant run failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}