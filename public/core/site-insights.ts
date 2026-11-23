// Surroundings, prices and listings for a located parcel, gathered by the worker (no CORS on these hosts):
// OpenStreetMap (Overpass) and OSRM for roads, transit, forest, power lines and drive times; the national price register (RCN)
// for notarial land prices; Otodom and OLX for current asking prices. Each source fails on its own.
import { geographicPoint, projectPoint } from './geospatial.ts';

type P = [number, number];
export interface Near { name?: string; kind: string; distance: number; detail?: string }
export interface Sale { date: string; price: number; area: number; perM2: number; use?: string; purpose?: string; place?: string }
export interface Listing { source: 'Otodom' | 'OLX'; title: string; url: string; price?: number; area?: number; perM2?: number; distance?: number; place?: string }
export interface SiteInsights {
  retrievedAt: string;
  admin?: { voivodeship: string; county: string; commune: string; region: string };
  /** source 'tiles': VersaTiles vector tiles only (no power lines, transit within ~2 km); 'overpass': full OpenStreetMap query. */
  osm: { status: 'ok' | 'error'; source?: 'overpass' | 'tiles'; road?: Near; busStop?: Near; rail?: Near; forest?: Near; water?: Near; powerLines: Near[]; nuisance: Near[]; buildings200?: number };
  drives: (Near & { km: number; minutes: number })[];
  prices: { status: 'ok' | 'none' | 'error'; radius: number; count: number; median?: number; q1?: number; q3?: number; estimate?: number; buildingOnly?: boolean; sales: Sale[] };
  listings: { status: 'ok' | 'none' | 'error'; searched: string[]; items: Listing[]; match?: Listing };
}

const segDist = (p: P, a: P, b: P) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
export const insideRing = (p: P, ring: P[]) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
/** Shortest distance in metres between a parcel ring and a point or polyline (0 when they touch or overlap). */
export function distanceToParcel(ring: P[], line: P[]): number {
  if (line.some(p => insideRing(p, ring))) return 0;
  let best = Infinity;
  for (const v of line) ring.forEach((a, i) => { best = Math.min(best, segDist(v, a, ring[(i + 1) % ring.length])); });
  if (line.length > 1) for (const v of ring) line.slice(1).forEach((b, i) => { best = Math.min(best, segDist(v, line[i], b)); });
  return Math.round(best);
}
/** Shortest distance in metres from a parcel ring to any of many points, e.g. the drawn pixels of a network map (0 when one is inside). */
export function pointsToParcel(ring: P[], points: P[]): number | null {
  let best = Infinity;
  for (const p of points) { if (insideRing(p, ring)) return 0; ring.forEach((a, i) => { best = Math.min(best, segDist(p, a, ring[(i + 1) % ring.length])); }); }
  return best === Infinity ? null : Math.round(best);
}
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = s.length / 2; return s.length % 2 ? s[Math.floor(m)] : (s[m - 1] + s[m]) / 2; };
const quantile = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b), i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
export const slug = (s: string) => s.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^powiat\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const opt = <K extends string, V>(k: K, v: V | undefined) => (v ? { [k]: v } : {}) as Partial<Record<K, V>>;

