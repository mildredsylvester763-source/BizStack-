export type BuildMode = 'draft_only' | 'ask_first' | 'auto_execute';
export type BuildStatus = 'queued' | 'planning' | 'building' | 'testing' | 'waiting_approval' | 'succeeded' | 'partial' | 'failed' | 'cancelled';
export type ProviderStatus = 'not_configured' | 'available' | 'failed' | 'fallback';

export type WebsiteSection = {
  id: string;
  type: 'hero' | 'text' | 'services' | 'products' | 'features' | 'testimonials' | 'faq' | 'contact' | 'booking' | 'gallery' | 'cta';
  heading?: string;
  body?: string;
  items?: Array<Record<string, unknown>>;
  button?: string;
  url?: string;
};

export type WebsitePageSpec = {
  slug: string;
  title: string;
  pageType: 'home' | 'standard' | 'commerce' | 'booking' | 'contact';
  seo: { title: string; description: string };
  sections: WebsiteSection[];
};

export type WebsiteSpec = {
  name: string;
  subdomain: string;
  theme: { style: 'ledger' | 'modern' | 'luxury' | 'bold' | 'minimal' | 'dark'; primary: string; accent: string; surface: string; typography: 'editorial' | 'clean' | 'geometric' };
  navigation: string[];
  features: string[];
  pages: WebsitePageSpec[];
  forms: Array<{ key: string; name: string; fields: string[]; destination: 'crm' | 'internal' }>;
  integrations: Array<{ key: string; provider: string; required: boolean; status: 'ready' | 'credential_required' }>;
  seo: { siteTitle: string; description: string; keywords: string[] };
};

export type BuildPlanStep = { key: string; label: string; description: string; order: number; requiresApproval: boolean };
export type BuildPlan = { capability: string; mode: BuildMode; steps: BuildPlanStep[] };

export type BuildContext = {
  business: { id: string; name: string; industry?: string | null; currency?: string | null; contactEmail?: string | null; contactPhone?: string | null };
  websiteId?: string | null;
  existingWebsite?: unknown;
};

export type BuildCapability = 'website' | 'invoice' | 'product_inventory' | 'money_transaction' | 'customer' | 'connector' | 'quote' | 'general';
export type BuildRequest = { capability: BuildCapability; prompt: string; mode?: BuildMode; websiteId?: string | null; context: BuildContext };
export type BuildProviderResult = { providerKey: string; status: 'available' | 'failed' | 'fallback'; spec?: WebsiteSpec; raw?: unknown; model?: string; error?: string };