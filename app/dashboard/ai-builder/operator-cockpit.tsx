"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import VoiceInput from "./voice-input";
import WebsiteWorkspace from "./website-workspace";
import BuilderMobileMenu from "./builder-mobile-menu";

type App={name:string;slug:string;category:string;description:string;icon_key:string;connected?:boolean;accounts?:any[]};
type Msg={id?:string;role:"user"|"assistant"|"tool";content:string;metadata?:any};
type Event={id:string;title:string;status:string;detail?:string;input?:any;output?:any};
type Project={id:string;name:string;slug:string;project_type:string;status:string;default_branch:string;framework:string|null;runtime:string|null;repository_name:string|null;preview_url:string|null;production_url:string|null;updated_at:string};
type ProjectFile={id:string;path:string;content:string|null;content_sha:string|null;language:string|null;size_bytes:number;is_binary:boolean;version_no:number;updated_at:string};
type EngineeringMode="plan"|"review"|"architecture";
type Conversation={id:string;title:string|null;last_message_at:string|null;created_at:string;updated_at:string};
type ComposerAttachment={id:string;name:string;mime_type:string;size_bytes:number;kind:"image"|"document"|"spreadsheet"|"text"|"archive"|"other";status:"processing"|"ready"|"failed";extracted_chars:number;preview_url?:string|null;project_id?:string|null;conversation_id?:string|null};

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

function collectGeneratedAssets(toolResults:any[]|undefined){
  const assets:any[]=[];
  for(const item of toolResults||[]){
    const output=item?.output;
    const candidates=[
      output?.asset,
      ...(Array.isArray(output?.visualAssets?.generated)?output.visualAssets.generated:[]),
      ...(Array.isArray(output?.result?.visualAssets?.generated)?output.result.visualAssets.generated:[])
    ];
    for(const asset of candidates){
      if(asset?.public_url && !assets.some((x)=>x.id===asset.id)){
        assets.push(asset);
      }
    }
  }
  return assets;
}


