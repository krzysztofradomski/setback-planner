// Local plan (MPZP) documents without a search engine: every plan is published in its province's official journal,
// which has a public search and full-text API. Shared by the worker (fetch + AI) and tests.
import { geographicPoint, projectPoint } from './geospatial.ts';
import { TILE_ZOOM, tileOf, tileLonLat } from './context.ts';

/** Official journal per province (first two TERYT digits). */
// ponytail: Masovia only; other provinces run different journal software, add their search adapters when needed
export const journals: Record<string, string> = { '14': 'https://edziennik.mazowieckie.pl' };

export interface PlanCandidate { oid: number; year: number; position: number; title: string; url: string }
export interface Street { name: string; distance: number; side: string }

const plain = (html: string) => html.replace(/<\/p>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|\u00a0/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/[ \t\r]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();

/** Plan resolutions whose title names any of `places`, newest first. */
export async function searchPlans(base: string, places: string[], fetcher: typeof fetch = fetch): Promise<PlanCandidate[]> {
  const found = new Map<number, PlanCandidate>();
  for (const place of [...new Set(places)].slice(0, 3)) {
    const r = await fetcher(`${base}/api/SearchLegalAct`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ Title: `zagospodarowania przestrzennego ${place}`, PageNumber: 1, ResultCount: 60, SortColumnName: 'ActDate', SortAscending: false }), signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('Journal search unavailable');
    const j = await r.json() as { LegalActs?: { Oid: number; Year: number; Position: number; Title?: string; Subject?: string }[] };
    for (const a of j.LegalActs ?? []) {
      const title = String(a.Title || a.Subject || '').replace(/\s+/g, ' ').trim();
      // The title search is a substring match; keep only plans of this town or gmina (another gmina may have an area called the same).
      const ours = new RegExp(`(miasta|gminy|gm\\.|wsi|obrębu)\\s+${place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu').test(title);
      if (ours && /zagospodarowania przestrzennego/i.test(title) && Number.isInteger(a.Oid)) found.set(a.Oid, { oid: a.Oid, year: a.Year, position: a.Position, title: title.slice(0, 400), url: `${base}/legalact/${a.Year}/${a.Position}/` });
    }
  }
  return [...found.values()].sort((a, b) => b.year - a.year || b.position - a.position);
}

/** Full text of one act; null when the journal only has a scanned PDF. */
export async function actText(base: string, oid: number, fetcher: typeof fetch = fetch): Promise<string | null> {
  const r = await fetcher(`${base}/api/LegalActHtml/${oid}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) return null;
  const body = await r.text();
  if (body.length > 3_000_000) return null;
  try { const j = JSON.parse(body) as { IsSuccess?: boolean; Content?: string }; return j.IsSuccess && j.Content ? plain(j.Content) : null; } catch { return null; }
}

/** The sentence that says which area the plan covers. */
export function planScope(text: string) {
  const i = text.search(/Uchwala się|uchwala się|Plan obejmuje|Przedmiotem planu/);
  return i < 0 ? text.slice(0, 400) : text.slice(i, i + 600);
}

/** Paragraphs that carry building rules (distances, lines, heights, coverage, roofs, garages), up to `limit` characters. */
export function ruleExcerpt(text: string, limit = 16000) {
  const keep = /(?:od|przy|do|z) granic|granic[yę] działk|lini[aiy]? zabudowy|garaż|gospodarcz|wysokoś|powierzchni[aę]? zabudowy|biologicznie czynn|intensywnoś|dach|połaci|kondygnac|szerokoś[cć] elewacji|odległoś|MN\b|ogrodze/i;
  let out = '';
  for (const p of text.split('\n')) if (keep.test(p) && out.length + p.length < limit) out += p + '\n';
  return out;
}

const sides = ['północ', 'północny wschód', 'wschód', 'południowy wschód', 'południe', 'południowy zachód', 'zachód', 'północny zachód'];
/** Named streets within `radius` metres of an EPSG:2180 point, with the side of the point they lie on. */
export function streetsNear(lines: { name: string; points: [number, number][] }[], e: number, n: number, radius = 200): Street[] {
  const best = new Map<string, Street>();
  for (const { name, points } of lines) for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i], dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((e - ax) * dx + (n - ay) * dy) / len2)), px = ax + t * dx - e, py = ay + t * dy - n, d = Math.hypot(px, py);
    if (d > radius || (best.get(name)?.distance ?? Infinity) <= d) continue;
    const bearing = (Math.atan2(px, py) * 180 / Math.PI + 360) % 360; // 0 = north, EPSG:2180 northing is up
    best.set(name, { name, distance: Math.round(d), side: sides[Math.round(bearing / 45) % 8] });
  }
  return [...best.values()].sort((a, b) => a.distance - b.distance).slice(0, 8);
}

/** Street label lines from the OpenStreetMap tile around a point, in EPSG:2180. */
export async function streetLines(e: number, n: number, fetcher: typeof fetch = fetch) {
  const [lon, lat] = geographicPoint([e, n]), { x, y } = tileOf(lon, lat);
  const r = await fetcher(`https://tiles.versatiles.org/tiles/osm/${TILE_ZOOM}/${x}/${y}`, { signal: AbortSignal.timeout(15000), credentials: 'omit' });
  if (!r.ok) return [];
  const [{ VectorTile }, { PbfReader }] = await Promise.all([import('@mapbox/vector-tile'), import('pbf')]);
  const layer = new VectorTile(new PbfReader(new Uint8Array(await r.arrayBuffer()))).layers.street_labels;
  const out: { name: string; points: [number, number][] }[] = [];
  for (let i = 0; layer && i < layer.length; i++) {
    const f = layer.feature(i), name = String(f.properties.name ?? '');
    if (!name || f.type !== 2) continue;
    for (const line of f.loadGeometry()) out.push({ name, points: line.map(p => projectPoint(tileLonLat(x + p.x / layer.extent, y + p.y / layer.extent))) });
  }
  return out;
}
