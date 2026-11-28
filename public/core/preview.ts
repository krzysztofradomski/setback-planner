// Link previews: a compact outline of the plot and its buildings rides in the query string (the scene itself stays in the
// hash, which never reaches the server), so the Worker can draw a PNG and fill the og: tags for chat apps.
import { worldFootprint } from './footprints.ts';
import type { Point } from './geometry.ts';
import type { Scene } from './scene.ts';

export const PREVIEW_KEYS = ['pv', 'pn', 'pa'] as const;
export type Preview = { plot: Point[]; items: { kind: 'h' | 'g'; ring: Point[] }[] };
const ring = (points: Point[]) => points.slice(0, 64).map(p => Math.round(p.x * 10) + ',' + Math.round(p.y * 10)).join(',');

/** Plot outline and house/garage footprints in decimetres: "p1,2,3,4_h5,6,7,8_g…". Landscape objects are left out. */
export function previewParam(scene: Scene): string {
  const items = scene.items.filter(i => i.visible && i.type !== 'landscape').slice(0, 12);
  return ['p' + ring(scene.plot), ...items.map(i => (i.type === 'house' ? 'h' : 'g') + ring(worldFootprint(i)))].join('_');
}
export function parsePreview(value: string | null): Preview | null {
  if (!value || value.length > 3000 || !/^p[-\d,_hg]+$/.test(value)) return null;
  const out: Preview = { plot: [], items: [] };
  for (const part of value.split('_')) {
    const n = part.slice(1).split(',').map(Number);
    if (n.length < 6 || n.length % 2 || n.some(v => !Number.isInteger(v) || Math.abs(v) > 1e6)) return null;
    const points = Array.from({ length: n.length / 2 }, (_, k) => ({ x: n[2 * k] / 10, y: n[2 * k + 1] / 10 }));
    if (part[0] === 'p') { if (out.plot.length) return null; out.plot = points; }
    else if (part[0] === 'h' || part[0] === 'g') out.items.push({ kind: part[0], ring: points });
    else return null;
  }
  return out.plot.length ? out : null;
}
/** The current query string with fresh preview keys; campaign keys and anything else are kept. */
export function shareSearch(scene: Scene, search: string, houseName: string): string {
  const params = new URLSearchParams(search);
  for (const k of PREVIEW_KEYS) params.delete(k);
  try { params.set('pv', previewParam(scene)); } catch { return params.size ? '?' + params : ''; }
  if (houseName) params.set('pn', houseName.slice(0, 60));
  const area = Math.abs(scene.plot.reduce((s, a, i) => { const b = scene.plot[(i + 1) % scene.plot.length]; return s + a.x * b.y - b.x * a.y; }, 0) / 2);
  params.set('pa', String(Math.round(area)));
  return '?' + params;
}
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** og:/twitter: tags for a shared plan. Text comes from the link, so it is filtered, bounded and escaped. */
export function previewMeta(params: URLSearchParams, origin: string): string {
  const name = (params.get('pn') ?? '').replace(/[^\p{L}\p{N} .,-]/gu, '').slice(0, 60).trim(), area = Number(params.get('pa'));
  const plot = Number.isFinite(area) && area > 0 && area < 1e7 ? new Intl.NumberFormat('pl-PL').format(Math.round(area)) + ' m²' : '';
  const title = name ? `${name} na działce${plot ? ' ' + plot : ''}` : plot ? `Dom na działce ${plot}` : 'Dom na działce: czy się zmieści?';
  const description = 'Zobacz ten projekt na prawdziwej granicy działki: w 2D, w 3D i z raportem o okolicy. Sprawdź też swoją działkę.';
  const pv = params.get('pv'), image = origin + '/api/og.png' + (parsePreview(pv) ? '?pv=' + encodeURIComponent(pv!) : '');
  return [['og:title', title], ['og:description', description], ['og:image', image], ['og:image:width', '800'], ['og:image:height', '420'], ['og:type', 'website']]
    .map(([k, v]) => `<meta property="${k}" content="${esc(v)}">`).join('')
    + `<meta name="twitter:card" content="summary_large_image"><meta name="description" content="${esc(description)}">`;
}

