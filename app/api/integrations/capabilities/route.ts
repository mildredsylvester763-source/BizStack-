import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getConnectorCapabilities } from "@/lib/connectors/capabilities";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const capabilities = await getConnectorCapabilities(business.id);
  return NextResponse.json(capabilities);
}