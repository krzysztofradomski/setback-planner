// Local plan (MPZP) documents without a search engine: every plan is published in its province's official journal,
// which has a public search and full-text API. Shared by the worker (fetch + AI) and tests.
import { geographicPoint, projectPoint } from './geospatial.ts';
import { TILE_ZOOM, tileOf, tileLonLat } from './context.ts';

/** Official journal per province (first two TERYT digits). */
// ponytail: Masovia only; other provinces run different journal software, add their search adapters when needed
export const journals: Record<string, string> = { '14': 'https://edziennik.mazowieckie.pl' };

export interface PlanCandidate { oid: number; year: number; position: number; title: string; url: string; pdf: string }
export interface Street { name: string; distance: number; side: string }

const plain = (html: string) => html.replace(/<\/p>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|\u00a0/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/[ \t\r]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();

/** Plan resolutions for a place, newest first. A town that shares its gmina's name keeps only "miasta X" plans, so the
 *  gmina's village plans ("gminy X dla wsi Y") do not crowd out the town's own. */
export async function searchPlans(base: string, city: string, commune: string, fetcher: typeof fetch = fetch): Promise<PlanCandidate[]> {
  const found = new Map<number, PlanCandidate>(), place = city || commune, kinds = city && city === commune ? 'miasta' : 'miasta|gminy|gm\\.|wsi|obrębu|dla';
  for (const query of [`zagospodarowania przestrzennego ${place}`, place]) {
    const r = await fetcher(`${base}/api/SearchLegalAct`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ Title: query, PageNumber: 1, ResultCount: 200, SortColumnName: 'ActDate', SortAscending: false }), signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error('Journal search unavailable');
    const j = await r.json() as { LegalActs?: { Oid: number; Year: number; Position: number; Title?: string; Subject?: string; PdfUrl?: string }[] };
    for (const a of j.LegalActs ?? []) {
      const title = String(a.Title || a.Subject || '').replace(/\s+/g, ' ').trim();
      // The title search is a substring match; keep only plans of this town or gmina (another gmina may have an area called the same).
      const ours = new RegExp(`(?<![\\p{L}])(${kinds}|m\\.)\\s*(?:części\\s+)?${place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu').test(title);
      if (ours && /zagospodarowania przestrzennego/i.test(title) && Number.isInteger(a.Oid)) found.set(a.Oid, { oid: a.Oid, year: a.Year, position: a.Position, title: title.slice(0, 400), url: `${base}/legalact/${a.Year}/${a.Position}/`, pdf: /^GetActPdf\.ashx\?[\w=&]+$/.test(a.PdfUrl ?? '') ? `${base}/${a.PdfUrl}` : `${base}/GetActPdf.ashx?year=${a.Year}&book=0&position=${a.Position}` });
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

/** Scanned plan pages as JPEG images (for OCR); `pages` are 1-based page numbers, missing ones are skipped. */
export async function pdfPages(data: ArrayBuffer, pages: number[], width = 1400): Promise<Blob[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  // Copy: pdf.js takes over the buffer. No font-face loading or browser image decoder: both stall in background tabs.
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)), disableFontFace: true, isImageDecoderSupported: false, isOffscreenCanvasSupported: false }).promise, out: Blob[] = [];
  for (const n of pages) {
    if (n > doc.numPages) break;
    const page = await doc.getPage(n), base = page.getViewport({ scale: 1 }), viewport = page.getViewport({ scale: width / base.width });
    const canvas = document.createElement('canvas'); canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport, intent: 'print' }).promise;
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.82));
    if (blob) out.push(blob);
  }
  await doc.destroy();
  return out;
}
/** True when converted PDF text is too thin to be the act itself (a scan without a text layer). */
export const looksScanned = (text: string, bytes: number) => (text.match(/\p{L}/gu)?.length ?? 0) < Math.max(1500, bytes / 2000);

/** Older journals publish a whole issue as one PDF. From the OCR of its first two pages (table of contents and the page
 *  header "– 20126 –" on page 2) find the PDF pages of the act at `position`; null for a single-act PDF. */
export function actPages(firstPages: string, position: number): { start: number; end: number } | null {
  const entry = (pos: number) => firstPages.match(new RegExp(`(?:^|\\n)\\s*${pos}\\s*[–-][^\\n]*?\\.{3,}\\s*(\\d{4,6})`))?.[1];
  const page2 = firstPages.split(/\n/).find(l => /Nr \d+\s*[–-]\s*\d{4,6}\s*[–-]/.test(l))?.match(/[–-]\s*(\d{4,6})\s*[–-]/)?.[1];
  const start = Number(entry(position)), next = Number(entry(position + 1));
  if (!start || !page2) return null;
  const toPdf = (journalPage: number) => journalPage - Number(page2) + 2;
  return { start: toPdf(start), end: next > start ? toPdf(next) - 1 : toPdf(start) + 30 };
}

/** Zone symbols (e.g. "21MN", "KDZ") from OCR of the plan drawing around the parcel. */
export const planSymbols = (ocr: string) => [...new Set([...ocr.toUpperCase().matchAll(/(?<![A-Z0-9])(\d{0,3})\s?([A-Z]{1,4}(?:-[A-Z]{1,3})?)(?![A-Z0-9])/g)]
  .filter(m => /^(MN|MW|MNU|U|UP|ZP|ZL|R|KD[A-Z]?|KDW|KS|P|PU|ZE|WS|E|K|W|G|IT|UK|US|UO|UZ|MU|RM|ZN|ZD)(-[A-Z]{1,3})?$/.test(m[2])).filter(m => m[1] || m[2].length > 1).map(m => m[1] + m[2]))].slice(0, 20);
/** How many of the drawing's symbols the plan text defines ("21MN" also counts inside a list "1MN, … 21MN"). */
export const symbolHits = (text: string, symbols: string[]) => symbols.filter(s => new RegExp(`(?<![\\p{L}\\d])${s.replace(/^(\d+)/, '$1\\s?')}(?![\\p{L}\\d])`, 'u').test(text)).length;
