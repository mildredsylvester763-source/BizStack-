-- Expand the BizStack Operator app directory across business, engineering, design and automation workflows.
insert into public.ai_app_catalog
(slug,name,publisher,category,description,icon_key,auth_type,connection_mode,capabilities,scopes,status,sort_order)
values
('figma','Figma','Figma','Design','Read approved design files and use design context in product and code workflows.','figma','oauth','account','["files","design_context","comments","assets"]','["file:read"]','coming_soon',200),
('linear','Linear','Linear','Project Management','Issues, projects, cycles and engineering workflow context.','linear','oauth','workspace','["issues","projects","cycles","comments"]','["read","write"]','coming_soon',210),
('jira','Jira','Atlassian','Project Management','Issues, projects, workflows and release coordination.','jira','oauth','site','["issues","projects","comments","transitions"]','["read","write"]','coming_soon',220),
('postman','Postman','Postman','Developer','Collections, environments and API-development context.','postman','api_key','workspace','["collections","environments","requests","tests"]','["read","write"]','coming_soon',230),
('sentry','Sentry','Sentry','Observability','Application errors, traces and release diagnostics for autonomous repair.','sentry','api_key','organization','["issues","events","releases","performance"]','["org:read","project:read"]','coming_soon',240),
('cloudflare','Cloudflare','Cloudflare','Infrastructure','DNS, domains, workers and edge infrastructure workflows.','cloudflare','api_key','account','["dns","zones","workers","domains"]','["read","write"]','coming_soon',250),
('aws','Amazon Web Services','Amazon','Infrastructure','Controlled access to selected AWS resources and deployment context.','aws','api_key','account','["cloudwatch","s3","lambda","ecs"]','["scoped"]','coming_soon',260),
('google-cloud','Google Cloud','Google','Infrastructure','Cloud resources, logs and deployment context for authorized projects.','google-cloud','oauth','project','["projects","logs","storage","compute"]','["scoped"]','coming_soon',270),
('firebase','Firebase','Google','Backend','Authentication, Firestore, Storage, Functions and project configuration context.','firebase','api_key','project','["auth","firestore","storage","functions"]','["scoped"]','coming_soon',280),
('docker','Docker','Docker','Developer','Container images, builds and local/runtime development workflows.','docker','api_key','workspace','["images","builds","registries"]','["scoped"]','coming_soon',290),
('twilio','Twilio','Twilio','Communication','SMS, voice and messaging workflows through authorized accounts.','twilio','api_key','account','["sms","voice","messaging","webhooks"]','["scoped"]','coming_soon',300),
('sendgrid','SendGrid','Twilio','Communication','Transactional email delivery and sender-domain workflows.','sendgrid','api_key','account','["send","templates","contacts","events"]','["scoped"]','coming_soon',310),
('zapier','Zapier','Zapier','Automation','Connect BizStack workflows to external applications and automation steps.','zapier','api_key','workspace','["webhooks","actions","triggers"]','["scoped"]','coming_soon',320),
('make','Make','Make','Automation','Scenario automation and external workflow orchestration.','make','api_key','workspace','["scenarios","webhooks","runs"]','["scoped"]','coming_soon',330),
('hubspot','HubSpot','HubSpot','CRM','Contacts, companies, deals, tickets and marketing context.','hubspot','oauth','account','["contacts","companies","deals","tickets"]','["scoped"]','coming_soon',340),
('salesforce','Salesforce','Salesforce','CRM','Accounts, contacts, opportunities and service workflows.','salesforce','oauth','organization','["accounts","contacts","opportunities","cases"]','["scoped"]','coming_soon',350),
('mailchimp','Mailchimp','Intuit','Marketing','Audience, campaigns, templates and marketing automation context.','mailchimp','oauth','account','["audiences","campaigns","templates","reports"]','["scoped"]','coming_soon',360),
('calendly','Calendly','Calendly','Scheduling','Availability, event types and scheduled meeting context.','calendly','oauth','account','["availability","event_types","events"]','["scoped"]','coming_soon',370),
('zoom','Zoom','Zoom','Communication','Authorized meeting, recording and scheduling context.','zoom','oauth','account','["meetings","recordings","users"]','["scoped"]','coming_soon',380),
('youtube','YouTube','Google','Media','Channel, video and publishing context for authorized creator accounts.','youtube','oauth','channel','["videos","channels","analytics"]','["scoped"]','coming_soon',390),
('meta-business','Meta Business','Meta','Marketing','Pages, business assets and authorized messaging/advertising context.','meta-business','oauth','business','["pages","messages","ads","webhooks"]','["scoped"]','coming_soon',400),
('flutter','Flutter','Google','Developer','Flutter project workflows, package context and mobile build assistance.','flutter','custom','workspace','["project_files","build","test","analyze"]','[]','active',410)
on conflict (slug) do update set
 name=excluded.name,publisher=excluded.publisher,category=excluded.category,description=excluded.description,
 icon_key=excluded.icon_key,auth_type=excluded.auth_type,connection_mode=excluded.connection_mode,
 capabilities=excluded.capabilities,scopes=excluded.scopes,status=excluded.status,sort_order=excluded.sort_order;
