-- Run in Supabase SQL Editor.

alter table businesses
  add column if not exists bank_name text,
  add column if not exists bank_account_name text,
  add column if not exists bank_account_number text;

alter table invoices
  add column if not exists payment_methods text[] not null default array['bank_transfer','qr'];
