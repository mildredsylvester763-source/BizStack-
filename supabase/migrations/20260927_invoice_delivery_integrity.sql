-- Invoice delivery integrity: queue is not "sent". Provider acceptance is the boundary that moves an invoice to sent.
create or replace function public.queue_invoice_email(p_invoice_id uuid)
returns uuid
language plpgsql
security invoker
set search_path=public
as $function$
declare
  i public.invoices%rowtype;
  c record;
  b record;
  msg uuid;
  job uuid;
  existing_job uuid;
  idem text;
  subject_text text;
  body_text text;
begin
  select * into i from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  select * into b from public.businesses where id=i.business_id;
  if not found or b.owner_id <> auth.uid() then raise exception 'Not authorized'; end if;
  select name,email,phone into c from public.customers where id=i.customer_id;
  if c.email is null or btrim(c.email)='' then raise exception 'Customer has no email address'; end if;
  idem := 'invoice:'||i.id::text||':email:'||coalesce(i.updated_at::text,i.created_at::text);
  select id into existing_job from public.communication_delivery_jobs where business_id=i.business_id and idempotency_key=idem limit 1;
  if existing_job is not null then return existing_job; end if;

  subject_text := 'Invoice '||i.invoice_number||' from '||b.name;
  body_text := 'Invoice '||i.invoice_number||' is ready for payment. Total: '||to_char(coalesce(i.total,0),'FM999999999999990.00')||' '||coalesce(i.currency,'')||'. Due: '||coalesce(i.due_date::text,'upon receipt')||'.';

  insert into public.communication_messages(business_id,customer_id,channel,direction,status,subject,body,template_name,metadata)
  values(i.business_id,i.customer_id,'email','outbound','queued',subject_text,body_text,'invoice_delivery',
    jsonb_build_object('invoice_id',i.id,'invoice_number',i.invoice_number,'recipient',c.email))
  returning id into msg;

  insert into public.communication_delivery_jobs(business_id,communication_id,entity_type,entity_id,channel,recipient,subject,body,idempotency_key,metadata)
  values(i.business_id,msg,'invoice',i.id,'email',c.email,subject_text,body_text,idem,jsonb_build_object('customer_id',i.customer_id))
  returning id into job;

  insert into public.events(business_id,event_type,summary,evidence,status,priority,category,action_type)
  values(i.business_id,'invoice.delivery_queued','Invoice '||i.invoice_number||' queued for email delivery',
    jsonb_build_object('invoice_id',i.id,'delivery_job_id',job,'communication_id',msg,'recipient',c.email),
    'info','normal','communications','delivery');

  return job;
end
$function$;

revoke all on function public.queue_invoice_email(uuid) from anon;
grant execute on function public.queue_invoice_email(uuid) to authenticated;