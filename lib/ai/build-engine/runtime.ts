import { createClient } from '@/lib/supabase-server';
import { buildPlan, countWebsiteRequirements } from '@/lib/ai/build-engine/capabilities';
import { generateWebsiteSpec } from '@/lib/ai/build-engine/provider';
import type { BuildContext, BuildMode, WebsiteSpec } from '@/lib/ai/build-engine/types';

async function ownerBusiness(businessId: string, userId: string) {
  const supabase = createClient();
  const { data: business, error } = await supabase.from('businesses').select('id,name,industry,currency,contact_email,contact_phone,organization_id,workspace_id').eq('id', businessId).eq('owner_id', userId).single();
  if (error || !business) throw new Error('Business context is not available.');
  return { supabase, business };
}

function checksum(value: unknown) {
  const json = JSON.stringify(value); let hash = 2166136261;
  for (let i=0;i<json.length;i+=1) { hash ^= json.charCodeAt(i); hash = Math.imul(hash,16777619); }
  return (hash >>> 0).toString(16);
}

function websiteContext(business: any, existingWebsite?: unknown): BuildContext {
  return {
    business: { id: business.id, name: business.name, industry: business.industry, currency: business.currency, contactEmail: business.contact_email, contactPhone: business.contact_phone },
    websiteId: existingWebsite && typeof existingWebsite === 'object' && 'id' in existingWebsite ? String((existingWebsite as {id?: unknown}).id ?? '') : null,
    existingWebsite
  };
}

async function applyWebsiteSpec(supabase: any, businessId: string, websiteId: string | null | undefined, spec: WebsiteSpec, publish: boolean) {
  let finalWebsiteId = websiteId || null;
  if (finalWebsiteId) {
    const { data: existing } = await supabase.from('websites').select('id').eq('id', finalWebsiteId).eq('business_id', businessId).single();
    if (!existing) throw new Error('Website not found for this build.');
  } else {
    const { data: created, error } = await supabase.from('websites').insert({
      business_id: businessId, name: spec.name, subdomain: spec.subdomain, status: 'draft',
      settings: { theme: spec.theme, navigation: spec.navigation, features: spec.features, forms: spec.forms, integrations: spec.integrations, seo: spec.seo, analytics: { enabled:false } }
    }).select('id').single();
    if (error || !created) throw new Error(error?.message || 'Could not create website.');
    finalWebsiteId = created.id;
  }

  const { data: oldPages } = await supabase.from('website_pages').select('id,slug,version').eq('website_id', finalWebsiteId);
  const existingBySlug = new Map((oldPages ?? []).map((p:any) => [p.slug, p]));
  for (const item of spec.pages) {
    const existing = existingBySlug.get(item.slug);
    const payload = { website_id: finalWebsiteId, slug: item.slug, title: item.title, page_type: item.pageType, content: { sections: item.sections, generated_by: 'bizstack-build-engine', generated_at: new Date().toISOString() }, seo: item.seo, status: publish ? 'published' : 'draft', version: (existing?.version ?? 0) + 1, updated_at: new Date().toISOString() };
    if (existing?.id) await supabase.from('website_pages').update(payload).eq('id', existing.id).eq('website_id', finalWebsiteId);
    else await supabase.from('website_pages').insert(payload);
  }

  const { data: current } = await supabase.from('websites').select('current_version').eq('id', finalWebsiteId).eq('business_id', businessId).single();
  await supabase.from('websites').update({
    name: spec.name, subdomain: spec.subdomain, settings: { theme: spec.theme, navigation: spec.navigation, features: spec.features, forms: spec.forms, integrations: spec.integrations, seo: spec.seo },
    status: publish ? 'published' : 'draft', current_version: (current?.current_version ?? 0) + 1, published_at: publish ? new Date().toISOString() : null, updated_at: new Date().toISOString()
  }).eq('id', finalWebsiteId).eq('business_id', businessId);
  return finalWebsiteId;
}

function structuralTests(spec: WebsiteSpec) {
  return [
    { key:'pages_present', pass:spec.pages.length >= 1, expected:'at least one page', actual:spec.pages.length },
    { key:'home_present', pass:spec.pages.some((p)=>p.slug === 'home'), expected:'home page', actual:spec.pages.map((p)=>p.slug) },
    { key:'contact_surface_present', pass:spec.pages.some((p)=>p.slug === 'contact'), expected:'contact page', actual:spec.pages.map((p)=>p.slug) },
    { key:'all_sections_have_ids', pass:spec.pages.every((p)=>p.sections.every((s)=>Boolean(s.id))), expected:'section ids', actual:spec.pages.flatMap((p)=>p.sections).map((s)=>s.id) },
    { key:'seo_present', pass:spec.pages.every((p)=>Boolean(p.seo.title && p.seo.description)), expected:'SEO title and description for every page', actual:spec.pages.map((p)=>p.seo) }
  ];
}

