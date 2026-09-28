"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import VoiceInput from "./voice-input";

type Message={id?:string;role:"user"|"assistant"|"tool";content:string;metadata?:any};
type Activity={id:string;kind:string;title:string;status:string;detail?:string;input?:any;output?:any;created_at?:string};
type App={name:string;slug:string;category:string;description:string;connected:boolean;icon:string};

const APPS:App[]=[
 {name:"GitHub",slug:"github",category:"Code",description:"Repositories, branches, commits, pull requests and source files.",connected:false,icon:"GH"},
 {name:"Google Drive",slug:"google-drive",category:"Files",description:"Bring documents, spreadsheets and project files into the workspace.",connected:false,icon:"GD"},
 {name:"Gmail",slug:"gmail",category:"Communication",description:"Read and act on business email with permission-aware access.",connected:false,icon:"GM"},
 {name:"Slack",slug:"slack",category:"Communication",description:"Business conversations, notifications and team actions.",connected:false,icon:"SL"},
 {name:"Notion",slug:"notion",category:"Knowledge",description:"Search and use workspace knowledge as agent context.",connected:false,icon:"NO"},
 {name:"Supabase",slug:"supabase",category:"Infrastructure",description:"Inspect and operate connected application databases.",connected:false,icon:"SB"},
 {name:"Vercel",slug:"vercel",category:"Deploy",description:"Projects, deployments, logs and production workflows.",connected:false,icon:"VC"},
 {name:"Google Calendar",slug:"google-calendar",category:"Scheduling",description:"Read availability and coordinate business events.",connected:false,icon:"GC"}
];

