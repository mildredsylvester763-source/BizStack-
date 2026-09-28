import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getConfiguredAiProviders } from "@/lib/ai/providers/router";

export async function GET(){
 const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {data:business}=await supabase.from("businesses").select("id").eq("owner_id",user.id).limit(1).maybeSingle();
 if(!business)return NextResponse.json({error:"Business context is not available."},{status:404});
 const providers=getConfiguredAiProviders();
 return NextResponse.json({mode:process.env.BIZSTACK_AI_PROVIDER||"auto",providers,legacyEndpointConfigured:Boolean(process.env.BIZSTACK_AI_API_URL&&process.env.BIZSTACK_AI_API_KEY)});
}
