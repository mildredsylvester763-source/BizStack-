"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import VoiceInput from "./voice-input";

type App={name:string;slug:string;category:string;description:string;icon_key:string;connected?:boolean;accounts?:any[]};
type Msg={id?:string;role:"user"|"assistant"|"tool";content:string;metadata?:any};
type Event={id:string;title:string;status:string;detail?:string;input?:any;output?:any};
type Project={id:string;name:string;slug:string;project_type:string;status:string;default_branch:string;framework:string|null;runtime:string|null;repository_name:string|null;preview_url:string|null;production_url:string|null;updated_at:string};
type ProjectFile={id:string;path:string;content:string|null;content_sha:string|null;language:string|null;size_bytes:number;is_binary:boolean;version_no:number;updated_at:string};
type EngineeringMode="plan"|"review"|"architecture";
type Conversation={id:string;title:string|null;last_message_at:string|null;created_at:string;updated_at:string};

const FALLBACK:App[]=[
 {name:"Google Drive",slug:"google-drive",category:"Files",description:"Search and work with Drive files, Docs, Sheets and Slides.",icon_key:"GD"},
 {name:"GitHub",slug:"github",category:"Developer",description:"Repositories, source, branches, issues and pull requests.",icon_key:"GH"},
 {name:"Gmail",slug:"gmail",category:"Communication",description:"Search, draft and send authorized business email.",icon_key:"GM"},
 {name:"Google Calendar",slug:"google-calendar",category:"Scheduling",description:"Availability and authorized events.",icon_key:"GC"},
 {name:"Slack",slug:"slack",category:"Communication",description:"Team conversations and authorized messages.",icon_key:"SL"},
 {name:"Notion",slug:"notion",category:"Knowledge",description:"Search selected workspace knowledge.",icon_key:"NO"},
 {name:"Supabase",slug:"supabase",category:"Infrastructure",description:"Authorized database and backend resources.",icon_key:"SB"},
 {name:"Vercel",slug:"vercel",category:"Deployment",description:"Projects, deployments and logs.",icon_key:"VC"},
 {name:"Custom Connector",slug:"custom-connector",category:"Custom",description:"Connect a documented API, webhook, database or private service.",icon_key:"+"}
];

function languageFor(path:string){
  const ext=path.split(".").pop()?.toLowerCase();
  return ext==="ts"||ext==="tsx"?"typescript":ext==="js"||ext==="jsx"?"javascript":ext==="css"?"css":ext==="json"?"json":ext==="md"?"markdown":ext||"text";
}

