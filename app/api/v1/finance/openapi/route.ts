// @ts-nocheck
import { NextResponse } from "next/server";

export async function GET(){
 return NextResponse.json({
  openapi:"3.0.3",
  info:{title:"BizStack Finance API",version:"1.0.0",description:"Scoped finance API for BizStack business customers, schools, churches, cooperatives, accountants and partner software."},
  servers:[{url:"/api/v1/finance"}],
  security:[{bearerAuth:[]}],
  components:{securitySchemes:{bearerAuth:{type:"http",scheme:"bearer",bearerFormat:"BizStack finance API key"}}},
  paths:{
   "/": {
    get:{summary:"Read finance resources",parameters:[{name:"resource",in:"query",required:false,schema:{type:"string",enum:["summary","customers","invoices","transactions"]}}],responses:{"200":{description:"Resource data"},"401":{description:"Invalid API key"}}},
    post:{summary:"Write a finance resource",requestBody:{required:true,content:{"application/json":{schema:{type:"object",properties:{resource:{type:"string",enum:["customer","transaction","invoice"]}}}}}},responses:{"201":{description:"Created"},"400":{description:"Validation error"},"401":{description:"Invalid API key"}}}
   }
  }
 });
}
