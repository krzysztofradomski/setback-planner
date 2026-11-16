// One-click garden layout around the main house. Deterministic: every object is checked against the parcel and
// existing objects; anything that does not fit is skipped rather than forced.
import { itemSchema, type Scene, type SceneItem } from './scene.ts';
import { worldFootprint } from './footprints.ts';
import { parcelContains } from './topology.ts';
import { polygonRelation, type Point } from './geometry.ts';
import { objectLibrary } from './objects.ts';

type Kind = keyof typeof objectLibrary;
export type GardenStyle = 'family' | 'modern' | 'natural';
type Zone = 'back-left' | 'back-right' | 'back' | 'side' | 'front';
const STYLES: Record<GardenStyle, [Kind, Zone][]> = {
  family: [['vegetables', 'back-left'], ['shed', 'back-left'], ['swing', 'back-right'], ['sandbox', 'back-right'], ['tree', 'back'], ['tree', 'side'], ['flowers', 'front'], ['shrub', 'front']],
  modern: [['hot-tub', 'back-right'], ['seating', 'back-left'], ['evergreen', 'back'], ['evergreen', 'side'], ['shrub', 'front'], ['shrub', 'front'], ['light', 'front']],
  natural: [['tree', 'back-left'], ['tree', 'back-right'], ['tree', 'back'], ['raised-bed', 'back-left'], ['woodshed', 'back-right'], ['flowers', 'front'], ['shrub', 'side'], ['shrub', 'side']],
};

/** Distance from p along unit dir to the parcel boundary (Infinity if it never leaves). */
export function rayToBoundary(p: Point, dir: Point, ring: Point[]) {
  let best = Infinity;
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length], ex = b.x - a.x, ey = b.y - a.y, den = dir.x * ey - dir.y * ex;
    if (Math.abs(den) < 1e-9) return;
    const t = ((a.x - p.x) * ey - (a.y - p.y) * ex) / den, u = ((a.x - p.x) * dir.y - (a.y - p.y) * dir.x) / den;
    if (t > 1e-6 && u >= 0 && u <= 1) best = Math.min(best, t);
  });
  return best;
}

export function designGarden(scene: Scene, style: GardenStyle, nextId: () => string, name: (kind: Kind) => string) {
  const house = scene.items.filter(i => i.type === 'house' && i.visible).sort((a, b) => b.w * b.d - a.w * a.d)[0];
  if (!house) throw new Error('Add a house first');
  const r = house.rot * Math.PI / 180, right = { x: Math.cos(r), y: Math.sin(r) }, front = { x: -Math.sin(r), y: Math.cos(r) };
  const at = (lx: number, ly: number) => ({ x: house.x + lx * right.x + ly * front.x, y: house.y + lx * right.y + ly * front.y });
  const placed: SceneItem[] = [];
  const fits = (item: SceneItem, margin: boolean) => {
    const ring = worldFootprint(item);
    if (!parcelContains(scene, ring)) return false;
    if (margin && !parcelContains(scene, worldFootprint({ ...item, w: item.w + 1, d: item.d + 1 }))) return false; // 0.5 m from the boundary
    return [...scene.items, ...placed].every(o => polygonRelation(ring, worldFootprint(o)) === 'disjoint');
  };
  const make = (kind: Kind, p: Point, w: number = objectLibrary[kind].w, d: number = objectLibrary[kind].d, rot = house.rot) =>
    itemSchema.parse({ id: nextId(), type: 'landscape', kind, name: name(kind), x: p.x, y: p.y, w, d, rot, setback: 0, architecture: { storeys: 1, height: objectLibrary[kind].height, roof: 'flat', pitch: 0 } });
  const tryAdd = (item: SceneItem, margin = true) => { if (fits(item, margin)) { placed.push(item); return true; } return false; };

  // Terrace behind the house.
  tryAdd(make('terrace', at(0, -(house.d / 2 + 1.85)), Math.min(Math.max(house.w * .6, 4), 8), 3.5));
  // Path from the front door (catalogue door if known) to the boundary.
  const door = house.openings.find(o => o.type === 'door' && o.edge === 2);
  const doorX = door ? house.w / 2 - (door.offset + door.width / 2) : 0, start = at(doorX, house.d / 2 + .05);
  const pathLength = Math.min(rayToBoundary(start, front, scene.plot) - .05, 30);
  if (Number.isFinite(pathLength) && pathLength > 1) tryAdd(make('path', at(doorX, house.d / 2 + .05 + pathLength / 2), 1.4, pathLength), false);
  // Driveway in front of each garage, and of the house's own carport.
  for (const garage of scene.items.filter(i => i.type === 'garage' || (i.kind === 'pergola' && !!i.group && i.group === house.group))) {
    const gr = garage.rot * Math.PI / 180, gFront = { x: -Math.sin(gr), y: Math.cos(gr) }, gStart = { x: garage.x + gFront.x * (garage.d / 2 + .05), y: garage.y + gFront.y * (garage.d / 2 + .05) };
    const length = Math.min(rayToBoundary(gStart, gFront, scene.plot) - .05, 30);
    if (Number.isFinite(length) && length > 1) tryAdd(make('driveway', { x: gStart.x + gFront.x * length / 2, y: gStart.y + gFront.y * length / 2 }, Math.max(3, garage.w), length, garage.rot), false);
  }
  // Style objects: greedy search over a 1 m grid, preferring the requested zone.
  const xs = scene.plot.map(p => p.x), ys = scene.plot.map(p => p.y), candidates: Point[] = [];
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 1) for (let y = Math.min(...ys); y <= Math.max(...ys); y += 1) candidates.push({ x, y });
  const score = (p: Point, zone: Zone) => {
    const lx = (p.x - house.x) * right.x + (p.y - house.y) * right.y, ly = (p.x - house.x) * front.x + (p.y - house.y) * front.y;
    const back = -ly - house.d / 2, side = Math.abs(lx) - house.w / 2;
    switch (zone) {
      case 'back-left': return back > 4 ? back - lx * .8 : -Infinity;
      case 'back-right': return back > 4 ? back + lx * .8 : -Infinity;
      case 'back': return back > 6 ? back * 1.5 - Math.abs(lx) * .3 : -Infinity;
      case 'side': return side > 2 && Math.abs(ly) < house.d ? side : -Infinity;
      case 'front': return ly > house.d / 2 + 1 ? -Math.abs(lx - doorX - 2.5) - Math.abs(ly - house.d / 2 - 2) : -Infinity;
    }
  };
  for (const [kind, zone] of STYLES[style]) {
    const ranked = candidates.map(p => ({ p, s: score(p, zone) })).filter(c => c.s > -Infinity).sort((a, b) => b.s - a.s || a.p.x - b.p.x || a.p.y - b.p.y);
    for (const { p } of ranked.slice(0, 400)) if (tryAdd(make(kind, p))) break;
  }
  // Hedge along the boundary, open on the edge the house faces (usually the street).
  const ring = scene.plot, mids = ring.map((a, i) => { const b = ring[(i + 1) % ring.length]; return ((a.x + b.x) / 2 - house.x) * front.x + ((a.y + b.y) / 2 - house.y) * front.y; });
  const street = mids.indexOf(Math.max(...mids)), hedge = [...ring.slice(street + 1), ...ring.slice(0, street + 1)];
  return { items: placed, hedge };
}
