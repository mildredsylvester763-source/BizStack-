import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase-server";

export const runtime="nodejs";

function parseCsv(text:string){
 const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean);
 if(!lines.length)return [];
 const parse=(line:string)=>{const out:string[]=[];let cur="",quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){cur+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){out.push(cur.trim());cur="";}else cur+=ch;}out.push(cur.trim());return out;};
 const headers=parse(lines[0]).map((h,i)=>h||`column_${i+1}`);
 return lines.slice(1).map((line,row)=>{const values=parse(line);const obj:Record<string,string>={};headers.forEach((h,i)=>obj[h]=values[i]??"");return{row:row+2,data:obj};});
}

export async function POST(req:NextRequest){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const form=await req.formData();
 const businessId=String(form.get("businessId")||"");
 const integrationId=String(form.get("integrationId")||"");
 const file=form.get("file");
 if(!businessId||!integrationId||!(file instanceof File))return NextResponse.json({error:"businessId, integrationId and file are required"},{status:400});
 const {data:business}=await supabase.from("businesses").select("id").eq("id",businessId).eq("owner_id",user.id).single();
 if(!business)return NextResponse.json({error:"Forbidden"},{status:403});
 const {data:integration}=await supabase.from("integrations").select("id,connection_type,status").eq("id",integrationId).eq("business_id",businessId).single();
 if(!integration)return NextResponse.json({error:"Integration not found"},{status:404});
 const bytes=Buffer.from(await file.arrayBuffer());
 const checksum=crypto.createHash("sha256").update(bytes).digest("hex");
 const ext=(file.name.split(".").pop()||"other").toLowerCase();
 const format=["csv","json","jsonl","txt","xml","xlsx","xls","pdf"].includes(ext)?ext:"other";
 const importId=crypto.randomUUID();
 const path=`${businessId}/${integrationId}/${importId}/${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
 const {error:uploadError}=await supabase.storage.from("bizstack-imports").upload(path,bytes,{contentType:file.type||"application/octet-stream",upsert:false});
 if(uploadError)return NextResponse.json({error:"File storage failed: "+uploadError.message},{status:500});
 const {error:rowError}=await supabase.from("integration_imports").insert({id:importId,business_id:businessId,integration_id:integrationId,file_name:file.name,storage_path:path,content_type:file.type||null,file_size:bytes.length,checksum,format,status:"uploaded",created_by:user.id});
 if(rowError){await supabase.storage.from("bizstack-imports").remove([path]);return NextResponse.json({error:rowError.message},{status:500});}
 let rows:{row:number,data:Record<string,unknown>}[]=[];
 if(format==="csv")rows=parseCsv(bytes.toString("utf8"));
 else if(format==="json"){try{const parsed=JSON.parse(bytes.toString("utf8"));rows=(Array.isArray(parsed)?parsed:[parsed]).map((data,row)=>({row:row+1,data:typeof data==="object"&&data?data:{value:data}}));}catch{}}
 else if(format==="jsonl"){rows=bytes.toString("utf8").split(/\r?\n/).filter(Boolean).map((line,row)=>{try{return{row:row+1,data:JSON.parse(line)}}catch{return{row:row+1,data:{raw:line}}}});}
 const preview=rows.slice(0,25);
 if(rows.length){
  const payload=rows.map(r=>({import_id:importId,row_number:r.row,source_data:r.data,normalized_data:r.data,status:"pending",content_hash:crypto.createHash("sha256").update(JSON.stringify(r.data)).digest("hex")}));
  const {error}=await supabase.from("integration_import_rows").insert(payload);
  if(error)return NextResponse.json({error:error.message},{status:500});
 }
 await supabase.from("integration_imports").update({status:rows.length?"preview_ready":"mapping",row_count:rows.length,preview:{headers:preview[0]?Object.keys(preview[0].data):[],rows:preview.map(r=>r.data)},updated_at:new Date().toISOString()}).eq("id",importId).eq("business_id",businessId);
 await supabase.from("integrations").update({status:"pending",error_message:null}).eq("id",integrationId).eq("business_id",businessId);
 return NextResponse.json({ok:true,importId,status:rows.length?"preview_ready":"mapping",format,rowCount:rows.length,preview:preview.map(r=>r.data),storagePath:path});
}
