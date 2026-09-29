// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { assertBusinessOwner } from "@/lib/integrations/runtime";

const categoryMap:any={banking:"banking",payments:"payments",accounting:"accounting",commerce:"commerce",crm:"crm",communications:"communications",productivity:"productivity",operations:"operations",data:"data",custom:"other"};
const connectionMap:any={oauth:"oauth",api_key:"api_key",bearer:"api_key",basic:"api_key",webhook:"webhook",database:"database",file_import:"file_import",custom:"api_key"};

export async function POST(req:NextRequest){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await req.json().catch(()=>null);
 if(!body?.businessId||!body?.connectorDefinitionId)return NextResponse.json({error:"businessId and connectorDefinitionId are required"},{status:400});
 try{
  await assertBusinessOwner(body.businessId,user.id);
  const {data:def,error}=await supabase.from("connector_definitions").select("id,business_id,name,slug,category,auth_type,base_url,status,capabilities,schema_definition,config").eq("id",body.connectorDefinitionId).eq("business_id",body.businessId).single();
  if(error||!def)throw new Error("Connector definition not found.");
  if(def.status==="disabled")throw new Error("This connector is disabled.");
  const connectionType=connectionMap[def.auth_type]||"api_key";
  const category=categoryMap[def.category]||"other";
  const syncMode=def.capabilities?.webhooks?"near_realtime":def.capabilities?.scheduledSync?"scheduled":"manual";
  const config={...(def.config||{}),connector_definition_id:def.id,base_url:def.base_url||null,test_url:def.config?.test_url||null,credentials_required:def.auth_type!=="file_import"&&def.auth_type!=="native",auth_type:def.auth_type};
  const {data:existing}=await supabase.from("integrations").select("id,status").eq("business_id",body.businessId).eq("provider",def.slug).limit(1);
  if(existing?.length)return NextResponse.json({ok:true,integrationId:existing[0].id,existing:true,status:existing[0].status});
  const {data:integration,error:ie}=await supabase.from("integrations").insert({
   business_id:body.businessId,
   provider:def.slug,
   category,
   connection_type:connectionType,
   display_name:def.name,
   status:"pending",
   sync_mode:syncMode,
   capabilities:{...(def.capabilities||{}),connector_definition_id:def.id,resources:def.schema_definition?.resources||[]},
   config
  }).select("id,display_name,connection_type,status,sync_mode,config").single();
  if(ie||!integration)throw new Error(ie?.message||"Could not activate connector.");
  await supabase.from("connector_definitions").update({status:"testing",updated_at:new Date().toISOString()}).eq("id",def.id).eq("business_id",body.businessId);
  await supabase.from("events").insert({business_id:body.businessId,event_type:"integration.connector_activated",summary:"Connector "+def.name+" was added to Integration Hub and is waiting for credentials or verification.",evidence:{connector_definition_id:def.id,integration_id:integration.id,auth_type:def.auth_type},status:"info",priority:"normal",category:"integrations"});
  return NextResponse.json({ok:true,integrationId:integration.id,connectionType,status:integration.status});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Connector activation failed"},{status:400});}
}