export default function OperatorCockpit({
  businessId,businessName,initialConversationId,initialMessages
}:{businessId:string;businessName:string;initialConversationId:string|null;initialMessages:Msg[]}){
  const db=createClient(),end=useRef<HTMLDivElement>(null),fileInput=useRef<HTMLInputElement>(null);
  const [messages,setMessages]=useState(initialMessages),[input,setInput]=useState(""),[busy,setBusy]=useState(false);
  const [attachments,setAttachments]=useState<ComposerAttachment[]>([]),[attachmentBusy,setAttachmentBusy]=useState(false);
  const [conversations,setConversations]=useState<Conversation[]>([]),[historyQuery,setHistoryQuery]=useState(""),[historyBusy,setHistoryBusy]=useState(false),[historyOpen,setHistoryOpen]=useState(false),[conversationBusy,setConversationBusy]=useState(false);
  const [visualPicker,setVisualPicker]=useState(false);
  const [conversationId,setConversationId]=useState(initialConversationId),[events,setEvents]=useState<Event[]>([]);
  const [apps,setApps]=useState<App[]>(FALLBACK),[appOpen,setAppOpen]=useState(false),[query,setQuery]=useState("");
  const [context,setContext]=useState<App[]>([]),[tab,setTab]=useState("chat"),[selectedEvent,setSelectedEvent]=useState<Event|null>(null),[approval,setApproval]=useState<any>(null),[picker,setPicker]=useState(false);
  const [projects,setProjects]=useState<Project[]>([]),[projectId,setProjectId]=useState(""),[files,setFiles]=useState<ProjectFile[]>([]),[selectedPath,setSelectedPath]=useState(""),[editor,setEditor]=useState(""),[fileDirty,setFileDirty]=useState(false),[saving,setSaving]=useState(false),[versioning,setVersioning]=useState(false),[workspaceAutoOpened,setWorkspaceAutoOpened]=useState(false);
  const [terminalCommand,setTerminalCommand]=useState("npm run build"),[terminalOutput,setTerminalOutput]=useState(""),[terminalBusy,setTerminalBusy]=useState(false),[terminalPreview,setTerminalPreview]=useState("");
  const [previewUrl,setPreviewUrl]=useState("");
  const [aiProviders,setAiProviders]=useState<{provider:string;model:string;priority:number}[]>([]);
  const [projectOpen,setProjectOpen]=useState(false),[newProject,setNewProject]=useState({name:"",slug:"",projectType:"app",framework:"Next.js",runtime:"Node.js",platformTarget:"web"}),[projectCreating,setProjectCreating]=useState(false);
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
      const r=await fetch("/api/assistant/conversations?limit=80&projectId="+encodeURIComponent(projectId||""),{cache:"no-store"});
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
      const r=await fetch("/api/assistant/conversations?conversationId="+encodeURIComponent(id)+"&limit=80&projectId="+encodeURIComponent(projectId||""),{cache:"no-store"});
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
    setAttachments([]);
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
    if(!workspaceAutoOpened){
      const initialProject=list.find(p=>p.id===next);
      if(initialProject?.project_type==="website"){
        setTab("website");
        setWorkspaceAutoOpened(true);
      }
    }
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

  async function uploadAttachments(selected:FileList|File[]){
    const filesToUpload=Array.from(selected).filter(Boolean).slice(0,12);
    if(!filesToUpload.length||attachmentBusy)return;
    setAttachmentBusy(true);
    const added:ComposerAttachment[]=[];
    const failures:string[]=[];
    try{
      for(const file of filesToUpload){
        const form=new FormData();
        form.append("file",file);
        if(projectId)form.append("projectId",projectId);
        if(conversationId)form.append("conversationId",conversationId);
        const response=await fetch("/api/assistant/attachments",{method:"POST",body:form});
        const payload=await response.json().catch(()=>({}));
        if(!response.ok||!payload.attachment)failures.push(file.name+": "+String(payload.error||"upload failed"));
        else added.push(payload.attachment as ComposerAttachment);
      }
      if(added.length)setAttachments(v=>[...v,...added].slice(-12));
      if(failures.length)setMessages(v=>[...v,{role:"assistant",content:"Some attachments could not be added:\n"+failures.join("\n")}]);
    }finally{
      setAttachmentBusy(false);
      if(fileInput.current)fileInput.current.value="";
    }
  }

  async function send(){
    const text=input.trim();
    const pendingAttachments=attachments;
    if((!text&&!pendingAttachments.length)||busy||attachmentBusy)return;
    setInput("");setAttachments([]);setBusy(true);setPicker(false);
    setMessages(v=>[...v,{role:"user",content:text||"Review these attached references.",metadata:{apps:context.map(a=>a.slug),project_id:projectId||null,attachments:pendingAttachments}}]);
    try{
      const isBuildRequest=/\b(build|create|make|design|generate|website|web app|landing page|site|code|feature|fix|bug|edit)\b/i.test(text);
      const r=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input:text,attachments:pendingAttachments.map(a=>a.id),conversationId,clientMessageId:crypto.randomUUID(),context:{apps:context.map(a=>a.slug),businessId,projectId:projectId||null}})});
      const x=await r.json().catch(()=>({}));
      if(!r.ok){
        if(isBuildRequest && projectId && pendingAttachments.length===0 && /model provider|AI engine|provider/i.test(String(x.error||""))){
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
        const generatedAssets=collectGeneratedAssets(x.toolResults);
        setMessages(v=>[...v,{role:"assistant",content:x.message||"Done.",metadata:{assets:generatedAssets}}]);
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
      const r=await fetch("/api/projects",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({businessId,name,slug,projectType:newProject.projectType,framework:newProject.framework,runtime:newProject.runtime,metadata:{platform_target:newProject.platformTarget,creator_surface:"ai_builder"}})});
      const x=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(x.error||"Could not create project.");
      setProjectOpen(false);setNewProject({name:"",slug:"",projectType:"app",framework:"Next.js",runtime:"Node.js",platformTarget:"web"});
      const id=await loadProjects(x.project?.id);if(id){setTab(x.project?.project_type==="website"?"website":"code");await loadFiles(id)}
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

  return (
    <>
      <aside className={(historyOpen?"fixed inset-y-0 left-0 z-50 flex":"hidden")+" xl:flex w-[250px] shrink-0 flex-col bg-[#0c0e12] border-r border-white/[.07]"}>
      <div className="h-12 px-3 border-b border-white/[.07] flex items-center gap-2">
        <button onClick={startNewConversation} className="flex-1 rounded-xl bg-white text-black px-3 py-2 text-[9px] font-medium">+ New chat</button>
        <button onClick={()=>setHistoryOpen(false)} className="xl:hidden w-8 h-8 rounded-lg bg-white/[.05] text-white/40">×</button>
      </div>
      <div className="p-3 border-b border-white/[.06]"><input value={historyQuery} onChange={e=>setHistoryQuery(e.target.value)} placeholder="Search chats" className="w-full bg-white/[.04] border border-white/[.07] rounded-xl px-3 py-2 text-[9px] text-white/70 placeholder:text-white/20 outline-none"/></div>
      <div className="px-3 py-2 text-[8px] uppercase tracking-[.18em] text-white/20">History</div>
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
        {historyBusy&&<div className="px-2 py-3 text-[8px] text-white/20">Loading conversations…</div>}
        {!historyBusy&&!shownConversations.length&&<div className="px-2 py-4 text-[8px] text-white/20">No saved chats yet. Your first message will create one.</div>}
        {shownConversations.map(c=><button key={c.id} onClick={()=>void openConversation(c.id)} className={"w-full text-left px-3 py-2.5 rounded-xl border "+(conversationId===c.id?"bg-white/[.07] border-white/[.09]":"border-transparent hover:bg-white/[.04]")}>
          <div className="text-[9px] text-white/65 truncate">{c.title||"New conversation"}</div>
          <div className="text-[7px] text-white/20 mt-1">{c.last_message_at?new Date(c.last_message_at).toLocaleDateString(undefined,{month:"short",day:"numeric"}):"No activity"}</div>
        </button>)}
      </div>
      <div className="p-3 border-t border-white/[.06]"><div className="text-[8px] text-white/20">Persistent history</div><div className="text-[7px] leading-4 text-white/15 mt-1">Chats stay attached to the BizStack workspace and can be reopened without losing the project context you were using.</div></div>
    </aside>
      <div className="bizstack-builder min-h-screen bg-[#0b0d11] text-white xl:pl-[250px]">

    <div className="h-14 px-3 sm:px-4 border-b border-white/[.07] flex items-center gap-2">
      <BuilderMobileMenu
        businessName={businessName}
        projectName={project?.name}
        onNewChat={startNewConversation}
        onOpenHistory={()=>setHistoryOpen(true)}
        onOpenApps={()=>setAppOpen(true)}
        onOpenProject={()=>setProjectOpen(true)}
        onOpenWebsite={()=>setTab("website")}
      />
      <div className="min-w-0">
        <div className="font-semibold text-[12px] tracking-[-.02em] text-white/90">BizStack</div>
        <div className="text-[8px] text-white/25 truncate">{project?.project_type==="website"?"Website Creator":"AI Builder"} · {businessName}</div>
      </div>
      <div className="hidden lg:flex items-center gap-1.5 ml-3">{aiProviders.slice(0,3).map(p=><span key={p.provider} className="px-2 py-1 rounded-full bg-emerald-300/[.05] border border-emerald-300/[.07] text-[7px] text-emerald-200/55">{p.provider} · {p.model}</span>)}</div>
      <div className="ml-auto flex items-center gap-1.5">
        <button onClick={()=>setHistoryOpen(true)} className="hidden sm:inline-flex px-3 py-1.5 rounded-xl bg-white/[.045] border border-white/[.06] text-[8px] text-white/45">History</button>
        <button onClick={startNewConversation} className="hidden md:inline-flex px-3 py-1.5 rounded-xl bg-white/[.055] border border-white/[.06] text-[8px] text-white/55">New chat</button>
        <button onClick={()=>setAppOpen(true)} className="hidden md:inline-flex px-3 py-1.5 rounded-xl bg-indigo-400/10 border border-indigo-300/10 text-[8px] text-indigo-200">Connections</button>
      </div>
    </div>
    <div className="px-3 py-2 border-b border-white/[.06] bg-[#0d0f13] flex items-center gap-2 overflow-x-auto">
      <span className="text-[8px] uppercase tracking-[.18em] text-white/20">Project</span>
      <select value={projectId} onChange={e=>{const next=e.target.value;setProjectId(next);const nextProject=projects.find(p=>p.id===next);setTab(nextProject?.project_type==="website"?"website":"code")}} className="min-w-[180px] bg-white/[.05] border border-white/[.07] rounded-lg px-2 py-1.5 text-[9px] outline-none"><option value="">No project attached</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
      {statusPills.map(x=><span key={x} className="px-2 py-1 rounded bg-white/[.04] text-[8px] text-white/25">{x}</span>)}{context.map(a=><button key={a.slug} onClick={()=>setContext(v=>v.filter(x=>x.slug!==a.slug))} className="px-2 py-1 rounded bg-indigo-400/10 text-[8px] text-indigo-200">@{a.name}</button>)}
    </div>

    <div className="grid xl:grid-cols-[390px_minmax(0,1fr)_270px] min-h-[calc(100vh-96px)]">
      <section className="bg-[#101217] border-r border-white/[.07] flex flex-col min-h-0">
        <nav className="h-11 px-3 border-b border-white/[.06] flex items-center gap-2">
          <div className="md:hidden flex-1">
            <select value={tab} onChange={e => setTab(e.target.value)} className="w-full rounded-xl border border-white/[.07] bg-white/[.04] px-3 py-2 text-[8px] text-white/55 outline-none">
              {["chat",...(project?.project_type==="website"?["website"]:[]),"code","engineering","preview","terminal","run"].map(x => <option key={x} value={x}>{x === "website" ? "Website Creator" : x === "chat" ? "AI Chat" : x[0].toUpperCase() + x.slice(1)}</option>)}
            </select>
          </div>
          <div className="hidden md:flex items-center gap-1 overflow-x-auto">
            {["chat",...(project?.project_type==="website"?["website"]:[]),"code","engineering","preview","terminal","run"].map(x => (
              <button key={x} onClick={() => setTab(x)} className={tab===x ? "px-3 py-1.5 rounded-xl bg-white/[.08] text-[8px] text-white/70" : "px-3 py-1.5 rounded-xl text-white/25 text-[8px] hover:bg-white/[.03]"}>
                {x === "website" ? "Website" : x === "chat" ? "Chat" : x[0].toUpperCase() + x.slice(1)}
              </button>
            ))}
          </div>
        </nav>
        <div className="flex-1 overflow-y-auto">
          {tab==="chat"&&<div className="p-4 space-y-5">
            {!messages.length&&<div className="pt-8"><div className="text-[8px] uppercase tracking-[.2em] text-white/20">Autonomous workspace</div><h2 className="text-3xl mt-2 tracking-tight">What should I handle?</h2><p className="text-[11px] text-white/35 leading-5 mt-3">Tell the Operator the outcome. It can now work against real project records and source files.</p><div className="grid grid-cols-2 gap-2 mt-5">{quickActions.map(x=><button key={x} onClick={()=>setInput(x)} className="text-left p-3 rounded-xl border border-white/[.07] text-[9px] text-white/45 hover:bg-white/[.04]">{x}</button>)}</div></div>}
            {messages.map((m,i)=><div key={m.id||i} className="flex gap-3 items-start"><div className={"w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-[8px] font-semibold "+(m.role==="user"?"bg-white/[.08] text-white/55":"bg-indigo-400/10 text-indigo-200")}>{m.role==="user"?"You":"B"}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2 mb-1"><span className="text-[9px] text-white/35">{m.role==="user"?"You":"BizStack"}</span>{m.metadata?.ai_provider&&<span className="text-[7px] text-white/15">{String(m.metadata.ai_provider)}</span>}</div><div className="text-[12px] leading-6 text-white/72 whitespace-pre-wrap break-words">{m.content}</div>{Array.isArray(m.metadata?.attachments)&&m.metadata.attachments.length>0&&<div className="mt-3 flex flex-wrap gap-2">{m.metadata.attachments.map((a:any)=><div key={a.id||a.name} className="rounded-xl border border-white/[.07] bg-white/[.025] px-2.5 py-2 min-w-[150px] max-w-full">{a.preview_url&&String(a.mime_type||"").startsWith("image/")&&<img src={a.preview_url} alt={a.name||"Attached image"} className="w-32 h-20 object-cover rounded-lg mb-2"/>}<div className="text-[8px] text-white/55 truncate">{a.name||"Attachment"}</div><div className="text-[7px] text-white/20 mt-1">{a.kind||"file"}{a.extracted_chars?(" · "+a.extracted_chars.toLocaleString()+" chars read"):""}</div></div>)}</div>}{Array.isArray(m.metadata?.assets)&&m.metadata.assets.length>0&&<div className="grid gap-2 mt-3 sm:grid-cols-2">{m.metadata.assets.map((asset:any)=><a key={asset.id||asset.public_url} href={asset.public_url} target="_blank" rel="noreferrer" className="group rounded-2xl overflow-hidden border border-white/[.08] bg-white/[.025]"><div className="aspect-[16/10] bg-white/[.03]"><img src={asset.public_url} alt={asset.alt_text||asset.name||"Generated website visual"} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.015]" loading="lazy"/></div><div className="px-3 py-2.5 flex items-center justify-between gap-2"><span className="text-[8px] text-white/50 truncate">{asset.name||"Generated visual"}</span><span className="text-[7px] text-indigo-200/70 shrink-0">bespoke</span></div></a>)}</div>}</div></div>)}
            {approval&&<div className="p-3 rounded-xl border border-amber-300/20 bg-amber-300/[.05]"><div className="text-[8px] text-amber-200 uppercase">Approval required</div><p className="text-[10px] mt-2">{approval.action}</p><button className="mt-3 bg-white text-black rounded-lg px-3 py-2 text-[9px]" onClick={async()=>{setBusy(true);try{const r=await fetch("/api/assistant/approve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({runId:approval.runId})});const x=await r.json().catch(()=>({}));setApproval(x.approval||null);setMessages(v=>[...v,{role:"assistant",content:x.message||"Approved action completed."}]);await loadProjects(projectId||undefined).catch(()=>null)}finally{setBusy(false)}}}>Approve</button></div>}
            {busy&&<div className="flex gap-3 items-center py-2"><div className="w-7 h-7 rounded-lg bg-indigo-400/10 flex items-center justify-center text-[8px] text-indigo-200 animate-pulse">B</div><div className="text-[9px] text-white/30">BizStack is working across the workspace…</div></div>}<div ref={end}/>
          </div>}
          {tab==="website"&&<WebsiteWorkspace project={project} files={files} initialPreviewUrl={previewUrl} onPreviewUrlChange={setPreviewUrl} onAskAI={setInput} onCreateProject={()=>setProjectOpen(true)}/>}\n          {tab==="code"&&<div className="h-full min-h-[620px] flex">
            <div className="w-56 shrink-0 border-r border-white/[.06] bg-[#0f1115] overflow-y-auto"><div className="px-3 py-2 border-b border-white/[.05] text-[8px] uppercase tracking-[.15em] text-white/20">{project?.name||"No project"}</div>{!project&&<div className="p-3 text-[9px] text-white/25">Create or select a project to open its real source tree.</div>}{project&&files.map(f=><button key={f.path} onClick={()=>{setSelectedPath(f.path);setEditor(String(f.content??""));setFileDirty(false)}} className={selectedPath===f.path?"w-full text-left px-3 py-2 bg-white/[.07] text-[9px] text-white":"w-full text-left px-3 py-2 text-[9px] text-white/35 hover:bg-white/[.04]"}>{f.path}</button>)}{project&&files.length===0&&<div className="p-3 text-[9px] text-white/20">No source files yet. Ask the Operator to create the project files.</div>}</div>
            <div className="flex-1 flex flex-col min-w-0"><div className="h-10 px-3 border-b border-white/[.06] flex items-center gap-2"><span className="text-[9px] text-white/40 truncate">{selectedPath||"Select a file"}</span>{selectedFile&&<span className="text-[8px] text-white/15 ml-auto">v{selectedFile.version_no} · {selectedFile.content_sha?.slice(0,10)||"no checksum"}</span>}{fileDirty&&<span className="text-[8px] text-amber-200">unsaved</span>}<button onClick={()=>void snapshot()} disabled={!project||versioning||saving} className="ml-auto px-2.5 py-1.5 rounded-lg bg-indigo-400/10 text-[8px] text-indigo-200 disabled:opacity-20">Snapshot</button><button onClick={()=>void saveFile()} disabled={!project||!selectedPath||!fileDirty||saving} className="px-2.5 py-1.5 rounded-lg bg-white text-black text-[8px] disabled:opacity-20">{saving?"Saving…":"Save"}</button></div><textarea value={editor} onChange={e=>{setEditor(e.target.value);setFileDirty(true)}} spellCheck={false} disabled={!selectedFile} placeholder={project?"Select a source file":"Select a project"} className="flex-1 min-h-[570px] resize-none bg-[#0b0d11] px-4 py-4 font-mono text-[11px] leading-5 text-white/75 outline-none"/></div>
          </div>}
          {tab==="engineering"&&<div className="h-full min-h-[620px] flex flex-col bg-[#090b0e]">
            <div className="px-4 py-3 border-b border-white/[.06] flex items-center gap-2">
              <div><div className="text-[8px] uppercase tracking-[.18em] text-white/20">Engineering intelligence</div><div className="text-[9px] text-white/35 mt-1">{project?.name||"No project selected"}</div></div>
              <div className="ml-auto text-[8px] text-white/20">{engineeringProvider||"provider auto"}</div>
            </div>
            <div className="px-4 py-3 border-b border-white/[.06] flex flex-wrap gap-2">
              {[{key:"plan",label:"Plan",detail:"strategy before edits"},{key:"review",label:"Review",detail:"bugs, security, regressions"},{key:"architecture",label:"Architecture",detail:"system map and boundaries"}].map((m:any)=><button key={m.key} onClick={()=>void runEngineeringMode(m.key)} disabled={!project||engineeringBusy} className={engineeringMode===m.key?"px-3 py-2 rounded-lg bg-white text-black text-[8px]":"px-3 py-2 rounded-lg bg-white/[.05] text-[8px] text-white/45 border border-white/[.07]"}>{engineeringBusy&&engineeringMode===m.key?"Working…":m.label}<span className="ml-2 text-white/25">{m.detail}</span></button>)}
            </div>
            <div className="flex-1 overflow-auto p-4">
              {!engineeringOutput&&<div className="max-w-xl mx-auto pt-10 text-center"><div className="text-[8px] uppercase tracking-[.2em] text-white/20">Agentic engineering loop</div><h3 className="text-xl mt-2">Plan, inspect, review and verify before changing the code.</h3><p className="text-[10px] leading-5 text-white/25 mt-3">Select a file for focused review, or leave the selection empty for a project-level analysis. These modes never claim to have changed files.</p></div>}
              {engineeringOutput&&<pre className="whitespace-pre-wrap text-[10px] leading-5 text-white/65 font-mono">{engineeringOutput}</pre>}
            </div>
            <div className="mt-4 rounded-xl border border-white/[.06] bg-white/[.02] p-3">
              <div className="flex items-center justify-between"><span className="text-[8px] uppercase tracking-[.18em] text-white/20">Checkpoints</span><button onClick={()=>void snapshot()} disabled={!project||versioning||saving} className="px-2.5 py-1.5 rounded-lg bg-white/[.06] text-[8px] text-white/60 disabled:opacity-20">Snapshot now</button></div>
              <div className="mt-3 space-y-2 max-h-40 overflow-auto">
                {versionsBusy&&<div className="text-[8px] text-white/25">Loading checkpoints…</div>}
                {!versionsBusy&&!versions.length&&<div className="text-[8px] text-white/20">No saved checkpoints yet.</div>}
                {versions.map(v=><div key={v.id} className="flex items-center gap-2 rounded-lg border border-white/[.05] bg-white/[.015] p-2">
                  <div className="min-w-0 flex-1"><div className="text-[8px] text-white/55">v{v.version_no} · {v.message||"Snapshot"}</div><div className="text-[7px] text-white/20 mt-1">{v.created_at?new Date(v.created_at).toLocaleString():""}</div></div>
                  <button onClick={()=>void restoreVersion(String(v.id))} disabled={restoringVersion||versioning||saving} className="px-2 py-1 rounded bg-white/[.05] text-[7px] text-white/50 disabled:opacity-20">{restoringVersion?"Restoring…":"Restore"}</button>
                </div>)}
              </div>
            </div>
            <div className="p-3 border-t border-white/[.06] space-y-3">
              <div className="flex items-center justify-between"><span className="text-[8px] text-white/20">{selectedPath?"Focused: "+selectedPath:"Project-wide context"}</span><button onClick={()=>void runEngineeringMode(engineeringMode)} disabled={!project||engineeringBusy} className="px-3 py-2 rounded-lg bg-indigo-400/10 text-indigo-200 text-[8px] disabled:opacity-20">Re-run {engineeringMode}</button></div>
              <div className="flex flex-wrap gap-2"><button onClick={()=>void verifyProject()} disabled={!project||shipBusy} className="px-3 py-2 rounded-lg bg-emerald-300/[.08] border border-emerald-300/[.1] text-emerald-200 text-[8px] disabled:opacity-20">{shipBusy?"Working…":"Verify build"}</button><button onClick={()=>void deployProject()} disabled={!project||shipBusy} className="px-3 py-2 rounded-lg bg-white/[.06] border border-white/[.08] text-white/60 text-[8px] disabled:opacity-20">Deploy preview</button></div>
              {shipStatus&&<div className="text-[8px] leading-4 text-white/30">{shipStatus}</div>}
            </div>
          </div>}
          {tab==="preview"&&<div className="h-full min-h-[620px] flex flex-col bg-[#080a0d]">
 <div className="px-4 py-3 border-b border-white/[.06] flex items-center gap-3"><div><div className="text-[8px] uppercase tracking-[.18em] text-white/20">Live browser preview</div><div className="text-[9px] text-white/35 mt-1">{project?.name||"No project selected"}</div></div><button onClick={async()=>{if(!project)return;setBusy(true);try{const r=await fetch("/api/projects/"+encodeURIComponent(project.id)+"/preview",{method:"POST"});const x=await r.json();if(!r.ok)throw new Error(x.error||"Preview failed");setPreviewUrl(x.url||"");setMessages(v=>[...v,{role:"assistant",content:"Live sandbox preview is ready."}]);}catch(e){setMessages(v=>[...v,{role:"assistant",content:e instanceof Error?e.message:"Preview failed."}])}finally{setBusy(false)}}} disabled={!project||busy} className="ml-auto px-3 py-1.5 rounded-lg bg-white text-black text-[8px] disabled:opacity-20">{busy?"Starting…":"Start preview"}</button></div>
 {previewUrl||project?.preview_url?<iframe title="BizStack live preview" src={previewUrl||project?.preview_url||""} className="flex-1 w-full border-0 bg-white"/>:<div className="flex-1 grid place-items-center text-[10px] text-white/25">Start preview to open the actual project runtime.</div>}
 </div>}
          {tab==="terminal"&&<div className="h-full min-h-[620px] flex flex-col bg-[#090b0e]">
            <div className="px-4 py-3 border-b border-white/[.06] flex items-center gap-3"><div><div className="text-[8px] uppercase tracking-[.18em] text-white/20">Isolated terminal</div><div className="text-[9px] text-white/35 mt-1">{project?.name||"No project attached"}</div></div><div className="ml-auto text-[8px] text-white/15">{terminalBusy?"running":"idle"}</div></div>
            <div className="flex-1 p-4 font-mono text-[10px] leading-5 text-white/60 overflow-auto whitespace-pre-wrap">{terminalOutput||"Sandbox output will appear here. Commands execute only through the isolated runtime adapter; no host shell is used."}</div>
            <div className="p-3 border-t border-white/[.06]"><div className="flex gap-2"><span className="px-2 py-2 text-emerald-300/70">$</span><input value={terminalCommand} onChange={e=>setTerminalCommand(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void runTerminal()}}} disabled={!project||terminalBusy} className="flex-1 bg-transparent outline-none text-[10px] font-mono text-white/70" placeholder="npm install / npm run build / node …"/><button onClick={()=>void runTerminal()} disabled={!project||terminalBusy||!terminalCommand.trim()} className="px-3 rounded-lg bg-white text-black text-[8px] disabled:opacity-20">{terminalBusy?"Running…":"Run"}</button></div>{terminalPreview&&<div className="mt-2 text-[8px] text-indigo-200">Preview: {terminalPreview}</div>}</div>
          </div>}
          {tab==="run"&&<div>{events.length?events.map(e=><button key={e.id} onClick={()=>setSelectedEvent(e)} className="w-full text-left px-4 py-3 border-b border-white/[.05] hover:bg-white/[.03]"><div className="flex gap-2 text-[9px]"><span className={e.status==="failed"?"text-red-300":"text-emerald-300"}>●</span><span className="text-white/55">{e.title}</span><span className="ml-auto text-white/20">{e.status}</span></div>{e.detail&&<p className="text-[8px] text-white/20 mt-1">{e.detail}</p>}</button>):<div className="p-5 text-[9px] text-white/20">No runtime events recorded for this workspace yet.</div>}</div>}
        </div>
        <div className="p-3 border-t border-white/[.07]"><div className="rounded-2xl border border-white/[.1] bg-[#15181e] p-2">
<input ref={fileInput} type="file" multiple accept="image/*,.pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.json,.html,.xml,.yaml,.yml,.ts,.tsx,.js,.jsx,.css,.scss,.sql" className="hidden" onChange={e=>{if(e.target.files)void uploadAttachments(e.target.files)}}/>
{attachments.length>0&&<div className="mb-2 flex flex-wrap gap-1.5">{attachments.map(a=><div key={a.id} className="group flex items-center gap-1.5 rounded-xl border border-indigo-300/[.1] bg-indigo-300/[.04] px-2 py-1.5"><span className="text-[8px] text-white/60 max-w-[170px] truncate">{a.name}</span><span className="text-[7px] text-indigo-200/60">{a.status==="ready"?"read":"processing"}</span><button onClick={()=>setAttachments(v=>v.filter(x=>x.id!==a.id))} className="text-white/25 hover:text-white/60">×</button></div>)}</div>}
{picker&&<div className="mb-2 p-2 rounded-xl bg-[#1b1e25]">
  <div className="text-[7px] uppercase tracking-[.18em] text-white/20 px-2 pb-1">Connected context</div>
  {apps.filter(a=>a.connected).map(a=><button key={a.slug} onClick={()=>{setContext(v=>v.some(x=>x.slug===a.slug)?v:[...v,a]);setPicker(false)}} className="block w-full text-left px-2 py-2 text-[9px] hover:bg-white/[.05]">@{a.name}</button>)}
  {!apps.some(a=>a.connected)&&<button onClick={()=>{setPicker(false);setAppOpen(true)}} className="text-[9px] text-indigo-200 p-2">Connect an app →</button>}
  <div className="mt-2 pt-2 border-t border-white/[.06]">
    <button onClick={()=>{setVisualPicker(v=>!v);setPicker(false)}} className="w-full text-left px-2 py-2 rounded-lg bg-indigo-400/[.07] border border-indigo-300/[.08] text-[9px] text-indigo-100">Create bespoke visual…</button>
  </div>
</div>}
{visualPicker&&<div className="mb-2 p-2 rounded-xl bg-[#1b1e25] border border-indigo-300/[.08]">
  <div className="flex items-center justify-between px-2 pb-1"><div><div className="text-[7px] uppercase tracking-[.18em] text-indigo-200/60">Visual Creator</div><div className="text-[8px] text-white/30 mt-1">Original artwork tied to this business and website</div></div><button onClick={()=>setVisualPicker(false)} className="text-white/25 px-1">×</button></div>
  <div className="grid grid-cols-2 gap-1.5 mt-2">
    {[
      ["logo","Create a distinctive original brand mark/logo for this business. Do not imitate existing brands, templates or generic SaaS marks."],
      ["hero","Create a bespoke homepage hero visual based on this business, audience, brand direction and current website. Avoid generic stock photography and abstract template gradients."],
      ["product_scene","Create a premium, business-specific product scene for the real products/context in this project. Preserve the product identity and avoid generic catalog imagery."],
      ["section_image","Create an original section visual that communicates this exact business idea and fits the existing visual identity. Avoid stock/template artwork."]
    ].map(([kind,prompt])=><button key={kind} onClick={()=>{setInput(prompt);setVisualPicker(false)}} className="text-left rounded-lg border border-white/[.06] bg-white/[.02] hover:bg-white/[.05] px-2.5 py-2"><div className="text-[8px] text-white/65 capitalize">{String(kind).replace("_"," ")}</div><div className="text-[7px] leading-4 text-white/25 mt-1">AI will create it in this chat</div></button>)}
  </div>
</div>}<div className="flex items-end gap-2"><button title="Attach files or images" onClick={()=>fileInput.current?.click()} className="w-8 h-8 rounded-xl bg-indigo-400/[.08] border border-indigo-300/[.08] text-indigo-200/80">{attachmentBusy?"…":"↗"}</button><button onClick={()=>setPicker(v=>!v)} className="w-8 h-8 rounded-xl bg-white/[.05] text-white/40">+</button><VoiceInput onTranscript={setInput}/><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send()}}} rows={2} placeholder={project?.project_type==="website"?"Attach a screenshot/reference or describe the website you want to build or change…":"Attach files/images, then ask BizStack to understand, build, edit, run or review them…"} className="flex-1 resize-none bg-transparent outline-none text-[11px] leading-5 placeholder:text-white/20"/><button onClick={()=>void send()} disabled={(!input.trim()&&!attachments.length)||busy||attachmentBusy} className="w-9 h-9 rounded-xl bg-white text-black disabled:opacity-20">↑</button></div></div><div className="mt-2 flex items-center justify-between gap-3"><p className="text-[8px] text-white/15">Attach images, PDFs, Word files, spreadsheets or source files · Enter run · Shift+Enter newline</p><span className="text-[7px] text-white/15">{project?.project_type==="website"?"Website Creator mode":"AI engineering + operations"}</span></div></div>
      </section>

      <section className="bg-[#15181d] border-r border-white/[.07] min-h-0"><div className="h-10 px-4 border-b border-white/[.06] flex items-center justify-between"><span className="text-[9px] text-white/35">Project work surface</span><span className="text-[8px] text-white/20">{project?project.slug:"operator runtime"}</span></div>{project?<div className="p-5"><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2.5"><div className="rounded-2xl bg-white/[.025] border border-white/[.06] p-4"><div className="text-[8px] uppercase tracking-[.18em] text-white/20">Source</div><div className="text-2xl mt-2">{files.length}</div><div className="text-[9px] text-white/25 mt-1">editable files</div></div><div className="rounded-2xl bg-white/[.025] border border-white/[.06] p-4"><div className="text-[8px] uppercase tracking-[.18em] text-white/20">Revision</div><div className="text-2xl mt-2">{selectedFile?.version_no||"—"}</div><div className="text-[9px] text-white/25 mt-1">selected file revision</div></div><div className="rounded-2xl bg-white/[.025] border border-white/[.06] p-4"><div className="text-[8px] uppercase tracking-[.18em] text-white/20">Preview</div><div className="text-[10px] mt-3">{project.preview_url||"Not published"}</div><div className="text-[9px] text-white/25 mt-1">only verified URLs appear</div></div></div><div className="mt-4 rounded-2xl border border-white/[.06] bg-white/[.02] p-4"><div className="text-[8px] uppercase tracking-[.18em] text-white/20">Operator contract</div><p className="text-[11px] text-white/40 leading-6 mt-2">Natural language and voice requests can now resolve against a persistent project graph, read source files, write source files and snapshot versions. Terminal execution, browser execution and sandbox isolation remain separate runtime adapters and are not faked here.</p></div></div>:<div className="h-[calc(100%-40px)] flex items-center justify-center p-10 text-center"><div className="max-w-md"><div className="w-16 h-16 rounded-[20px] border border-white/[.07] bg-white/[.03] mx-auto flex items-center justify-center text-[9px] text-white/20">PROJECT</div><h3 className="text-lg mt-5">Attach a real software project.</h3><p className="text-[10px] text-white/25 leading-5 mt-3">Create a project here or ask the Operator to create one. The center surface reflects persisted project state rather than simulated build output.</p><button onClick={()=>setProjectOpen(true)} className="mt-5 rounded-xl bg-white text-black px-4 py-2 text-[9px]">Create project</button></div></div>}</section>

      <aside className="bg-[#0f1115] min-h-0"><div className="h-10 px-3 border-b border-white/[.06] flex items-center justify-between"><span className="text-[9px] text-white/45">Activity</span><span className="text-[8px] text-white/20">{events.length}</span></div><div className="max-h-[520px] overflow-y-auto">{events.slice(0,40).map(e=><button key={e.id} onClick={()=>setSelectedEvent(e)} className="w-full text-left px-3 py-2 hover:bg-white/[.03]"><div className="flex gap-2 text-[8px]"><span className={e.status==="failed"?"text-red-300":"text-emerald-300"}>●</span><span className="text-white/45 truncate">{e.title}</span><span className="ml-auto text-white/15">{e.status}</span></div></button>)}</div><div className="border-t border-white/[.06] p-3"><div className="text-[8px] uppercase tracking-wider text-white/20">Connected accounts</div>{apps.filter(a=>a.connected).map(a=><div key={a.slug} className="mt-2 flex gap-2 items-center"><span className="w-5 h-5 rounded bg-white/[.05] flex items-center justify-center text-[7px]">{a.icon_key}</span><span className="text-[8px] text-white/45 truncate">{a.name}</span><span className="ml-auto text-emerald-300">●</span></div>)}</div></aside>
    </div>

    {selectedEvent&&<div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={()=>setSelectedEvent(null)}><div className="max-w-2xl w-full bg-[#171a20] border border-white/[.1] rounded-2xl p-4" onClick={e=>e.stopPropagation()}><div className="flex justify-between"><span className="text-xs">{selectedEvent.title}</span><button onClick={()=>setSelectedEvent(null)}>×</button></div><pre className="mt-4 text-[8px] text-white/50 whitespace-pre-wrap max-h-[60vh] overflow-auto">{JSON.stringify(selectedEvent,null,2)}</pre></div></div>}

    {projectOpen&&<div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4" onClick={()=>setProjectOpen(false)}><div className="w-full max-w-lg rounded-[22px] bg-[#12151a] border border-white/[.1] p-5" onClick={e=>e.stopPropagation()}><div className="flex items-start justify-between"><div><div className="text-[8px] uppercase tracking-[.2em] text-white/20">New software project</div><h3 className="text-xl mt-1">Create an editable workspace</h3><p className="text-[9px] text-white/30 mt-2">This creates persistent project metadata and a versionable file graph. It does not claim a sandbox or deployment until those runtimes actually exist.</p></div><button onClick={()=>setProjectOpen(false)}>×</button></div><div className="space-y-2 mt-5">
<input value={newProject.name} onChange={e=>setNewProject(v=>({...v,name:e.target.value}))} placeholder="Project name" className="w-full bg-white/[.04] border border-white/[.07] rounded-xl px-3 py-2.5 text-[10px] outline-none"/>
<input value={newProject.slug} onChange={e=>setNewProject(v=>({...v,slug:e.target.value}))} placeholder="Slug (optional)" className="w-full bg-white/[.04] border border-white/[.07] rounded-xl px-3 py-2.5 text-[10px] outline-none"/>
<div className="grid grid-cols-2 gap-2">
<select value={newProject.projectType} onChange={e=>{const value=e.target.value;setNewProject(v=>({...v,projectType:value,...(value==="website"?{framework:"Next.js",platformTarget:"web"}:value==="mobile"?{framework:"Expo React Native",platformTarget:"android-ios"}:value==="api"?{framework:"Next.js",platformTarget:"server"}:{framework:"Next.js",platformTarget:"web"})}))}} className="bg-white/[.04] border border-white/[.07] rounded-xl px-3 py-2.5 text-[10px] outline-none">
<option value="app">Web App</option><option value="website">Website</option><option value="mobile">Mobile App</option><option value="fullstack">Full-stack</option><option value="api">API / Service</option>
</select>
<select value={newProject.platformTarget} onChange={e=>setNewProject(v=>({...v,platformTarget:e.target.value}))} className="bg-white/[.04] border border-white/[.07] rounded-xl px-3 py-2.5 text-[10px] outline-none">
<option value="web">Web</option><option value="android">Android</option><option value="ios">iOS</option><option value="android-ios">Android + iOS</option><option value="server">Server / API</option>
</select>
</div>
<div className="grid grid-cols-2 gap-2">
<input value={newProject.framework} onChange={e=>setNewProject(v=>({...v,framework:e.target.value}))} placeholder="Framework (e.g. Next.js / Expo / Flutter)" className="bg-white/[.04] border border-white/[.07] rounded-xl px-3 py-2.5 text-[10px] outline-none"/>
<input value={newProject.runtime} onChange={e=>setNewProject(v=>({...v,runtime:e.target.value}))} placeholder="Runtime" className="bg-white/[.04] border border-white/[.07] rounded-xl px-3 py-2.5 text-[10px] outline-none"/>
</div>
{newProject.projectType==="mobile"&&<div className="rounded-xl border border-cyan-300/[.1] bg-cyan-300/[.035] p-3"><div className="text-[7px] uppercase tracking-[.18em] text-cyan-100/55">Mobile target</div><div className="text-[8px] text-white/35 mt-1">The target is stored with the project so the Builder can reason about native navigation, device constraints and platform-specific packaging. Store submission is a separate verified pipeline.</div></div>}
</div><div className="flex justify-end gap-2 mt-5"><button onClick={()=>setProjectOpen(false)} className="px-3 py-2 rounded-lg text-[9px] text-white/30">Cancel</button><button onClick={()=>void createProject()} disabled={!newProject.name.trim()||projectCreating} className="px-4 py-2 rounded-lg bg-white text-black text-[9px] disabled:opacity-30">{projectCreating?"Creating…":"Create project"}</button></div></div></div>}

    {appOpen&&<div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4" onClick={()=>setAppOpen(false)}><div className="w-full max-w-5xl max-h-[88vh] overflow-hidden rounded-[22px] bg-[#12151a] border border-white/[.1]" onClick={e=>e.stopPropagation()}><div className="p-5 border-b border-white/[.07]"><div className="flex justify-between"><div><div className="text-[8px] uppercase tracking-[.2em] text-white/20">App directory</div><h3 className="text-xl mt-1">Connect your working world</h3><p className="text-[9px] text-white/30 mt-2">Accounts become available inside the Operator. Standard apps use provider authorization; custom connectors handle user-supplied credentials.</p></div><button onClick={()=>setAppOpen(false)}>×</button></div><div className="mt-4 flex gap-2"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search apps and capabilities…" className="flex-1 bg-white/[.04] border border-white/[.07] rounded-xl px-3 py-2.5 text-[10px] outline-none"/><button onClick={()=>location.href="/dashboard/integrations?custom=1"} className="bg-indigo-400/10 text-indigo-200 rounded-xl px-3 text-[9px]">+ Custom connector</button></div></div><div className="p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 overflow-y-auto max-h-[58vh]">{shownApps.map(a=><div key={a.slug} className="rounded-2xl border border-white/[.07] p-4 bg-white/[.015]"><div className="flex gap-3"><span className="w-9 h-9 rounded-xl bg-white/[.06] flex items-center justify-center text-[8px]">{a.icon_key}</span><div><p className="text-[10px]">{a.name}</p><p className="text-[8px] text-white/20 mt-1">{a.category}</p></div></div><p className="text-[9px] text-white/30 leading-4 mt-3 min-h-8">{a.description}</p>{a.connected&&a.accounts?.map((x:any)=><div key={x.id} className="mt-2 rounded-lg bg-emerald-300/[.04] border border-emerald-300/[.08] p-2"><p className="text-[8px] text-white/50 truncate">{x.account_label||x.external_account_email||"Connected account"}</p><p className="text-[7px] text-emerald-300/60">authorized</p></div>)}<div className="flex gap-1.5 mt-3"><button onClick={()=>void connect(a)} className="flex-1 rounded-lg bg-white/[.07] py-2 text-[8px]">{a.connected?"Connect another account":"Connect account"}</button>{a.connected&&<button onClick={()=>{setContext(v=>v.some(x=>x.slug===a.slug)?v:[...v,a]);setAppOpen(false)}} className="rounded-lg border border-white/[.07] px-2 text-[8px] text-indigo-200">Use</button>}</div></div>)}</div></div></div>}
      </div>
    </> 
  );
}
