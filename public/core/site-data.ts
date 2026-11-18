// Public registry data for a located parcel: one WMS map image and one feature query per official layer.
// Shared by the worker (which fetches, avoiding CORS) and the browser/report (which display it).
import { mapSources } from '../map/sources.ts';
import type { Scene } from './scene.ts';
import { geographicPoint, projectPoint } from './geospatial.ts';

export const siteLayerIds = ['cadastre', 'planning', 'utilities', 'environment', 'flood', 'groundwater', 'landslides', 'mining', 'wells'] as const;
export type SiteLayerId = typeof siteLayerIds[number];
export type SiteStatus = 'found' | 'none' | 'unavailable' | 'error';
export interface SiteFeature { layer?: string; attrs: Record<string, string> }
/** `mercator`: the image was requested in EPSG:3857 over this box (services that refuse EPSG:2180) and must be warped onto the frame. */
export interface SiteLayer { status: SiteStatus; features: SiteFeature[]; note?: string; image?: string; mercator?: Box }
type Box = [number, number, number, number];
export interface SiteData {
  retrievedAt: string; bbox: [number, number, number, number]; point: [number, number]; size: number;
  layers: Record<SiteLayerId, SiteLayer>;
  ortho: { image?: string; captures: { date: string; series: string }[] };
  /** Building lines (nieprzekraczalne linie zabudowy) from the local plan, alone on a transparent EPSG:3857 image. */
  planLines?: { image: string; mercator: Box };
  /** Filled in the browser from planLines: building line distance per parcel edge in metres. */
  planSetbacks?: (number | null)[];
  /** Filled in the browser from /api/plan-rules: the plan resolution and its rules quoted verbatim. */
  planRules?: { status: string; note?: string; reason?: string; aiUsed?: boolean; plan?: { title: string; url: string; pdf: string; scope: string; source: string }; extraction?: { claims: { parameter: string; value: string; quote: string }[]; unknowns: string[] } | null; alternatives?: { title: string; url: string }[] };
}
export const SITE_SIZE = 512;
/** INFO_FORMAT each server answers usefully (checked against the live services on 2026-11-17). */
const infoFormat: Record<SiteLayerId, string> = { cadastre: 'text/xml', planning: 'text/html', utilities: 'text/xml', environment: 'application/json', flood: 'application/json', groundwater: 'text/xml', landslides: 'text/xml', mining: 'text/xml', wells: 'text/xml' };

