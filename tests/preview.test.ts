import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewParam, parsePreview, previewMeta, shareSearch, rasterPreview, encodePng, DEFAULT_PREVIEW, OG_W } from '../public/core/preview.ts';
import { parseScene } from '../public/core/scene.ts';

const scene = parseScene({ plot: [{ x: 0, y: 0 }, { x: 25, y: 0 }, { x: 25, y: 40 }, { x: 0, y: 40 }], items: [{ id: 'h1', type: 'house', name: 'DE 105', x: 12.5, y: 15, w: 13.1, d: 9.98 }, { id: 't1', type: 'landscape', kind: Object.keys((await import('../public/core/objects.ts')).objectLibrary)[0], name: 'tree', x: 5, y: 35, w: 2, d: 2 }] });

test('preview outline round-trips and leaves out landscape', () => {
  const pv = previewParam(scene), p = parsePreview(pv)!;
  assert.match(pv, /^p0,0,250,0,250,400,0,400_h/);
  assert.equal(p.items.length, 1);
  assert.equal(p.items[0].kind, 'h');
  assert.ok(Math.abs(p.items[0].ring[0].x - 5.95) < .06);
});
test('preview parser rejects junk', () => {
  for (const bad of [null, '', 'x1,2,3,4,5,6', 'p1,2,3', 'p1,2,3,4,5,6_p1,2,3,4,5,6', 'p1,2,3,4,5,6_z1,2,3,4,5,6', 'p1,2,3,4,5,a', 'p' + '1,'.repeat(2000)]) assert.equal(parsePreview(bad), null, String(bad));
});
test('share search keeps campaign keys and replaces old preview keys', () => {
  const q = new URLSearchParams(shareSearch(scene, '?utm_campaign=wiosna&pv=old&pn=old', 'DE 105'));
  assert.equal(q.get('utm_campaign'), 'wiosna');
  assert.equal(q.get('pn'), 'DE 105');
  assert.equal(q.get('pa'), '1000');
  assert.notEqual(q.get('pv'), 'old');
});
test('meta tags are escaped and name the house and plot', () => {
  const html = previewMeta(new URLSearchParams({ pn: 'DE 105"><script>', pa: '1000', pv: DEFAULT_PREVIEW }), 'https://x.test');
  assert.ok(!html.includes('<script'));
  assert.match(html, /og:title" content="DE 105script na działce 1000 m²"/);
  assert.match(html, /og:image" content="https:\/\/x.test\/api\/og.png\?pv=p0%2C0/);
});
test('PNG is valid and the house is orange', async () => {
  const px = rasterPreview(parsePreview(previewParam(scene))!);
  const h = scene.items[0];
  assert.ok(px.includes(3));
  assert.equal(px[167 * OG_W + 400], 3, 'house centre (12.5, 15) m maps to (400, 167) px');
  const png = await encodePng(px);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(png.length < 60000, 'small enough for chat apps: ' + png.length);
  void h;
});
