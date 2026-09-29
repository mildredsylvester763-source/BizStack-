import { createClient } from "@/lib/supabase-server";

export async function getConnectorCapabilities(businessId: string) {
  const supabase = await createClient();
  const [{ data: integrations, error: integrationsError }, { data: definitions, error: definitionsError }, { data: syncState, error: syncError }] = await Promise.all([
    supabase.from("integrations").select("id,provider,category,connection_type,display_name,status,sync_mode,external_account_id,last_synced_at,last_event_at,error_message,capabilities").eq("business_id", businessId).order("display_name"),
    supabase.from("connector_definitions").select("id,name,slug,category,auth_type,status,capabilities,last_tested_at,last_error").eq("business_id", businessId).order("name"),
    supabase.from("connector_sync_state").select("connector_definition_id,resource,cursor_value,last_synced_at,status,records_synced,last_error,metadata").eq("business_id", businessId)
  ]);
  if (integrationsError) throw integrationsError;
  if (definitionsError) throw definitionsError;
  if (syncError) throw syncError;

  return {
    integrations: integrations ?? [],
    connector_definitions: (definitions ?? []).map((definition) => ({
      ...definition,
      sync_state: (syncState ?? []).filter((state) => state.connector_definition_id === definition.id)
    }))
  };
}