/** The national local-plan integration redirects EPSG:2180 requests; it answers in Web Mercator. */
const mercatorOnly: Partial<Record<SiteLayerId, true>> = { planning: true };
const R = 6378137;
export const toMercator = ([e, n]: [number, number]): [number, number] => { const [lon, lat] = geographicPoint([e, n]); return [R * lon * Math.PI / 180, R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))]; };
export const fromMercator = ([x, y]: [number, number]): [number, number] => projectPoint([x / R * 180 / Math.PI, (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI]);
/** Web Mercator box covering an EPSG:2180 frame (its four corners). */
export function mercatorBox(bbox: Box): Box {
  const c = [[bbox[0], bbox[1]], [bbox[2], bbox[1]], [bbox[0], bbox[3]], [bbox[2], bbox[3]]].map(p => toMercator(p as [number, number]));
  return [Math.min(...c.map(p => p[0])), Math.min(...c.map(p => p[1])), Math.max(...c.map(p => p[0])), Math.max(...c.map(p => p[1]))];
}
/** EPSG:2180 point of a pixel on a size×size image of a Web Mercator box. */
export const mercatorPixel = (box: Box, size: number, u: number, v: number) => fromMercator([box[0] + u / size * (box[2] - box[0]), box[3] - v / size * (box[3] - box[1])]);
/** SVG matrix that lays a Web Mercator image onto the EPSG:2180 frame image (affine; exact enough over a parcel). */
export function mercatorMatrix(data: Pick<SiteData, 'bbox' | 'size'>, box: Box) {
  const S = data.size, at = (u: number, v: number) => sitePixel(data, ...mercatorPixel(box, S, u, v));
  const [o, x, y] = [at(0, 0), at(S, 0), at(0, S)];
  return [(x[0] - o[0]) / S, (x[1] - o[1]) / S, (y[0] - o[0]) / S, (y[1] - o[1]) / S, o[0], o[1]].map(v => +v.toFixed(5)).join(' ');
}

/** Distance from each parcel edge to the plan's building line inside the parcel, in metres (null where the plan draws none).
 *  `points` are building-line pixels in local parcel coordinates; a line parallel to an edge shows up as a peak in the
 *  distances of the pixels nearest that edge. */
export function buildingLineSetbacks(plot: { x: number; y: number }[], points: { x: number; y: number }[], pixel: number, inside: (p: { x: number; y: number }) => boolean): (number | null)[] {
  const edges = plot.map((a, i) => { const b = plot[(i + 1) % plot.length], len = Math.hypot(b.x - a.x, b.y - a.y); return { a, b, len, ux: (b.x - a.x) / len, uy: (b.y - a.y) / len }; });
  const near = edges.map(() => [] as number[]);
  for (const p of points) {
    if (!inside(p)) continue;
    let best = -1, bestD = Infinity;
    edges.forEach((e, i) => { const t = (p.x - e.a.x) * e.ux + (p.y - e.a.y) * e.uy; if (t < 0 || t > e.len) return; const d = Math.abs((p.x - e.a.x) * e.uy - (p.y - e.a.y) * e.ux); if (d < bestD) { bestD = d; best = i; } });
    if (best >= 0 && bestD > 0.3 && bestD < 25) near[best].push(bestD);
  }
  return near.map((ds, i) => {
    // ponytail: 0.25 m histogram; enough samples to cover ~30% of the edge as a line, else no plan line on that side
    const bins = new Map<number, number>();
    for (const d of ds) { const k = Math.round(d * 4); bins.set(k, (bins.get(k) ?? 0) + 1); }
    let peak = -1, count = 0;
    for (const [k, c] of bins) if (c > count) { count = c; peak = k; }
    const window = ds.filter(d => Math.abs(d * 4 - peak) <= 1.5);
    if (peak < 0 || window.length * pixel < edges[i].len * 0.3) return null;
    const mean = window.reduce((a, b) => a + b, 0) / window.length, half = Math.round(mean * 2) / 2;
    return Math.abs(mean - half) <= 0.25 ? half : Math.round(mean * 10) / 10; // plans draw lines at whole or half metres; the stroke shifts the reading
  });
}

export function wmsOf(id: SiteLayerId | 'ortho') {
  const url = new URL(mapSources[id].tiles[0]);
  return { base: url.origin + url.pathname, layers: url.searchParams.get('LAYERS')! };
}

/** Square EPSG:2180 frame around the parcel with a margin, plus a query point inside it; null when the parcel is not located. */
export function siteFrame(scene: Scene) {
  const origin = scene.coordinates.projected?.origin;
  if (!origin || scene.plot.length < 3) return null;
  const pts = scene.plot.map(p => [origin.x + p.x, origin.y - p.y]);
  const es = pts.map(p => p[0]), ns = pts.map(p => p[1]);
  const cx = (Math.min(...es) + Math.max(...es)) / 2, cy = (Math.min(...ns) + Math.max(...ns)) / 2;
  const half = Math.max(Math.max(...es) - Math.min(...es), Math.max(...ns) - Math.min(...ns)) * 0.85 + 20;
  // ponytail: queries the vertex average only; a concave parcel's own shape is still shown on every map image.
  const point: [number, number] = [es.reduce((a, b) => a + b, 0) / es.length, ns.reduce((a, b) => a + b, 0) / ns.length];
  const bbox = [cx - half, cy - half, cx + half, cy + half].map(v => Math.round(v * 10) / 10) as [number, number, number, number];
  return { bbox, point: point.map(v => Math.round(v * 10) / 10) as [number, number], query: `bbox=${bbox.join(',')}&x=${point[0].toFixed(1)}&y=${point[1].toFixed(1)}` };
}

/** Pixel position of an EPSG:2180 point on a SITE_SIZE map image of the frame. */
export function sitePixel(data: Pick<SiteData, 'bbox' | 'size'>, e: number, n: number): [number, number] {
  const [minE, minN, maxE, maxN] = data.bbox;
  return [(e - minE) / (maxE - minE) * data.size, (maxN - n) / (maxN - minN) * data.size];
}

/** Parcel outline as an SVG path on the site map images. */
export function siteParcelPath(scene: Scene, data: Pick<SiteData, 'bbox' | 'size'>) {
  const origin = scene.coordinates.projected?.origin;
  if (!origin) return '';
  return 'M' + scene.plot.map(p => sitePixel(data, origin.x + p.x, origin.y - p.y).map(v => v.toFixed(1)).join(' ')).join(' L') + 'Z';
}

const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
const skipKey = /^(shape|geometry|the_geom|geom|objectid|fid|gid|gml_id|gdb_id|id_pg|id|globalid|kod qr|informacje o pochodzeniu.*|informacje dodatkowe.*|shape[._].*|st_area.*|st_length.*|identifier_codespace|przestrzennazw|wersjaid|lokalnyid|layername|descriptionofarea|waterregion|.+_cl|.+_ipos|gml_location|id_namespace|ifcid)$/i;
function clean(attrs: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, raw] of Object.entries(attrs)) {
    const key = decode(k), value = decode(String(raw ?? ''));
    if (!key || skipKey.test(key) || !value || /^(null|<null>|none|-)$/i.test(value)) continue;
    if (Object.keys(out).length >= 12) break;
    out[key.slice(0, 80)] = value.slice(0, 240);
  }
  return out;
}

