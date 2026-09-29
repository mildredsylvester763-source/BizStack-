// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

type Integration={id:string;display_name:string;category:string;connection_type:string;status:string;sync_mode:string;error_message?:string|null;config?:Record<string,any>};
type ConnectorDefinition={id:string;name:string;slug:string;category:string;auth_type:string;status:string;capabilities:Record<string,any>;schema_definition:Record<string,any>;config:Record<string,any>};
type Catalog={name:string;category:string;methods:string[];mode:string;description:string};

const catalog:Catalog[]=[
{name:"Bank account",category:"banking",methods:["OAuth / bank login","Open-banking provider","File import"],mode:"near_realtime",description:"Balances, transactions and reconciliation sources."},
{name:"Payment processor",category:"payments",methods:["OAuth / provider login","API key","Webhook"],mode:"near_realtime",description:"Collections, payouts, refunds, disputes and payment events."},
{name:"Accounting platform",category:"accounting",methods:["OAuth / provider login","API key","File import"],mode:"scheduled",description:"Accounting records synchronized while BizStack remains the canonical operating layer."},
{name:"Commerce platform",category:"commerce",methods:["OAuth / store login","API key","Webhook"],mode:"near_realtime",description:"Orders, customers, products, inventory and fulfilment."},
{name:"CRM",category:"crm",methods:["OAuth / provider login","API key","File import"],mode:"near_realtime",description:"Relationships, contacts, activities and customer history."},
{name:"Company database",category:"data",methods:["Database connection","File import"],mode:"scheduled",description:"Controlled server-side database or export ingestion."},
{name:"Custom API",category:"data",methods:["API key","OAuth","Webhook"],mode:"near_realtime",description:"Bring almost any documented HTTP API into the connector runtime."},
{name:"Webhook source",category:"data",methods:["Webhook endpoint"],mode:"realtime",description:"Turn signed external events into auditable BizStack events."},
{name:"Communications",category:"communications",methods:["OAuth / provider login","API key"],mode:"near_realtime",description:"Email, SMS and WhatsApp delivery through configured providers."}
];

function typeFor(method:string){const m=method.toLowerCase();if(m.includes("oauth"))return"oauth";if(m.includes("api"))return"api_key";if(m.includes("webhook"))return"webhook";if(m.includes("database"))return"database";if(m.includes("file"))return"file_import";return"native";}
function helpFor(method:string){const m=method.toLowerCase();if(m.includes("oauth"))return"Provider authorization will be added through its OAuth configuration. No password is stored in BizStack.";if(m.includes("api"))return"Your credential is encrypted server-side. It is never written to the browser database as plaintext.";if(m.includes("webhook"))return"BizStack will verify signed inbound requests before accepting external events.";if(m.includes("database"))return"Use a restricted account with only the schemas and operations this connector needs.";if(m.includes("file"))return"Imports will eventually support preview, field mapping, duplicate detection and reconciliation.";return"Configure the connection inside BizStack.";}

