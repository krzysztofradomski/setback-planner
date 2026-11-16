// Deterministic geometry from an AI-interpreted house brief. The model only reads words; sizes are computed here.
export interface HouseAnswer { storeys: number | null; floorArea: number | null; width: number | null; depth: number | null; roof: 'gable' | 'hip' | 'flat' | 'shed' | null; pitch: number | null; garage: 'none' | 'attached' | 'carport' | null; cars: number | null; summary: string }
export interface BriefPlan { w: number; d: number; storeys: number; height: number; roof: 'gable' | 'hip' | 'flat' | 'shed'; pitch: number; garage: { kind: 'attached' | 'carport'; w: number; d: number } | null; estimated: ('size' | 'roof' | 'storeys')[]; match: string | null }
const GROSS_FACTOR = 1.2, ASPECT = 1.45; // ponytail: usable→gross and length:depth rules of thumb, labelled as estimates in the UI
const round = (n: number) => Math.round(n * 10) / 10, clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
export function planFromBrief(a: HouseAnswer, catalog: { id: string; width: number; depth: number }[] = []): BriefPlan {
  const estimated: BriefPlan['estimated'] = [];
  const storeys = a.storeys ?? (estimated.push('storeys'), 1);
  let w = a.width, d = a.depth;
  if (!w || !d) {
    estimated.push('size');
    const footprint = a.floorArea ? a.floorArea * GROSS_FACTOR / storeys : 120;
    w = Math.sqrt(footprint * ASPECT); d = footprint / w;
  }
  w = round(clamp(w, 4, 40)); d = round(clamp(d, 4, 40));
  const roof = a.roof ?? (estimated.push('roof'), 'gable');
  const pitch = clamp(a.pitch ?? (roof === 'flat' ? 2 : roof === 'shed' ? 12 : 35), 0, 60);
  const cars = clamp(a.cars ?? 1, 1, 3);
  const garage = a.garage === 'attached' || a.garage === 'carport' ? { kind: a.garage, w: cars === 1 ? 3.5 : cars * 3, d: 6 } : null;
  const area = w * d, best = catalog.map(m => ({ id: m.id, diff: Math.abs(m.width * m.depth - area) / area })).sort((x, y) => x.diff - y.diff)[0];
  return { w, d, storeys, height: storeys === 1 ? 3 : storeys === 2 ? 5.8 : 8.6, roof, pitch, garage, estimated, match: best && best.diff <= .2 && storeys === 1 ? best.id : null };
}