// ---- PNG drawing (palette image, scanline polygon fill, zlib via CompressionStream) ----
export const OG_W = 800, OG_H = 420;
const palette = [[250, 249, 245], [221, 232, 211], [63, 107, 58], [255, 106, 0], [154, 160, 166], [20, 20, 19]];
/** Pixels as palette indices: paper, plot, boundary, house (brand orange), garage, dark outline. */
export function rasterPreview(p: Preview): Uint8Array {
  const px = new Uint8Array(OG_W * OG_H), all = [...p.plot, ...p.items.flatMap(i => i.ring)];
  const minX = Math.min(...all.map(q => q.x)), maxX = Math.max(...all.map(q => q.x)), minY = Math.min(...all.map(q => q.y)), maxY = Math.max(...all.map(q => q.y));
  const s = Math.min((OG_W - 80) / Math.max(maxX - minX, 1), (OG_H - 80) / Math.max(maxY - minY, 1));
  const ox = (OG_W - (maxX - minX) * s) / 2, oy = (OG_H - (maxY - minY) * s) / 2;
  const map = (q: Point) => ({ x: ox + (q.x - minX) * s, y: oy + (q.y - minY) * s });
  const fill = (points: Point[], colour: number) => {
    const r = points.map(map), top = Math.max(0, Math.floor(Math.min(...r.map(q => q.y)))), bottom = Math.min(OG_H - 1, Math.ceil(Math.max(...r.map(q => q.y))));
    for (let y = top; y <= bottom; y++) {
      const cy = y + .5, xs: number[] = [];
      for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; if ((a.y <= cy) !== (b.y <= cy)) xs.push(a.x + (cy - a.y) / (b.y - a.y) * (b.x - a.x)); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.round(xs[k])); x < Math.min(OG_W, Math.round(xs[k + 1])); x++) px[y * OG_W + x] = colour;
    }
  };
  const outline = (points: Point[], colour: number, w: number) => {
    const r = points.map(map);
    for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length], steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
      for (let t = 0; t <= steps; t++) {
        const cx = Math.round(a.x + (b.x - a.x) * t / steps), cy = Math.round(a.y + (b.y - a.y) * t / steps);
        for (let dy = -w; dy <= w; dy++) for (let dx = -w; dx <= w; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < OG_W && y < OG_H) px[y * OG_W + x] = colour; }
      }
    }
  };
  fill(p.plot, 1); outline(p.plot, 2, 2);
  for (const i of p.items) { fill(i.ring, i.kind === 'h' ? 3 : 4); outline(i.ring, 5, 1); }
  return px;
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (bytes: Uint8Array) => { let c = 0xffffffff; for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length), v = new DataView(out.buffer);
  v.setUint32(0, data.length); out.set(new TextEncoder().encode(type), 4); out.set(data, 8); v.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)));
  return out;
}
export async function encodePng(px: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const raw = new Uint8Array(OG_H * (OG_W + 1));
  for (let y = 0; y < OG_H; y++) raw.set(px.subarray(y * OG_W, (y + 1) * OG_W), y * (OG_W + 1) + 1);
  const zipped = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const head = new Uint8Array(13), v = new DataView(head.buffer);
  v.setUint32(0, OG_W); v.setUint32(4, OG_H); head.set([8, 3, 0, 0, 0], 8);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('PLTE', new Uint8Array(palette.flat())), chunk('IDAT', zipped), chunk('IEND', new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, c) => n + c.length, 0)); let at = 0; for (const c of parts) { out.set(c, at); at += c.length; }
  return out;
}
/** Shown when a link carries no outline: a 25 × 40 m plot with a DE 105 sized house. */
export const DEFAULT_PREVIEW = 'p0,0,250,0,250,400,0,400_h59,100,190,100,190,200,59,200';
