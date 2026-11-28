import { test } from 'node:test'; import assert from 'node:assert/strict';
import { kwNumber, readRegister, registerSummary } from '../public/core/land-register.ts';
import { parseScene } from '../public/core/scene.ts';

// Synthetic entries in the wording the EKW browser prints (no real register).
const III = `Rubryka 3.1 - Ograniczone prawa rzeczowe
Numer wpisu 1
Treść wpisu SŁUŻEBNOŚĆ GRUNTOWA POLEGAJĄCA NA PRAWIE PRZEJAZDU I PRZECHODU PASEM GRUNTU O SZEROKOŚCI 4 M
Rubryka 3.3 - Roszczenia: BRAK WPISÓW`;
const IV = `Rubryka 4.4 - Hipoteka
Numer hipoteki 1
Rodzaj hipoteki HIPOTEKA UMOWNA
Suma 450 000,00 (CZTERYSTA PIĘĆDZIESIĄT TYSIĘCY) ZŁ
Wierzyciel hipoteczny BANK`;

test('register numbers are normalised and checked for the court format', () => {
  assert.deepEqual(kwNumber(' wa1g/00012345/6 '), { number: 'WA1G/00012345/6', ok: true });
  assert.equal(kwNumber('WA1G/12345/6').ok, false);
  assert.equal(kwNumber('').ok, false);
});

test('pasted sections name the burdens and mortgage sums that appear in them, nothing more', () => {
  const f = readRegister(III, IV);
  assert.deepEqual(f.burdens, ['służebność gruntowa (np. przejazd)']);
  assert.equal(f.section3Empty, false);
  assert.equal(f.mortgage, true);
  assert.deepEqual(f.mortgages, ['450 000,00 zł']);
  const empty = readRegister('Dział III - Prawa, roszczenia i ograniczenia: BRAK WPISÓW', 'Dział IV - Hipoteka: BRAK WPISÓW');
  assert.deepEqual([empty.burdens, empty.section3Empty, empty.mortgage, empty.section4Empty], [[], true, false, true]);
  assert.equal(readRegister('', 'DZIAŁ IV - HIPOTEKA\nSuma 250 000,00 ZŁ').mortgage, true, 'a sum under the stripped heading is still a mortgage');
  const unknown = readRegister('jakiś inny tekst', '');
  assert.deepEqual(registerSummary(unknown, 'jakiś inny tekst', '', true), ['Dział III: nie rozpoznano typowych wpisów – przeczytaj treść.']);
  assert.deepEqual(registerSummary(f, III, IV, true), ['Dział III: służebność gruntowa (np. przejazd).', 'Dział IV: hipoteka 450 000,00 zł.']);
});

test('the parcel keeps pasted register sections and projects without them still load', () => {
  const base = { ...parseScene({ plot: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }, { x: 0, y: 30 }] }), parcel: { identifier: '143201_4.0028.52', source: { name: 'ULDK', retrievedAt: '2026-11-28T10:00:00Z', crs: 'EPSG:2180' as const }, edited: false } };
  assert.equal(parseScene(base).parcel?.landRegister, undefined);
  const s = parseScene({ ...base, parcel: { ...base.parcel, landRegister: { number: 'WA1G/00012345/6', section3: III, section4: IV } } });
  assert.equal(s.parcel?.landRegister?.section4, IV);
  assert.throws(() => parseScene({ ...base, parcel: { ...base.parcel, landRegister: { owners: 'Jan Kowalski' } } }), 'owners are not a field');
});

test('the report lists register burdens and the mortgage as risks and quotes the pasted text', async () => {
  const { insightFacts, insightSections } = await import('../public/core/report-insights.ts');
  const scene = parseScene({ ...parseScene({ plot: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }, { x: 0, y: 30 }] }), parcel: { identifier: 'X', source: { name: 'ULDK', retrievedAt: '2026-11-28T10:00:00Z', crs: 'EPSG:2180' as const }, edited: false, landRegister: { number: 'wa1g/00012345/6', section3: III, section4: IV } } });
  const c = { scene, lang: 'pl' as const, area: 900, buildable: 400, coverage: 0, buildings: 0, failing: 0 }, f = insightFacts(c);
  assert.ok(f.risks.some(r => r.title === 'Księga wieczysta: służebność gruntowa (np. przejazd)'));
  assert.ok(f.risks.some(r => r.title === 'Hipoteka w księdze wieczystej' && r.text.startsWith('450 000,00 zł.')));
  const html = insightSections(c, f);
  assert.match(html, /WA1G\/00012345\/6/);
  assert.match(html, /SŁUŻEBNOŚĆ GRUNTOWA POLEGAJĄCA/);
  assert.ok(!html.includes('<script'), 'pasted text is escaped');
});
