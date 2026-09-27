// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { assertBusinessOwner, loadIntegrationCredential } from "@/lib/integrations/runtime";

export const runtime="nodejs";

function checksum(value:unknown){
  const json=JSON.stringify(value); let hash=2166136261;
  for(let i=0;i<json.length;i+=1){hash^=json.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16);
}

function safeExternalUrl(value:string){
  const url=new URL(value);
  if(!["https:","http:"].includes(url.protocol)) throw new Error("Connector URLs must use HTTP or HTTPS.");
  const host=url.hostname.toLowerCase();
  if(host==="localhost"||host.endsWith(".localhost")||host==="metadata.google.internal"||host==="host.docker.internal"||host==="0.0.0.0"||host==="127.0.0.1"||host==="::1"||host==="169.254.169.254") throw new Error("Private or metadata endpoints are not allowed.");
  const ipv4=host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1})$/);
  if(ipv4){
    const [a,b]=ipv4.slice(1).map(Number);
    if(a===10||a===127||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)) throw new Error("Private network addresses are not allowed.");
  }
  return url;
}

function extractRecords(body:any){
  if(Array.isArray(body)) return body;
  if(Array.isArray(body?.data)) return body.data;
  if(Array.isArray(body?.items)) return body.items;
  if(Array.isArray(body?.results)) return body.results;
  if(Array.isArray(body?.records)) return body.records;
  if(body&&typeof body==="object") return [body];
  return [];
}

function nextCursor(body:any){
  return body?.next_cursor??body?.nextCursor??body?.pagination?.next_cursor??body?.pagination?.nextCursor??body?.meta?.next_cursor??body?.meta?.nextCursor??null;
}

function externalId(record:any,index:number){
  const value=record?.id??record?.uuid??record?._id??record?.external_id??record?.externalId;
  return String(value??checksum({record,index}));
}

