export type ConnectorResource={key:string;label:string;endpoint:string;method:'GET'|'POST'|'PUT'|'PATCH'|'DELETE';localEntityType?:string|null;readable:boolean;writeable:boolean};
export type ConnectorDraft={name:string;slug:string;description:string;category:string;authType:'api_key'|'bearer'|'oauth'|'webhook'|'basic'|'custom';baseUrl:string|null;testUrl:string|null;resources:ConnectorResource[];capabilities:{read:boolean;write:boolean;webhooks:boolean;scheduledSync:boolean};config:Record<string,unknown>};

const slugify=(v:string)=>v.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70);
const methodFor=(v:string):ConnectorResource['method']=>{
 const m=v.toUpperCase(); return ['GET','POST','PUT','PATCH','DELETE'].includes(m)?m as ConnectorResource['method']:'GET';
};

export function parseConnectorRequest(prompt:string):ConnectorDraft{
 const text=prompt.trim();
 const nameMatch=text.match(/(?:connect|connector|integrate)\s+(?:to|with|my)?\s*([^,;]+?)(?=\s+(?:api|using|auth|authentication|base url|endpoint|resources|resource|webhook|test)\b|[,;]|$)/i);
 const name=(nameMatch?.[1]||'Custom API Connector').trim().replace(/^my\s+/i,'').replace(/\s+/g,' ');
 const baseUrl=text.match(/https?:\/\/[^\s,;]+/i)?.[0]?.replace(/[),.]+$/,'')||null;
 const authLower=text.toLowerCase();
 const authType:(ConnectorDraft['authType'])=authLower.includes('oauth')?'oauth':authLower.includes('webhook')?'webhook':authLower.includes('basic auth')?'basic':authLower.includes('bearer')||authLower.includes('token')?'bearer':authLower.includes('custom auth')?'custom':'api_key';
 const category=/payment|bank|wallet|money/i.test(text)?'payments':/crm|customer|contact/i.test(text)?'crm':/shop|store|order|commerce|inventory/i.test(text)?'commerce':/email|sms|whatsapp|message|communication/i.test(text)?'communications':'custom';
 const testUrl=text.match(/(?:test|health|verify)(?:\s+(?:url|endpoint))?\s*[:=]?\s*(https?:\/\/[^\s,;]+)/i)?.[1]||null;
 const resources:ConnectorResource[]=[];
 const resourceRegex=/(?:resource|endpoint)\s*[:=]?\s*([a-zA-Z][\w -]{1,50})\s*(?:->|:|at|using)?\s*(?:(GET|POST|PUT|PATCH|DELETE)\s*)?(\/[A-Za-z0-9_./:{}?=&-]+)/gi;
 let match:RegExpExecArray|null;
 while((match=resourceRegex.exec(text))!==null){
   const key=slugify(match[1]); if(!key)continue;
   const endpoint=match[3]; const method=methodFor(match[2]||'GET');
   resources.push({key,label:match[1].trim(),endpoint,method,readable:method==='GET',writeable:method!=='GET',localEntityType:key});
 }
 if(!resources.length){
   const endpoints=Array.from(text.matchAll(/(?:GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s,;]+)/gi));
   for(const item of endpoints.slice(0,20)){const ep=item[1];const key=slugify(ep.split('/').filter(Boolean)[0]||'resource');const method=methodFor(item[0].split(/\s+/)[0]);resources.push({key:key+'-'+resources.length,label:key,endpoint:ep,method,readable:method==='GET',writeable:method!=='GET',localEntityType:key});}
 }
 if(!resources.length) resources.push({key:'resource',label:'Primary resource',endpoint:'/',method:'GET',readable:true,writeable:false,localEntityType:'external_resource'});
 const unique=Array.from(new Map(resources.map(r=>[r.key,r])).values()).slice(0,30);
 return {
   name,slug:slugify(name)||'custom-api-connector',description:text,
   category,authType,baseUrl,testUrl,resources:unique,
   capabilities:{read:unique.some(r=>r.readable),write:unique.some(r=>r.writeable),webhooks:/webhook/i.test(text),scheduledSync:true},
   config:{auth:{type:authType},resource_count:unique.length,source:'ai_universal_connector_builder',requires_credentials:true}
 };
}
