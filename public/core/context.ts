// Surroundings for the 3D view: GUGiK orthophoto under the parcel and neighbouring building footprints
// (OpenStreetMap via VersaTiles vector tiles). Derived, never saved in the project; heights are estimates and labelled.
import { geographicPoint, projectPoint } from './geospatial.ts';
import { pointLocation, validRing, type Point } from './geometry.ts';
import type { Scene } from './scene.ts';

export interface ContextBuilding { ring: Point[]; height: number; heightSource: 'tag' | 'levels' | 'default'; kind: string; onParcel: boolean }
export interface SceneContext {
  center: Point; half: number;
  ortho: string;
  buildings: ContextBuilding[];
  retrievedAt: string;
  /** Fence lines on neighbouring parcels' boundaries, filled in after the ULDK lookups. */
  fences?: [Point, Point][];
}

const MARGIN = 70, MAX_HALF = 260, METRES_PER_LEVEL = 3, DEFAULT_LEVELS = 2;

export function contextBounds(scene: Scene) {
  const xs = scene.plot.map(p => p.x), ys = scene.plot.map(p => p.y);
  const center = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  const half = Math.min(MAX_HALF, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + MARGIN);
  return { center, half };
}

/** GUGiK orthophoto (WMS, EPSG:2180, easting/northing order) covering the context square. */
export function orthoUrl(origin: Point, center: Point, half: number, size = 1024) {
  const e = origin.x + center.x, n = origin.y - center.y;
  const url = new URL('https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolution');
  url.search = new URLSearchParams({ SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetMap', FORMAT: 'image/jpeg', LAYERS: 'Raster', STYLES: '', SRS: 'EPSG:2180', WIDTH: String(size), HEIGHT: String(size), BBOX: [e - half, n - half, e + half, n + half].map(v => v.toFixed(2)).join(',') }).toString();
  return url.toString();
}

export function estimateHeight(tags: Record<string, string>): { height: number; heightSource: ContextBuilding['heightSource'] } {
  const metres = parseFloat(tags.height ?? '');
  if (Number.isFinite(metres) && metres > 1 && metres < 200) return { height: metres, heightSource: 'tag' };
  const levels = parseFloat(tags['building:levels'] ?? '');
  const roofLevels = parseFloat(tags['roof:levels'] ?? '');
  if (Number.isFinite(levels) && levels >= 1 && levels < 60) return { height: (levels + (Number.isFinite(roofLevels) ? roofLevels * 0.6 : 0)) * METRES_PER_LEVEL + 0.5, heightSource: 'levels' };
  return { height: DEFAULT_LEVELS * METRES_PER_LEVEL + 0.5, heightSource: 'default' };
}

// OSM building footprints from VersaTiles (Shortbread schema: complete at z14, CDN with CORS, no height attributes).
export const TILE_ZOOM = 14;
const TILE_URL = 'https://tiles.versatiles.org/tiles/osm';
export const tileOf = (lon: number, lat: number) => {
  const n = 2 ** TILE_ZOOM, r = lat * Math.PI / 180;
  return { x: Math.floor((lon + 180) / 360 * n), y: Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n) };
};
export const tileLonLat = (x: number, y: number): [number, number] => {
  const n = 2 ** TILE_ZOOM;
  return [x / n * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI];
};

/** Decode one z14 tile into local footprints inside the context square. */
export async function buildingsFromTile(buffer: Uint8Array, x: number, y: number, scene: Scene, center: Point, half: number): Promise<ContextBuilding[]> {
  const origin = scene.coordinates.projected?.origin;
  if (!origin) throw new Error('Parcel is not georeferenced');
  const [{ VectorTile }, { PbfReader }] = await Promise.all([import('@mapbox/vector-tile'), import('pbf')]);
  const layer = new VectorTile(new PbfReader(buffer)).layers.buildings;
  if (!layer) return [];
  const out: ContextBuilding[] = [];
  for (let i = 0; i < layer.length && out.length < 800; i++) { // ponytail: cap keeps dense city blocks responsive
    const feature = layer.feature(i);
    if (feature.type !== 3) continue;
    const [outer] = feature.loadGeometry();
    if (!outer || outer.length < 4) continue;
    let ring = outer.map(p => { const [e, n] = projectPoint(tileLonLat(x + p.x / layer.extent, y + p.y / layer.extent)); return { x: e - origin.x, y: origin.y - n }; });
    if (Math.abs(ring[0].x - ring.at(-1)!.x) < 1e-6 && Math.abs(ring[0].y - ring.at(-1)!.y) < 1e-6) ring = ring.slice(0, -1);
    if (ring.length < 3 || ring.length > 400 || !validRing(ring)) continue;
    const c = ring.reduce((s, p) => ({ x: s.x + p.x / ring.length, y: s.y + p.y / ring.length }), { x: 0, y: 0 });
    if (Math.abs(c.x - center.x) > half || Math.abs(c.y - center.y) > half) continue;
    out.push({ ring, kind: 'building', onParcel: pointLocation(c, scene.plot) !== 'outside', ...estimateHeight({}) });
  }
  return out;
}

const ROAD_KINDS = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'track', 'busway']);
/** Decode road centre lines (not footpaths or private driveways) from one tile into local coordinates. */
export async function streetsFromTile(buffer: Uint8Array, x: number, y: number, scene: Scene): Promise<Point[][]> {
  const origin = scene.coordinates.projected?.origin;
  if (!origin) throw new Error('Parcel is not georeferenced');
  const [{ VectorTile }, { PbfReader }] = await Promise.all([import('@mapbox/vector-tile'), import('pbf')]);
  const layer = new VectorTile(new PbfReader(buffer)).layers.streets;
  if (!layer) return [];
  const out: Point[][] = [];
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i), kind = String(f.properties.kind ?? '');
    if (f.type !== 2 || !ROAD_KINDS.has(kind) || f.properties.service === 'driveway' || f.properties.tunnel === true) continue;
    for (const line of f.loadGeometry()) out.push(line.map(p => { const [e, n] = projectPoint(tileLonLat(x + p.x / layer.extent, y + p.y / layer.extent)); return { x: e - origin.x, y: origin.y - n }; }));
  }
  return out;
}
const segmentDistance = (p: Point, a: Point, b: Point) => { const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
/** Parcel edge facing a road: the edge whose midpoint is closest to a road centre line (within 35 m), weighted by edge length. */
export function streetEdge(plot: Point[], streets: Point[][]): number | null {
  let best: number | null = null, bestScore = Infinity;
  plot.forEach((a, i) => {
    const b = plot[(i + 1) % plot.length], length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 3) return;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    let d = Infinity;
    for (const line of streets) for (let j = 1; j < line.length; j++) d = Math.min(d, segmentDistance(mid, line[j - 1], line[j]));
    const score = d - Math.min(length, 30) * .1; // prefer the long frontage when two edges are equally close
    if (d <= 35 && score < bestScore) { best = i; bestScore = score; }
  });
  return best;
}
/** Streets around the parcel from the same tiles as the buildings. */
export async function loadStreets(scene: Scene, fetcher: typeof fetch = fetch): Promise<Point[][]> {
  const origin = scene.coordinates.projected?.origin;
  if (!origin) return [];
  const { center, half } = contextBounds(scene);
  const [w, s] = geographicPoint([origin.x + center.x - half, origin.y - center.y - half]), [e, n] = geographicPoint([origin.x + center.x + half, origin.y - center.y + half]);
  const a = tileOf(w, n), b = tileOf(e, s), parts: Promise<Point[][]>[] = [];
  for (let x = a.x; x <= b.x; x++) for (let y = a.y; y <= b.y; y++) parts.push(fetcher(`${TILE_URL}/${TILE_ZOOM}/${x}/${y}`, { signal: AbortSignal.timeout(20000), credentials: 'omit' }).then(async r => r.ok ? streetsFromTile(new Uint8Array(await r.arrayBuffer()), x, y, scene) : []));
  return (await Promise.all(parts.slice(0, 9))).flat();
}

