import { z } from 'zod';
// Plan-text extraction schema for the public plan reader (/api/plan-pick).
export const extractionSchema = z.object({ claims: z.array(z.object({ parameter: z.string().min(1).max(120), value: z.string().min(1).max(500), quote: z.string().min(5).max(1500), uncertain: z.literal(true) }).strict()).max(20), unknowns: z.array(z.string().max(300)).max(20) }).strict();