export default function OperatorCockpit({
  businessId,businessName,initialConversationId,initialMessages
}:{businessId:string;businessName:string;initialConversationId:string|null;initialMessages:Msg[]}){
  const db=createClient(),end=useRef<HTMLDivElement>(null);
  const [messages,setMessages]=useState(initialMessages),[input,setInput]=useState(""),[busy,setBusy]=useState(false);
  const [conversations,setConversations]=useState<Conversation[]>([]),[historyQuery,setHistoryQuery]=useState(""),[historyBusy,setHistoryBusy]=useState(false),[historyOpen,setHistoryOpen]=useState(false),[conversationBusy,setConversationBusy]=useState(false);
  const [conversationId,setConversationId]=useState(initialConversationId),[events,setEvents]=useState<Event[]>([]);
  const [apps,setApps]=useState<App[]>(FALLBACK),[appOpen,setAppOpen]=useState(false),[query,setQuery]=useState("");
  const [context,setContext]=useState<App[]>([]),[tab,setTab]=useState("chat"),[selectedEvent,setSelectedEvent]=useState<Event|null>(null),[approval,setApproval]=useState<any>(null),[picker,setPicker]=useState(false);
  const [projects,setProjects]=useState<Project[]>([]),[projectId,setProjectId]=useState(""),[files,setFiles]=useState<ProjectFile[]>([]),[selectedPath,setSelectedPath]=useState(""),[editor,setEditor]=useState(""),[fileDirty,setFileDirty]=useState(false),[saving,setSaving]=useState(false),[versioning,setVersioning]=useState(false);
  const [terminalCommand,setTerminalCommand]=useState("npm run build"),[terminalOutput,setTerminalOutput]=useState(""),[terminalBusy,setTerminalBusy]=useState(false),[terminalPreview,setTerminalPreview]=useState("");
  const [previewUrl,setPreviewUrl]=useState("");
  const [aiProviders,setAiProviders]=useState<{provider:string;model:string;priority:number}[]>([]);
  const [projectOpen,setProjectOpen]=useState(false),[newProject,setNewProject]=useState({name:"",slug:"",projectType:"app",framework:"Next.js",runtime:"Node.js"}),[projectCreating,setProjectCreating]=useState(false);
  const [engineeringMode,setEngineeringMode]=useState<EngineeringMode>("plan"),[engineeringOutput,setEngineeringOutput]=useState(""),[engineeringBusy,setEngineeringBusy]=useState(false),[engineeringProvider,setEngineeringProvider]=useState("");
  const [shipBusy,setShipBusy]=useState(false),[shipStatus,setShipStatus]=useState("");
  const [versions,setVersions]=useState<any[]>([]),[versionsBusy,setVersionsBusy]=useState(false),[restoringVersion,setRestoringVersion]=useState(false);
  const project=useMemo(()=>projects.find(p=>p.id===projectId)||null,[projects,projectId]);
  const selectedFile=useMemo(()=>files.find(f=>f.path===selectedPath)||null,[files,selectedPath]);
  const shownApps=useMemo(()=>apps.filter(a=>(a.name+" "+a.category+" "+a.description).toLowerCase().includes(query.toLowerCase())),[apps,query]);

  const shownConversations=useMemo(()=>conversations.filter(c=>(c.title||"New conversation").toLowerCase().includes(historyQuery.trim().toLowerCase())),[conversations,historyQuery]);

  async function loadConversations(){
    setHistoryBusy(true);
    try{
      const r=await fetch("/api/assistant/conversations?limit=80",{cache:"no-store"});
      const x=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(x.error||"Conversation history could not be loaded.");
      setConversations((x.conversations||[]) as Conversation[]);
    }catch(e){
      setMessages(v=>v.length?v:[{role:"assistant",content:e instanceof Error?e.message:"Conversation history could not be loaded."}]);
    }finally{setHistoryBusy(false)}
  }

  async function openConversation(id:string){
    if(id===conversationId||conversationBusy)return;
    setConversationBusy(true);
    try{
      const r=await fetch("/api/assistant/conversations?conversationId="+encodeURIComponent(id)+"&limit=80",{cache:"no-store"});
      const x=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(x.error||"Conversation could not be opened.");
      setConversationId(id);
      setMessages((x.messages||[]).map((m:any)=>({id:m.id,role:m.role,content:m.content,metadata:m.metadata})));
      setApproval(null);
      setTab("chat");
      setHistoryOpen(false);
    }catch(e){
      setMessages(v=>[...v,{role:"assistant",content:e instanceof Error?e.message:"Conversation could not be opened."}]);
    }finally{setConversationBusy(false)}
  }

  function startNewConversation(){
    setConversationId(null);
    setMessages([]);
    setApproval(null);
    setInput("");
    setTab("chat");
    setHistoryOpen(false);
  }

  useEffect(()=>{end.current?.scrollIntoView({behavior:"smooth"})},[messages,busy]);
  useEffect(()=>{(async()=>{try{const r=await fetch("/api/ai/providers",{cache:"no-store"});const x=await r.json();if(r.ok)setAiProviders(x.providers||[]);}catch{}})();void loadConversations()},[]);


  async function loadProjects(preferredId?:string){
    const r=await fetch("/api/projects?businessId="+encodeURIComponent(businessId),{cache:"no-store"});
    const x=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(x.error||"Could not load projects.");
    const list=(x.projects||[]) as Project[];
    setProjects(list);
    const next=preferredId||projectId||list[0]?.id||"";
    setProjectId(next);
    return next;
  }

  async function loadFiles(id:string){
    if(!id){setFiles([]);setSelectedPath("");setEditor("");return}
    const r=await fetch("/api/projects/"+encodeURIComponent(id)+"/files",{cache:"no-store"});
    const x=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(x.error||"Could not load files.");
    const list=(x.files||[]) as ProjectFile[];
    setFiles(list);
    const nextPath=list.some(f=>f.path===selectedPath)?selectedPath:list[0]?.path||"";
    setSelectedPath(nextPath);
    setEditor(String(list.find(f=>f.path===nextPath)?.content??""));
    setFileDirty(false);
  }

  useEffect(()=>{void loadProjects().catch(e=>setMessages(v=>[...v,{role:"assistant",content:e.message||"Project workspace could not be loaded."}]))},[businessId]);
  useEffect(()=>{void loadFiles(projectId).catch(e=>setMessages(v=>[...v,{role:"assistant",content:e.message||"Project files could not be loaded."}]))},[projectId]);
  async function loadVersions(id:string){
    if(!id){setVersions([]);return}
    setVersionsBusy(true);
    try{
      const r=await fetch("/api/projects/"+encodeURIComponent(id)+"/versions",{cache:"no-store"});
      const x=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(x.error||"Could not load project checkpoints.");
      setVersions(x.versions||[]);
    }catch(e){setMessages(v=>[...v,{role:"assistant",content:e instanceof Error?e.message:"Checkpoint history could not be loaded."}])}
    finally{setVersionsBusy(false)}
  }
  useEffect(()=>{void loadVersions(projectId)},[projectId]);
  useEffect(()=>{if(selectedFile&&!fileDirty)setEditor(String(selectedFile.content??""))},[selectedFile,fileDirty]);

  useEffect(()=>{
    (async()=>{
      const [{data:c},{data:i}]=await Promise.all([
        db.from("ai_app_catalog").select("name,slug,category,description,icon_key,status").neq("status","private").order("sort_order"),
        db.from("integrations").select("id,provider,status,account_label,external_account_email,external_account_name").eq("business_id",businessId)
      ]);
      const list=(c?.length?c:FALLBACK) as any[];
      setApps(list.map(a=>{const ac=(i||[]).filter((x:any)=>x.provider===a.slug&&x.status==="connected");return {...a,connected:ac.length>0,accounts:ac}}));
    })();
  },[businessId]);

  useEffect(()=>{
    const ch=db.channel("operator-cockpit-"+businessId)
      .on("postgres_changes",{event:"*",schema:"public",table:"ai_agent_run_steps",filter:"business_id=eq."+businessId},p=>{
        const r:any=p.new;setEvents(v=>[{id:r.id,title:r.tool_key||r.step_type||"Operator step",status:r.status,detail:r.error_message,input:r.input,output:r.output},...v.filter(x=>x.id!==r.id)].slice(0,100));
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"ai_build_steps",filter:"business_id=eq."+businessId},p=>{
        const r:any=p.new;setEvents(v=>[{id:r.id,title:r.step_key||"Build step",status:r.status,detail:r.error_message,input:r.input,output:r.output},...v.filter(x=>x.id!==r.id)].slice(0,100));
      }).subscribe();
    return()=>{db.removeChannel(ch)};
  },[businessId]);

  async function send(){
    const text=input.trim();if(!text||busy)return;
    setInput("");setBusy(true);setPicker(false);
    setMessages(v=>[...v,{role:"user",content:text,metadata:{apps:context.map(a=>a.slug),project_id:projectId||null}}]);
    try{
      const isBuildRequest=/\b(build|create|make|design|generate|website|web app|landing page|site|code|feature|fix|bug|edit)\b/i.test(text);
      const r=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input:text,conversationId,clientMessageId:crypto.randomUUID(),context:{apps:context.map(a=>a.slug),businessId,projectId:projectId||null}})});
      const x=await r.json().catch(()=>({}));
      if(!r.ok){
        if(isBuildRequest && projectId && /model provider|AI engine|provider/i.test(String(x.error||""))){
          const fallback=await fetch("/api/ai/build",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({capability:"website",prompt:text,businessId,projectId,mode:"auto_execute",publish:false})});
          const fx=await fallback.json().catch(()=>({}));
          if(!fallback.ok) throw new Error(fx.error||x.error||"Builder request failed.");
          const generated=fx?.result?.project?.files||[];
          setMessages(v=>[...v,{role:"assistant",content:"The local Builder compiler handled the request and versioned "+generated.length+" editable source files. Connect the model provider to unlock the full inspect → edit → run → repair loop."}]);
          await loadProjects(projectId).catch(()=>null);
          await loadFiles(projectId).catch(()=>null);
        } else throw new Error(x.error||"Operator request failed.");
      } else {
        if(x.conversationId)setConversationId(x.conversationId);
        if(x.approval)setApproval(x.approval);
        setMessages(v=>[...v,{role:"assistant",content:x.message||"Done."}]);
        await loadProjects(projectId||undefined).catch(()=>null);
        await loadFiles(projectId||"").catch(()=>null);
        await loadConversations().catch(()=>null);
      }
    }catch(e){setMessages(v=>[...v,{role:"assistant",content:e instanceof Error?e.message:"The Operator could not complete that request."}])}
    finally{setBusy(false)}
  }

  async function saveFile(){
    if(!project||!selectedPath||!fileDirty)return;
    setSaving(true);
    try{
      const r=await fetch("/api/projects/"+encodeURIComponent(project.id)+"/files",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:selectedPath,content:editor,language:languageFor(selectedPath)})});
      const x=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(x.error||"Could not save file.");
      await loadFiles(project.id);setFileDirty(false);
    }catch(e){setMessages(v=>[...v,{role:"assistant",content:e instanceof Error?e.message:"File save failed."}])}
    finally{setSaving(false)}
  }

  async function snapshot(){
    if(!project)return;
    setVersioning(true);
    try{
      await saveFile();
      const r=await fetch("/api/projects/"+encodeURIComponent(project.id)+"/versions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:"Operator workspace snapshot"})});
      const x=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(x.error||"Could not create project snapshot.");
      setMessages(v=>[...v,{role:"assistant",content:"Saved a persistent project version "+String(x.version?.version_no??"")+"."}]);
    }catch(e){setMessages(v=>[...v,{role:"assistant",content:e instanceof Error?e.message:"Version snapshot failed."}])}
    finally{setVersioning(false)}
  }

  async function restoreVersion(versionId:string){
    if(!project||restoringVersion)return;
    setRestoringVersion(true);
    try{
      const r=await fetch("/api/projects/"+encodeURIComponent(project.id)+"/versions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({restoreVersionId:versionId,message:"Restore checkpoint"})});
      const x=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(x.error||"Could not restore checkpoint.");
      await loadFiles(project.id);
      await loadVersions(project.id);
      setMessages(v=>[...v,{role:"assistant",content:"Restored checkpoint v"+String(x.restoredFrom??"")+" into the project source. Existing runtime and deployment state was not changed by the restore."}]);
      setTab("code");
    }catch(e){setMessages(v=>[...v,{role:"assistant",content:e instanceof Error?e.message:"Checkpoint restore failed."}])}
    finally{setRestoringVersion(false)}
  }

  async function createProject(){
    const name=newProject.name.trim(),slug=(newProject.slug.trim()||name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")).toLowerCase();
    if(!name||!slug)return;
    setProjectCreating(true);
    try{
      const r=await fetch("/api/projects",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({businessId,name,slug,projectType:newProject.projectType,framework:newProject.framework,runtime:newProject.runtime})});
      const x=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(x.error||"Could not create project.");
      setProjectOpen(false);setNewProject({name:"",slug:"",projectType:"app",framework:"Next.js",runtime:"Node.js"});
      const id=await loadProjects(x.project?.id);if(id){setTab("code");await loadFiles(id)}
    }catch(e){setMessages(v=>[...v,{role:"assistant",content:e instanceof Error?e.message:"Project creation failed."}])}
    finally{setProjectCreating(false)}
  }

  function parseCommand(line:string){
    const parts=line.trim().split(/\s+/).filter(Boolean);
    return {cmd:parts.shift()||"",args:parts};
  }

  async function runTerminal(){
    if(!project||terminalBusy)return;
    const parsed=parseCommand(terminalCommand);
    if(!parsed.cmd)return;
    setTerminalBusy(true);setTerminalOutput("");
    try{
      const sync=await fetch("/api/projects/"+encodeURIComponent(project.id)+"/runtime",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"sync"})});
      const sx=await sync.json().catch(()=>({}));
      if(!sync.ok)throw new Error(sx.error||"Sandbox sync failed.");
      const r=await fetch("/api/projects/"+encodeURIComponent(project.id)+"/runtime",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"run",cmd:parsed.cmd,args:parsed.args})});
      const x=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(x.error||"Sandbox command failed.");
      const out=[x.session?.output,x.session?.error_output].filter(Boolean).join("\n");
      setTerminalOutput(out||("Exit code: "+String(x.session?.exit_code??0)));
      setTerminalPreview(x.sandbox?.preview_url||"");
      setMessages(v=>[...v,{role:"assistant",content:"Sandbox command completed: "+parsed.cmd}]);
    }catch(e){setTerminalOutput(e instanceof Error?e.message:"Sandbox command failed.")}
    finally{setTerminalBusy(false)}
  }

  async function runEngineeringMode(mode:EngineeringMode){
    if(!project||engineeringBusy)return;
    setEngineeringMode(mode);setEngineeringBusy(true);setEngineeringOutput("");
    try{
      const r=await fetch("/api/projects/"+encodeURIComponent(project.id)+"/engineering",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode,prompt:input.trim(),selectedPath:selectedPath||null})});
      const x=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(x.error||"Engineering analysis failed.");
      setEngineeringProvider(x.provider?String(x.provider)+(x.model?" · "+String(x.model):""):"deterministic");
      setEngineeringOutput(String(x.analysis||[x.title,x.summary,...(x.steps||[]),...(x.warnings||[])].filter(Boolean).join("\n\n")||x.summary||"No analysis returned."));
      setTab("engineering");
    }catch(e){setEngineeringOutput(e instanceof Error?e.message:"Engineering analysis failed.");setTab("engineering");}
    finally{setEngineeringBusy(false)}
  }

  async function verifyProject(){
    if(!project||shipBusy)return;
    setShipBusy(true);setShipStatus("Running real production build verification…");
    try{
      const sync=await fetch("/api/projects/"+encodeURIComponent(project.id)+"/runtime",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"sync"})});
      const sx=await sync.json().catch(()=>({}));
      if(!sync.ok)throw new Error(sx.error||"Project sync failed.");
      const r=await fetch("/api/projects/"+encodeURIComponent(project.id)+"/runtime",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"run",cmd:"npm",args:["run","build"]})});
      const x=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(x.error||"Build verification failed.");
      const exitCode=Number(x.session?.exit_code??0);
      setShipStatus(exitCode===0?"Verified: production build passed.":("Build failed with exit code "+exitCode+"."));
      setTerminalOutput([x.session?.output,x.session?.error_output].filter(Boolean).join("\n")||("Exit code: "+exitCode));
      setTab("terminal");
    }catch(e){setShipStatus(e instanceof Error?e.message:"Build verification failed.");setTab("terminal");}
    finally{setShipBusy(false)}
  }

  async function deployProject(){
    if(!project||shipBusy)return;
    setShipBusy(true);setShipStatus("Creating a preview deployment from the current repository…");
    try{
      const r=await fetch("/api/projects/"+encodeURIComponent(project.id)+"/deploy",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({environment:"preview",gitRef:project.default_branch||"main"})});
      const x=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(x.error||"Deployment request failed.");
      const depId=x.deployment?.id;
      if(depId){
        const sr=await fetch("/api/projects/"+encodeURIComponent(project.id)+"/deploy/status?deploymentId="+encodeURIComponent(depId),{cache:"no-store"});
        const sx=await sr.json().catch(()=>({}));
        setShipStatus(sx.deployment?.url?("Deployment requested: "+sx.deployment.url):"Deployment request accepted; status is being tracked.");
      }else setShipStatus("Deployment request accepted; no deployment record id was returned.");
    }catch(e){setShipStatus(e instanceof Error?e.message:"Deployment failed.");}
    finally{setShipBusy(false)}
  }

  async function connect(app:App){
    if(app.slug==="custom-connector"){location.href="/dashboard/integrations?custom=1";return}
    const r=await fetch("/api/apps/connect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({app:app.slug,businessId})});
    const x=await r.json().catch(()=>({}));
    if(r.ok&&x.authorizationUrl)location.href=x.authorizationUrl;
    else if(r.ok&&x.redirect)location.href=x.redirect;
    else setMessages(v=>[...v,{role:"assistant",content:x.error||"This provider connection needs its provider-specific adapter before authorization can begin."}]);
  }

  const statusPills=project?[project.framework||"framework undetected",project.runtime||"runtime unconfigured",project.repository_name?"repo linked":"local project",project.preview_url?"preview linked":"preview not published"]:[];
  const quickActions=project?["Inspect "+project.name,"Edit "+project.name+" source","Review current project","Plan the next feature"]:["Create a software project","Connect Google Drive","Find overdue invoices","Explain cash position"];

  return null;

}
