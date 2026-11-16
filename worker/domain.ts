import { z } from 'zod';
export const rulesSchema = z.object({
    agreement: z.string().max(300).default(''), attributionDays: z.number().int().min(1).max(3650).default(90),
    excludeExisting: z.boolean().default(true), excludeDuplicates: z.boolean().default(true), requirePayment: z.boolean().default(true),
    campaign: z.string().max(150).default(''), mode: z.enum(['fixed', 'basis_points']).default('fixed'),
    value: z.number().int().min(0).max(100000000).default(0), currency: z.enum(['PLN', 'EUR', 'USD']).default('PLN'),
}).strict().refine(r => r.mode !== 'basis_points' || r.value <= 10000, 'Basis points must be <=10000');
export type Rules = z.infer<typeof rulesSchema>;
export const evidenceSchema = z.object({ contractRef: z.string().max(300).default(''), contractCents: z.number().int().min(0).max(10000000000).default(0), paymentRef: z.string().max(300).default(''), settlementRef: z.string().max(300).default(''), dispute: z.boolean().default(false), resolution: z.string().max(1000).default('') }).strict();
export type Evidence = z.infer<typeof evidenceSchema>;
export const statuses = ['new', 'qualified', 'accepted', 'rejected', 'contracted', 'paid', 'commission_eligible', 'commission_settled', 'cancelled', 'reversed'] as const;
const transitions: Record<string, readonly string[]> = { new: ['qualified', 'rejected'], qualified: ['accepted', 'rejected'], accepted: ['contracted', 'rejected'], contracted: ['paid', 'commission_eligible', 'cancelled'], paid: ['commission_eligible', 'cancelled'], commission_eligible: ['commission_settled', 'reversed'], commission_settled: ['reversed'], rejected: ['qualified'], cancelled: ['qualified'], reversed: ['qualified'] };
export function transition(lead: {
    status: string;
    duplicate: number;
    existing_customer: number;
    created: number;
    attributed: number;
    attribution: string;
}, next: string, e: Evidence, r: Rules) {
    if (!transitions[lead.status]?.includes(next))
        throw new Error('Invalid status transition');
    if (['contracted', 'paid', 'commission_eligible', 'commission_settled'].includes(next) && (!e.contractRef || !e.contractCents))
        throw new Error('Confirmed contract reference and value required');
    if (next === 'paid' && !e.paymentRef)
        throw new Error('First payment confirmation required');
    if (['cancelled', 'reversed'].includes(next) && !e.resolution.trim())
        throw new Error('Cancellation/reversal explanation required');
    if (next === 'commission_eligible' || next === 'commission_settled') {
        const attribution = JSON.parse(lead.attribution) as {
            campaign?: string;
        };
        if (!r.agreement || !r.value || (r.requirePayment && !e.paymentRef) || (r.excludeExisting && lead.existing_customer) || (r.excludeDuplicates && lead.duplicate) || (e.dispute && !e.resolution.trim()) || (r.campaign && r.campaign !== attribution.campaign) || lead.created - lead.attributed > r.attributionDays * 86400000)
            throw new Error('Commission agreement or attribution eligibility not satisfied');
        if (next === 'commission_settled' && !e.settlementRef)
            throw new Error('Settlement confirmation required');
        return r.mode === 'fixed' ? r.value : Number((BigInt(e.contractCents) * BigInt(r.value) + 5000n) / 10000n);
    }
    return 0;
}
export function csvCell(value: unknown) { let s = String(value ?? ''); if (/^[\s]*[=+@\-\t\r]/.test(s))
    s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; }
export const extractionSchema = z.object({ claims: z.array(z.object({ parameter: z.string().min(1).max(120), value: z.string().min(1).max(500), quote: z.string().min(5).max(1500), uncertain: z.literal(true) }).strict()).max(20), unknowns: z.array(z.string().max(300)).max(20) }).strict();
export function validateExtraction(value: unknown, text: string) {
    const result = extractionSchema.parse(value);
    for (const claim of result.claims)
        if (!text.includes(claim.quote) || !claim.quote.includes(claim.value))
            throw new Error('Unverifiable AI citation');
    return result;
}