/** Normalises the GetFeatureInfo dialects used by the Polish services: GeoServer JSON, ESRI XML/HTML, GeoMedia GML, Oracle ROWSET and plain messages. */
export function parseFeatureInfo(body: string): { features: SiteFeature[]; note?: string; error?: boolean } {
  const text = body.trim(), features: SiteFeature[] = [];
  const push = (attrs: Record<string, string>, layer?: string) => { const a = clean(attrs); if (Object.keys(a).length && features.length < 5) features.push(layer ? { layer: decode(layer).slice(0, 120), attrs: a } : { attrs: a }); };
  if (/ServiceException/i.test(text)) return { features, error: true, note: decode(text.replace(/[\s\S]*<ServiceException[^>]*>([\s\S]*?)<\/ServiceException>[\s\S]*/i, '$1')).slice(0, 200) };
  if (text.startsWith('{')) {
    try {
      const json = JSON.parse(text) as { features?: { id?: string; properties?: Record<string, unknown> }[] };
      for (const f of json.features ?? []) push(Object.fromEntries(Object.entries(f.properties ?? {}).map(([k, v]) => [k, v !== null && typeof v === 'object' ? '' : String(v ?? '')])), f.id?.replace(/\.(fid-|ID_).*$/, ''));
      return { features };
    } catch { return { features, error: true }; }
  }
  // ESRI WMS XML: <FIELDS a="v" .../>
  for (const m of text.matchAll(/<FIELDS\s([^>]*?)\/?>/g)) push(Object.fromEntries([...m[1].matchAll(/([\w.:-]+)="([^"]*)"/g)].map(a => [a[1], a[2]])));
  // GeoMedia GML (GUGiK integration services): <Attribute Name="k">v</Attribute>
  for (const m of text.matchAll(/<gml:featureMember>([\s\S]*?)<\/gml:featureMember>/g)) push(Object.fromEntries([...m[1].matchAll(/<Attribute Name="([^"]*)">([\s\S]*?)<\/Attribute>/g)].map(a => [a[1], a[2]])), m[1].match(/<Layer Name="([^"]*)"/)?.[1]);
  // Oracle ROWSET (some municipalities): <ROW><TAG>v</TAG>…</ROW>
  for (const m of text.matchAll(/<ROW\b[^>]*>([\s\S]*?)<\/ROW>/g)) push(Object.fromEntries([...m[1].matchAll(/<([A-Z_][\w]*)>([\s\S]*?)<\/\1>/g)].map(a => [a[1], a[2]])), text.match(/<ROWSET name="([^"]*)"/)?.[1]);
  // HTML tables (ESRI and other municipal servers): header row of <th>, data rows of <td>, layer in the preceding heading.
  for (const m of text.matchAll(/(?:<h\d[^>]*>([\s\S]*?)<\/h\d>\s*)?<table[\s\S]*?<\/table>/gi)) {
    const rows = [...m[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(r => r[0]);
    const head = rows.map(r => [...r.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(c => c[1])).find(h => h.length);
    if (!head) continue;
    for (const r of rows) { const cells = [...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => c[1]); if (cells.length === head.length) push(Object.fromEntries(head.map((h, i) => [h, cells[i]])), m[1]?.replace(/^.*layer name:\s*/i, '').replace(/'/g, '')); }
  }
  if (features.length || /^<\?xml|<html|<FeatureInfoResponse|<FeatureCollection|<GetFeatureInfo_Result/i.test(text)) return { features };
  if (/no features were found/i.test(text) || !text) return { features };
  return { features, note: decode(text).slice(0, 200) };
}

export function layerStatus(parsed: ReturnType<typeof parseFeatureInfo>): SiteStatus {
  if (parsed.error) return 'error';
  if (parsed.features.length) return 'found';
  return parsed.note && /brak serwisu|nie obsługuje|niedostępn/i.test(parsed.note) ? 'unavailable' : 'none';
}

/** Orthophoto capture dates from the GUGiK ORTO text/plain feature info, newest first. */
export function parseOrthoCaptures(body: string) {
  const text = body.trim();
  if (!text.startsWith('@')) return [];
  // Header "@Layer f1;f2;…;" then records of the same field count, on one line or many.
  const fieldsLine = text.replace(/^@\S+\s+/, ''), all = fieldsLine.split(';').map(f => f.trim());
  const width = all.indexOf('czy_ark_wy') + 1 || all.findIndex(f => /^\d+$/.test(f));
  if (width <= 0) return [];
  const names = all.slice(0, width), date = names.indexOf('aktualnosc'), series = names.indexOf('seria'), project = names.indexOf('projekt');
  if (date < 0) return [];
  const records: string[][] = [];
  for (let i = width; i + width <= all.length; i += width) records.push(all.slice(i, i + width));
  const iso = (d: string) => d.split('.').reverse().join('-');
  return records.filter(c => /^\d{2}\.\d{2}\.\d{4}$/.test(c[date] ?? ''))
    .map(c => ({ date: iso(c[date]), series: (c[series] && c[series] !== 'Null' ? c[series] : c[project] ?? '').slice(0, 60) }))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
}

/** Validated frame of a site-data request. */
export function parseSiteQuery(params: URLSearchParams) {
  const bbox = (params.get('bbox') ?? '').split(',').map(Number), x = Number(params.get('x')), y = Number(params.get('y'));
  const inPoland = (e: number, n: number) => e > 140000 && e < 900000 && n > 100000 && n < 800000;
  if (bbox.length !== 4 || !bbox.every(Number.isFinite) || !inPoland(bbox[0], bbox[1]) || !inPoland(bbox[2], bbox[3])) throw new Error('Invalid frame');
  const w = bbox[2] - bbox[0], h = bbox[3] - bbox[1];
  if (w < 10 || h < 10 || w > 4000 || Math.abs(w - h) > 1 || !(x > bbox[0] && x < bbox[2] && y > bbox[1] && y < bbox[3])) throw new Error('Invalid frame');
  return { bbox: bbox as [number, number, number, number], point: [x, y] as [number, number] };
}

/** Fetches every layer for a frame. Each source fails independently; nothing here throws for a remote outage. */
export async function fetchSiteData(frame: { bbox: SiteData['bbox']; point: SiteData['point'] }, fetcher: typeof fetch = fetch, timeout = 12000): Promise<SiteData> {
  const size = SITE_SIZE, B = frame.bbox.join(','), [px, py] = sitePixel({ bbox: frame.bbox, size }, ...frame.point).map(Math.round);
  const common = (layers: string) => `SERVICE=WMS&VERSION=1.1.1&LAYERS=${layers}&STYLES=&SRS=EPSG:2180&WIDTH=${size}&HEIGHT=${size}&BBOX=${B}`;
  const get = async (url: string) => { const r = await fetcher(url, { signal: AbortSignal.timeout(timeout), headers: { Accept: '*/*' } }); if (!r.ok) throw new Error('HTTP ' + r.status); if (r.url && !new URL(r.url).hostname.endsWith('.gov.pl')) throw new Error('Unexpected redirect'); return r; };
  const image = async (url: string) => {
    const r = await get(url), type = r.headers.get('content-type') ?? '';
    if (!/^image\/(png|jpeg)/.test(type)) throw new Error('Not an image');
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.length > 1_500_000) throw new Error('Image too large');
    let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${type.startsWith('image/png') ? 'image/png' : 'image/jpeg'};base64,${btoa(bin)}`;
  };
  const text = async (url: string) => { const body = await (await get(url)).text(); if (body.length > 3_000_000) throw new Error('Response too large'); return body; };
  const info = (layers: string, format: string, [x, y] = [px, py]) => `&REQUEST=GetFeatureInfo&QUERY_LAYERS=${layers}&X=${x}&Y=${y}&INFO_FORMAT=${encodeURIComponent(format)}&FEATURE_COUNT=5`;
  const merc = mercatorBox(frame.bbox), M = merc.join(','), mp = toMercator(frame.point), mxy: [number, number] = [Math.round((mp[0] - merc[0]) / (merc[2] - merc[0]) * size), Math.round((merc[3] - mp[1]) / (merc[3] - merc[1]) * size)];
  const commonM = (layers: string) => `SERVICE=WMS&VERSION=1.1.1&LAYERS=${layers}&STYLES=&SRS=EPSG:3857&WIDTH=${size}&HEIGHT=${size}&BBOX=${M}`;
  const layers = Object.fromEntries(await Promise.all(siteLayerIds.map(async id => {
    const { base, layers } = wmsOf(id), q = mercatorOnly[id] ? commonM(layers) : common(layers);
    const [img, fi] = await Promise.allSettled([image(`${base}?${q}&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=TRUE`), text(`${base}?${q}${mercatorOnly[id] ? info(layers, infoFormat[id], mxy) : info(layers, infoFormat[id])}`)]);
    const parsed = fi.status === 'fulfilled' ? parseFeatureInfo(fi.value) : { features: [], error: true };
    const layer: SiteLayer = { status: layerStatus(parsed), features: parsed.features };
    if ('note' in parsed && parsed.note) layer.note = parsed.note;
    if (img.status === 'fulfilled') layer.image = img.value;
    if (mercatorOnly[id]) layer.mercator = merc;
    return [id, layer] as const;
  }))) as Record<SiteLayerId, SiteLayer>;
  const planLines = await image(`${wmsOf('planning').base}?${commonM('wektor-lzb')}&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=TRUE`).catch(() => undefined);
  const o = wmsOf('ortho'), oq = common(o.layers);
  const [orthoImage, orthoInfo] = await Promise.allSettled([image(`${o.base}?${oq}&REQUEST=GetMap&FORMAT=image/jpeg`), text(`${o.base}?${oq}${info(o.layers, 'text/plain')}`)]);
  return {
    retrievedAt: new Date().toISOString(), bbox: frame.bbox, point: frame.point, size, layers,
    ortho: { ...(orthoImage.status === 'fulfilled' ? { image: orthoImage.value } : {}), captures: orthoInfo.status === 'fulfilled' ? parseOrthoCaptures(orthoInfo.value) : [] },
    ...(planLines ? { planLines: { image: planLines, mercator: merc } } : {}),
  };
}

/** One-line Polish summary of what a layer reports at the parcel. */
export function siteSummary(id: SiteLayerId, layer: SiteLayer): string {
  if (layer.status === 'unavailable') return 'Gmina lub powiat nie publikuje tej usługi.';
  if (layer.status === 'error') return 'Usługa nie odpowiedziała. Sprawdź na mapie źródłowej.';
  // Some municipal services draw the plan but answer feature queries with nothing; a drawn map still means a plan applies.
  if (id === 'planning' && layer.status === 'none' && (layer.image?.length ?? 0) > 4000) return 'Działka w granicach miejscowego planu (rysunek planu na mapie). Gmina nie udostępnia opisu terenu w usłudze — przeznaczenie i ustalenia odczytaj z rysunku i tekstu planu.';
  if (layer.status === 'none') return ({ flood: 'Punkt działki poza obszarami zagrożenia powodziowego na mapach MZP/MRP.', planning: 'Brak planu miejscowego w punkcie działki. Sprawdź w gminie plan ogólny lub warunki zabudowy.', utilities: 'Powiat nie zwrócił sieci w tym miejscu. Sprawdź mapę zasadniczą w starostwie.' } as Partial<Record<SiteLayerId, string>>)[id] ?? 'Brak obiektów w punkcie działki.';
  const a = layer.features[0].attrs, pick = (re: RegExp) => Object.entries(a).find(([k]) => re.test(k))?.[1];
  if (id === 'cadastre') return [pick(/^numer działki/i) && 'dz. ' + pick(/^numer działki/i), pick(/obrębu/i) && 'obręb ' + pick(/obrębu/i), pick(/^pole/i) && pick(/^pole/i)!.replace('.', ',') + ' ha', pick(/oznaczenie (konturu|użytku)/i) && 'użytki: ' + pick(/oznaczenie (konturu|użytku)/i)].filter(Boolean).join(' · ');
  if (id === 'flood') { const risk = layer.features.map(f => f.attrs.lor_qualitativevalue).find(Boolean); return risk ? `Działka w strefie ryzyka powodziowego (MRP, ISOK): ${risk}.` : 'Działka w obszarze zagrożenia powodziowego (MZP, ISOK).'; }
  const names = [...new Set(layer.features.map(f => Object.entries(f.attrs).filter(([k]) => /symb|oznacz|fun_nazwa|przeznacz|nazwa|name|opis|tytul|rodzaj|typ/i.test(k)).slice(0, 2).map(([, v]) => v).join(' – ')).filter(Boolean))];
  return (names.length ? names.slice(0, 3).join('; ') : Object.values(a).slice(0, 2).join(' – ')).slice(0, 220);
}

// Polish labels for the attribute names and codes the services return (official Polish names are kept as they are).
const keyNames: Record<string, string> = { nazwa: 'Nazwa', kod: 'Kod', kodinspire: 'Kod INSPIRE', hazardcategory: 'Rodzaj zagrożenia', validityperiod_start: 'Obowiązuje od', validityperiod_end: 'Obowiązuje do', lor_qualitativevalue: 'Poziom ryzyka', nazwawarstwy: 'Warstwa', opisobszaru: 'Opis obszaru', regionwodny: 'Region wodny', fun_nazwa: 'Przeznaczenie terenu', fun_symb: 'Symbol terenu', nazwa_plan: 'Plan miejscowy', max_wys: 'Maks. wysokość zabudowy', inten_zab: 'Intensywność zabudowy', www: 'Strona planu', dzielnica: 'Dzielnica', tytul: 'Tytuł', status: 'Status', typ: 'Typ', rodzaj: 'Rodzaj', data: 'Data' };
const layerNames: Record<string, string> = { ParkiNarodowe: 'Park narodowy', Rezerwaty: 'Rezerwat przyrody', ObszarySpecjalnejOchrony: 'Natura 2000 – obszar specjalnej ochrony ptaków', SpecjalneObszaryOchrony: 'Natura 2000 – specjalny obszar ochrony siedlisk', 'NZ.RiskZone': 'Strefa ryzyka powodziowego (MRP)', 'NZ.Fluvial': 'Obszar zagrożenia powodziowego (MZP)', NZ: 'Zagrożenie powodziowe', integracja: 'Ewidencja gruntów i budynków', MPZP_PRZEZNACZENIE_TERENU: 'Przeznaczenie terenu (MPZP)' };
const valueNames: Record<string, string> = { fluvial: 'powódź rzeczna', pluvial: 'powódź opadowa', coastal: 'powódź od strony morza', groundWater: 'wody gruntowe' };
export const siteKeyLabel = (key: string) => keyNames[key.toLowerCase()] ?? key.replace(/_/g, ' ');
export const siteLayerLabel = (layer: string) => layerNames[layer] ?? layer;
export const siteValue = (value: string) => valueNames[value] ?? (/^\d{4}-\d{2}-\d{2}T/.test(value) ? value.slice(0, 10) : value);