const paved = /^(asphalt|paved|concrete|concrete:plates|concrete:lanes|paving_stones|sett|chipseal|metal)$/;
const roadKinds: Record<string, string> = { motorway: 'autostrada', trunk: 'droga ekspresowa', primary: 'droga główna', secondary: 'droga drugorzędna', tertiary: 'droga lokalna', unclassified: 'droga lokalna', residential: 'ulica osiedlowa', living_street: 'strefa zamieszkania', service: 'droga dojazdowa', track: 'droga gruntowa', road: 'droga' };
export interface OsmElement { type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; geometry?: { lat: number; lon: number }[]; tags?: Record<string, string> }
/** Nearest features of each kind from an Overpass answer, measured to the parcel ring (EPSG:2180). */
export function readOsm(elements: OsmElement[], ring: P[]): SiteInsights['osm'] {
  const shape = (e: OsmElement): P[] => (e.geometry ?? (e.lat !== undefined ? [{ lat: e.lat, lon: e.lon! }] : e.center ? [e.center] : [])).map(g => projectPoint([g.lon, g.lat]));
  const near = (test: (t: Record<string, string>) => boolean, describe: (t: Record<string, string>) => Omit<Near, 'distance'>) => elements.filter(e => e.type !== 'count' && e.tags && test(e.tags) && shape(e).length)
    .map(e => ({ ...describe(e.tags!), distance: distanceToParcel(ring, shape(e)) })).sort((a, b) => a.distance - b.distance);
  const road = near(x => !!roadKinds[x.highway] && !/^(motorway|trunk)$/.test(x.highway), x => ({ name: x.name ?? x.ref, kind: roadKinds[x.highway], detail: x.surface ? (paved.test(x.surface) ? 'utwardzona' : 'nieutwardzona') : x.highway === 'track' ? 'nieutwardzona' : undefined }))[0];
  const count = elements.find(e => e.type === 'count')?.tags;
  return {
    status: 'ok', ...opt('road', road),
    ...opt('busStop', near(x => x.highway === 'bus_stop' || (x.public_transport === 'platform' && x.bus === 'yes'), x => ({ name: x.name, kind: 'przystanek autobusowy' }))[0]),
    ...opt('rail', near(x => x.railway === 'station' || x.railway === 'halt', x => ({ name: x.name, kind: x.railway === 'halt' ? 'przystanek kolejowy' : 'stacja kolejowa' }))[0]),
    ...opt('forest', near(x => x.landuse === 'forest' || x.natural === 'wood', x => ({ name: x.name, kind: 'las', detail: x.leaf_type === 'needleleaved' ? 'iglasty' : x.leaf_type === 'broadleaved' ? 'liściasty' : x.leaf_type === 'mixed' ? 'mieszany' : undefined }))[0]),
    ...opt('water', near(x => /^(river|stream|canal)$/.test(x.waterway ?? ''), x => ({ name: x.name, kind: x.waterway === 'river' ? 'rzeka' : x.waterway === 'canal' ? 'kanał' : 'ciek' }))[0]),
    powerLines: near(x => x.power === 'line' || x.power === 'minor_line', x => { const kv = Math.max(0, ...String(x.voltage ?? '').split(';').map(v => Number(v) / 1000).filter(Number.isFinite)); return { kind: kv >= 110 ? 'linia WN' : kv >= 1 ? 'linia SN' : x.power === 'minor_line' ? 'linia nN' : 'linia energetyczna', detail: kv ? `${kv} kV` : undefined }; })
      .filter((n, i, all) => all.findIndex(m => m.kind === n.kind) === i).slice(0, 3),
    nuisance: near(x => /^(industrial|landfill|quarry)$/.test(x.landuse ?? '') || x.man_made === 'wastewater_plant' || x.power === 'substation' || x.power === 'plant' || /^(motorway|trunk)$/.test(x.highway ?? '') || x.aeroway === 'aerodrome', x => ({ name: x.name, kind: x.landuse === 'industrial' ? 'teren przemysłowy' : x.landuse === 'landfill' ? 'składowisko odpadów' : x.landuse === 'quarry' ? 'kopalnia/żwirownia' : x.man_made === 'wastewater_plant' ? 'oczyszczalnia ścieków' : x.power === 'substation' ? 'stacja elektroenergetyczna' : x.power === 'plant' ? 'elektrownia' : x.aeroway ? 'lotnisko' : roadKinds[x.highway] }))
      .filter((n, i, all) => all.findIndex(m => m.kind === n.kind) === i).slice(0, 5),
    ...(count ? { buildings200: Number(count.ways ?? count.total ?? 0) } : {}),
  };
}

