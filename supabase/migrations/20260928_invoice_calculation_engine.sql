-- Complete invoice calculation engine: one canonical server-side source of truth.
create or replace function public.recalculate_invoice_totals(p_invoice_id uuid)
returns public.invoices
language plpgsql
security invoker
set search_path=public
as $function$
declare
  v_invoice public.invoices%rowtype;
  v_subtotal numeric(20,2);
  v_discount numeric(20,2);
  v_taxable numeric(20,2);
  v_tax numeric(20,2);
  v_total numeric(20,2);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select i.*
    into v_invoice
  from public.invoices i
  join public.businesses b on b.id = i.business_id
  where i.id = p_invoice_id
    and b.owner_id = auth.uid()
  for update;

  if not found then
    raise exception 'Invoice not found';
  end if;

  select coalesce(round(sum(greatest(quantity,0) * greatest(unit_price,0)),2),0)
    into v_subtotal
  from public.invoice_items
  where invoice_id = p_invoice_id;

  if v_invoice.discount_type = 'percentage' then
    v_discount := round(v_subtotal * least(greatest(coalesce(v_invoice.discount_value,0),0),100) / 100,2);
  elsif v_invoice.discount_type = 'fixed' then
    v_discount := least(round(greatest(coalesce(v_invoice.discount_value,0),0),2), v_subtotal);
  else
    v_discount := 0;
  end if;

  v_taxable := greatest(v_subtotal - v_discount,0);

  if coalesce(v_invoice.tax_enabled,false) and coalesce(v_invoice.tax_rate,0) > 0 then
    if coalesce(v_invoice.tax_inclusive,false) then
      v_tax := round(v_taxable - (v_taxable / (1 + (v_invoice.tax_rate / 100))),2);
      v_total := v_taxable;
    else
      v_tax := round(v_taxable * v_invoice.tax_rate / 100,2);
      v_total := round(v_taxable + v_tax,2);
    end if;
  else
    v_tax := 0;
    v_total := v_taxable;
  end if;

  update public.invoices
  set subtotal = v_subtotal,
      discount_amount = v_discount,
      tax_amount = v_tax,
      total = greatest(v_total,0),
      paid_amount = least(greatest(coalesce(paid_amount,0),0), greatest(v_total,0))
  where id = p_invoice_id
  returning * into v_invoice;

  return v_invoice;
end
$function$;

revoke all on function public.recalculate_invoice_totals(uuid) from anon;
grant execute on function public.recalculate_invoice_totals(uuid) to authenticated;

-- Refresh overdue state without touching drafts or paid invoices.
create or replace function public.refresh_invoice_statuses(p_business_id uuid default null)
returns integer
language plpgsql
security invoker
set search_path=public
as $function$
declare
  v_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  update public.invoices i
  set status = case
    when i.paid_amount >= i.total and i.total >= 0 then 'paid'
    when i.due_date is not null and i.due_date < current_date and i.paid_amount > 0 then 'partially_paid'
    when i.due_date is not null and i.due_date < current_date then 'overdue'
    when i.paid_amount > 0 then 'partially_paid'
    else 'sent'
  end
  from public.businesses b
  where b.id=i.business_id
    and b.owner_id=auth.uid()
    and (p_business_id is null or i.business_id=p_business_id)
    and i.status <> 'draft'
    and not (i.status='paid' and i.paid_amount >= i.total);

  get diagnostics v_count = row_count;
  return v_count;
end
$function$;

revoke all on function public.refresh_invoice_statuses(uuid) from anon;
grant execute on function public.refresh_invoice_statuses(uuid) to authenticated;
