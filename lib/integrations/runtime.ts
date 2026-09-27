// @ts-nocheck
import { createClient } from "@/lib/supabase-server";
import { decryptSecret, encryptSecret } from "@/lib/security/secrets";

export type ExternalCredential = {
  apiKey?: string;
  bearerToken?: string;
  username?: string;
  password?: string;
  accessToken?: string;
  refreshToken?: string;
  metadata?: Record<string, unknown>;
};

export async function assertBusinessOwner(businessId: string, userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from("businesses").select("id,name,currency").eq("id", businessId).eq("owner_id", userId).single();
  if (error || !data) throw new Error("Business access denied");
  return data;
}

export async function saveIntegrationCredential(args: {
  businessId: string;
  integrationId: string;
  kind: "api_key"|"oauth"|"bearer"|"basic"|"database"|"webhook"|"custom";
  credential: ExternalCredential;
}) {
  const supabase = createClient();
  const encrypted = encryptSecret(args.credential);
  const { data, error } = await supabase.from("integration_credentials").upsert({
    business_id: args.businessId,
    integration_id: args.integrationId,
    credential_kind: args.kind,
    encrypted_payload: encrypted,
    status: "active",
    metadata: { fields: Object.keys(args.credential).filter(k => k !== "apiKey" && k !== "bearerToken" && k !== "accessToken" && k !== "refreshToken") }
  }, { onConflict: "integration_id" }).select("id,integration_id,credential_kind,status,expires_at,last_verified_at,metadata").single();
  if (error) throw error;
  return data;
}

export async function loadIntegrationCredential(integrationId: string, businessId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from("integration_credentials").select("*").eq("integration_id", integrationId).eq("business_id", businessId).eq("status","active").single();
  if (error) throw error;
  return { row: data, credential: decryptSecret<ExternalCredential>(data.encrypted_payload) };
}

export async function markIntegrationVerified(integrationId: string, businessId: string) {
  const supabase = createClient();
  await supabase.from("integration_credentials").update({last_verified_at:new Date().toISOString(),status:"active"}).eq("integration_id",integrationId).eq("business_id",businessId);
  await supabase.from("integrations").update({status:"connected",error_message:null,last_synced_at:new Date().toISOString()}).eq("id",integrationId).eq("business_id",businessId);
}