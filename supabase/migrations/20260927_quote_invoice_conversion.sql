-- Atomic quote -> invoice conversion.
create or replace function public.convert_accepted_quote_to_invoice(p_quote_id uuid)
returns uuid
language plpgsql
security invoker
set search_path=public
as $function$
declare
  q public.quotes%rowtype;
  inv_id uuid;
  inv_num text;
begin
  select * into q from public.quotes where id=p_quote_id for update;
  if not found then raise exception 'Quote not found'; end if;
  if not exists(select 1 from public.businesses b where b.id=q.business_id and b.owner_id=(select auth.uid()))
     then raise exception 'Not authorized'; end if;
  if q.status not in ('accepted','sent','viewed') then raise exception 'Only an active quote can be converted to an invoice'; end if;
  if q.converted_invoice_id is not null then return q.converted_invoice_id; end if;

  inv_num := public.next_invoice_number(q.business_id);

  insert into public.invoices(
    business_id,customer_id,invoice_number,status,due_date,currency,issue_date,payment_terms,
    reference,purchase_order,notes,terms_and_conditions,discount_type,discount_value,
    tax_rate,subtotal,discount_amount,tax_amount,total,paid_amount,tax_enabled,tax_name,
    tax_treatment,tax_inclusive
  )
  values(
    q.business_id,q.customer_id,inv_num,'draft',q.expiry_date,q.currency,current_date,coalesce(q.payment_terms,'Due on receipt'),
    q.reference,q.purchase_order,q.notes,q.terms,coalesce(q.discount_type,'none'),q.discount_value,
    q.tax_rate,q.subtotal,q.discount_amount,q.tax_amount,q.total,0,q.tax_rate>0,q.tax_name,
    'none',false
  )
  returning id into inv_id;

  insert into public.invoice_items(invoice_id,description,quantity,unit_price)
  select inv_id,description,quantity,unit_price from public.quote_items where quote_id=q.id;

  perform public.recalculate_invoice_totals(inv_id);

  update public.quotes
  set status='converted',converted_invoice_id=inv_id,updated_at=now()
  where id=q.id;

  insert into public.events(business_id,event_type,summary,evidence,status,priority,category,action_type)
  values(
    q.business_id,'quote.converted',
    'Quote '||q.quote_number||' converted to invoice',
    jsonb_build_object('quote_id',q.id,'invoice_id',inv_id,'invoice_number',inv_num),
    'info','normal','sales','convert_quote'
  );

  return inv_id;
end
$function$;

revoke all on function public.convert_accepted_quote_to_invoice(uuid) from anon;
grant execute on function public.convert_accepted_quote_to_invoice(uuid) to authenticated;