/** Orthophoto frame only: available instantly, before building tiles arrive. */
export function contextFrame(scene: Scene): SceneContext {
  const origin = scene.coordinates.projected?.origin;
  if (!origin) throw new Error('Parcel is not georeferenced');
  const { center, half } = contextBounds(scene);
  return { center, half, ortho: orthoUrl(origin, center, half), buildings: [], retrievedAt: new Date().toISOString() };
}

export async function loadContext(scene: Scene, fetcher: typeof fetch = fetch): Promise<SceneContext> {
  const frame = contextFrame(scene), origin = scene.coordinates.projected!.origin, { center, half } = frame;
  const [w, s] = geographicPoint([origin.x + center.x - half, origin.y - center.y - half]);
  const [e, n] = geographicPoint([origin.x + center.x + half, origin.y - center.y + half]);
  const a = tileOf(w, n), b = tileOf(e, s), tiles: { x: number; y: number }[] = [];
  for (let x = a.x; x <= b.x; x++) for (let y = a.y; y <= b.y; y++) tiles.push({ x, y });
  if (tiles.length > 9) throw new Error('Context area too large');
  const parts = await Promise.all(tiles.map(async t => {
    const r = await fetcher(`${TILE_URL}/${TILE_ZOOM}/${t.x}/${t.y}`, { signal: AbortSignal.timeout(20000), credentials: 'omit' });
    if (r.status === 204 || r.status === 404) return [];
    if (!r.ok) throw new Error('Building tiles unavailable');
    const buffer = new Uint8Array(await r.arrayBuffer());
    if (buffer.length > 4_000_000) throw new Error('Tile too large');
    return buildingsFromTile(buffer, t.x, t.y, scene, center, half);
  }));
  return { ...frame, buildings: parts.flat() };
}

