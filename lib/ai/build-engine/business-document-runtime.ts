import { createClient } from '@/lib/supabase-server';
import { buildPlan } from '@/lib/ai/build-engine/capabilities';
import { parseBusinessDocumentRequest } from '@/lib/ai/build-engine/business-document-local';
import type { BuildMode } from '@/lib/ai/build-engine/types';

function checksum(value:unknown){const json=JSON.stringify(value);let hash=2166136261;for(let i=0;i<json.length;i+=1){hash^=json.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(16);}

export async function runBusinessDocumentBuild({businessId,userId,prompt,mode='draft_only'}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
 const supabase=createClient();
 const {data:business,error}=await supabase.from('businesses').select('id,name,currency,industry,description,workspace_id').eq('id',businessId).eq('owner_id',userId).single();
 if(error||!business)throw new Error('Business context is not available.');
 const draft=parseBusinessDocumentRequest(prompt);
 const plan=buildPlan({capability:'business_plan',prompt,mode,context:{business}});
 const idempotencyKey=checksum({capability:'business_plan',prompt:prompt.trim(),mode});
 const {data:existing}=await supabase.from('ai_build_runs').select('id,status,result').eq('business_id',businessId).eq('idempotency_key',idempotencyKey).maybeSingle();
 if(existing?.id&&['succeeded','building','testing','planning'].includes(existing.status))return{runId:existing.id,status:existing.status,result:existing.result};
 const {data:run,error:runError}=await supabase.from('ai_build_runs').insert({business_id:businessId,workspace_id:business.workspace_id,created_by:userId,capability_key:'business_plan',request_text:prompt.trim(),execution_mode:mode,plan,context:{business,draft},idempotency_key:idempotencyKey,status:'planning',started_at:new Date().toISOString()}).select('id').single();
 if(runError||!run)throw new Error(runError?.message||'Could not create document build run.');
 try{
   const sections={
     executive_summary:'A concise description of the business, opportunity, operating model and intended outcome.',
     business_overview:(business.description||business.name+' is a business operating in '+(business.industry||'its target market')+'.'),
     problem:'Define the customer problem, unmet need or funding constraint addressed by this document.',
     solution:'Describe the product/service, delivery model and why customers can obtain measurable value.',
     market:'Define target customers, market segments, competitors, positioning and the assumptions that should be validated before submission.',
     operations:'Describe people, suppliers, locations, technology, workflow, compliance and delivery capacity.',
     marketing_sales:'Describe acquisition channels, sales motion, retention, partnerships and measurable growth targets.',
     financial_model:{base_currency:business.currency||'USD',funding_request:draft.fundingAmount,assumptions:['Revenue and cost projections must be replaced with verified business data before submission.','Funding use should reconcile to a documented budget.','Market-size claims require source evidence before external submission.']},
     funding_request:{amount:draft.fundingAmount,purpose:draft.goal,funder:draft.funderName,audience:draft.audience},
     milestones:['0-90 days: establish operational baseline and execute priority improvements.','90-180 days: measure traction, margins and customer retention.','180-365 days: scale validated channels and strengthen controls.'],
     risks_and_mitigations:['Demand risk → validate with measured sales/lead evidence.','Cash-flow risk → maintain rolling cash forecast and scenario analysis.','Execution risk → assign accountable owners and dated milestones.'],
     impact_metrics:['Revenue growth','Gross margin','Active customers','Retention','Jobs created','Operational efficiency']
   };
   const assumptions=(sections.financial_model as any).assumptions;
   const validation={sections:Object.keys(sections).length,missingCritical:[] as string[],submissionReady:false,reason:'Draft requires evidence review and business-specific financial inputs before external submission.'};
   const {data:latest}=await supabase.from('ai_business_documents').select('version').eq('business_id',businessId).eq('title',draft.title).order('version',{ascending:false}).limit(1).maybeSingle();
   const version=Number(latest?.version||0)+1;
   const {data:document,error:docError}=await supabase.from('ai_business_documents').insert({business_id:businessId,document_type:draft.documentType,title:draft.title,status:'draft',version,source_prompt:prompt,audience:draft.audience,funder_name:draft.funderName,content:{goal:draft.goal,sections},assumptions,validation,generated_by:'local_business_document_compiler'},).select('id,title,document_type,status,version,content,assumptions,validation,created_at').single();
   if(docError||!document)throw new Error(docError?.message||'Could not save business document.');
   const result={document,version,validation};
   await supabase.from('ai_build_artifacts').insert({business_id:businessId,build_run_id:run.id,artifact_type:'business_document',artifact_key:document.id,version,status:'validated',content:result,checksum:checksum(result)});
   await supabase.from('ai_build_runs').update({status:'succeeded',provider_key:'local-business-document-compiler',provider_status:'fallback',result,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',run.id).eq('business_id',businessId);
   await supabase.from('events').insert({business_id:businessId,event_type:'ai.build.business_document_created',summary:draft.title+' generated as version '+version,evidence:{build_run_id:run.id,document_id:document.id,document_type:draft.documentType,version},status:'info',priority:'normal',category:'ai_documents'});
   return{runId:run.id,status:'succeeded',result};
 }catch(error){const message=error instanceof Error?error.message:'Business document build failed.';await supabase.from('ai_build_runs').update({status:'failed',error_message:message,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',run.id).eq('business_id',businessId);throw new Error(message);}
}