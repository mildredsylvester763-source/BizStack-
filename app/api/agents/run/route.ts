import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { runAgent } from "@/lib/agents/runtime";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const agentId = String(body?.agentId ?? "");
    const input = String(body?.input ?? "").trim();

    if (!agentId || !input) {
      return NextResponse.json({ error: "agentId and input are required." }, { status: 400 });
    }
    if (input.length > 4000) {
      return NextResponse.json({ error: "Input is too long." }, { status: 400 });
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });

    const result = await runAgent({
      agentId,
      businessId: business.id,
      userId: user.id,
      input
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent run failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}