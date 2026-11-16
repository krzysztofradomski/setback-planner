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
const tileLonLat = (x: number, y: number): [number, number] => {
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
