insert into public.ai_tools (tool_key,name,description,category,risk_level,input_schema,output_schema,capabilities,status)
values
('projects.list','Project Directory','Inspect persistent software projects and their verified deployment state.','development','low','{"type":"object","properties":{},"additionalProperties":false}'::jsonb,'{"type":"object"}'::jsonb,'["read","development"]','active'),
('projects.create','Create Software Project','Create a real editable software project with persistent files and an initial version snapshot.','development','medium','{"type":"object","properties":{"name":{"type":"string"},"slug":{"type":"string"},"project_type":{"type":"string"},"framework":{"type":"string"},"runtime":{"type":"string"},"files":{"type":"array"}},"required":["name"]}'::jsonb,'{"type":"object"}'::jsonb,'["write","development","audit"]','active'),
('project.files.list','Project Source Files','Read the real persistent source tree for a software project.','development','low','{"type":"object","properties":{"project_id":{"type":"string"}},"required":["project_id"]}'::jsonb,'{"type":"object"}'::jsonb,'["read","development"]','active'),
('project.files.write','Write Project File','Create or modify a real source file in a persistent software project.','development','medium','{"type":"object","properties":{"project_id":{"type":"string"},"path":{"type":"string"},"content":{"type":"string"},"language":{"type":"string"}},"required":["project_id","path","content"]}'::jsonb,'{"type":"object"}'::jsonb,'["write","development","audit"]','active'),
('project.version.create','Snapshot Project Version','Create an immutable project version snapshot before or after source changes.','development','low','{"type":"object","properties":{"project_id":{"type":"string"},"message":{"type":"string"}},"required":["project_id"]}'::jsonb,'{"type":"object"}'::jsonb,'["write","development","audit"]','active')
on conflict (tool_key) do update set
  name=excluded.name,
  description=excluded.description,
  category=excluded.category,
  risk_level=excluded.risk_level,
  input_schema=excluded.input_schema,
  output_schema=excluded.output_schema,
  capabilities=excluded.capabilities,
  status=excluded.status;

insert into public.ai_agent_tool_bindings (business_id,agent_id,tool_id,enabled,configuration)
select a.business_id,a.id,t.id,true,'{}'::jsonb
from public.ai_agents a
join public.ai_tools t on t.tool_key in ('projects.list','projects.create','project.files.list','project.files.write','project.version.create') and t.status='active'
where a.slug='bizstack-operator'
on conflict do nothing;