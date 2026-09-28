insert into public.ai_app_catalog
(slug,name,publisher,category,description,icon_key,auth_type,connection_mode,capabilities,scopes,status,sort_order,metadata)
values
('slack','Slack','Salesforce','Communication','Connect authorized Slack workspaces for messages, channels and team context.','SL','oauth','oauth',
 '["search","read","write","events"]'::jsonb,'["identity.basic","identity.email","channels:read","chat:write"]'::jsonb,'active',40,'{"provider_adapter":"slack"}'::jsonb),
('notion','Notion','Notion','Knowledge','Connect an authorized Notion workspace for pages and selected knowledge.','NO','oauth','oauth',
 '["search","read","write"]'::jsonb,'[]'::jsonb,'active',50,'{"provider_adapter":"notion"}'::jsonb)
on conflict (slug) do update set
  name=excluded.name,
  publisher=excluded.publisher,
  category=excluded.category,
  description=excluded.description,
  icon_key=excluded.icon_key,
  auth_type=excluded.auth_type,
  connection_mode=excluded.connection_mode,
  capabilities=excluded.capabilities,
  scopes=excluded.scopes,
  status=excluded.status,
  metadata=excluded.metadata;

