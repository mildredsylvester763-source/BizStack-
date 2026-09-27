import type { BuildPlan, BuildRequest, WebsiteSpec } from '@/lib/ai/build-engine/types';

export type CapabilityDefinition = { key: string; name: string; description: string; actions: string[]; approvalRequired: boolean };

const registry: CapabilityDefinition[] = [
  { key: 'website', name: 'AI Website Builder', description: 'Translate a business request into a structured, editable website specification and apply it to real website records.', actions: ['generate_sitemap','generate_content_model','generate_sections','configure_forms','configure_integrations','validate_seo','publish'], approvalRequired: true },
  { key: 'invoice', name: 'AI Invoice Builder', description: 'Translate a natural-language invoice request into a real draft invoice with real customer matching, line items, totals and validation.', actions: ['resolve_customer','parse_line_items','create_draft','recalculate_totals','validate_invoice','audit'], approvalRequired: false },\n  { key: 'general', name: 'Business Build Engine', description: 'Generic structured build orchestration for future BizStack modules.', actions: ['interpret','plan','validate','execute','audit'], approvalRequired: true }
];

export function getCapability(key: string) { return registry.find((item) => item.key === key) ?? null; }

export function buildPlan(request: BuildRequest): BuildPlan {
  const capability = getCapability(request.capability);
  if (!capability) throw new Error('Unknown build capability.');
  const steps = capability.actions.map((action, index) => ({
    key: action,
    label: action.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' '),
    description: action + ' for ' + request.capability + ' build',
    order: index + 1,
    requiresApproval: request.capability === 'website' ? action === 'publish' && request.mode !== 'auto_execute' : capability.approvalRequired && request.mode !== 'auto_execute'
  }));
  return { capability: request.capability, mode: request.mode ?? 'ask_first', steps };
}

export function countWebsiteRequirements(spec: WebsiteSpec) {
  return {
    pages: spec.pages.length,
    sections: spec.pages.reduce((sum, page) => sum + page.sections.length, 0),
    forms: spec.forms.length,
    integrations: spec.integrations.length,
    navigation: spec.navigation.length,
    features: spec.features.length
  };
}