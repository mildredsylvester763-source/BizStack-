import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // /dashboard itself redirects to /onboarding if this business
      // hasn't been set up yet, so this one destination covers both
      // a brand-new signup and a returning login.
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}