const TILE_ZOOM = 14, tileOf = (lon: number, lat: number) => { const k = 2 ** TILE_ZOOM, r = lat * Math.PI / 180; return [Math.floor((lon + 180) / 360 * k), Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * k)]; };
const tileLonLat = (x: number, y: number): [number, number] => { const k = 2 ** TILE_ZOOM; return [x / k * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * y / k))) * 180 / Math.PI]; };
/** The same features from OpenStreetMap vector tiles (VersaTiles shortbread), turned into Overpass-like elements for readOsm. */
export async function tileElements(tiles: { buffer: Uint8Array; x: number; y: number }[], point: P): Promise<OsmElement[]> {
  const [{ VectorTile }, { PbfReader }] = await Promise.all([import('@mapbox/vector-tile'), import('pbf')]);
  const out: OsmElement[] = [];
  let buildings = 0;
  const kindTags: Record<string, (k: string) => Record<string, string> | null> = {
    streets: k => roadKinds[k] ? { highway: k } : null,
    land: k => k === 'forest' || k === 'wood' ? { landuse: 'forest' } : /^(industrial|landfill|quarry)$/.test(k) ? { landuse: k } : null,
    water_lines: k => /^(river|stream|canal)$/.test(k) ? { waterway: k } : null,
    public_transport: k => k === 'bus_stop' ? { highway: 'bus_stop' } : k === 'station' || k === 'halt' || k === 'railway_station' ? { railway: k === 'halt' ? 'halt' : 'station' } as Record<string, string> : null,
  };
  for (const { buffer, x, y } of tiles) {
    const tile = new VectorTile(new PbfReader(buffer));
    for (const [name, toTags] of Object.entries(kindTags)) {
      const layer = tile.layers[name];
      for (let i = 0; layer && i < layer.length; i++) {
        const f = layer.feature(i), tags = toTags(String(f.properties.kind ?? ''));
        if (!tags) continue;
        if (name === 'streets' && f.properties.surface) tags.surface = String(f.properties.surface);
        if (f.properties.name) tags.name = String(f.properties.name);
        for (const part of f.loadGeometry()) {
          const geometry = part.map(q => { const [lon, lat] = tileLonLat(x + q.x / layer.extent, y + q.y / layer.extent); return { lat, lon }; });
          // a forest the parcel stands in: its outline is far away, so mark the inside with the query point itself
          if (f.type === 3 && insideRing(point, geometry.map(g => projectPoint([g.lon, g.lat])))) { const [lon, lat] = geographicPoint(point); geometry.push({ lat, lon }); }
          out.push({ type: f.type === 1 ? 'node' : 'way', tags: { ...tags }, ...(f.type === 1 ? geometry[0] : { geometry }) });
        }
      }
    }
    const b = tile.layers.buildings;
    for (let i = 0; b && i < b.length; i++) {
      const [ring] = b.feature(i).loadGeometry(), c = ring?.[0];
      if (!c) continue;
      const at = projectPoint(tileLonLat(x + c.x / b.extent, y + c.y / b.extent));
      if (Math.hypot(at[0] - point[0], at[1] - point[1]) <= 200) buildings++;
    }
  }
  out.push({ type: 'count', tags: { ways: String(buildings) } });
  return out;
}

/** Unbuilt-land sales from an RCN WFS answer: one per transaction, plausible prices only, newest first. */
export function readRcn(xml: string, now = Date.now()): Sale[] {
  const out = new Map<string, Sale>();
  for (const m of xml.matchAll(/<wfs:member>([\s\S]*?)<\/wfs:member>/g)) {
    const f = (k: string) => m[1].match(new RegExp(`<ms:${k}[^>]*>([\\s\\S]*?)</ms:${k}>`))?.[1].replace(/<[^>]+>/g, '').trim() ?? '';
    if (f('NIER_RODZAJ') !== 'nieruchomoscGruntowaNiezabudowana' || f('TRAN_RODZAJ_TRANS') !== 'wolnyRynek') continue;
    const price = Number(f('TRAN_CENA_BRUTTO')), area = Number(f('NIER_POW_GRUNTU')) * 10000, date = f('DOK_DATA').slice(0, 10);
    if (!(price > 0 && area >= 200 && area <= 20000) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || now - Date.parse(date) > 4 * 365 * 864e5) continue;
    const perM2 = price / area;
    if (perM2 < 5 || perM2 > 5000) continue;
    out.set(f('TRAN_OZNACZENIE_TRANS') || f('DOK_OZNACZENIE') + date, { date, price, area: Math.round(area), perM2: Math.round(perM2), use: f('DZI_SPOSOB_UZYT') || undefined, purpose: f('DZI_PRZEZN_WMPZP') || undefined, place: f('DZI_ADRES').replace(/^MSC:/, '').split(';')[0] || undefined });
  }
  return [...out.values()].sort((a, b) => b.date.localeCompare(a.date));
}
/** Median price of comparable sales (housing land when at least three are known) and the parcel's value at that price. */
export function priceSummary(sales: Sale[], area: number, radius: number): SiteInsights['prices'] {
  const building = sales.filter(s => /mieszkan|zabud/i.test(`${s.purpose} ${s.use}`)), use = building.length >= 3 ? building : sales;
  if (!use.length) return { status: 'none', radius, count: 0, sales: [] };
  const per = use.map(s => s.perM2), med = median(per);
  return { status: 'ok', radius, count: use.length, median: Math.round(med), q1: Math.round(quantile(per, .25)), q3: Math.round(quantile(per, .75)), estimate: Math.round(med * area / 1000) * 1000, buildingOnly: use === building, sales: use.slice(0, 12) };
}

