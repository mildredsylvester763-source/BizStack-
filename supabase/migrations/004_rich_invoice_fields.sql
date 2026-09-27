alter table public.invoices
  add column if not exists issue_date date not null default current_date,
  add column if not exists payment_terms text not null default 'Due on receipt',
  add column if not exists reference text,
  add column if not exists purchase_order text,
  add column if not exists notes text,
  add column if not exists terms_and_conditions text,
  add column if not exists discount_type text not null default 'none'
    check (discount_type in ('none','percentage','fixed')),
  add column if not exists discount_value numeric not null default 0
    check (discount_value >= 0),
  add column if not exists tax_rate numeric not null default 0
    check (tax_rate >= 0),
  add column if not exists subtotal numeric not null default 0
    check (subtotal >= 0),
  add column if not exists discount_amount numeric not null default 0
    check (discount_amount >= 0),
  add column if not exists tax_amount numeric not null default 0
    check (tax_amount >= 0),
  add column if not exists total numeric not null default 0
    check (total >= 0);

create index if not exists invoices_business_due_date_idx
  on public.invoices (business_id, due_date);

comment on column public.invoices.issue_date is 'Date the invoice was issued.';
comment on column public.invoices.payment_terms is 'Human-readable payment terms captured with the invoice.';
comment on column public.invoices.reference is 'Optional customer/reference identifier shown on the invoice.';
comment on column public.invoices.purchase_order is 'Optional customer purchase order number.';
comment on column public.invoices.discount_type is 'Invoice-level discount method.';
comment on column public.invoices.tax_rate is 'Invoice-level tax rate percentage.';
