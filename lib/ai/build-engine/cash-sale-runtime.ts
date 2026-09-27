import { createClient } from '@/lib/supabase-server';
import { buildPlan } from '@/lib/ai/build-engine/capabilities';
import { parseCashSaleRequest } from '@/lib/ai/build-engine/cash-sale-local';
import type { BuildMode } from '@/lib/ai/build-engine/types';

function checksum(value: unknown) {
  const json = JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < json.length; i += 1) { hash ^= json.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16);
}

export async function runCashSaleBuild({ businessId, userId, prompt, mode = 'auto_execute' }: { businessId: string; userId: string; prompt: string; mode?: BuildMode }) {
  const supabase = createClient();
  const { data: business, error } = await supabase.from('businesses').select('id,name,currency,workspace_id').eq('id', businessId).eq('owner_id', userId).single();
  if (error || !business) throw new Error('Business context is not available.');
  const plan = buildPlan({ capability: 'cash_sale', prompt, mode, context: { business: { id: business.id, name: business.name, currency: business.currency } } });
  const idempotencyKey = checksum({ capability: 'cash_sale', prompt: prompt.trim(), mode });
  const { data: existing } = await supabase.from('ai_build_runs').select('id,status,result').eq('business_id', businessId).eq('idempotency_key', idempotencyKey).maybeSingle();
  if (existing?.id && ['succeeded','building','testing','planning'].includes(existing.status)) return { runId: existing.id, status: existing.status, result: existing.result };
  const { data: run, error: runError } = await supabase.from('ai_build_runs').insert({ business_id: businessId, workspace_id: business.workspace_id, created_by: userId, capability_key: 'cash_sale', request_text: prompt.trim(), execution_mode: mode, plan, context: { business }, idempotency_key: idempotencyKey, status: 'planning', started_at: new Date().toISOString() }).select('id').single();
  if (runError || !run) throw new Error(runError?.message || 'Could not create cash sale build run.');
  try {
    const draft = parseCashSaleRequest(prompt);
    const { data: session } = await supabase.from('cash_register_sessions').select('id,currency,status').eq('business_id', businessId).eq('status','open').order('opened_at',{ascending:false}).limit(1).maybeSingle();
    if (!session) throw new Error('There is no open cash register session. Open today’s register before recording a cash sale.');
    if (session.currency !== (business.currency || session.currency)) throw new Error('The open register currency does not match the business currency.');
    await supabase.from('ai_build_steps').insert({ business_id: businessId, build_run_id: run.id, sequence_no: 1, step_key: 'resolve_session', step_type: 'lookup', status: 'succeeded', input: { sessionId: session.id }, output: { currency: session.currency }, finished_at: new Date().toISOString() });

    let customerId: string | null = null;
    if (draft.customerName) {
      const { data: customers } = await supabase.from('customers').select('id,name,email').eq('business_id', businessId).ilike('name','%' + draft.customerName + '%').limit(5);
      if (!customers?.[0]) throw new Error('Customer “' + draft.customerName + '” was not found. Create the customer first or remove the customer from the sale request.');
      customerId = customers[0].id;
    }

    const resolvedItems: Array<{ product_id: string; quantity: number; unit_price: number }> = [];
    for (const line of draft.lines) {
      const { data: products } = await supabase.from('products').select('id,name,unit_price,stock_quantity,is_active').eq('business_id', businessId).ilike('name', line.productName).eq('is_active', true).limit(5);
      const product = products?.[0];
      if (!product) throw new Error('Product “' + line.productName + '” was not found. Create the product first.');
      const unitPrice = line.unitPrice == null ? Number(product.unit_price) : line.unitPrice;
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error('Invalid price for product “' + product.name + '”.');
      if (Number(product.stock_quantity) < line.quantity) throw new Error('Insufficient stock for “' + product.name + '”. Available: ' + product.stock_quantity + '.');
      resolvedItems.push({ product_id: product.id, quantity: line.quantity, unit_price: unitPrice });
    }
    await supabase.from('ai_build_steps').insert({ business_id: businessId, build_run_id: run.id, sequence_no: 2, step_key: 'resolve_products', step_type: 'lookup', status: 'succeeded', input: { lines: draft.lines }, output: { items: resolvedItems }, finished_at: new Date().toISOString() });

    const { data: sale, error: saleError } = await supabase.rpc('record_cash_sale', {
      p_session_id: session.id,
      p_customer_id: customerId,
      p_currency: session.currency,
      p_payment_method: draft.paymentMethod,
      p_amount_received: draft.amountReceived ?? 0,
      p_notes: draft.notes,
      p_items: resolvedItems
    });
    if (saleError || !sale) throw new Error(saleError?.message || 'Could not record the cash sale.');

    const tests = [
      { key: 'sale_number_present', pass: Boolean(sale.sale_number) },
      { key: 'positive_total', pass: Number(sale.total) > 0 },
      { key: 'session_bound', pass: sale.session_id === session.id },
      { key: 'payment_method_valid', pass: ['cash','card','bank_transfer','mobile_money','other'].includes(sale.payment_method) }
    ];
    for (const test of tests) await supabase.from('ai_build_tests').insert({ business_id: businessId, build_run_id: run.id, test_key: test.key, test_type: 'cash_sale_integrity', status: test.pass ? 'passed' : 'failed', assertion: { expected: true }, actual: test.pass, completed_at: new Date().toISOString() });
    const failed = tests.filter((test) => !test.pass);
    if (failed.length) throw new Error('Cash sale validation failed: ' + failed.map((test) => test.key).join(', '));

    const result = { sale, sessionId: session.id, tests };
    await supabase.from('ai_build_artifacts').insert({ business_id: businessId, build_run_id: run.id, artifact_type: 'cash_sale', artifact_key: 'cash_sale', version: 1, status: 'validated', content: result, checksum: checksum(result) });
    await supabase.from('ai_build_steps').insert({ business_id: businessId, build_run_id: run.id, sequence_no: 3, step_key: 'create_sale', step_type: 'execution', status: 'succeeded', input: { sessionId: session.id }, output: result, finished_at: new Date().toISOString() });
    await supabase.from('ai_build_runs').update({ status: 'succeeded', provider_key: 'local-cash-sale-compiler', provider_status: 'fallback', result, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', run.id).eq('business_id', businessId);
    await supabase.from('events').insert({ business_id: businessId, event_type: 'ai.build.cash_sale_created', summary: 'AI Build Engine recorded ' + sale.sale_number + '.', evidence: { build_run_id: run.id, cash_sale_id: sale.id, session_id: session.id, total: sale.total }, status: 'info', priority: 'normal', category: 'sales' });
    return { runId: run.id, status: 'succeeded', result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cash sale build failed.';
    await supabase.from('ai_build_runs').update({ status: 'failed', error_message: message, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', run.id).eq('business_id', businessId);
    throw new Error(message);
  }
}