/** Plot listings in an Otodom search page (__NEXT_DATA__). */
export function readOtodom(html: string): Listing[] {
  const json = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!json) return [];
  type Item = { title?: string; slug?: string; totalPrice?: { value?: number }; areaInSquareMeters?: number; pricePerSquareMeter?: { value?: number }; location?: { address?: { city?: { name?: string } } } };
  const items = (JSON.parse(json) as { props?: { pageProps?: { data?: { searchAds?: { items?: Item[] } } } } }).props?.pageProps?.data?.searchAds?.items ?? [];
  return items.filter(i => i.title && i.slug).map(i => ({ source: 'Otodom' as const, title: i.title!.slice(0, 140), url: `https://www.otodom.pl/pl/oferta/${encodeURIComponent(i.slug!)}`, price: i.totalPrice?.value, area: i.areaInSquareMeters, perM2: i.pricePerSquareMeter?.value ? Math.round(i.pricePerSquareMeter.value) : undefined, place: i.location?.address?.city?.name }));
}
/** Plot listings in an OLX search page (window.__PRERENDERED_STATE__), with their map position in EPSG:2180. */
export function readOlx(html: string): (Listing & { at?: P })[] {
  const raw = html.match(/window\.__PRERENDERED_STATE__\s*=\s*("(?:[^"\\]|\\.)*")/)?.[1];
  if (!raw) return [];
  type Ad = { title?: string; url?: string; price?: { regularPrice?: { value?: number } }; params?: { key: string; normalizedValue?: string }[]; location?: { cityName?: string }; map?: { lat?: number; lon?: number } };
  const ads = (JSON.parse(JSON.parse(raw) as string) as { listing?: { listing?: { ads?: Ad[] } } }).listing?.listing?.ads ?? [];
  return ads.filter(a => a.title && a.url?.startsWith('https://www.olx.pl/')).map(a => {
    const area = Number(a.params?.find(p => p.key === 'm')?.normalizedValue) || undefined, price = a.price?.regularPrice?.value;
    return { source: 'OLX' as const, title: a.title!.slice(0, 140), url: a.url!, price, area, perM2: price && area ? Math.round(price / area) : undefined, place: a.location?.cityName, ...(a.map?.lat && a.map.lon ? { at: projectPoint([a.map.lon, a.map.lat]) } : {}) };
  });
}

const overpass = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const capitals: Record<string, string> = { dolnośląskie: 'Wrocław', 'kujawsko-pomorskie': 'Bydgoszcz', lubelskie: 'Lublin', lubuskie: 'Zielona Góra', łódzkie: 'Łódź', małopolskie: 'Kraków', mazowieckie: 'Warszawa', opolskie: 'Opole', podkarpackie: 'Rzeszów', podlaskie: 'Białystok', pomorskie: 'Gdańsk', śląskie: 'Katowice', świętokrzyskie: 'Kielce', 'warmińsko-mazurskie': 'Olsztyn', wielkopolskie: 'Poznań', zachodniopomorskie: 'Szczecin' };
const browserHeaders = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36', 'Accept-Language': 'pl-PL,pl;q=0.9' };

