// @ts-nocheck
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase-admin";

export async function authenticateFinanceApi(request:Request){
 const header=request.headers.get("authorization")||"";
 const token=header.startsWith("Bearer ")?header.slice(7).trim():"";
 if(!token.startsWith("bs_live_")) throw new Error("Missing or invalid BizStack finance API bearer token.");
 const hash=crypto.createHash("sha256").update(token).digest("hex");
 const admin=createAdminClient();
 const {data:key,error}=await admin.from("finance_api_keys").select("id,client_id,scopes,status,expires_at,client:finance_api_clients(id,business_id,client_type,status,client_name)").eq("key_hash",hash).maybeSingle();
 if(error||!key||key.status!=="active"||key.client?.status!=="active") throw new Error("Invalid or revoked finance API key.");
 if(key.expires_at&&new Date(key.expires_at).getTime()<Date.now()) throw new Error("Finance API key has expired.");
 await admin.from("finance_api_keys").update({last_used_at:new Date().toISOString()}).eq("id",key.id);
 return {admin,key,businessId:key.client.business_id,client:key.client};
}
export function requireScope(scopes:string[],scope:string){ if(!scopes.includes(scope)) throw new Error("Missing API scope: "+scope); }