/** Parcels touching ours, found by asking ULDK for the parcel 2.5 m outside the middle of each edge (one request at a time). */
export async function loadNeighbourParcels(scene: Scene, fetcher: typeof fetch = fetch, gap = 150): Promise<Point[][]> {
  const origin = scene.coordinates.projected?.origin;
  if (!origin || !validRing(scene.plot)) return [];
  const { lookupParcelAt } = await import('./uldk.ts');
  const own = scene.parcel?.identifier, seen = new Set<string>(own ? [own] : []), rings: Point[][] = [];
  const probes = scene.plot.flatMap((a, i) => {
    const b = scene.plot[(i + 1) % scene.plot.length], len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 2) return [];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, n = { x: (b.y - a.y) / len, y: -(b.x - a.x) / len };
    const out = (s: number) => ({ x: mid.x + n.x * s, y: mid.y + n.y * s });
    return [pointLocation(out(2.5), scene.plot) === 'outside' ? out(2.5) : out(-2.5)];
  }).slice(0, 12); // ponytail: one probe per edge finds the adjacent parcels, not the whole block
  for (const p of probes) {
    try {
      const [lon, lat] = geographicPoint([origin.x + p.x, origin.y - p.y]);
      const found = await lookupParcelAt(lon, lat, fetcher), id = found.parcel.identifier ?? '';
      if (seen.has(id)) continue;
      seen.add(id);
      const o = found.coordinates.projected!.origin, dx = o.x - origin.x, dy = origin.y - o.y;
      for (const [outer] of [[found.plot], ...found.plotParts ?? []]) rings.push(outer.map(q => ({ x: q.x + dx, y: q.y + dy })));
    } catch { /* roads and unregistered land have no parcel here */ }
    if (gap) await new Promise(r => setTimeout(r, gap));
  }
  return rings;
}

/** Fence lines along neighbouring parcels, minus lines already fenced by our own boundary or by another neighbour. */
export function neighbourFenceSegments(plot: Point[], rings: Point[][], tolerance = 0.5): [Point, Point][] {
  const taken: [Point, Point][] = plot.map((a, i) => [a, plot[(i + 1) % plot.length]]), out: [Point, Point][] = [];
  const near = (p: Point) => taken.some(([a, b]) => segmentDistance(p, a, b) < tolerance);
  for (const ring of rings) ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length];
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.5 || near({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })) return;
    out.push([a, b]); taken.push([a, b]);
  });
  return out;
}