export default function IntegrationsPage(){
 const supabase=createClient();
 const [items,setItems]=useState<Integration[]>([]),[schedules,setSchedules]=useState<any[]>([]),[businessId,setBusinessId]=useState(""),[loading,setLoading]=useState(true);
 const [selected,setSelected]=useState<Catalog|null>(null),[method,setMethod]=useState(""),[label,setLabel]=useState(""),[apiKey,setApiKey]=useState(""),[baseUrl,setBaseUrl]=useState(""),[testUrl,setTestUrl]=useState(""),[webhookSecret,setWebhookSecret]=useState(""),[oauthAuthorizeUrl,setOauthAuthorizeUrl]=useState(""),[oauthTokenUrl,setOauthTokenUrl]=useState(""),[oauthClientId,setOauthClientId]=useState(""),[importFile,setImportFile]=useState<File|null>(null);
 const [definitions,setDefinitions]=useState<ConnectorDefinition[]>([]),[credentialTarget,setCredentialTarget]=useState<Integration|null>(null),[credentialValue,setCredentialValue]=useState(""),[credentialSaving,setCredentialSaving]=useState(false);
 const [step,setStep]=useState<"method"|"details"|"review">("method"),[saving,setSaving]=useState(false),[message,setMessage]=useState("");

 async function load(){const {data:{user}}=await supabase.auth.getUser();if(!user)return;const {data:b}=await supabase.from("businesses").select("id").eq("owner_id",user.id).single();if(!b)return;setBusinessId(b.id);const [{data},{data:defs}]=await Promise.all([supabase.from("integrations").select("id,display_name,category,connection_type,status,sync_mode,error_message,config").eq("business_id",b.id).order("created_at"),supabase.from("connector_definitions").select("id,name,slug,category,auth_type,status,capabilities,schema_definition,config").eq("business_id",b.id).order("name")]);const {data:sched}=await supabase.from("connector_schedules").select("id,connector_definition_id,resource,schedule_type,interval_seconds,enabled,next_run_at,last_run_at,last_status,config").eq("business_id",b.id).order("next_run_at",{ascending:true});setItems(data||[]);setDefinitions(defs||[]);setSchedules(sched||[]);setLoading(false);}
 useEffect(()=>{load();},[]);
 useEffect(()=>{if(!businessId)return;const ch=supabase.channel("bizstack-integrations").on("postgres_changes",{event:"*",schema:"public",table:"integrations",filter:"business_id=eq."+businessId},()=>load()).subscribe();return()=>{supabase.removeChannel(ch);};},[businessId]);

 function open(c:Catalog){setSelected(c);setMethod(c.methods[0]);setLabel(c.name);setApiKey("");setBaseUrl("");setTestUrl("");setWebhookSecret("");setOauthAuthorizeUrl("");setOauthTokenUrl("");setOauthClientId("");setImportFile(null);setMessage("");setStep("method");}
 function close(){if(saving)return;setSelected(null);setMethod("");setLabel("");setApiKey("");setBaseUrl("");setTestUrl("");setWebhookSecret("");setOauthAuthorizeUrl("");setOauthTokenUrl("");setOauthClientId("");setImportFile(null);setMessage("");setStep("method");}

 async function start(){
  if(!selected||!businessId||!method)return;
  setSaving(true);setMessage("");
  const connectionType=typeFor(method);
  const config={setup_stage:"configuration_saved",connection_method:method,base_url:baseUrl.trim()||null,test_url:testUrl.trim()||null,oauth_authorize_url:oauthAuthorizeUrl.trim()||null,oauth_token_url:oauthTokenUrl.trim()||null,oauth_client_id:oauthClientId.trim()||null,setup_started_at:new Date().toISOString()};
  const {data,error}=await supabase.from("integrations").insert({business_id:businessId,provider:selected.name.toLowerCase().replace(/\\s+/g,"-"),category:selected.category,connection_type:connectionType,display_name:label.trim()||selected.name,status:"pending",sync_mode:selected.mode,capabilities:{setup_method:method,authorization_required:connectionType==="oauth",manual_sync:true,incremental_sync:true,webhooks:selected.mode!=="manual"},config}).select("id,display_name,category,connection_type,status,sync_mode,error_message").single();
  if(error){setSaving(false);setMessage(error.message);return;}
  if(data)setItems(v=>[...v,data]);
  if(connectionType==="oauth"){
    const response=await fetch("/api/integrations/oauth/start",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({businessId,integrationId:data.id})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok){setSaving(false);setMessage(result.error||"OAuth setup failed.");return;}
    setSaving(false);setStep("review");setMessage("OAuth connection created. Authorize the provider to finish the connection.");
    window.location.assign(result.authorizationUrl); return;
  }
  if(connectionType==="file_import"){
    if(!importFile){setSaving(false);setMessage("Choose a file to import.");return;}
    const fd=new FormData();fd.append("businessId",businessId);fd.append("integrationId",data.id);fd.append("file",importFile);
    const response=await fetch("/api/integrations/import",{method:"POST",body:fd});const result=await response.json().catch(()=>({}));
    if(!response.ok){setSaving(false);setMessage(result.error||"File import failed.");return;}
    setSaving(false);setStep("review");setMessage(`File uploaded and staged for mapping: ${result.rowCount||0} rows detected.`);await load();return;
  }
  if(connectionType!=="native"){
    const credential=connectionType==="webhook"?{webhookSecret}:{apiKey};
    if(connectionType==="api_key"&&!apiKey.trim()){setSaving(false);setMessage("Enter an API key before saving this connection.");return;}
    const response=await fetch("/api/integrations/connect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({businessId,integrationId:data.id,kind:connectionType,credential})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok){setSaving(false);setMessage(result.error||"Credential storage failed.");return;}
  }
  setSaving(false);setStep("review");setMessage("Connection configuration saved securely. It is not marked connected until the external provider is verified.");
  await load();
 }

 async function activateConnector(id:string){
  if(!businessId)return;
  setMessage("Activating connector in Integration Hub…");
  const response=await fetch("/api/connectors/activate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({businessId,connectorDefinitionId:id})});
  const result=await response.json().catch(()=>({}));
  setMessage(response.ok?"Connector added. Configure credentials, then test it.":result.error||"Connector activation failed.");
  await load();
 }
 async function scheduleResource(definitionId:string,resourceKey:string,intervalSeconds:number){
  setMessage("Scheduling "+resourceKey+"…");
  const response=await fetch("/api/connectors/schedules",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({businessId,connectorDefinitionId:definitionId,resource:resourceKey,intervalSeconds})});
  const result=await response.json().catch(()=>({}));
  setMessage(response.ok?"Scheduled "+resourceKey+" to sync automatically.":result.error||"Could not schedule resource.");
  await load();
 }
 async function removeSchedule(scheduleId:string){
  const response=await fetch("/api/connectors/schedules",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({businessId,scheduleId})});
  const result=await response.json().catch(()=>({}));
  setMessage(response.ok?"Schedule removed.":result.error||"Could not remove schedule.");
  await load();
 }
 async function syncResource(integrationId:string,resourceKey:string){
  setMessage("Syncing "+resourceKey+"…");
  const response=await fetch("/api/connectors/sync",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({businessId,integrationId,resourceKey})});
  const result=await response.json().catch(()=>({}));
  setMessage(response.ok?"Synced "+(result.records||0)+" records from "+resourceKey+".":result.message||result.error||"Connector sync failed.");
  await load();
 }
 async function saveCustomCredential(){
  if(!credentialTarget||!credentialValue.trim()||!businessId)return;
  setCredentialSaving(true);
  setMessage("");
  const kind=credentialTarget.connection_type==="webhook"?"webhook":"api_key";
  const credential=kind==="webhook"?{webhookSecret:credentialValue.trim()}:{apiKey:credentialValue.trim()};
  const response=await fetch("/api/integrations/connect",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({businessId,integrationId:credentialTarget.id,kind,credential})
  });
  const result=await response.json().catch(()=>({}));
  setCredentialSaving(false);
  if(!response.ok){
    setMessage(result.error||"Credential save failed.");
    return;
  }
  setCredentialTarget(null);
  setCredentialValue("");
  setMessage("Credential saved securely. Run Test to verify the provider.");
  await load();
 }
 async function test(id:string){
  setMessage("Testing provider…");
  const r=await fetch(`/api/integrations/${id}/test`,{method:"POST"});
  const data=await r.json().catch(()=>({}));
  setMessage(data.ok?"Provider verified and connection is active.":data.message||data.error||"Provider test failed.");
  await load();
 }

 return <main className="min-h-screen bg-[#f3f0e8] text-[#171918]"><header className="sticky top-0 z-30 border-b border-black/[.08] bg-[#f8f6f0]/90 backdrop-blur-xl"><div className="max-w-[1480px] mx-auto h-[72px] px-4 sm:px-6 lg:px-8 flex justify-between items-center gap-4"><div className="flex items-center gap-3 min-w-0"><Link href="/dashboard" className="font-display text-xl tracking-tight">BizStack</Link><span className="hidden sm:block h-5 w-px bg-black/10" /><span className="hidden sm:inline text-[10px] uppercase tracking-[.2em] text-black/35">Connections / Integration Hub</span></div><div className="flex items-center gap-2"><Link href="/dashboard/settings" className="hidden sm:inline rounded-full border border-black/10 bg-white/60 px-3 py-1.5 text-[11px] text-black/55">Business settings</Link><Link href="/dashboard/ai-builder" className="rounded-full bg-[#171918] text-white px-3.5 py-2 text-[11px]">AI Builder</Link></div></div></header>
 <section className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12"><div className="grid xl:grid-cols-[1fr_auto] gap-8 items-end mb-9"><div><div className="flex items-center gap-2 mb-4"><span className="h-1.5 w-1.5 rounded-full bg-[#806f50]" /><span className="text-[10px] uppercase tracking-[.24em] text-[#806f50]">System connections</span></div><h2 className="font-display text-[42px] sm:text-[54px] leading-[.98] tracking-[-.035em] max-w-3xl">Connect the systems behind the business.</h2><p className="text-[15px] leading-6 text-black/50 mt-4 max-w-2xl">Every connection is a real server-side object. Credentials stay encrypted, provider verification is explicit, and sync state remains visible rather than pretending an integration is live.</p></div><div className="rounded-[22px] border border-black/[.08] bg-[#fcfaf5] px-5 py-4 min-w-[250px]"><p className="text-[9px] uppercase tracking-[.2em] text-black/30">Current posture</p><div className="grid grid-cols-3 gap-4 mt-3"><div><p className="text-[10px] text-black/35">Active</p><p className="font-display text-2xl mt-1 text-[#2f6b43]">{items.filter(i=>i.status==="connected").length}</p></div><div><p className="text-[10px] text-black/35">Pending</p><p className="font-display text-2xl mt-1 text-[#7b611c]">{items.filter(i=>i.status==="pending").length}</p></div><div><p className="text-[10px] text-black/35">Errors</p><p className="font-display text-2xl mt-1 text-[#a04444]">{items.filter(i=>i.status==="error"||i.status==="failed").length}</p></div></div></div></div>
 <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-10">{catalog.map(c=><button key={c.name} onClick={()=>open(c)} disabled={!businessId} className="group text-left rounded-[24px] bg-[#fcfaf5] border border-black/[.08] p-5 sm:p-6 hover:bg-white hover:-translate-y-0.5 hover:shadow-[0_18px_60px_rgba(25,24,20,.06)] transition-all"><div className="flex justify-between gap-3"><p className="font-medium text-sm">{c.name}</p><span className="text-[10px] uppercase text-ink/35">{c.mode.replace("_"," ")}</span></div><p className="text-xs text-ink/45 mt-2 leading-5">{c.description}</p><span className="inline-block mt-4 text-xs text-vault">+ Configure connection</span></button>)}</div>
 <section className="rounded-[28px] bg-[#fcfaf5] border border-black/[.08] p-6 sm:p-7 mb-5 shadow-[0_20px_70px_rgba(25,24,20,.05)]"><div className="flex justify-between items-end gap-4 mb-5"><div><h3 className="font-display text-xl">Custom connector definitions</h3><p className="text-xs text-ink/45 mt-1">AI-compiled connectors stay drafts until you explicitly activate them here. Credentials remain separate from the connector definition.</p></div><Link href="/dashboard/ai-builder" className="text-xs text-vault">Open AI Builder</Link></div>{definitions.length===0?<p className="text-sm text-ink/50">No custom connector definitions yet.</p>:<div className="space-y-3">{definitions.map(d=><div key={d.id} className="border-t border-black/[.07] pt-4 mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><p className="text-sm font-medium">{d.name}</p><p className="text-xs text-ink/45 mt-1">{d.category} · {d.auth_type} · {d.schema_definition?.resources?.length||0} resources · {d.status}</p></div><div className="flex gap-2"><button onClick={()=>activateConnector(d.id)} className="text-xs bg-ink text-white px-3 py-2">{items.some(i=>i.config?.connector_definition_id===d.id)?"Already added":"Add to Integration Hub"}</button></div></div>)}</div>}</section>
 <section className="rounded-[28px] bg-[#fcfaf5] border border-black/[.08] p-6 sm:p-7 shadow-[0_20px_70px_rgba(25,24,20,.05)]"><div className="flex justify-between items-end gap-4 mb-5"><div><h3 className="font-display text-xl">Your connections</h3><p className="text-xs text-ink/45 mt-1">A connection is only considered active after authentication or provider verification succeeds.</p></div></div>{loading?<p className="text-sm text-ink/50">Loading…</p>:items.length===0?<p className="text-sm text-ink/50">Nothing connected yet.</p>:<div className="space-y-3">{items.map(i=><div key={i.id} className="border-t border-black/[.07] py-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4"><div><p className="text-sm font-medium">{i.display_name}</p><p className="text-xs text-ink/45 mt-1">{i.category} · {i.connection_type} · {i.sync_mode}</p>{i.error_message&&<p className="text-xs text-red-700 mt-2">{i.error_message}</p>}</div><div className="flex gap-2 items-center"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] capitalize ${i.status==="connected"?"bg-[#dcefe2] text-[#2f6b43] border-[#b9dcc5]":i.status==="error"||i.status==="failed"?"bg-[#f7dddd] text-[#a04444] border-[#e8bcbc]":"bg-[#f8edc8] text-[#7b611c] border-[#ead89b]"}`}>{i.status}</span>{i.config?.connector_definition_id&&<>{i.status==="pending"&&i.connection_type!=="oauth"&&<button onClick={()=>{setCredentialTarget(i);setCredentialValue("");setMessage("");}} className="text-xs bg-ink text-white px-3 py-1.5">Configure</button>}{i.status==="pending"&&i.connection_type==="oauth"&&<span className="text-xs text-ink/40 border border-rule px-3 py-1.5">OAuth setup required</span>}{i.status==="pending"&&<button onClick={()=>test(i.id)} className="text-xs border border-vault text-vault px-3 py-1.5">Test</button>}{i.status==="connected"&&(()=>{const def=definitions.find(d=>d.id===i.config.connector_definition_id);const resources=((def?.schema_definition?.resources||[]) as any[]).filter((r:any)=>!r.method||r.method==="GET").slice(0,4);return <div className="flex flex-wrap gap-2">{resources.map((r:any)=>{const active=schedules.find((s:any)=>s.connector_definition_id===def?.id&&s.resource===r.key&&s.enabled);return <div key={r.key} className="flex flex-wrap gap-1 items-center"><button onClick={()=>syncResource(i.id,r.key)} className="text-xs border border-vault text-vault px-3 py-1.5">Sync {r.label||r.key}</button>{active?<button onClick={()=>removeSchedule(active.id)} className="text-[11px] border border-rule text-ink/50 px-2 py-1.5">Auto: {Math.round(Number(active.interval_seconds)/60)}m · off</button>:<button onClick={()=>scheduleResource(def.id,r.key,3600)} className="text-[11px] bg-mist border border-rule text-ink/55 px-2 py-1.5">Auto: 1h</button>}</div>})}</div>})()}</>}{!i.config?.connector_definition_id&&i.status==="pending"&&<button onClick={()=>test(i.id)} className="text-xs border border-vault text-vault px-3 py-1.5">Test</button>}</div></div>)}</div>}</section>
 </section>
 {credentialTarget&&<div className="fixed inset-0 z-[60] bg-[#171918]/40 backdrop-blur-sm p-4 flex items-center justify-center" role="dialog" aria-modal="true"><div className="w-full max-w-lg rounded-[28px] bg-[#fcfaf5] border border-black/10 shadow-[0_40px_120px_rgba(20,20,16,.24)] overflow-hidden"><div className="p-6 border-b border-black/[.08] flex justify-between"><div><p className="text-xs uppercase tracking-[.16em] text-vault">Secure credential</p><h3 className="font-display text-2xl mt-1">{credentialTarget.display_name}</h3><p className="text-sm text-ink/50 mt-2">The secret is encrypted server-side and is never returned to this screen after save.</p></div><button onClick={()=>setCredentialTarget(null)} className="text-ink/45 text-xl">×</button></div><div className="p-6"><label className="block text-xs text-ink/50 mb-2">{credentialTarget.connection_type==="webhook"?"Webhook signing secret":"API key / bearer token"}</label><input type="password" autoComplete="new-password" value={credentialValue} onChange={e=>setCredentialValue(e.target.value)} placeholder="Enter secret" className="w-full border border-rule px-4 py-3 text-sm"/><div className="mt-5 bg-mist border border-rule p-4 text-xs text-ink/55 leading-5">This writes only to the encrypted integration credential vault. It is not stored in connector definition JSON, browser storage or ordinary integration metadata.</div><div className="mt-6 flex justify-end gap-2"><button onClick={()=>setCredentialTarget(null)} className="border border-rule px-4 py-2 text-sm">Cancel</button><button onClick={saveCustomCredential} disabled={credentialSaving||!credentialValue.trim()} className="bg-vault text-white px-4 py-2 text-sm disabled:opacity-50">{credentialSaving?"Saving…":"Save credential"}</button></div></div></div></div>}
 {selected&&<div className="fixed inset-0 z-50 bg-[#171918]/40 backdrop-blur-sm p-4 flex items-center justify-center" role="dialog" aria-modal="true"><div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[30px] bg-[#fcfaf5] border border-black/10 shadow-[0_40px_120px_rgba(20,20,16,.24)]"><div className="p-6 border-b border-black/[.08] flex justify-between gap-4"><div><p className="text-xs uppercase tracking-[.16em] text-vault">Connection setup</p><h3 className="font-display text-2xl mt-1">{selected.name}</h3><p className="text-sm text-ink/50 mt-2">{selected.description}</p></div><button onClick={close} className="text-ink/45 text-xl" aria-label="Close">×</button></div>
 <div className="p-6"><div className="flex gap-4 mb-7 text-xs">{["method","details","review"].map((s,i)=><span key={s} className={step===s?"text-vault font-medium":"text-ink/35"}>{i+1}. {s}</span>)}</div>
 {message&&<div className="mb-5 border border-rule bg-mist p-3 text-xs text-ink/65">{message}</div>}
 {step==="method"&&<div><h4 className="font-medium">Choose the connection protocol</h4><p className="text-sm text-ink/50 mt-1 mb-5">The protocol controls how credentials, callbacks, webhooks and synchronization are handled.</p><div className="space-y-3">{selected.methods.map(m=><button key={m} onClick={()=>{setMethod(m);setStep("details");}} className="w-full text-left border border-rule p-4 hover:border-vault/50"><p className="text-sm font-medium">{m}</p><p className="text-xs text-ink/45 mt-1">{helpFor(m)}</p></button>)}</div></div>}
 {step==="details"&&<div><h4 className="font-medium">Connection details</h4><p className="text-sm text-ink/50 mt-1 mb-5">{helpFor(method)}</p><label className="block text-xs text-ink/50 mb-2">Connection name</label><input value={label} onChange={e=>setLabel(e.target.value)} className="w-full border border-rule px-4 py-3 text-sm outline-none focus:border-vault"/>
 {typeFor(method)==="api_key"&&<><label className="block text-xs text-ink/50 mt-5 mb-2">API key</label><input type="password" autoComplete="new-password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="Stored encrypted; never displayed again" className="w-full border border-rule px-4 py-3 text-sm outline-none focus:border-vault"/></>}
 {typeFor(method)==="webhook"&&<><label className="block text-xs text-ink/50 mt-5 mb-2">Webhook signing secret</label><input type="password" autoComplete="new-password" value={webhookSecret} onChange={e=>setWebhookSecret(e.target.value)} className="w-full border border-rule px-4 py-3 text-sm outline-none focus:border-vault"/></>}
 {typeFor(method)==="file_import"&&<><label className="block text-xs text-ink/50 mt-5 mb-2">Source file</label><input type="file" accept=".csv,.json,.jsonl,.txt,.xml,.xlsx,.xls,.pdf" onChange={e=>setImportFile(e.target.files?.[0]||null)} className="w-full border border-rule px-4 py-3 text-sm"/></>}
 {typeFor(method)==="oauth"&&<><label className="block text-xs text-ink/50 mt-5 mb-2">OAuth authorization URL</label><input value={oauthAuthorizeUrl} onChange={e=>setOauthAuthorizeUrl(e.target.value)} placeholder="https://provider.example.com/oauth/authorize" className="w-full border border-rule px-4 py-3 text-sm outline-none focus:border-vault"/><label className="block text-xs text-ink/50 mt-5 mb-2">OAuth token URL</label><input value={oauthTokenUrl} onChange={e=>setOauthTokenUrl(e.target.value)} placeholder="https://provider.example.com/oauth/token" className="w-full border border-rule px-4 py-3 text-sm outline-none focus:border-vault"/><label className="block text-xs text-ink/50 mt-5 mb-2">OAuth client ID</label><input value={oauthClientId} onChange={e=>setOauthClientId(e.target.value)} placeholder="Provider client ID" className="w-full border border-rule px-4 py-3 text-sm outline-none focus:border-vault"/></>}
 {(typeFor(method)==="api_key"||typeFor(method)==="oauth")&&<><label className="block text-xs text-ink/50 mt-5 mb-2">API base URL</label><input value={baseUrl} onChange={e=>setBaseUrl(e.target.value)} placeholder="https://api.example.com" className="w-full border border-rule px-4 py-3 text-sm outline-none focus:border-vault"/><label className="block text-xs text-ink/50 mt-5 mb-2">Verification URL</label><input value={testUrl} onChange={e=>setTestUrl(e.target.value)} placeholder="https://api.example.com/health" className="w-full border border-rule px-4 py-3 text-sm outline-none focus:border-vault"/></>}
 <div className="mt-5 bg-mist border border-rule p-4 text-xs text-ink/55 leading-5">Credentials are sent directly to a server route and encrypted with BIZSTACK_ENCRYPTION_KEY. They are not saved in browser local storage, logs or ordinary integration metadata.</div><div className="flex justify-between mt-7"><button onClick={()=>setStep("method")} className="text-sm text-ink/50">Back</button><button onClick={()=>setStep("review")} className="bg-ink text-white px-5 py-2.5 text-sm">Review connection</button></div></div>}
 {step==="review"&&<div><h4 className="font-medium">Review and securely save</h4><div className="mt-4 border border-rule divide-y divide-rule text-sm"><div className="p-4 flex justify-between"><span className="text-ink/45">Connection</span><span>{label||selected.name}</span></div><div className="p-4 flex justify-between"><span className="text-ink/45">Method</span><span>{method}</span></div><div className="p-4 flex justify-between"><span className="text-ink/45">Verification</span><span>{testUrl?"Configured":"Provider verification required"}</span></div></div><p className="text-xs text-ink/45 mt-4">Saving never fabricates a successful connection. The status remains pending until the provider test or OAuth flow succeeds.</p><div className="flex justify-between mt-7"><button onClick={()=>setStep("details")} className="text-sm text-ink/50">Back</button><button onClick={start} disabled={saving} className="bg-vault text-white px-5 py-2.5 text-sm disabled:opacity-50">{saving?"Saving securely…":"Save connection"}</button></div></div>}
 </div></div></div>}
 </main>;
}