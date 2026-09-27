import type { BuildContext, BuildProviderResult, WebsiteSpec } from '@/lib/ai/build-engine/types';
import { normalizeLocalWebsiteSpec } from '@/lib/ai/build-engine/website-local';

function extractJson(value: unknown): unknown {
  if (typeof value === 'object' && value !== null) return value;
  if (typeof value !== 'string') return null;
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? value;
  try { return JSON.parse(fenced); } catch { return null; }
}

function configured() { return Boolean(process.env.BIZSTACK_AI_API_URL && process.env.BIZSTACK_AI_API_KEY); }

export async function generateWebsiteSpec(prompt: string, context: BuildContext): Promise<BuildProviderResult> {
  if (!configured()) return { providerKey: 'local-interpreter', status: 'fallback', spec: normalizeLocalWebsiteSpec(prompt, context), model: 'deterministic-local' };
  try {
    const response = await fetch(process.env.BIZSTACK_AI_API_URL as string, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.BIZSTACK_AI_API_KEY },
      body: JSON.stringify({
        model: process.env.BIZSTACK_AI_MODEL || 'default', temperature: 0.2, response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are BizStack structured website compiler. Return only valid JSON matching WebsiteSpec. Never invent credentials, domains, prices, integrations, or legal claims.' },
          { role: 'user', content: JSON.stringify({ prompt, context }) }
        ]
      }),
      cache: 'no-store'
    });
    if (!response.ok) {
      const error = await response.text();
      return { providerKey: 'configured-provider', status: 'failed', error: 'AI provider returned HTTP ' + response.status + ': ' + error.slice(0,500), spec: normalizeLocalWebsiteSpec(prompt, context) };
    }
    const json = await response.json();
    const candidate = extractJson(json?.output_text ?? json?.choices?.[0]?.message?.content ?? json?.output ?? json) as WebsiteSpec | null;
    if (!candidate?.pages?.length) return { providerKey: 'configured-provider', status: 'failed', error: 'AI provider returned no usable website specification.', spec: normalizeLocalWebsiteSpec(prompt, context) };
    return { providerKey: 'configured-provider', status: 'available', spec: candidate, raw: json, model: process.env.BIZSTACK_AI_MODEL || 'default' };
  } catch (error) {
    return { providerKey: 'configured-provider', status: 'failed', error: error instanceof Error ? error.message : 'AI provider request failed.', spec: normalizeLocalWebsiteSpec(prompt, context) };
  }
}