export async function runWebsiteBuild(args: { businessId:string; userId:string; prompt:string; websiteId?:string|null; mode?:BuildMode; publish?:boolean }) {
  const { businessId, userId, prompt, websiteId, mode='ask_first', publish=false } = args;
  if (!prompt.trim()) throw new Error('Describe what you want BizStack to build.');
  const { supabase, business } = await ownerBusiness(businessId,userId);
  let existingWebsite:any = null;
  if (websiteId) { const {data}=await supabase.from('websites').select('id,name,subdomain,status,current_version,settings').eq('id',websiteId).eq('business_id',businessId).single(); existingWebsite=data ?? null; }
  const context=websiteContext(business,existingWebsite);
  const plan=buildPlan({capability:'website',prompt,mode,websiteId,context});
  const idempotencyKey=checksum({capability:'website',websiteId:websiteId??null,prompt:prompt.trim(),mode});
  const existing=await supabase.from('ai_build_runs').select('id,status,result').eq('business_id',businessId).eq('idempotency_key',idempotencyKey).maybeSingle();
  if(existing.data?.id && ['succeeded','building','testing','planning'].includes(existing.data.status)) return {runId:existing.data.id,status:existing.data.status,result:existing.data.result};

  const {data:run,error:runError}=await supabase.from('ai_build_runs').insert({ business_id:businessId, workspace_id:business.workspace_id, created_by:userId, capability_key:'website', request_text:prompt.trim(), execution_mode:mode, plan, context, idempotency_key:idempotencyKey, status:'planning', started_at:new Date().toISOString() }).select('id').single();
  if(runError || !run) throw new Error(runError?.message || 'Could not create build run.');

  try {
    for(const step of plan.steps.slice(0,4)){
      const started=new Date().toISOString();
      await supabase.from('ai_build_steps').insert({ business_id:businessId, build_run_id:run.id, sequence_no:step.order, step_key:step.key, step_type:'compiler', status:'running', requires_approval:step.requiresApproval, input:{prompt}, started_at:started });
      await supabase.from('ai_build_steps').update({status:'succeeded',finished_at:new Date().toISOString()}).eq('build_run_id',run.id).eq('sequence_no',step.order);
    }
    await supabase.from('ai_build_runs').update({status:'building'}).eq('id',run.id).eq('business_id',businessId);
    const generated=await generateWebsiteSpec(prompt,context);
    if(!generated.spec) throw new Error(generated.error || 'The build engine could not produce a website specification.');
    const spec=generated.spec;
    const metrics=countWebsiteRequirements(spec);
    await supabase.from('ai_build_runs').update({provider_key:generated.providerKey,provider_status:generated.status === 'available' ? 'available' : generated.status === 'fallback' ? 'fallback':'failed',status:'testing',plan:{...plan,metrics}}).eq('id',run.id).eq('business_id',businessId);
    await supabase.from('ai_build_artifacts').insert({business_id:businessId,build_run_id:run.id,artifact_type:'website_spec',artifact_key:'website',version:1,status:'validated',content:spec,checksum:checksum(spec)});
    const tests=structuralTests(spec);
    for(const test of tests) await supabase.from('ai_build_tests').insert({business_id:businessId,build_run_id:run.id,test_key:test.key,test_type:'structural',status:test.pass?'passed':'failed',assertion:{expected:test.expected},actual:test.actual,error_message:test.pass?null:'Structural test failed.',completed_at:new Date().toISOString()});
    const failed=tests.filter((test)=>!test.pass);
    if(failed.length) throw new Error('Website validation failed: ' + failed.map((test)=>test.key).join(', '));
    const needsApproval=Boolean(publish && plan.steps.some((step)=>step.key==='publish' && step.requiresApproval));
    if(needsApproval){
      await supabase.from('ai_build_runs').update({status:'waiting_approval',result:{spec,tests,metrics,action:'publish',websiteId:websiteId??null}}).eq('id',run.id).eq('business_id',businessId);
      return {runId:run.id,status:'waiting_approval',result:{spec,tests,metrics}};
    }
    const finalWebsiteId=await applyWebsiteSpec(supabase,businessId,websiteId,spec,Boolean(publish));
    const result={websiteId:finalWebsiteId,published:Boolean(publish),metrics,provider:generated.providerKey,providerStatus:generated.status,spec,tests};
    await supabase.from('ai_build_steps').insert({business_id:businessId,build_run_id:run.id,sequence_no:5,step_key:'persist',step_type:'execution',status:'succeeded',input:{websiteId:finalWebsiteId},output:result,started_at:new Date().toISOString(),finished_at:new Date().toISOString()});
    await supabase.from('ai_build_runs').update({status:'succeeded',result,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',run.id).eq('business_id',businessId);
    await supabase.from('events').insert({ business_id:businessId,event_type:'ai.build.completed',summary:'Website build completed with ' + metrics.pages + ' pages and ' + metrics.sections + ' structured sections.',evidence:{build_run_id:run.id,website_id:finalWebsiteId,provider:generated.providerKey,provider_status:generated.status,metrics},status:'info',priority:'normal',category:'ai_build' });
    return {runId:run.id,status:'succeeded',result};
  } catch(error){
    const message=error instanceof Error ? error.message : 'Build failed.';
    await supabase.from('ai_build_runs').update({status:'failed',error_message:message,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',run.id).eq('business_id',businessId);
    throw new Error(message);
  }
}