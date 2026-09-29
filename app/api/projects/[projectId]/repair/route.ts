import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { executeRepair } from "@/lib/repair/engine";

export const runtime="nodejs";

async function getEvents(id:string){
  const token=process.env.VERCEL_TOKEN;
  if(!token)throw new Error("VERCEL_TOKEN is not configured on the server.");
  const r=await fetch("https://api.vercel.com/v3/deployments/"+encodeURIComponent(id)+"/events?limit=100",{headers:{Authorization:"Bearer "+token,Accept:"application/json"}});
  const body=await r.json().catch(()=>[]);
  if(!r.ok)throw new Error(body?.error?.message||"Could not read Vercel deployment events.");
  return body;
}

export async function POST(req:NextRequest,context:{params: Promise<{projectId:string}>}){
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const { data: accessProject } = await supabase.from("ai_projects").select("id,business_id,status").eq("id",(await context.params).projectId).maybeSingle();
  if(!accessProject || accessProject.status==="deleted") return NextResponse.json({error:"Project not found."},{status:404});
  const { data: canRepair } = await supabase.rpc("user_can_business",{p_business_id:accessProject.business_id,p_user_id:user.id,p_permission:"write_project_files"});
  if(!canRepair) return NextResponse.json({error:"You do not have permission to repair this project."},{status:403});
  const body=await req.json().catch(()=>({}));
  const deploymentId=typeof body.deploymentId==="string"?body.deploymentId:"";
  if(!deploymentId)return NextResponse.json({error:"deploymentId is required."},{status:400});
  const execute = body.execute === true;
  if (execute) {
    const { data: existingRepair, error: existingRepairError } = await supabase.from("ai_repair_runs")
      .select("id,status")
      .eq("deployment_id", deploymentId)
      .eq("project_id", (await context.params).projectId)
      .in("status", ["queued","planned","awaiting_approval"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingRepairError) throw existingRepairError;
    if (!existingRepair) return NextResponse.json({ error: "No executable repair run exists for this deployment." }, { status: 409 });
    const result = await executeRepair(existingRepair.id, user.id);
    return NextResponse.json({ ok: true, mode: "execute", repair: result });
  }

  const {data:deployment,error:de}=await supabase.from("ai_deployments").select("*").eq("id",deploymentId).eq("project_id",(await context.params).projectId).single();
  if(de||!deployment)return NextResponse.json({error:"Deployment record not found."},{status:404});
  const {data:project}=await supabase.from("ai_projects").select("id,business_id").eq("id",(await context.params).projectId).single();
  if(!project)return NextResponse.json({error:"Project not found."},{status:404});

  const raw=await getEvents(deployment.provider_deployment_id||"");
  const events=Array.isArray(raw)?raw:Array.isArray(raw?.events)?raw.events:[];
  const text=events.map((e:any)=>String(e?.text||e?.message||e?.payload?.text||"")).filter(Boolean).join("\n");
  const lower=text.toLowerCase();
  const failureClass=lower.includes("typescript")||lower.includes("type error")?"typescript":
    lower.includes("module not found")||lower.includes("cannot find module")?"dependency":
    lower.includes("environment variable")||lower.includes("env")&&lower.includes("missing")?"environment":
    lower.includes("eslint")?"lint":"build";

  const diagnosis={provider:"vercel",deployment_id:deployment.provider_deployment_id,events:events.slice(-100),log_excerpt:text.slice(-30000),failure_class:failureClass,diagnosed_at:new Date().toISOString()};
  const {data:repair,error:re}=await supabase.from("ai_repair_runs").insert({
    project_id:project.id,deployment_id:deployment.id,status:"planned",failure_class:failureClass,
    diagnosis,repair_plan:{strategy:"inspect failure evidence, create minimal source patch, run verification, redeploy only after verification",automatic_deploy:false},
    created_by:user.id
  }).select("id,status,failure_class,attempt_no,created_at").single();
  if(re)throw re;
  await supabase.from("ai_deployments").update({build_logs:diagnosis,error_summary:text.slice(-2000)||null,updated_at:new Date().toISOString()}).eq("id",deployment.id);
  return NextResponse.json({ok:true,repair,diagnosis});
}

export async function GET(_req:NextRequest,context:{params: Promise<{projectId:string}>}){
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const { data: project } = await supabase.from("ai_projects")
    .select("id,business_id,status")
    .eq("id", (await context.params).projectId)
    .maybeSingle();
  if (!project || project.status === "deleted") return NextResponse.json({error:"Project not found."},{status:404});
  const { data: canRead } = await supabase.rpc("user_can_business", {
    p_business_id: project.business_id,
    p_user_id: user.id,
    p_permission: "read_project_history"
  });
  if (!canRead) return NextResponse.json({error:"You do not have permission to view repair history."},{status:403});
  const {data,error}=await supabase.from("ai_repair_runs").select("*").eq("project_id",(await context.params).projectId).order("created_at",{ascending:false}).limit(50);
  if(error)throw error;
  return NextResponse.json({repairs:data||[]});
}