export default function AssistantClient({businessId,businessName,initialConversationId,initialMessages}:{businessId:string;businessName:string;initialConversationId:string|null;initialMessages:Message[]}){
 const supabase=createClient();
 const [messages,setMessages]=useState<Message[]>(initialMessages);
 const [input,setInput]=useState("");
 const [busy,setBusy]=useState(false);
 const [conversationId,setConversationId]=useState(initialConversationId);
 const [runId,setRunId]=useState<string|null>(null);
 const [activities,setActivities]=useState<Activity[]>([]);
 const [activeTab,setActiveTab]=useState<"chat"|"code"|"preview"|"logs"|"files">("chat");
 const [appsOpen,setAppsOpen]=useState(false);
 const [apps,setApps]=useState(APPS);
 const [selectedActivity,setSelectedActivity]=useState<Activity|null>(null);
 const [approval,setApproval]=useState<any>(null);
 const endRef=useRef<HTMLDivElement|null>(null);

 useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[messages,busy]);

 useEffect(()=>{
   if(!businessId)return;
   const channel=supabase.channel("operator-live-"+businessId)
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"ai_agent_runs",filter:"business_id=eq."+businessId},payload=>{
      const row:any=payload.new;
      if(row.status==="running"||row.status==="waiting_approval"){setRunId(row.id);setActivities(v=>[{id:row.id,kind:"run",title:"Operator run",status:row.status,detail:"Agent execution started.",created_at:row.created_at},...v].slice(0,100));}
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"ai_agent_run_steps",filter:"business_id=eq."+businessId},payload=>{
      const row:any=payload.new;
      if(runId&&row.agent_run_id!==runId)return;
      if(row.agent_run_id)setRunId(row.agent_run_id);
      setActivities(v=>{const item:Activity={id:row.id,kind:"tool",title:row.tool_key||row.step_type||"Agent step",status:row.status,detail:row.error_message||undefined,input:row.input,output:row.output,created_at:row.started_at};const i=v.findIndex(x=>x.id===item.id);if(i<0)return[item,...v].slice(0,100);const n=[...v];n[i]={...n[i],...item};return n;});
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"ai_build_steps",filter:"business_id=eq."+businessId},payload=>{
      const row:any=payload.new;
      setActivities(v=>{const item:Activity={id:row.id,kind:"build",title:row.step_key||"Build step",status:row.status,detail:row.error_message||undefined,input:row.input,output:row.output,created_at:row.started_at};const i=v.findIndex(x=>x.id===item.id);if(i<0)return[item,...v].slice(0,100);const n=[...v];n[i]={...n[i],...item};return n;});
    })
    .subscribe();
   return()=>{supabase.removeChannel(channel);};
 },[businessId,runId]);

 useEffect(()=>{
   let cancelled=false;
   (async()=>{
     const {data}=await supabase.from("integrations").select("provider,status").eq("business_id",businessId);
     if(cancelled)return;
     setApps(APPS.map(app=>({...app,connected:Boolean(data?.some((x:any)=>String(x.provider).toLowerCase().includes(app.slug)&&x.status==="connected"))})));
   })();
   return()=>{cancelled=true;};
 },[businessId]);

 async function send(){
   const text=input.trim();if(!text||busy)return;
   setInput("");setBusy(true);setActiveTab("chat");
   setMessages(v=>[...v,{role:"user",content:text}]);
   try{
     const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input:text,conversationId,clientMessageId:crypto.randomUUID()})});
     const result=await response.json().catch(()=>({}));
     if(!response.ok)throw new Error(result.error||"Assistant request failed.");
     if(result.conversationId)setConversationId(result.conversationId);
     if(result.runId)setRunId(result.runId);
     if(result.approval)setApproval(result.approval);
     setMessages(v=>[...v,{role:"assistant",content:result.message||"Done."}]);
     if(result.toolResults?.length)setActivities(v=>result.toolResults.map((x:any)=>({id:crypto.randomUUID(),kind:"tool",title:x.tool,status:"succeeded",output:x.output}),...v));
   }catch(error){setMessages(v=>[...v,{role:"assistant",content:error instanceof Error?error.message:"The assistant could not complete that request."}]);}
   finally{setBusy(false);}
 }

 async function approve(){
   if(!approval||busy)return;
   setBusy(true);
   try{
     const response=await fetch("/api/assistant/approve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({runId:approval.runId})});
     const result=await response.json().catch(()=>({}));
     if(!response.ok)throw new Error(result.error||"Approval failed.");
     setApproval(result.approval||null);setRunId(result.runId||approval.runId);
     setMessages(v=>[...v,{role:"assistant",content:result.message||"The approved action has been completed."}]);
   }catch(error){setMessages(v=>[...v,{role:"assistant",content:error instanceof Error?error.message:"Approval failed."}]);}
   finally{setBusy(false);}
 }

 const activeTools=useMemo(()=>activities.filter(a=>a.kind==="tool"||a.kind==="build"),[activities]);

 return <div className="rounded-2xl border border-rule bg-[#0d0f12] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,.18)]">
   <div className="h-14 px-4 border-b border-white/10 flex items-center justify-between text-white">
     <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[10px] font-semibold">BZ</div><div><p className="text-sm font-medium">BizStack Operator</p><p className="text-[10px] text-white/40">{businessName} · autonomous workspace</p></div></div>
     <div className="flex items-center gap-2"><button onClick={()=>setAppsOpen(true)} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs">Apps</button><span className="px-2 py-1 rounded-full bg-emerald-400/10 text-emerald-300 text-[10px]">● Live</span></div>
   </div>

   <div className="grid xl:grid-cols-[minmax(320px,430px)_minmax(0,1fr)_300px] min-h-[760px]">
     <section className="bg-[#111318] border-r border-white/10 flex flex-col min-h-0">
       <div className="px-4 py-3 border-b border-white/10 flex items-center gap-1">
         {(["chat","code","preview","logs","files"] as const).map(tab=><button key={tab} onClick={()=>setActiveTab(tab)} className={activeTab===tab?"px-3 py-1.5 rounded-md bg-white/10 text-white text-[11px]":"px-3 py-1.5 rounded-md text-white/40 hover:text-white text-[11px]"}>{tab[0].toUpperCase()+tab.slice(1)}</button>)}
       </div>
       <div className="flex-1 overflow-y-auto">
         {activeTab==="chat"&&<div className="p-4 space-y-4">
           {!messages.length&&<div className="py-12"><p className="text-[10px] uppercase tracking-[.2em] text-white/30">Workspace agent</p><h3 className="text-2xl text-white font-medium mt-2">What are we building?</h3><p className="text-sm text-white/40 mt-3 leading-6">Talk normally. The agent can inspect the business, use connected apps, change files, build surfaces and coordinate multi-step work.</p></div>}
           {messages.map((m,i)=><div key={m.id||i}><div className="text-[10px] uppercase tracking-wider text-white/25 mb-1">{m.role==="user"?"You":"BizStack"}</div><div className={m.role==="user"?"text-sm text-white/90 leading-6":"text-sm text-white/65 leading-6"}>{m.content}</div></div>)}
           {approval&&<div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4"><p className="text-[10px] uppercase tracking-wider text-amber-300">Approval required</p><p className="text-sm text-white mt-2">{approval.action}</p><p className="text-xs text-white/45 mt-2">{approval.reason}</p><button onClick={()=>void approve()} className="mt-3 px-3 py-2 rounded-lg bg-white text-black text-xs">Approve</button></div>}
           {busy&&<div className="text-xs text-white/35 animate-pulse">Agent is working across the workspace…</div>}
           <div ref={endRef}/>
         </div>}
         {activeTab==="code"&&<div className="h-full"><div className="px-4 py-3 border-b border-white/10 text-xs text-white/40">Generated artifacts · live changes appear here</div><div className="p-5 font-mono text-xs text-white/45 leading-6"><p>// BizStack agent workspace</p><p>// Waiting for a code artifact from the active build…</p><p className="text-white/20 mt-4">The workspace will show generated files, diffs and individual file changes here as the code runtime is expanded.</p></div></div>}
         {activeTab==="preview"&&<div className="h-full bg-white"><div className="h-10 px-4 border-b border-rule flex items-center text-xs text-ink/40">Live app preview · build output</div><div className="h-[calc(100%-40px)] flex items-center justify-center text-center p-8"><div><div className="w-14 h-14 rounded-2xl bg-ink text-white mx-auto flex items-center justify-center text-xs">PREVIEW</div><p className="text-sm text-ink mt-4">The live preview attaches to the active project build.</p><p className="text-xs text-ink/40 mt-2">No fake preview is shown when no real build artifact exists.</p></div></div></div>}
         {activeTab==="logs"&&<ActivityList items={activeTools} onSelect={setSelectedActivity}/>}
         {activeTab==="files"&&<div className="p-4"><p className="text-xs text-white/35">Project files</p><div className="mt-3 rounded-xl border border-white/10 p-4 text-xs text-white/45">File tree will be populated from the active project workspace and connected repositories.</div></div>}
       </div>
       <div className="p-3 border-t border-white/10">
         <div className="rounded-xl bg-white/5 border border-white/10 p-2 flex items-end gap-2"><VoiceInput onTranscript={setInput}/><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send();}}} rows={2} placeholder="Ask, build, change, connect, inspect…" className="flex-1 resize-none bg-transparent text-sm text-white placeholder:text-white/25 outline-none"/><button onClick={()=>void send()} disabled={!input.trim()||busy} className="px-3 py-2 rounded-lg bg-white text-black text-xs disabled:opacity-30">Run</button></div>
         <p className="text-[9px] text-white/20 mt-2">Enter run · Shift+Enter newline · speak naturally with the microphone</p>
       </div>
     </section>

     <section className="bg-[#17191e] min-w-0 border-r border-white/10">
       <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between"><span className="text-xs text-white/50">Workspace canvas</span><span className="text-[10px] text-white/25">{runId?"Run "+runId.slice(0,8):"No active run"}</span></div>
       <div className="h-[calc(100%-48px)] flex items-center justify-center p-8">
         <div className="max-w-xl text-center"><div className="mx-auto w-20 h-20 rounded-3xl border border-white/10 bg-white/5 flex items-center justify-center text-xs text-white/30">CANVAS</div><h3 className="text-xl text-white mt-5">The build surface lives here.</h3><p className="text-sm text-white/35 leading-6 mt-3">When the agent creates or changes an app, this area becomes the interactive preview, design surface, terminal output and code workspace instead of sending you back to separate dashboard pages.</p></div>
       </div>
     </section>

     <aside className="bg-[#101216] min-w-0">
       <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between"><span className="text-xs text-white/60">Activity</span><span className="text-[10px] text-white/25">{activeTools.length} events</span></div>
       <ActivityList items={activeTools.slice(0,30)} onSelect={setSelectedActivity}/>
       <div className="border-t border-white/10 p-4"><p className="text-[10px] uppercase tracking-wider text-white/25">Connected apps</p><div className="mt-3 space-y-2">{apps.filter(a=>a.connected).slice(0,5).map(a=><div key={a.slug} className="flex items-center gap-2 text-xs text-white/55"><span className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-[8px]">{a.icon}</span>{a.name}<span className="ml-auto text-emerald-300">●</span></div>)}{!apps.some(a=>a.connected)&&<p className="text-xs text-white/25">No apps connected yet.</p>}</div></div>
     </aside>
   </div>

   {selectedActivity&&<div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-5" onClick={()=>setSelectedActivity(null)}><div className="w-full max-w-2xl max-h-[80vh] overflow-auto rounded-2xl bg-[#17191e] border border-white/10 text-white" onClick={e=>e.stopPropagation()}><div className="px-5 py-4 border-b border-white/10 flex justify-between"><div><p className="text-sm">{selectedActivity.title}</p><p className="text-[10px] text-white/30 mt-1">{selectedActivity.status}</p></div><button onClick={()=>setSelectedActivity(null)} className="text-white/40">×</button></div><pre className="p-5 text-xs text-white/60 whitespace-pre-wrap">{JSON.stringify({input:selectedActivity.input,output:selectedActivity.output,detail:selectedActivity.detail},null,2)}</pre></div></div>}

   {appsOpen&&<div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-5" onClick={()=>setAppsOpen(false)}><div className="w-full max-w-3xl max-h-[85vh] overflow-auto rounded-2xl bg-[#17191e] border border-white/10 text-white" onClick={e=>e.stopPropagation()}><div className="px-6 py-5 border-b border-white/10"><p className="text-[10px] uppercase tracking-[.18em] text-white/30">Apps & connections</p><h3 className="text-xl mt-1">Give the Operator access to the tools you use.</h3><p className="text-xs text-white/35 mt-2">Connections are permissioned. BizStack never pretends an app is connected until the authorization or verification actually succeeds.</p></div><div className="grid sm:grid-cols-2 gap-3 p-5">{apps.map(app=><div key={app.slug} className="rounded-xl border border-white/10 p-4 bg-white/[.02]"><div className="flex items-start gap-3"><span className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-[9px]">{app.icon}</span><div className="flex-1"><p className="text-sm">{app.name}</p><p className="text-xs text-white/35 mt-1">{app.category}</p></div>{app.connected&&<span className="text-[9px] text-emerald-300">CONNECTED</span>}</div><p className="text-xs text-white/40 leading-5 mt-3">{app.description}</p><button onClick={async()=>{if(app.slug==="github"){const r=await fetch("/api/apps/github/connect",{method:"POST"});const data=await r.json().catch(()=>({}));if(r.ok&&data.authorizationUrl)window.location.assign(data.authorizationUrl);else alert(data.error||"GitHub connection could not be started.");}else window.location.href="/dashboard/integrations";}} className="mt-4 w-full rounded-lg bg-white/10 hover:bg-white/15 py-2 text-xs">{app.connected?"Manage":"Connect"}</button></div>)}</div></div></div>}
 </div>;
}

function ActivityList({items,onSelect}:{items:Activity[];onSelect:(item:Activity)=>void}){
 return <div className="p-3 space-y-2 overflow-y-auto max-h-[520px]">{items.length?items.map(item=><button key={item.id} onClick={()=>onSelect(item)} className="w-full text-left rounded-lg border border-white/5 hover:border-white/15 bg-white/[.02] px-3 py-2.5"><div className="flex items-center gap-2"><span className={item.status==="failed"?"text-red-300":item.status==="running"?"text-amber-300":"text-emerald-300"}>●</span><span className="text-[11px] text-white/70 truncate">{item.title}</span><span className="ml-auto text-[9px] text-white/25">{item.status}</span></div>{item.detail&&<p className="text-[9px] text-white/25 mt-1 truncate">{item.detail}</p>}</button>):<p className="text-xs text-white/25 p-2">Live agent events will appear here.</p>}</div>;
}
