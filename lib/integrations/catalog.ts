export type IntegrationCatalogEntry={
 provider:string; name:string; category:string; connection:"oauth"|"api_key"|"bearer";
 description:string; credentialFields:string[]; capabilities:string[];
 configFields?:string[];
};

export const INTEGRATION_CATALOG:IntegrationCatalogEntry[]=[
 {provider:"github",name:"GitHub",category:"developer",connection:"oauth",description:"Repositories, branches, commits, pull requests, issues and developer identity.",credentialFields:["accessToken","refreshToken"],capabilities:["read","write","repository","pull_requests"]},
 {provider:"google-drive",name:"Google Drive",category:"files",connection:"oauth",description:"Files and folders for business documents and imports.",credentialFields:["accessToken","refreshToken"],capabilities:["read","write","files"]},
 {provider:"gmail",name:"Gmail",category:"communications",connection:"oauth",description:"Business email inbox, sending and message workflows.",credentialFields:["accessToken","refreshToken"],capabilities:["read","send","modify"]},
 {provider:"google-calendar",name:"Google Calendar",category:"scheduling",connection:"oauth",description:"Calendar events and scheduling workflows.",credentialFields:["accessToken","refreshToken"],capabilities:["read","write","events"]},
 {provider:"slack",name:"Slack",category:"communications",connection:"oauth",description:"Workspace channels, messages and notifications.",credentialFields:["accessToken"],capabilities:["read","send"]},
 {provider:"notion",name:"Notion",category:"knowledge",connection:"oauth",description:"Pages, databases and business knowledge.",credentialFields:["accessToken"],capabilities:["read","write"]},
 {provider:"microsoft-365",name:"Microsoft 365",category:"productivity",connection:"oauth",description:"Microsoft Graph access for mail, files, calendars and profile.",credentialFields:["accessToken","refreshToken"],capabilities:["mail","files","calendar"]},
 {provider:"dropbox",name:"Dropbox",category:"files",connection:"oauth",description:"Cloud file storage and imports.",credentialFields:["accessToken","refreshToken"],capabilities:["read","write"]},
 {provider:"box",name:"Box",category:"files",connection:"oauth",description:"Enterprise file storage and document workflows.",credentialFields:["accessToken","refreshToken"],capabilities:["read","write"]},
 {provider:"trello",name:"Trello",category:"project_management",connection:"oauth",description:"Boards, lists and cards.",credentialFields:["accessToken"],capabilities:["read","write"]},
 {provider:"asana",name:"Asana",category:"project_management",connection:"oauth",description:"Projects, tasks and work management.",credentialFields:["accessToken","refreshToken"],capabilities:["read","write"]},
 {provider:"linear",name:"Linear",category:"project_management",connection:"oauth",description:"Issues, projects and engineering workflows.",credentialFields:["accessToken"],capabilities:["read","write"]},
 {provider:"jira",name:"Jira",category:"project_management",connection:"oauth",description:"Issues and engineering project management.",credentialFields:["accessToken","refreshToken"],capabilities:["read","write"]},
 {provider:"gitlab",name:"GitLab",category:"developer",connection:"oauth",description:"Repositories and CI/developer workflows.",credentialFields:["accessToken","refreshToken"],capabilities:["read","write","repository"]},
 {provider:"bitbucket",name:"Bitbucket",category:"developer",connection:"oauth",description:"Repositories and pull requests.",credentialFields:["accessToken","refreshToken"],capabilities:["read","write","repository"]},
 {provider:"hubspot",name:"HubSpot",category:"crm",connection:"oauth",description:"Contacts, companies and CRM data.",credentialFields:["accessToken","refreshToken"],capabilities:["read","write","crm"]},
 {provider:"salesforce",name:"Salesforce",category:"crm",connection:"oauth",description:"CRM records and sales workflows.",credentialFields:["accessToken","refreshToken"],capabilities:["read","write","crm"]},
 {provider:"airtable",name:"Airtable",category:"data",connection:"oauth",description:"Tables and structured business data.",credentialFields:["accessToken","refreshToken"],capabilities:["read","write"]},
 {provider:"monday",name:"monday.com",category:"project_management",connection:"oauth",description:"Boards and operational work management.",credentialFields:["accessToken","refreshToken"],capabilities:["read","write"]},
 {provider:"clickup",name:"ClickUp",category:"project_management",connection:"oauth",description:"Tasks and workspace operations.",credentialFields:["accessToken","refreshToken"],capabilities:["read","write"]},
 {provider:"discord",name:"Discord",category:"communications",connection:"oauth",description:"Community and business messaging.",credentialFields:["accessToken"],capabilities:["read","send"]},
 {provider:"zoom",name:"Zoom",category:"communications",connection:"oauth",description:"Meetings and scheduling.",credentialFields:["accessToken","refreshToken"],capabilities:["read","write"]},
 {provider:"calendly",name:"Calendly",category:"scheduling",connection:"oauth",description:"Scheduling links and event data.",credentialFields:["accessToken","refreshToken"],capabilities:["read","write"]},
 {provider:"quickbooks",name:"QuickBooks Online",category:"accounting",connection:"oauth",description:"Accounting and financial records.",credentialFields:["accessToken","refreshToken"],capabilities:["read","write","accounting"]},
 {provider:"xero",name:"Xero",category:"accounting",connection:"oauth",description:"Accounting, contacts and transaction workflows.",credentialFields:["accessToken","refreshToken"],capabilities:["read","write","accounting"]},
 {provider:"figma",name:"Figma",category:"design",connection:"oauth",description:"Design files and design-system workflows.",credentialFields:["accessToken"],capabilities:["read","design"]},
 {provider:"stripe",name:"Stripe",category:"payments",connection:"api_key",description:"Payments, customers, invoices and billing.",credentialFields:["apiKey"],capabilities:["read","write","payments"],configFields:["account_id"]},
 {provider:"shopify",name:"Shopify",category:"commerce",connection:"api_key",description:"Store products, orders and inventory.",credentialFields:["apiKey"],capabilities:["read","write","commerce"],configFields:["shop_domain"]},
 {provider:"twilio",name:"Twilio",category:"communications",connection:"api_key",description:"SMS and communications infrastructure.",credentialFields:["apiKey","username","password"],capabilities:["send","sms"],configFields:["from_number"]},
 {provider:"resend",name:"Resend",category:"communications",connection:"api_key",description:"Transactional email delivery.",credentialFields:["apiKey"],capabilities:["send","email"],configFields:["from_email"]},
 {provider:"meta-whatsapp",name:"WhatsApp Business",category:"communications",connection:"bearer",description:"Business WhatsApp messaging and webhook inbox.",credentialFields:["accessToken"],capabilities:["send","receive","webhooks"],configFields:["phone_number_id"]},
 {provider:"meta-messenger",name:"Facebook Messenger",category:"communications",connection:"bearer",description:"Facebook Page Messenger conversations and webhooks.",credentialFields:["accessToken"],capabilities:["send","receive","webhooks"],configFields:["page_id"]}
];

export function getIntegrationCatalog(provider?:string){
 const list=provider?INTEGRATION_CATALOG.filter(x=>x.provider===provider):INTEGRATION_CATALOG;
 return list;
}