export async function POST(req:NextRequest){
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await req.json().catch(()=>({}));
  const businessId=String(body.businessId||"");
  const integrationId=String(body.integrationId||"");
  const resourceKey=String(body.resourceKey||"");
  if(!businessId||!integrationId||!resourceKey)return NextResponse.json({error:"businessId, integrationId and resourceKey are required"},{status:400});
  try{
    await assertBusinessOwner(businessId,user.id);
    const {data:integration,error:ie}=await supabase.from("integrations").select("id,business_id,provider,status,config,capabilities").eq("id",integrationId).eq("business_id",businessId).single();
    if(ie||!integration)throw new Error("Integration not found.");
    if(integration.status!=="connected")throw new Error("Connect and verify the integration before syncing.");
    const definitionId=integration.config?.connector_definition_id;
    if(!definitionId)throw new Error("This integration is not backed by a custom connector definition.");
    const {data:def,error:de}=await supabase.from("connector_definitions").select("id,name,status,auth_type,base_url,capabilities,schema_definition,config").eq("id",definitionId).eq("business_id",businessId).single();
    if(de||!def)throw new Error("Connector definition not found.");
    const resource=(def.schema_definition?.resources||[]).find((r:any)=>r.key===resourceKey||r.label===resourceKey);
    if(!resource)throw new Error("Connector resource not found.");
    if(resource.method&&resource.method!=="GET")throw new Error("Only read/sync resources are enabled by this generic executor. Write actions require an explicit connector action handler.");
    const base=String(def.base_url||"").replace(/\/$/,"");
    const endpoint=String(resource.endpoint||"/");
    const runUrl=safeExternalUrl(base+endpoint);
    const {credential}=await loadIntegrationCredential(integrationId,businessId);
    const run=await supabase.from("connector_runs").insert({business_id:businessId,integration_id:integrationId,connector_definition_id:definitionId,run_type:"sync",status:"running",details:{resource:resourceKey}}).select("id").single();
    if(run.error||!run.data)throw new Error(run.error?.message||"Could not create connector run.");
    const runId=run.data.id;
    let cursor:string|null=null, page=0,total=0;
    try{
      while(page<25&&total<2000){
        const url=new URL(runUrl.toString());
        if(cursor)url.searchParams.set("cursor",cursor);
        else if(page>0)url.searchParams.set("page",String(page+1));
        const headers:Record<string,string>={accept:"application/json"};
        const authType=def.auth_type;
        if(authType==="bearer"&&credential.apiKey)headers.Authorization=`Bearer ${credential.apiKey}`;
        else if(credential.apiKey)headers["x-api-key"]=credential.apiKey;
        if(credential.bearerToken||credential.accessToken)headers.Authorization=`Bearer ${credential.bearerToken||credential.accessToken}`;
        const response=await fetch(url.toString(),{headers,cache:"no-store"});
        const text=await response.text();
        if(!response.ok)throw new Error(`Provider returned HTTP ${response.status}: ${text.slice(0,500)}`);
        let parsed:any;try{parsed=JSON.parse(text);}catch{throw new Error("Provider returned non-JSON content.");}
        const records=extractRecords(parsed);
        for(let i=0;i<records.length&&total<2000;i+=1){
          const record=records[i];
          const extId=externalId(record,i);
          const updated=record?.updated_at??record?.updatedAt??record?.modified_at??record?.modifiedAt??null;
          await supabase.from("integration_resources").upsert({
            business_id:businessId,integration_id:integrationId,resource_type:resourceKey,external_id:extId,
            local_entity_type:resource.localEntityType||null,local_entity_id:null,external_payload:record,
            content_hash:checksum(record),external_updated_at:updated,last_synced_at:new Date().toISOString(),
            sync_status:"synced",metadata:{connector_definition_id:definitionId}
          },{onConflict:"integration_id,resource_type,external_id"});
          total+=1;
        }
        const candidate=nextCursor(parsed);
        if(!candidate||records.length===0)break;
        cursor=String(candidate); page+=1;
      }
      await supabase.from("connector_sync_state").upsert({business_id:businessId,connector_definition_id:definitionId,resource:resourceKey,cursor_value:cursor,last_synced_at:new Date().toISOString(),status:"succeeded",records_synced:total,last_error:null,metadata:{pages:page+1}},{onConflict:"connector_definition_id,resource"});
      await supabase.from("connector_runs").update({status:"succeeded",records_read:total,records_written:total,finished_at:new Date().toISOString(),details:{resource:resourceKey,pages:page+1,cursor}}).eq("id",runId).eq("business_id",businessId);
      await supabase.from("integrations").update({last_synced_at:new Date().toISOString(),error_message:null}).eq("id",integrationId).eq("business_id",businessId);
      await supabase.from("events").insert({business_id:businessId,event_type:"integration.sync.completed",summary:"Connector synced "+total+" "+resourceKey+" records.",evidence:{connector_definition_id:definitionId,integration_id:integrationId,resource:resourceKey,records:total},status:"info",priority:"normal",category:"integrations"});
      return NextResponse.json({ok:true,status:"succeeded",resource:resourceKey,records:total,pages:page+1});
    }catch(error){
      const message=error instanceof Error?error.message:"Connector sync failed.";
      await supabase.from("connector_sync_state").upsert({business_id:businessId,connector_definition_id:definitionId,resource:resourceKey,cursor_value:cursor,last_synced_at:new Date().toISOString(),status:"failed",records_synced:total,last_error:message,metadata:{pages:page+1}},{onConflict:"connector_definition_id,resource"});
      await supabase.from("connector_runs").update({status:"failed",records_read:total,records_written:0,finished_at:new Date().toISOString(),error_message:message}).eq("id",runId).eq("business_id",businessId);
      await supabase.from("integrations").update({status:"error",error_message:message}).eq("id",integrationId).eq("business_id",businessId);
      return NextResponse.json({ok:false,status:"failed",message,records:total},{status:502});
    }
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Connector sync failed"},{status:400});}
}
