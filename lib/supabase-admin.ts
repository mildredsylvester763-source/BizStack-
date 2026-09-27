// @ts-nocheck
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createSupabaseClient> | null = null;

export function createAdminClient(){
  if(client) return client;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url || !key) throw new Error("Server-side Supabase service role is not configured");
  client=createSupabaseClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  return client;
}