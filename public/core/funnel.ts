// Anonymous funnel: one count per step per page load, labelled with the campaign the visitor came from.
// Nothing is stored on the device and nothing identifies the visitor.
import { campaignLabel } from './attribution.ts';

export const funnelSteps = ['visit', 'parcel', 'house', 'view3d', 'report', 'share', 'video', 'inquiry'] as const;
export type FunnelStep = typeof funnelSteps[number];
export const funnelSource = (value: unknown) => campaignLabel(value) ?? 'direct';
/** The campaign label marketers set on the link: campaign first, then showroom/event, then source. */
export function sourceOf(a: Partial<Record<string, string>> | null): string {
  return funnelSource(a?.utm_campaign ?? a?.campaign ?? a?.showroom ?? a?.event ?? a?.utm_source);
}
const sent = new Set<FunnelStep>(); // ponytail: per page load; a reload counts again, acceptable for campaign comparison
export function track(step: FunnelStep, attribution: Partial<Record<string, string>> | null) {
  if (sent.has(step)) return;
  sent.add(step);
  void fetch('/api/funnel', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ step, source: sourceOf(attribution) }) }).catch(() => { /* counting is best effort */ });
}
