import { createClient } from '@/lib/supabase-server';
import { buildPlan } from '@/lib/ai/build-engine/capabilities';
import { parseInvoiceRequest, type InvoiceDraft } from '@/lib/ai/build-engine/invoice-local';
import type { BuildMode } from '@/lib/ai/build-engine/types';

function checksum(value:unknown){ const json=JSON.stringify(value); let hash=2166136261; for(let i=0;i<json.length;i+=1){hash^=json.charCodeAt(i);hash=Math.imul(hash,16777619);} return (hash>>>0).toString(16); }

export async function runInvoiceBuild({businessId,userId,prompt,mode='draft_only'}:{businessId:string;userId:string;prompt:string;mode?:BuildMode}){
  const supabase=createClient();
  const {data:business,error:businessError}=await supabase.from('businesses').select('id,name,currency,workspace_id').eq('id',businessId).eq('owner_id',userId).single();
  if(businessError||!business) throw new Error('Business context is not available.');
  const plan=buildPlan({capability:'invoice',prompt,mode,context:{business:{id:business.id,name:business.name,currency:business.currency}}});
  const idempotencyKey=checksum({capability:'invoice',prompt:prompt.trim(),mode});
  const existing=await supabase.from('ai_build_runs').select('id,status,result').eq('business_id',businessId).eq('idempotency_key',idempotencyKey).maybeSingle();
  if(existing.data?.id&&['succeeded','building','testing','planning','waiting_approval'].includes(existing.data.status)) return {runId:existing.data.id,status:existing.data.status,result:existing.data.result};
  const {data:run,error:runError}=await supabase.from('ai_build_runs').insert({business_id:businessId,workspace_id:business.workspace_id,created_by:userId,capability_key:'invoice',request_text:prompt.trim(),execution_mode:mode,plan,context:{business},idempotency_key:idempotencyKey,status:'planning',started_at:new Date().toISOString()}).select('id').single();
  if(runError||!run) throw new Error(runError?.message||'Could not create invoice build run.');
  try{
    const draft:InvoiceDraft=parseInvoiceRequest(prompt,business.currency||'USD');
    await supabase.from('ai_build_steps').insert({business_id:businessId,build_run_id:run.id,sequence_no:1,step_key:'resolve_customer',step_type:'compiler',status:'running',input:{customerName:draft.customerName}});
    const {data:customers}=await supabase.from('customers').select('id,name,email,phone').eq('business_id',businessId).ilike('name','%'+draft.customerName+'%').limit(10);
    const customer=customers?.[0];
    if(!customer) throw new Error('No existing customer matched “'+draft.customerName+'”. Create that customer first so the invoice cannot be attached to the wrong person or company.');
    await supabase.from('ai_build_steps').update({status:'succeeded',output:{customerId:customer.id,customerName:customer.name},finished_at:new Date().toISOString()}).eq('build_run_id',run.id).eq('sequence_no',1);
    await supabase.from('ai_build_steps').insert({business_id:businessId,build_run_id:run.id,sequence_no:2,step_key:'parse_line_items',step_type:'compiler',status:'succeeded',input:{prompt},output:{lines:draft.lines},finished_at:new Date().toISOString()});

    const {data:invoiceNumber}=await supabase.rpc('next_invoice_number',{p_business_id:businessId});
    if(!invoiceNumber) throw new Error('Invoice numbering service did not return a number.');
    const {data:invoice,error:invoiceError}=await supabase.from('invoices').insert({business_id:businessId,customer_id:customer.id,invoice_number:invoiceNumber,status:'draft',due_date:draft.dueDate,currency:draft.currency,issue_date:new Date().toISOString().slice(0,10),payment_terms:draft.paymentTerms,reference:draft.reference,purchase_order:draft.purchaseOrder,notes:draft.notes,tax_rate:draft.taxRate,tax_enabled:draft.taxRate>0,tax_name:draft.taxRate>0?'Tax':null}).select('id,invoice_number').single();
    if(invoiceError||!invoice) throw new Error(invoiceError?.message||'Could not create invoice draft.');
    const {error:itemError}=await supabase.from('invoice_items').insert(draft.lines.map((line)=>({invoice_id:invoice.id,description:line.description,quantity:line.quantity,unit_price:line.unitPrice})));
    if(itemError){ await supabase.from('invoices').delete().eq('id',invoice.id).eq('business_id',businessId); throw new Error(itemError.message); }
    await supabase.rpc('recalculate_invoice_totals',{p_invoice_id:invoice.id});
    const {data:stored}=await supabase.from('invoices').select('id,invoice_number,status,due_date,currency,subtotal,discount_amount,tax_amount,total,customer:customers(name,email)').eq('id',invoice.id).eq('business_id',businessId).single();
    if(!stored) throw new Error('Could not reload the created invoice.');
    const tests=[
      {key:'customer_bound',pass:Boolean(stored.customer)},
      {key:'has_line_items',pass:draft.lines.length>0},
      {key:'positive_total',pass:Number(stored.total)>0},
      {key:'currency_present',pass:Boolean(stored.currency)}
    ];
    const failed=tests.filter((test)=>!test.pass);
    for(const test of tests) await supabase.from('ai_build_tests').insert({business_id:businessId,build_run_id:run.id,test_key:test.key,test_type:'invoice_integrity',status:test.pass?'passed':'failed',assertion:{expected:true},actual:test.pass,completed_at:new Date().toISOString()});
    if(failed.length) throw new Error('Invoice validation failed: '+failed.map((test)=>test.key).join(', '));
    const result={invoiceId:stored.id,invoiceNumber:stored.invoice_number,status:stored.status,total:Number(stored.total),currency:stored.currency,customer:stored.customer,dueDate:stored.due_date,lines:draft.lines,tests,delivery:'draft_only'};
    await supabase.from('ai_build_steps').insert({business_id:businessId,build_run_id:run.id,sequence_no:3,step_key:'create_draft',step_type:'execution',status:'succeeded',input:{invoiceId:stored.id},output:result,finished_at:new Date().toISOString()});
    await supabase.from('ai_build_runs').update({status:'succeeded',provider_key:'local-invoice-compiler',provider_status:'fallback',result,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',run.id).eq('business_id',businessId);
    await supabase.from('events').insert({business_id:businessId,event_type:'ai.build.invoice_created',summary:'AI Build Engine created draft '+stored.invoice_number+' for '+(stored.customer as any)?.name,evidence:{build_run_id:run.id,invoice_id:stored.id},status:'info',priority:'normal',category:'ai_build'});
    return {runId:run.id,status:'succeeded',result};
  }catch(error){
    const message=error instanceof Error?error.message:'Invoice build failed.';
    await supabase.from('ai_build_runs').update({status:'failed',error_message:message,finished_at:new Date().toISOString()}).eq('id',run.id).eq('business_id',businessId);
    throw new Error(message);
  }
}