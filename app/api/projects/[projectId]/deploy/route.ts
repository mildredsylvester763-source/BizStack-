import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime="nodejs";

async function vercel(path:string, init:RequestInit={}) {
  const token=process.env.VERCEL_TOKEN;
  if(!token) throw new Error("VERCEL_TOKEN is not configured on the server.");
  const r=await fetch("https://api.vercel.com"+path,{...init,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json",...(init.headers||{})}});
  const body=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(body.error?.message||body.error?.code||("Vercel API returned "+r.status));
  return body;
}

export async function POST(req:NextRequest,context:{params:{projectId:string}}){
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const { data: projectAccess } = await supabase.from("ai_projects").select("id,business_id,status").eq("id",context.params.projectId).maybeSingle();
  if(!projectAccess || projectAccess.status==="deleted") return NextResponse.json({error:"Project not found."},{status:404});
  const { data: canDeploy } = await supabase.rpc("user_can_business",{p_business_id:projectAccess.business_id,p_user_id:user.id,p_permission:"deploy_projects"});
  if(!canDeploy) return NextResponse.json({error:"You do not have permission to deploy this project."},{status:403});
  const body=await req.json().catch(()=>({}));
  const environment=body.environment==="production"?"production":"preview";
  const gitRef=typeof body.gitRef==="string"&&body.gitRef?body.gitRef:"main";
  const {data:project,error:pe}=await supabase.from("ai_projects").select("id,name,slug,business_id,repository_name,default_branch").eq("id",context.params.projectId).single();
  if(pe||!project)return NextResponse.json({error:"Project not found."},{status:404});
  const {data:version}=await supabase.from("ai_project_versions").select("id,version_no").eq("project_id",project.id).order("version_no",{ascending:false}).limit(1).maybeSingle();
  if(!project.repository_name)return NextResponse.json({error:"Project has no linked Git repository. Link the source repository before deploying."},{status:409});

  const {data:deployment,error:de}=await supabase.from("ai_deployments").insert({
    project_id:project.id,version_id:version?.id||null,provider:"vercel",environment,status:"queued",git_ref:gitRef,requested_by:user.id
  }).select("id,environment,status,git_ref,created_at").single();
  if(de)throw de;

  try{
    const parts=project.repository_name.split("/");
    const owner=parts[0],repo=parts[1];
    if(!owner||!repo)throw new Error("repository_name must be in owner/repository form.");
    const payload:any={name:project.slug,gitSource:{type:"github",repo:owner+"/"+repo,ref:gitRef}};
    if(process.env.VERCEL_PROJECT_ID)payload.project=process.env.VERCEL_PROJECT_ID;
    if(environment==="production")payload.target="production";
    const result=await vercel("/v13/deployments",{method:"POST",body:JSON.stringify(payload)});
    const deploymentId=result.id||result.uid;
    const url=result.url?("https://"+String(result.url).replace(/^https?:\/\//,"")):null;
    const status=result.readyState==="READY"?"ready":result.readyState==="ERROR"?"failed":"building";
    await supabase.from("ai_deployments").update({
      provider_deployment_id:deploymentId||null,deployment_url:url,status,started_at:new Date().toISOString(),updated_at:new Date().toISOString(),
      finished_at:status==="ready"||status==="failed"?new Date().toISOString():null
    }).eq("id",deployment.id);
    return NextResponse.json({ok:true,deployment:{id:deployment.id,providerDeploymentId:deploymentId,url,status,environment}});
  }catch(error){
    await supabase.from("ai_deployments").update({status:"failed",error_summary:error instanceof Error?error.message:"Deployment request failed",finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",deployment.id);
    return NextResponse.json({error:error instanceof Error?error.message:"Deployment request failed.",deploymentId:deployment.id},{status:502});
  }
}

export async function GET(_req:NextRequest,context:{params:{projectId:string}}){
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const {data:rows,error}=await supabase.from("ai_deployments").select("*").eq("project_id",context.params.projectId).order("created_at",{ascending:false}).limit(50);
  if(error)throw error;
  return NextResponse.json({deployments:rows||[]});
}