export async function fetchSiteInsights(input: { point: P; ring: P[]; area: number }, fetcher: typeof fetch = fetch): Promise<SiteInsights> {
  const { point, ring, area } = input, [lon, lat] = geographicPoint(point), [e, n] = point;
  const get = async (url: string, init: RequestInit = {}, timeout = 20000) => { const r = await fetcher(url, { ...init, signal: AbortSignal.timeout(timeout) }); if (!r.ok) throw new Error('HTTP ' + r.status); const body = await r.text(); if (body.length > 8_000_000) throw new Error('Too large'); return body; };
  const around = (r: number) => `(around:${r},${lat.toFixed(6)},${lon.toFixed(6)})`;
  // Two queries in parallel: the nearby one is quick; the wide railway search is slow on a busy server.
  const nearQuery = `[out:json][timeout:50];(way${around(250)}[highway];node${around(2500)}[highway=bus_stop];node${around(2500)}[public_transport=platform][bus=yes];way${around(1500)}[landuse=forest];way${around(1500)}[natural=wood];way${around(1500)}[waterway~"^(river|stream|canal)$"];way${around(1200)}[power~"^(line|minor_line)$"];nwr${around(3000)}[landuse~"^(industrial|landfill|quarry)$"];nwr${around(3000)}[man_made=wastewater_plant];nwr${around(1500)}[power~"^(substation|plant)$"];way${around(1500)}[highway~"^(motorway|trunk)$"];nwr${around(8000)}[aeroway=aerodrome];);out tags geom;way${around(200)}[building];out count;`;
  const wideQuery = `[out:json][timeout:50];node${around(15000)}[railway~"^(station|halt)$"];out;`;
  // ponytail: 45 s budget across the mirrors so a busy Overpass never holds back prices and listings
  const deadline = Date.now() + 45000;
  const ask = async (query: string) => {
    for (const url of overpass) {
      const left = deadline - Date.now();
      if (left < 3000) break;
      try { return (JSON.parse(await get(url, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'setback-planner/1.0' } }, left)) as { elements: OsmElement[] }).elements; }
      catch { /* next mirror */ }
    }
    throw new Error('Overpass unavailable');
  };
  const wideTask = ask(wideQuery).catch(() => [] as OsmElement[]);
  const osmTask = Promise.all([ask(nearQuery), wideTask]).then(([near, wide]) => ({ elements: [...near, ...wide], source: 'overpass' as const }));
  // Vector tiles come from a CDN within a second or two: the fallback when Overpass is busy (3×3 z14 tiles, about 2 km around).
  const [tx, ty] = tileOf(lon, lat);
  const tilesTask = Promise.all([-1, 0, 1].flatMap(dx => [-1, 0, 1].map(async dy => {
    const r = await fetcher(`https://tiles.versatiles.org/tiles/osm/${TILE_ZOOM}/${tx + dx}/${ty + dy}`, { signal: AbortSignal.timeout(15000) });
    return { buffer: new Uint8Array(r.ok ? await r.arrayBuffer() : new ArrayBuffer(0)), x: tx + dx, y: ty + dy };
  }))).then(tiles => tileElements(tiles, point));
  const adminTask = get(`https://uldk.gugik.gov.pl/?request=GetParcelByXY&xy=${e.toFixed(2)},${n.toFixed(2)}&result=voivodeship,county,commune,region`).then(body => {
    const [voivodeship, county, commune, region] = (body.split('\n')[1] ?? '').trim().split('|');
    return region ? { voivodeship, county, commune, region } : undefined;
  });
  // RCN WFS takes the EPSG:2180 box in northing,easting order.
  const radius = 1500;
  const pricesTask = get(`https://mapy.geoportal.gov.pl/wss/service/rcn?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ms:dzialki&COUNT=1000&BBOX=${n - radius},${e - radius},${n + radius},${e + radius},urn:ogc:def:crs:EPSG::2180`, {}, 30000)
    .then(xml => priceSummary(readRcn(xml), area, radius));
  const listingsTask = adminTask.then(async admin => {
    if (!admin) throw new Error('No admin names');
    const [v, c, g, r] = [admin.voivodeship, admin.county, admin.commune, admin.region].map(slug), searched: string[] = [], items: Listing[] = [];
    // ponytail: portal slugs are guessed from the registry names (village, then commune); a miss just means no listings
    for (const path of [`${v}/${c}/${g}/${r}`, `${v}/${c}/${g}`]) {
      const url = `https://www.otodom.pl/pl/wyniki/sprzedaz/dzialka/${path}?limit=36`;
      // The village-level search lists plots in that village only.
      try { const found = readOtodom(await get(url, { headers: browserHeaders })).map(l => ({ ...l, place: l.place ?? (path.endsWith('/' + r) ? admin.region : undefined) })); searched.push(url); if (found.length) { items.push(...found); break; } } catch { /* blocked or no such place */ }
    }
    for (const place of [r, g]) {
      const url = `https://www.olx.pl/nieruchomosci/dzialki/sprzedaz/${place}/?search%5Bdist%5D=5`;
      try {
        const found = readOlx(await get(url, { headers: browserHeaders }));
        searched.push(url);
        const near = found.map(({ at, ...l }) => ({ ...l, ...(at ? { distance: distanceToParcel(ring, [at]) } : {}) })).filter(l => l.distance === undefined || l.distance <= 10000);
        if (near.length) { items.push(...near); break; }
      } catch { /* blocked or no such place */ }
    }
    if (!searched.length) throw new Error('Portals unavailable');
    const unique = items.filter((l, i) => items.findIndex(x => x.url === l.url) === i);
    const match = unique.find(l => l.area && Math.abs(l.area - area) / area < 0.03 && (l.distance === undefined ? !!l.place && slug(l.place) === r : l.distance < 1500));
    return { status: unique.length ? 'ok' as const : 'none' as const, searched, items: unique.slice(0, 20), ...(match ? { match } : {}) };
  });
  const [overpassResult, tileResult, admin, prices, listings] = await Promise.allSettled([osmTask, tilesTask, adminTask, pricesTask, listingsTask]);
  const osm = overpassResult.status === 'fulfilled' ? overpassResult : tileResult.status === 'fulfilled' ? { status: 'fulfilled' as const, value: { elements: tileResult.value, source: 'tiles' as const } } : overpassResult;
  const elements = osm.status === 'fulfilled' ? osm.value.elements : [];
  // Drive times to the commune seat and the voivodeship capital, located with the GUGiK geocoder (stable, unlike Overpass).
  const names = admin.status === 'fulfilled' && admin.value ? [admin.value.commune.replace(/\s*\(.*\)$/, ''), capitals[admin.value.voivodeship]] : [];
  const places = (await Promise.all([...new Set(names.filter(Boolean))].map(async (name, i) => {
    try {
      // Place names repeat across Poland: take the match in the parcel's voivodeship (and commune, for the seat).
      const results = Object.values((JSON.parse(await get(`https://services.gugik.gov.pl/uug/?request=GetAddress&address=${encodeURIComponent(name)}&srid=2180`, { headers: { 'User-Agent': 'setback-planner/1.0' } }, 10000)) as { results?: Record<string, { city?: string; voivodeship?: string; commune?: string; x?: string; y?: string }> }).results ?? {});
      const a = admin.status === 'fulfilled' ? admin.value : undefined, same = results.filter(r => r.voivodeship === a?.voivodeship);
      const hit = (i === 0 ? same.find(r => r.commune === name) : undefined) ?? same[0];
      const at: P = [Number(hit?.x), Number(hit?.y)];
      return hit?.city && at.every(Number.isFinite) ? { name: hit.city, kind: i === 0 ? 'siedziba gminy' : 'miasto wojewódzkie', at, d: Math.hypot(at[0] - e, at[1] - n) } : null;
    } catch { return null; }
  }))).filter((p): p is NonNullable<typeof p> => !!p);
  const targets = places.filter(p => p.d > 1000);
  const drives = (await Promise.all(targets.map(async p => {
    try {
      const [tlon, tlat] = geographicPoint(p.at), body = JSON.parse(await get(`https://router.project-osrm.org/route/v1/driving/${lon.toFixed(5)},${lat.toFixed(5)};${tlon.toFixed(5)},${tlat.toFixed(5)}?overview=false`, { headers: { 'User-Agent': 'setback-planner/1.0' } }, 12000)) as { routes?: { distance: number; duration: number }[] };
      const route = body.routes?.[0];
      return route ? { name: p.name, kind: p.kind, distance: Math.round(p.d), km: Math.round(route.distance / 100) / 10, minutes: Math.round(route.duration / 60) } : null;
    } catch { return null; }
  }))).filter((d): d is NonNullable<typeof d> => !!d);
  return {
    retrievedAt: new Date().toISOString(),
    ...(admin.status === 'fulfilled' && admin.value ? { admin: admin.value } : {}),
    osm: osm.status === 'fulfilled' ? { ...readOsm(elements, ring), source: osm.value.source } : { status: 'error', powerLines: [], nuisance: [] },
    drives,
    prices: prices.status === 'fulfilled' ? prices.value : { status: 'error', radius, count: 0, sales: [] },
    listings: listings.status === 'fulfilled' ? listings.value : { status: 'error', searched: [], items: [] },
  };
}

/** Validated body of an /api/site-insights request: a point and parcel ring in EPSG:2180 inside Poland. */
export function parseInsightsQuery(body: unknown) {
  const b = body as { point?: unknown; ring?: unknown; area?: unknown } | null;
  const ok = (p: unknown): p is P => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] > 140000 && p[0] < 900000 && p[1] > 100000 && p[1] < 800000;
  if (!b || !ok(b.point) || !Array.isArray(b.ring) || b.ring.length < 3 || b.ring.length > 400 || !b.ring.every(ok) || typeof b.area !== 'number' || !(b.area > 1 && b.area < 1e7)) throw new Error('Invalid parcel');
  const point = b.point, ring = b.ring as P[];
  if (Math.max(...ring.map(p => Math.hypot(p[0] - point[0], p[1] - point[1]))) > 3000) throw new Error('Invalid parcel');
  return { point, ring, area: b.area };
}
