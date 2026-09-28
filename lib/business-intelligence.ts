export type CashflowSnapshot = {
  horizonDays:number; currentBalance:number; projectedBalance:number; projectedShortfall:number;
  avgDailyNet:number; expectedInflows:number; expectedOutflows:number;
  severity:"info"|"warning"|"critical"; explanation:string;
};

export function buildCashflowSnapshot(args:{
  currentBalance:number; recentInflows:number; recentOutflows:number;
  expectedInvoiceCollections:number; expectedObligations:number; horizonDays:number; minimumBuffer:number;
}):CashflowSnapshot{
  const days=Math.max(1,args.horizonDays);
  const avgDailyNet=(args.recentInflows-args.recentOutflows)/30;
  const projectedBalance=args.currentBalance+(avgDailyNet*days)+args.expectedInvoiceCollections-args.expectedObligations;
  const projectedShortfall=Math.max(0,args.minimumBuffer-projectedBalance);
  const severity=projectedBalance<0?"critical":projectedBalance<args.minimumBuffer?"warning":"info";
  const explanation=severity==="critical"
    ? `Projected cash is ${Math.abs(projectedBalance).toFixed(2)} below zero within ${days} days.`
    : severity==="warning"
      ? `Projected cash falls below your ${args.minimumBuffer.toFixed(2)} safety buffer within ${days} days.`
      : `Projected cash remains above the configured safety buffer for the next ${days} days.`;
  return {horizonDays:days,currentBalance:args.currentBalance,projectedBalance,projectedShortfall,avgDailyNet,expectedInflows:args.expectedInvoiceCollections,expectedOutflows:args.expectedObligations,severity,explanation};
}

const TOPICS:Record<string,string[]>={
  price:["price","expensive","cost","fee","charge"], delivery:["delivery","shipping","late","courier","dispatch"],
  quality:["quality","broken","damaged","defect","poor"], support:["support","reply","response","help","agent"],
  product:["feature","product","size","colour","color","variant","option"], checkout:["checkout","payment","pay","cart","invoice"],
  availability:["stock","available","sold out","out of stock"], experience:["love","great","excellent","happy","easy","smooth","recommend"]
};

export function clusterFeedback(messages:Array<{id:string;message:string;sentiment?:string|null}>){
  const groups=new Map<string,{topic:string;feedbackCount:number;negativeCount:number;positiveCount:number;exampleFeedbackId:string|null}>();
  for(const m of messages){
    const text=m.message.toLowerCase();
    const matched=Object.entries(TOPICS).filter(([,words])=>words.some(w=>text.includes(w))).map(([k])=>k);
    for(const topic of (matched.length?matched:["other"])){
      const g=groups.get(topic)||{topic,feedbackCount:0,negativeCount:0,positiveCount:0,exampleFeedbackId:null};
      g.feedbackCount++; if(m.sentiment==="negative")g.negativeCount++; if(m.sentiment==="positive")g.positiveCount++;
      if(!g.exampleFeedbackId)g.exampleFeedbackId=m.id; groups.set(topic,g);
    }
  }
  return [...groups.values()].sort((a,b)=>b.feedbackCount-a.feedbackCount);
}

export function parseWhatsAppOrder(message:string,products:Array<{id:string;name:string;sku?:string|null;unit_price:number;stock_quantity:number}>){
  const lines=message.trim().split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);
  const items:any[]=[]; const unresolved:string[]=[];
  for(const line of lines){
    const match=line.match(/^(\d+)\s*(?:x|×|pcs?|units?)?\s*(?:of\s+)?(.+)$/i);
    const qty=match?Math.max(1,Number(match[1])):1;
    const term=(match?match[2]:line).replace(/\s+(?:at|for)\s+\d+(?:\.\d+)?$/i,"").trim();
    const normalized=term.toLowerCase();
    const p=products.find(x=>(x.sku&&x.sku.toLowerCase()===normalized)||(x.name.toLowerCase()===normalized))
      ||products.find(x=>x.name.toLowerCase().includes(normalized)||normalized.includes(x.name.toLowerCase()));
    if(!p){unresolved.push(term);continue;}
    if(Number(p.stock_quantity)<qty){unresolved.push(`${term} (only ${p.stock_quantity} in stock)`);continue;}
    items.push({product_id:p.id,name:p.name,sku:p.sku||null,quantity:qty,unit_price:Number(p.unit_price),line_total:qty*Number(p.unit_price)});
  }
  return {items,total:items.reduce((s,x)=>s+x.line_total,0),unresolved};
}
