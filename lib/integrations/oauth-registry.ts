export type OAuthProvider = {
 provider:string;
 name:string;
 category:string;
 authorize:string;
 token:string;
 scopes:string[];
 client:string;
 identity?:string;
 tokenAuth?:"body"|"basic";
 extra?:Record<string,string>;
};

export const OAUTH_PROVIDERS:Record<string,OAuthProvider>={
 github:{provider:"github",name:"GitHub",category:"developer",authorize:"https://github.com/login/oauth/authorize",token:"https://github.com/login/oauth/access_token",scopes:["repo","read:user","user:email"],client:"GITHUB_CLIENT_ID",identity:"https://api.github.com/user"},
 "google-drive":{provider:"google-drive",name:"Google Drive",category:"files",authorize:"https://accounts.google.com/o/oauth2/v2/auth",token:"https://oauth2.googleapis.com/token",scopes:["openid","email","profile","https://www.googleapis.com/auth/drive.readonly","https://www.googleapis.com/auth/drive.file"],client:"GOOGLE_CLIENT_ID",identity:"https://www.googleapis.com/oauth2/v2/userinfo"},
 gmail:{provider:"gmail",name:"Gmail",category:"communications",authorize:"https://accounts.google.com/o/oauth2/v2/auth",token:"https://oauth2.googleapis.com/token",scopes:["openid","email","profile","https://www.googleapis.com/auth/gmail.readonly","https://www.googleapis.com/auth/gmail.modify","https://www.googleapis.com/auth/gmail.send"],client:"GOOGLE_CLIENT_ID",identity:"https://www.googleapis.com/oauth2/v2/userinfo"},
 "google-calendar":{provider:"google-calendar",name:"Google Calendar",category:"scheduling",authorize:"https://accounts.google.com/o/oauth2/v2/auth",token:"https://oauth2.googleapis.com/token",scopes:["openid","email","profile","https://www.googleapis.com/auth/calendar.readonly","https://www.googleapis.com/auth/calendar.events"],client:"GOOGLE_CLIENT_ID",identity:"https://www.googleapis.com/oauth2/v2/userinfo"},
 slack:{provider:"slack",name:"Slack",category:"communications",authorize:"https://slack.com/oauth/v2/authorize",token:"https://slack.com/api/oauth.v2.access",scopes:["openid","email","profile","channels:read","chat:write"],client:"SLACK_CLIENT_ID",identity:"https://slack.com/api/auth.test"},
 notion:{provider:"notion",name:"Notion",category:"knowledge",authorize:"https://api.notion.com/v1/oauth/authorize",token:"https://api.notion.com/v1/oauth/token",scopes:[],client:"NOTION_CLIENT_ID",identity:"https://api.notion.com/v1/users/me",tokenAuth:"basic"},
 microsoft:{provider:"microsoft-365",name:"Microsoft 365",category:"productivity",authorize:"https://login.microsoftonline.com/common/oauth2/v2.0/authorize",token:"https://login.microsoftonline.com/common/oauth2/v2.0/token",scopes:["openid","email","profile","offline_access","User.Read","Files.ReadWrite","Calendars.ReadWrite","Mail.ReadWrite"],client:"MICROSOFT_CLIENT_ID",identity:"https://graph.microsoft.com/v1.0/me"},
 dropbox:{provider:"dropbox",name:"Dropbox",category:"files",authorize:"https://www.dropbox.com/oauth2/authorize",token:"https://api.dropboxapi.com/oauth2/token",scopes:[],client:"DROPBOX_CLIENT_ID",identity:"https://api.dropboxapi.com/2/users/get_current_account"},
 box:{provider:"box",name:"Box",category:"files",authorize:"https://account.box.com/api/oauth2/authorize",token:"https://api.box.com/oauth2/token",scopes:[],client:"BOX_CLIENT_ID",identity:"https://api.box.com/2.0/users/me"},
 trello:{provider:"trello",name:"Trello",category:"project_management",authorize:"https://trello.com/1/authorize",token:"https://trello.com/1/OAuthGetAccessToken",scopes:["read","write"],client:"TRELLO_API_KEY",identity:"https://api.trello.com/1/members/me"},
 asana:{provider:"asana",name:"Asana",category:"project_management",authorize:"https://app.asana.com/-/oauth_authorize",token:"https://app.asana.com/-/oauth_token",scopes:["default"],client:"ASANA_CLIENT_ID",identity:"https://app.asana.com/api/1.0/users/me"},
 linear:{provider:"linear",name:"Linear",category:"project_management",authorize:"https://linear.app/oauth/authorize",token:"https://api.linear.app/oauth/token",scopes:["read","write"],client:"LINEAR_CLIENT_ID",identity:"https://api.linear.app/graphql"},
 jira:{provider:"jira",name:"Jira",category:"project_management",authorize:"https://auth.atlassian.com/authorize",token:"https://auth.atlassian.com/oauth/token",scopes:["read:jira-work","write:jira-work","read:jira-user"],client:"ATLASSIAN_CLIENT_ID",identity:"https://api.atlassian.com/me"},
 gitlab:{provider:"gitlab",name:"GitLab",category:"developer",authorize:"https://gitlab.com/oauth/authorize",token:"https://gitlab.com/oauth/token",scopes:["read_user","api"],client:"GITLAB_CLIENT_ID",identity:"https://gitlab.com/api/v4/user"},
 bitbucket:{provider:"bitbucket",name:"Bitbucket",category:"developer",authorize:"https://bitbucket.org/site/oauth2/authorize",token:"https://bitbucket.org/site/oauth2/access_token",scopes:["repository","pullrequest"],client:"BITBUCKET_CLIENT_ID",identity:"https://api.bitbucket.org/2.0/user"},
 hubspot:{provider:"hubspot",name:"HubSpot",category:"crm",authorize:"https://app.hubspot.com/oauth/authorize",token:"https://api.hubapi.com/oauth/v1/token",scopes:["crm.objects.contacts.read","crm.objects.contacts.write","crm.objects.companies.read","crm.objects.deals.read"],client:"HUBSPOT_CLIENT_ID",identity:"https://api.hubapi.com/oauth/v1/access-tokens"},
 salesforce:{provider:"salesforce",name:"Salesforce",category:"crm",authorize:"https://login.salesforce.com/services/oauth2/authorize",token:"https://login.salesforce.com/services/oauth2/token",scopes:["api","refresh_token"],client:"SALESFORCE_CLIENT_ID",identity:"https://login.salesforce.com/services/oauth2/userinfo"},
 airtable:{provider:"airtable",name:"Airtable",category:"data",authorize:"https://airtable.com/oauth2/v1/authorize",token:"https://airtable.com/oauth2/v1/token",scopes:["data.records:read","data.records:write","schema.bases:read"],client:"AIRTABLE_CLIENT_ID",identity:"https://api.airtable.com/v0/meta/whoami"},
 monday:{provider:"monday",name:"monday.com",category:"project_management",authorize:"https://auth.monday.com/oauth2/authorize",token:"https://auth.monday.com/oauth2/token",scopes:["me:read","boards:read","boards:write"],client:"MONDAY_CLIENT_ID"},
 clickup:{provider:"clickup",name:"ClickUp",category:"project_management",authorize:"https://app.clickup.com/api",token:"https://api.clickup.com/api/v2/oauth/token",scopes:["read"],client:"CLICKUP_CLIENT_ID",identity:"https://api.clickup.com/api/v2/user"},
 discord:{provider:"discord",name:"Discord",category:"communications",authorize:"https://discord.com/oauth2/authorize",token:"https://discord.com/api/oauth2/token",scopes:["identify","email","guilds"],client:"DISCORD_CLIENT_ID",identity:"https://discord.com/api/users/@me"},
 zoom:{provider:"zoom",name:"Zoom",category:"communications",authorize:"https://zoom.us/oauth/authorize",token:"https://zoom.us/oauth/token",scopes:["meeting:read","meeting:write","user:read"],client:"ZOOM_CLIENT_ID",identity:"https://api.zoom.us/v2/users/me"},
 calendly:{provider:"calendly",name:"Calendly",category:"scheduling",authorize:"https://auth.calendly.com/oauth/authorize",token:"https://auth.calendly.com/oauth/token",scopes:[],client:"CALENDLY_CLIENT_ID",identity:"https://api.calendly.com/users/me"},
 quickbooks:{provider:"quickbooks",name:"QuickBooks Online",category:"accounting",authorize:"https://appcenter.intuit.com/connect/oauth2",token:"https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",scopes:["com.intuit.quickbooks.accounting"],client:"QUICKBOOKS_CLIENT_ID",identity:"https://accounts.platform.intuit.com/v1/openid_connect/userinfo"},
 xero:{provider:"xero",name:"Xero",category:"accounting",authorize:"https://login.xero.com/identity/connect/authorize",token:"https://identity.xero.com/connect/token",scopes:["openid","profile","email","accounting.transactions","accounting.contacts"],client:"XERO_CLIENT_ID",identity:"https://identity.xero.com/connect/userinfo"},
 figma:{provider:"figma",name:"Figma",category:"design",authorize:"https://www.figma.com/oauth",token:"https://api.figma.com/v1/oauth/token",scopes:["file_read"],client:"FIGMA_CLIENT_ID",identity:"https://api.figma.com/v1/me"}
};

export function getOAuthProvider(slug:string){
 const normalized=slug==="microsoft-365"?"microsoft":slug;
 return OAUTH_PROVIDERS[normalized]||null;
}
