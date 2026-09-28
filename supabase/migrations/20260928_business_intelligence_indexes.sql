create index if not exists cashflow_alerts_rule_idx on public.cashflow_alerts(rule_id);
create index if not exists whatsapp_order_events_customer_idx on public.whatsapp_order_events(customer_id);
create index if not exists whatsapp_order_events_order_idx on public.whatsapp_order_events(order_id);
create index if not exists customer_feedback_customer_idx on public.customer_feedback(customer_id);
create index if not exists customer_feedback_topics_example_idx on public.customer_feedback_topics(example_feedback_id);