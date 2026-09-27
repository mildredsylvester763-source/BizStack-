import { createClient } from '@/lib/supabase-server';
import { buildPlan } from '@/lib/ai/build-engine/capabilities';
import { parseConnectorRequest } from '@/lib/ai/build-engine/connector-local';
import type { BuildMode } from '@/lib/ai/build-engine/types';

function checksum(value:unknown){const json=JSON.stringify(value);let hash=2166136261;for(let i=0;i<json.length;i+=1){hash^=json.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(16);}

export async function runConnectorBuild({businessId,userId,prompt,mode='auto_execute'}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=createClient();
 const {data:business,error}=await supabase.from('businesses').select('id,name,currency,workspace_id').eq('id',businessId).eq('owner_id',userId).single();
 if(error||!business)throw new Error('Business context is not available.');
 const plan=buildPlan({capability:'connector',prompt,mode,context:{business:{id:business.id,name:business.name,currency:business.currency}}});
 const idempotencyKey=checksum({capability:'connector',prompt:prompt.trim(),mode});
 const {data:existing}=await supabase.from('ai_build_runs').select('id,status,result').eq('business_id',businessId).eq('idempotency_key',idempotencyKey).maybeSingle();
 if(existing?.id&&['succeeded','building','testing','planning'].includes(existing.status))return{runId:existing.id,status:existing.status,result:existing.result};
 const {data:run,error:runError}=await supabase.from('ai_build_runs').insert({business_id:businessId,workspace_id:business.workspace_id,created_by:userId,capability_key:'connector',request_text:prompt.trim(),execution_mode:mode,plan,context:{business},idempotency_key:idempotencyKey,status:'planning',started_at:new Date().toISOString()}).select('id').single();
 if(runError||!run)throw new Error(runError?.message||'Could not create connector build run.');
 try{
   const draft=parseConnectorRequest(prompt);
   await supabase.from('ai_build_steps').insert({business_id:businessId,build_run_id:run.id,sequence_no:1,step_key:'parse_connector_spec',step_type:'compiler',status:'succeeded',input:{prompt},output:draft,finished_at:new Date().toISOString()});
   if(!draft.name||!draft.slug||!draft.resources.length)throw new Error('Connector specification is incomplete.');
   await supabase.from('ai_build_steps').insert({business_id:businessId,build_run_id:run.id,sequence_no:2,step_key:'validate_auth',step_type:'validation',status:'succeeded',input:{authType:draft.authType},output:{credentialRequired:true},finished_at:new Date().toISOString()});
   const {data:duplicate}=await supabase.from('connector_definitions').select('id,name,slug,status').eq('business_id',businessId).or('slug.eq.'+draft.slug+',name.ilike.'+draft.name).limit(5);
   if(duplicate?.length)throw new Error('A connector with this name or slug already exists.');
   const schemaDefinition={version:1,resources:draft.resources.map(r=>({...r,localEntityType:r.localEntityType||null})),mapping:{strategy:'explicit_review'},pagination:{strategy:'cursor_or_page_from_provider_definition'},rateLimits:{strategy:'provider_configured'},webhooks:{enabled:draft.capabilities.webhooks}};
   const {data:def,error:defError}=await supabase.from('connector_definitions').insert({
     business_id:businessId,name:draft.name,slug:draft.slug,description:draft.description,category:draft.category,auth_type:draft.authType,base_url:draft.baseUrl,status:'draft',
     capabilities:draft.capabilities,schema_definition:schemaDefinition,config:{...draft.config,test_url:draft.testUrl}
   }).select('id,name,slug,status,auth_type,base_url,category,capabilities,schema_definition,config').single();
   if(defError||!def)throw new Error(defError?.message||'Could not create connector definition.');
   await supabase.from('ai_build_steps').insert({business_id:businessId,build_run_id:run.id,sequence_no:3,step_key:'compile_resources',step_type:'compiler',status:'succeeded',input:{definitionId:def.id},output:{resourceCount:draft.resources.length},finished_at:new Date().toISOString()});
   const tests=[{key:'auth_declared',pass:Boolean(def.auth_type)},{key:'resources_present',pass:Array.isArray(def.schema_definition?.resources)&&def.schema_definition.resources.length>0},{key:'credential_boundary',pass:Boolean(def.config?.requires_credentials)}];
   for(const test of tests)await supabase.from('ai_build_tests').insert({business_id:businessId,build_run_id:run.id,test_key:test.key,test_type:'connector_integrity',status:test.pass?'passed':'failed',assertion:{expected:true},actual:test.pass,completed_at:new Date().toISOString()});
   const failed=tests.filter(t=>!t.pass);if(failed.length)throw new Error('Connector validation failed.');
   const result={connector:def,credentials:'required_before_connection',next:'provide_credentials_and_run_provider_test',tests};
   await supabase.from('ai_build_artifacts').insert({business_id:businessId,build_run_id:run.id,artifact_type:'connector_definition',artifact_key:'connector',version:1,status:'validated',content:result,checksum:checksum(result)});
   await supabase.from('ai_build_runs').update({status:'succeeded',provider_key:'local-connector-compiler',provider_status:'fallback',result,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',run.id).eq('business_id',businessId);
   await supabase.from('events').insert({business_id:businessId,event_type:'ai.build.connector_created',summary:'AI Build Engine created draft connector '+def.name,evidence:{build_run_id:run.id,connector_definition_id:def.id,auth_type:def.auth_type,resources:draft.resources.length},status:'info',priority:'normal',category:'integrations'});
   return{runId:run.id,status:'succeeded',result};
 }catch(error){
   const message=error instanceof Error?error.message:'Connector build failed.';
   await supabase.from('ai_build_runs').update({status:'failed',error_message:message,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',run.id).eq('business_id',businessId);
   throw new Error(message);
 }
}
