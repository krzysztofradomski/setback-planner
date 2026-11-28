// Parcel analysis for the printable report: a plain-language summary, risks, strengths, a detailed
// table per topic, land history, prices, listings and a checklist tailored to this parcel. Rule-based on the site data:
// every figure comes from a named source (registers, OpenStreetMap, PVGIS, GIOŚ, GUS, the law); nothing is estimated without one.
import type { Scene } from './scene.ts';
import { roadCategory, roadSetback, type Stat } from './site-insights.ts';
import type { SiteData, NetworkId } from './site-data.ts';
import { siteSummary } from './site-data.ts';

type Lang = 'en' | 'pl';
export interface InsightContext { scene: Scene; site?: SiteData; lang: Lang; area: number; buildable: number; coverage: number; buildings: number; failing: number; houseName?: string; neighbours?: number }
interface Item { title: string; text: string; cost?: string }
const esc = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Soil classes in a cadastral land-use code such as "ŁVI, PsV" or "RIIIa": classes I–III need a conversion decision and fees. */
export function soilClasses(code: string) {
  const found = [...code.matchAll(/(R|Ł|Ps|Ls|Lz|S|Br|Wsr|N)-?(VI|V|IVa|IVb|IV|IIIa|IIIb|III|II|I)z?(?![a-zA-Z])/g)].map(x => ({ use: x[1], cls: x[2] }));
  const valuable = found.some(x => /^(I|II|III|IIIa|IIIb)$/.test(x.cls) && x.use !== 'N' && x.use !== 'Ls' && x.use !== 'Lz');
  return { classes: found.map(x => x.use + x.cls), valuable, forest: /(^|[\s,;])(Ls|Lz)/.test(code), built: /(^|[\s,;])(B|Ba|Bi|Bp|Bz)($|[\s,;])/.test(code) };
}
const zl = (n: number) => new Intl.NumberFormat('pl-PL').format(Math.round(n)) + ' zł';
const m = (n: number) => `${new Intl.NumberFormat('pl-PL').format(n)} m`;
const n0 = (n: number) => new Intl.NumberFormat('pl-PL').format(n);
const dec = (n: number, pl: boolean) => pl ? n.toFixed(1).replace('.', ',') : n.toFixed(1);
const networks = ['power', 'water', 'sewer', 'gas'] as const;

export function insightFacts(c: InsightContext) {
  const { site, scene } = c, pl = c.lang === 'pl', T = (en: string, plText: string) => pl ? plText : en;
  const ins = site?.insights, osm = ins?.osm, layers = site?.layers, dist = site?.networkDistances ?? {};
  const cad = layers?.cadastre.features[0]?.attrs ?? {}, use = Object.entries(cad).find(([k]) => /oznaczenie (konturu|użytku)/i.test(k))?.[1] ?? '';
  const soil = soilClasses(use), terrain = scene.terrain, zs = terrain?.samples.map(s => s.z) ?? [];
  const found = (id: keyof SiteData['layers']) => layers?.[id]?.status === 'found';
  const planned = layers ? (found('planning') || (layers.planning.status === 'none' && (layers.planning.image?.length ?? 0) > 4000)) : undefined;
  const claims = site?.planRules?.extraction?.claims ?? [];
  const maxCover = claims.map(cl => /powierzchni\w* zabudow|wskaźnik\w* zabudow/i.test(cl.parameter) ? Number(cl.value.match(/(\d+(?:[.,]\d+)?)\s*%/)?.[1].replace(',', '.')) : NaN).find(Number.isFinite);
  // Counties that do not publish GESUT answer with empty images: no network anywhere is then "no data", not "no network".
  const published = !!layers && layers.utilities.status !== 'unavailable' && (layers.utilities.status === 'found' || Object.values(dist).some(v => typeof v === 'number'));
  const nets: Record<NetworkId, string> = { water: T('Water main', 'Wodociąg'), sewer: T('Sewer', 'Kanalizacja'), gas: T('Gas', 'Gaz'), power: T('Power', 'Prąd') };
  const netState = (id: NetworkId) => { const d = dist[id]; return d === undefined || !published ? 'unknown' : d === null ? 'absent' : d <= 15 ? 'at' : d <= 60 ? 'near' : 'far'; };
  const netText = (id: NetworkId) => { const d = dist[id], s = netState(id); return s === 'unknown' ? T('no data – check the county utility map', 'brak danych – sprawdź mapę uzbrojenia w starostwie') : s === 'absent' ? T('none within ~300 m', 'brak w promieniu ok. 300 m') : s === 'at' ? T(`at the parcel (${d} m)`, `przy działce (${d} m)`) : T(`about ${d} m away`, `ok. ${d} m od działki`); };
  const risks: Item[] = [], strengths: Item[] = [], checks: string[] = [];

  // Project fit first: this is what the showroom visitor asks.
  if (c.buildings && c.failing) risks.push({ title: T('The design breaks the setbacks', 'Projekt narusza odległości od granic'), text: T(`${c.failing} building(s) stand closer to the boundary than their setback. Move or mirror the design, or pick a narrower variant.`, `Budynki bliżej granicy niż wymagana odległość: ${c.failing}. Przesuń lub odbij projekt albo wybierz węższy wariant.`) });
  else if (c.buildings) strengths.push({ title: T('The design fits the parcel', 'Projekt mieści się na działce'), text: T(`${c.houseName ?? 'The house'} keeps every setback; ${dec(c.coverage, pl)}% of the parcel is built over.`, `${c.houseName ?? 'Dom'} zachowuje wszystkie odległości od granic; zabudowa zajmuje ${dec(c.coverage, pl)}% działki.`) });
  if (maxCover !== undefined && c.buildings) (c.coverage > maxCover ? risks : strengths).push({ title: T(`Plan limit: ${maxCover}% built-over area`, `Limit planu: ${maxCover}% powierzchni zabudowy`), text: c.coverage > maxCover ? T(`The design covers ${dec(c.coverage, pl)}% – above the plan's limit.`, `Projekt zajmuje ${dec(c.coverage, pl)}% – więcej niż dopuszcza plan.`) : T(`The design covers ${dec(c.coverage, pl)}%, within the limit.`, `Projekt zajmuje ${dec(c.coverage, pl)}%, w granicach limitu.`) });
  if (planned === true) { strengths.push({ title: T('Local plan in force', 'Obowiązuje plan miejscowy'), text: siteSummary('planning', layers!.planning) }); checks.push(T('Extract and drawing of the local plan (wypis i wyrys): confirm the zone symbol and building parameters.', 'Wypis i wyrys z planu miejscowego – potwierdzenie symbolu terenu i parametrów zabudowy.')); }
  else if (planned === false) { risks.push({ title: T('No local plan at the parcel', 'Brak planu miejscowego'), text: T('A house needs a zoning decision (WZ) first: the statutory deadline is 1 month, 2 for complex cases (Code of Administrative Procedure, art. 35), with parameters taken from the neighbouring buildings.', 'Dom wymaga najpierw decyzji o warunkach zabudowy (WZ): ustawowy termin to 1 miesiąc, 2 w sprawach szczególnie skomplikowanych (art. 35 KPA), parametry wynikają z sąsiedniej zabudowy.'), cost: T('stamp duty 598 zł (Stamp Duty Act)', 'opłata skarbowa 598 zł (ustawa o opłacie skarbowej)') }); checks.push(T('Apply for a zoning decision (WZ) or check the municipality’s general plan.', 'Wniosek o decyzję o warunkach zabudowy (WZ) lub sprawdzenie planu ogólnego gminy.')); }

  // Utilities
  if (netState('water') === 'absent') risks.push({ title: T('No water main nearby', 'Brak wodociągu'), text: T('A drilled well is needed; ask a local well driller about the depth of water.', 'Potrzebna studnia głębinowa; o głębokość wody zapytaj lokalną firmę studniarską.') });
  if (netState('sewer') === 'absent') risks.push({ title: T('No sewer nearby', 'Brak kanalizacji'), text: T('A septic tank or a household treatment plant is needed.', 'Potrzebne szambo albo przydomowa oczyszczalnia ścieków.') });
  if (netState('gas') === 'absent') risks.push({ title: T('No gas network', 'Brak gazu'), text: T('Plan a heat pump or another heat source.', 'Zaplanuj pompę ciepła lub inne źródło ogrzewania.') });
  if (netState('power') === 'absent' || netState('power') === 'far') risks.push({ title: T('Power network far from the parcel', 'Prąd daleko od działki'), text: T('The grid operator may need to extend the network before connecting the house.', 'Operator może wymagać rozbudowy sieci przed przyłączeniem domu.') });
  for (const id of ['water', 'sewer'] as const) if (netState(id) === 'near' || netState(id) === 'far') risks.push({ title: T(`${nets[id]}: long connection`, `${nets[id]}: długie przyłącze`), text: T(`The network is about ${dist[id]} m from the parcel.`, `Sieć jest ok. ${dist[id]} m od działki.`) });
  const at = networks.filter(id => netState(id) === 'at');
  if (at.length) strengths.push({ title: T(`${at.length} of 4 networks at the parcel`, `${at.length} z 4 sieci przy działce`), text: at.map(id => nets[id]).join(', ') });
  checks.push(T('Connection conditions from the power, water and gas operators.', 'Warunki przyłączenia od operatorów sieci (energia, woda, gaz).'));

  // Access
  const road = osm?.road;
  if (osm?.status === 'ok') {
    if (!road || road.distance > 25) risks.push({ title: T('Access to a public road to verify', 'Dostęp do drogi publicznej do weryfikacji'), text: road ? T(`The nearest mapped road is ${road.distance} m away. Without legal access there is no building permit – check the cadastral map (use “dr”) or set up an easement.`, `Najbliższa droga na mapie jest ${road.distance} m od działki. Bez prawnie zapewnionego dojazdu nie będzie pozwolenia na budowę – sprawdź mapę ewidencyjną (użytek „dr”) albo ustanów służebność drogi.`) : T('No mapped road within 250 m.', 'Brak drogi na mapie w promieniu 250 m.') });
    else if (road.detail === 'nieutwardzona') risks.push({ title: T('Unpaved access road', 'Nieutwardzona droga dojazdowa'), text: T(`${road.name ?? 'The road'} is unpaved: harder access after rain and for construction lorries.`, `${road.name ?? 'Droga'} jest nieutwardzona – po deszczu i dla ciężkiego sprzętu dojazd bywa trudny.`) });
    else strengths.push({ title: T('Road at the parcel', 'Droga przy działce'), text: `${road.name ? road.name + ' – ' : ''}${road.kind}${road.detail ? ', ' + road.detail : ''}` });
  }
  const category = roadCategory(road?.ref);
  if (road && category) { const [built, open] = roadSetback[category]; checks.push(T(`${road.name ?? road.ref} is a ${category} road (${road.ref}): the house must stand at least ${built} m from the carriageway edge in a built-up area, ${open} m elsewhere (art. 43 of the Public Roads Act); the road authority may allow less in justified cases.`, `${road.name ?? road.ref} to droga ${category} (${road.ref}): budynek co najmniej ${built} m od zewnętrznej krawędzi jezdni w terenie zabudowy, ${open} m poza nim (art. 43 ustawy o drogach publicznych); zarządca drogi może w uzasadnionych przypadkach zgodzić się na mniej.`)); }
  const pop = ins?.stats?.population ?? [], first = pop[0], last = pop[pop.length - 1];
  if (first && last && first !== last) { const change = (last.val - first.val) / first.val * 100, txt = `GUS: ${n0(first.val)} (${first.year}) → ${n0(last.val)} (${last.year})`;
    if (change > 0) strengths.push({ title: T(`The commune is growing: +${dec(change, pl)}% residents since ${first.year}`, `Gmina rośnie: +${dec(change, pl)}% mieszkańców od ${first.year}`), text: txt });
    else if (change < -1) risks.push({ title: T(`The commune is shrinking: ${dec(change, pl)}% residents since ${first.year}`, `Gmina się wyludnia: ${dec(change, pl)}% mieszkańców od ${first.year}`), text: txt }); }
  checks.push(T('Cadastral map and land register extract: is the access road a municipal road parcel (“dr”)?', 'Mapa ewidencyjna i wypis z rejestru gruntów: czy droga dojazdowa to działka drogowa gminy („dr”).'));

  // Ground, water, nature
  if (soil.valuable) { risks.push({ title: T('Valuable farmland (class I–III)', 'Grunt rolny klas I–III'), text: T('Outside city limits building needs a decision excluding the land from farming, a one-off fee and annual charges.', 'Poza granicami miast budowa wymaga decyzji o wyłączeniu z produkcji rolnej, opłaty jednorazowej i opłat rocznych.') }); checks.push(T('Application to exclude the land from agricultural production.', 'Wniosek o wyłączenie gruntu z produkcji rolnej.')); }
  else if (soil.classes.length) strengths.push({ title: T(`Soil ${soil.classes.join(', ')}`, `Grunt ${soil.classes.join(', ')}`), text: T('Classes IV–VI: no farmland conversion fees for a house.', 'Klasy IV–VI: bez opłat za wyłączenie z produkcji rolnej pod dom.') });
  if (soil.forest) risks.push({ title: T('Forest land in the cadastre', 'Grunt leśny w ewidencji'), text: T('It must be excluded from forest production first; the State Forests may have a right of first refusal.', 'Wymaga wyłączenia z produkcji leśnej; Lasy Państwowe mogą mieć prawo pierwokupu.') });
  if (found('flood')) risks.push({ title: T('Flood hazard zone', 'Strefa zagrożenia powodziowego'), text: siteSummary('flood', layers!.flood) });
  if (found('groundwater')) risks.push({ title: T('Risk of groundwater flooding', 'Ryzyko podtopień'), text: T('A basement may be impractical.', 'Podpiwniczenie może być nieopłacalne.') });
  if (found('groundwater') || (terrain && terrain.slopePercent >= 5)) checks.push(T('Geotechnical survey of the ground and water table.', 'Badania geotechniczne gruntu i poziomu wód gruntowych.'));
  if (found('landslides')) risks.push({ title: T('Landslide area', 'Teren osuwiskowy'), text: siteSummary('landslides', layers!.landslides) });
  if (found('mining')) risks.push({ title: T('Mining area or deposit', 'Teren górniczy lub złoże'), text: siteSummary('mining', layers!.mining) });
  if (found('environment')) risks.push({ title: T('Nature protection area', 'Forma ochrony przyrody'), text: siteSummary('environment', layers!.environment) });
  if (found('heritage')) { risks.push({ title: T('Registered monument', 'Zabytek w rejestrze'), text: T('Works need the heritage officer’s permit.', 'Prace wymagają pozwolenia konserwatora zabytków.') }); checks.push(T('Guidelines from the voivodeship heritage officer.', 'Wytyczne wojewódzkiego konserwatora zabytków.')); }
  if (layers && !found('flood') && !found('groundwater') && !found('landslides')) strengths.push({ title: T('Outside flood, groundwater and landslide areas', 'Poza strefami powodzi, podtopień i osuwisk'), text: T('At the parcel point on the official maps.', 'W punkcie działki na mapach urzędowych.') });
  if (terrain && zs.length) (terrain.slopePercent >= 5 ? risks : strengths).push({ title: T(`${terrain.slopePercent >= 5 ? 'Sloping' : 'Flat'} terrain (${dec(terrain.slopePercent, pl)}%)`, `${terrain.slopePercent >= 5 ? 'Teren ze spadkiem' : 'Płaski teren'} (${dec(terrain.slopePercent, pl)}%)`), text: `${dec(Math.min(...zs), pl)}–${dec(Math.max(...zs), pl)} m n.p.m.` });
  if (osm?.forest && osm.forest.distance < 12) risks.push({ title: T(`Forest ${osm.forest.distance} m from the parcel`, `Las ${osm.forest.distance} m od działki`), text: T('Check the fire-safety distance of the house from the forest edge (§ 271 WT, 12 m).', 'Sprawdź wymaganą odległość domu od granicy lasu (§ 271 WT, 12 m).') });
  for (const p of osm?.powerLines ?? []) if ((p.kind === 'linia WN' && p.distance < 60) || (p.kind === 'linia SN' && p.distance < 15)) risks.push({ title: `${p.kind} ${p.distance} m ${T('away', 'od działki')}`, text: T('The protection strip under the line may limit where the house can stand.', 'Pas technologiczny linii może ograniczyć miejsce na dom.') });
  const nuisance = (osm?.nuisance ?? []).filter(x => x.distance < 1000);
  for (const x of nuisance) risks.push({ title: `${x.kind} ${x.distance} m ${T('away', 'od działki')}`, text: x.name ?? '' });
  if (osm?.status === 'ok' && osm.source !== 'tiles' && !nuisance.length) strengths.push({ title: T('Quiet surroundings', 'Spokojne otoczenie'), text: T('No industrial sites, landfills, motorways or airports mapped within 1 km.', 'Brak zakładów, składowisk, dróg szybkiego ruchu i lotnisk w promieniu 1 km.') });
  const drive = ins?.drives[0];
  if (drive) strengths.push({ title: T(`${drive.minutes} min to ${drive.name}`, `${drive.minutes} min do: ${drive.name}`), text: `${dec(drive.km, pl)} km ${T('by car', 'samochodem')}` });
  checks.push(T('Land and mortgage register (księga wieczysta): encumbrances, easements, mortgages.', 'Księga wieczysta – obciążenia, służebności, hipoteki.'));
  checks.push(T('Map for design purposes from a surveyor (needed for the building permit).', 'Mapa do celów projektowych od geodety (potrzebna do pozwolenia na budowę).'));
  return { risks, strengths, checks, soil, use, planned, netText, nets, osm, ins, zs, category };
}
export type InsightFacts = ReturnType<typeof insightFacts>;

/** Summary in a sales advisor's words: what fits, what is there, what to check. No buy/don't-buy rating. */
export function summaryWriteUp(c: InsightContext, f: InsightFacts) {
  const pl = c.lang === 'pl', T = (en: string, plText: string) => pl ? plText : en, a = f.ins?.admin, id = c.scene.parcel?.identifier;
  const n = (v: number) => new Intl.NumberFormat(pl ? 'pl-PL' : 'en-GB').format(Math.round(v)), where = a ? `${a.region} (gm. ${a.commune}, ${a.county})` : '';
  const parts = [
    T(`Parcel ${id ?? ''}${where ? ' in ' + where : ''} has ${n(c.area)} m². Keeping 4 m from the boundaries leaves ${n(c.buildable)} m² for the house.`, `Działka ${id ?? ''}${where ? ', ' + where + ',' : ''} ma ${n(c.area)} m². Po zachowaniu 4 m od granic na dom zostaje ${n(c.buildable)} m².`),
    c.buildings ? (c.failing ? T(`The chosen design does not fit yet: ${c.failing} building(s) break the setbacks.`, `Wybrany projekt jeszcze się nie mieści: budynki naruszające odległości od granic: ${c.failing}.`) : T(`${c.houseName ?? 'The chosen design'} fits and covers ${dec(c.coverage, pl)}% of the parcel.`, `${c.houseName ?? 'Wybrany projekt'} mieści się na działce i zajmuje ${dec(c.coverage, pl)}% jej powierzchni.`)) : T('No design is placed on the parcel yet.', 'Na działce nie ustawiono jeszcze projektu.'),
    f.planned === true ? T('A local plan applies: the house is designed from it, without a zoning decision.', 'Obowiązuje plan miejscowy: dom projektuje się na jego podstawie, bez decyzji o warunkach zabudowy.') : f.planned === false ? T('There is no local plan at the parcel, so a zoning decision (WZ) comes first.', 'Dla działki nie ma planu miejscowego, więc najpierw potrzebna jest decyzja o warunkach zabudowy.') : '',
    !c.site ? '' : networks.every(id => f.netText(id) === f.netText('power')) ? `${T('Utilities', 'Media')}: ${f.netText('power')}.` : `${T('Utilities', 'Media')}: ${networks.map(id => `${f.nets[id].toLowerCase()} – ${f.netText(id)}`).join('; ')}.`,
    f.osm?.road ? `${T('Access', 'Dojazd')}: ${f.osm.road.name ? f.osm.road.name + ', ' : ''}${f.osm.road.kind}, ${f.osm.road.distance} m${f.osm.road.detail ? ', ' + f.osm.road.detail : ''}.` : '',
    f.ins?.prices.status === 'ok' ? T(`Comparable land nearby sold for a median ${f.ins.prices.median} zł/m², about ${zl(f.ins.prices.estimate!)} for this parcel.`, `Porównywalne grunty w okolicy sprzedawano po medianie ${f.ins.prices.median} zł/m², co dla tej działki daje ok. ${zl(f.ins.prices.estimate!)}.`) : '',
    f.risks.length ? T(`To settle before signing: ${f.risks.slice(0, 4).map(r => r.title.toLowerCase()).join('; ')}.`, `Do wyjaśnienia przed decyzją: ${f.risks.slice(0, 4).map(r => r.title.toLowerCase()).join('; ')}.`) : c.site ? T('The registers show no issues at the parcel.', 'Rejestry nie pokazują problemów w punkcie działki.') : '',
  ].filter(Boolean);
  return `<section class="summary"><h2>${T('Summary', 'Podsumowanie')}</h2><p>${esc(parts.join(' '))}</p></section>`;
}

const dataImage = (src?: string) => src && src.length < 4e6 && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(src) ? src : '';
const fmtDate = (iso: string) => iso.split('-').reverse().join('.');
/** Risks, strengths, detailed analysis, land history, prices, listings and checklist. */
export function insightSections(c: InsightContext, f: InsightFacts) {
  const pl = c.lang === 'pl', T = (en: string, plText: string) => pl ? plText : en, site = c.site, osm = f.osm, ins = f.ins;
  const list = (items: Item[], cls: string) => items.length ? `<ol class="${cls}">${items.map(i => `<li><b>${esc(i.title.charAt(0).toUpperCase() + i.title.slice(1))}</b>${i.cost ? ` <span class="cost">${esc(i.cost)}</span>` : ''}${i.text ? `<br><small>${esc(i.text)}</small>` : ''}</li>`).join('')}</ol>` : `<p>${T('None found.', 'Nic nie znaleziono.')}</p>`;
  const rows = (pairs: [string, string | undefined][]) => `<table>${pairs.filter(([, v]) => v).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>`;
  const near = (x?: { name?: string; kind: string; distance: number; detail?: string }) => x ? `${x.name ? x.name + ', ' : ''}${m(x.distance)}${x.detail ? ' · ' + x.detail : ''}` : osm?.status === 'ok' ? T('none nearby', 'brak w pobliżu') : undefined;
  const card = (title: string, source: string, body: string) => `<article class="site"><h3>${esc(title)}</h3><small>${esc(source)}</small>${body}</article>`;
  const terrain = c.scene.terrain;
  const ground = card(T('Land register and ground', 'Ewidencja gruntów i teren'), 'EGiB / KIEG, NMT GUGiK', rows([
    [T('Land use and soil class', 'Użytki i klasy'), f.use || undefined],
    [T('Farmland conversion', 'Wyłączenie z produkcji rolnej'), f.soil.classes.length ? (f.soil.valuable ? T('needed, fees for classes I–III', 'wymagane, opłaty dla klas I–III') : T('no fees (classes IV–VI)', 'bez opłat (kl. IV–VI)')) : f.soil.built ? T('already building land', 'grunt już budowlany') : undefined],
    [T('Elevation', 'Rzędne terenu'), f.zs.length ? `${dec(Math.min(...f.zs), pl)}–${dec(Math.max(...f.zs), pl)} m n.p.m.` : undefined],
    [T('Average slope', 'Średni spadek'), terrain ? `${dec(terrain.slopePercent, pl)}%` : undefined],
  ]));
  const media = card(T('Utilities', 'Media i uzbrojenie terenu'), 'GESUT / KIUT', rows(networks.map(id => [f.nets[id], site ? f.netText(id) : undefined])) + `<p><small>${T('Measured on the county utility map from the parcel boundary; confirm on the map for design purposes.', 'Zmierzone na mapie uzbrojenia powiatu od granicy działki; potwierdź na mapie do celów projektowych.')}</small></p>`);
  const access = card(T('Road and transport', 'Droga, ruch i komunikacja'), 'OpenStreetMap, OSRM', rows([
    [T('Nearest road', 'Najbliższa droga'), osm?.road ? `${osm.road.name ? osm.road.name + ' – ' : ''}${osm.road.kind}, ${m(osm.road.distance)}` : near()],
    [T('Surface', 'Nawierzchnia'), osm?.road?.detail],
    [T('Road category', 'Kategoria drogi'), osm?.road ? (f.category ? `${f.category} (${osm.road.ref})` : T('number not in the map data', 'brak numeru drogi w danych mapy')) : undefined],
    [T('Min. distance from the carriageway', 'Min. odległość od jezdni'), f.category ? T(`${roadSetback[f.category][0]} m built-up / ${roadSetback[f.category][1]} m elsewhere (art. 43 Public Roads Act)`, `${roadSetback[f.category][0]} m w terenie zabudowy / ${roadSetback[f.category][1]} m poza nim (art. 43 ustawy o drogach publicznych)`) : undefined],
    [T('Bus stop', 'Przystanek autobusowy'), near(osm?.busStop)],
    [T('Railway', 'Kolej'), osm?.source === 'tiles' && !osm.rail ? T('none within ~2 km', 'brak w promieniu ok. 2 km') : near(osm?.rail)],
    ...(ins?.drives ?? []).map(d => [d.name, `${dec(d.km, pl)} km, ${T('about', 'ok.')} ${d.minutes} min ${T('by car', 'autem')}`] as [string, string]),
  ]));
  const heritage = site?.layers.heritage?.status;
  const nature = card(T('Nature and surroundings', 'Przyroda i otoczenie'), 'OpenStreetMap, GDOŚ, NID', rows([
    [T('Forest', 'Las'), near(osm?.forest)],
    [T('Watercourse', 'Najbliższy ciek'), near(osm?.water)],
    [T('Power lines', 'Linie energetyczne'), osm?.source === 'tiles' ? T('no data this time – generate the report again', 'brak danych tym razem – wygeneruj raport ponownie') : osm?.status === 'ok' ? (osm.powerLines.length ? osm.powerLines.map(p => `${p.kind}${p.detail ? ' ' + p.detail : ''}: ${m(p.distance)}`).join(', ') : T('none within 1.2 km', 'brak w promieniu 1,2 km')) : undefined],
    [T('Nuisance sites', 'Obiekty uciążliwe'), osm?.status === 'ok' ? (osm.nuisance.length ? osm.nuisance.map(x => `${x.kind}: ${m(x.distance)}`).join(', ') : T('none mapped nearby', 'brak w pobliżu')) : undefined],
    [T('Buildings within 200 m', 'Budynki w promieniu 200 m'), osm?.buildings200 !== undefined ? String(osm.buildings200) : c.neighbours !== undefined ? String(c.neighbours) : undefined],
    [T('Heritage register', 'Rejestr zabytków'), heritage === 'found' ? T('monument at the parcel', 'zabytek w punkcie działki') : heritage === 'none' ? T('none', 'brak') : heritage ? T('no answer', 'brak odpowiedzi') : undefined],
  ]));
  const amen = osm?.amenities;
  const daily = card(T('Everyday places', 'Na co dzień'), T('OpenStreetMap, straight-line distance to the parcel', 'OpenStreetMap, odległość w linii prostej od działki'), osm?.status !== 'ok' ? '' : !amen ? `<p><small>${T('No data this time – generate the report again.', 'Brak danych tym razem – wygeneruj raport ponownie.')}</small></p>` : rows(['szkoła', 'przedszkole', 'sklep spożywczy', 'apteka', 'przychodnia'].map(kind => { const a = amen.find(x => x.kind === kind); return [kind.charAt(0).toUpperCase() + kind.slice(1), a ? `${a.name ? a.name + ', ' : ''}${m(a.distance)}` : osm.source === 'tiles' ? T('none within ~2 km', 'brak w promieniu ok. 2 km') : T('none within 3 km', 'brak w promieniu 3 km')] as [string, string]; })));
  const sol = ins?.solar, air = ins?.air, st = ins?.stats;
  const series = (xs: Stat[], unit = '') => xs.length ? xs.map(x => `${x.year}: ${n0(x.val)}${unit}`).join(' · ') : undefined;
  const solar = card(T('Solar energy', 'Energia słoneczna'), `PVGIS 5.3 (JRC, ${T('European Commission', 'Komisja Europejska')})${sol ? `, ${sol.database} ${sol.years}` : ''}`, sol ? rows([
    [T('Yearly yield of 1 kWp', 'Roczna produkcja z 1 kWp'), `${n0(sol.kwhPerKwp)} kWh`],
    [T('Best fixed setting', 'Optymalne ustawienie'), T(`${sol.angle}° tilt, azimuth ${sol.azimuth}° (0° = south)`, `nachylenie ${sol.angle}°, azymut ${sol.azimuth}° (0° = południe)`)],
  ]) + `<p><small>${T('PVGIS default 14% system losses; terrain horizon included.', 'Straty instalacji 14% (domyślne PVGIS); uwzględniony horyzont terenu.')}</small></p>` : `<p>${T('PVGIS did not answer.', 'PVGIS nie odpowiedział.')}</p>`);
  const airCard = card(T('Air quality', 'Jakość powietrza'), T('GIOŚ, state monitoring network', 'GIOŚ, Państwowy Monitoring Środowiska'), air ? rows([
    [T('Nearest station', 'Najbliższa stacja'), `${air.station}, ${dec(air.distance / 1000, pl)} km`],
    [T('Index at report time', 'Indeks w chwili raportu'), `${air.index}${air.at ? ` (${air.at})` : ''}`],
  ]) + `<p><small>${T('A single reading, not a yearly average.', 'Pojedynczy odczyt, nie średnia roczna.')}</small></p>` : `<p>${T('GIOŚ did not answer.', 'GIOŚ nie odpowiedział.')}</p>`);
  const commune = card(T('The commune in numbers', 'Gmina w liczbach'), `GUS, Bank Danych Lokalnych${st ? ' · ' + st.unit : ''}`, st ? rows([
    [T('Residents', 'Ludność'), series(st.population)],
    [T('New homes completed', 'Mieszkania oddane do użytkowania'), series(st.dwellings)],
    [T('Net migration', 'Saldo migracji'), series(st.migration)],
    [T('Average time to build a house', 'Średni czas budowy domu jednorodzinnego'), st.buildMonths.length ? `${dec(st.buildMonths[st.buildMonths.length - 1].val, pl)} ${T('months', 'mies.')} (${st.buildMonths[st.buildMonths.length - 1].year})` : undefined],
  ]) : `<p>${T('GUS did not answer.', 'GUS nie odpowiedział.')}</p>`);
  const shots = (site?.history ?? []).filter(h => dataImage(h.image));
  const history = shots.length ? `<h2>${T('Land history: archival orthophotos', 'Historia terenu: archiwalne ortofotomapy')}</h2><p>${T('Compare the pictures for old ponds, dumps, embankments or cleared forest: they change foundation costs.', 'Porównaj zdjęcia: dawne stawy, wysypiska, nasypy czy wycinki lasu zmieniają koszt fundamentów.')}</p><div class="views">${shots.map(h => `<figure><img alt="${esc(fmtDate(h.date))}" src="${dataImage(h.image)}"><figcaption>${esc(fmtDate(h.date))} · ${esc(h.series)} · GUGiK</figcaption></figure>`).join('')}${dataImage(site!.ortho.image) ? `<figure><img alt="" src="${dataImage(site!.ortho.image)}"><figcaption>${T('Current mosaic', 'Obecna mozaika')} · GUGiK</figcaption></figure>` : ''}</div>` : '';
  const p = ins?.prices;
  const prices = ins ? `<h2>${T('Prices and valuation', 'Ceny i wycena')}</h2>${p?.status === 'ok' ? `<section class="cards"><div class="card"><small>${T('Median notarial price', 'Mediana cen z aktów notarialnych')}</small><b>${p.median} zł/m²</b><em>${p.q1}–${p.q3} zł/m² · ${p.count} ${T('sales', 'transakcji')}</em></div><div class="card"><small>${T('Estimated land value', 'Szacunkowa wartość gruntu')}</small><b>${zl(p.estimate!)}</b><em>${zl(p.q1! * c.area)} – ${zl(p.q3! * c.area)}</em></div></section>
    <table><tr><th>${T('Date', 'Data')}</th><th>${T('Place', 'Miejscowość')}</th><th>${T('Area', 'Powierzchnia')}</th><th>${T('Price', 'Cena')}</th><th>zł/m²</th></tr>${p.sales.map(s => `<tr><td>${esc(fmtDate(s.date))}</td><td>${esc(s.place ?? '')}</td><td>${esc(m(s.area))}²</td><td>${esc(zl(s.price))}</td><td>${s.perM2}</td></tr>`).join('')}</table>
    <p><small>${T(`Undeveloped land sold on the open market within ${p.radius / 1000} km in the last 4 years${p.buildingOnly ? ' (housing land only)' : ''}; national price register RCN, GUGiK. Indicative only: a valuation needs a licensed appraiser.`, `Grunty niezabudowane sprzedane na wolnym rynku w promieniu ${String(p.radius / 1000).replace('.', ',')} km w ostatnich 4 latach${p.buildingOnly ? ' (tylko tereny pod zabudowę mieszkaniową)' : ''}; Rejestr Cen Nieruchomości, GUGiK. Wartość poglądowa – wycenę sporządza rzeczoznawca majątkowy.`)}</small></p>` : `<p>${p?.status === 'error' ? T('The price register did not respond.', 'Rejestr cen nie odpowiedział.') : T('No comparable land sales in the price register nearby.', 'Brak porównywalnych transakcji gruntami w rejestrze cen w okolicy.')}</p>`}` : '';
  const l = ins?.listings, listed = l?.items.filter(i => i.price) ?? [], perM2 = listed.filter(i => i.perM2).map(i => i.perM2!).sort((a, b) => a - b);
  const listings = ins ? `<h2>${T('Market check: listings nearby', 'Weryfikacja rynkowa: ogłoszenia w okolicy')}</h2>${l?.match ? `<p class="match"><b>${T('This parcel may be listed for sale', 'Ta działka może być wystawiona na sprzedaż')}:</b> <a href="${esc(l.match.url)}">${esc(l.match.title)}</a>${l.match.price ? ` – ${esc(zl(l.match.price))}` : ''}</p>` : ''}${listed.length ? `<p>${T(`${listed.length} plots for sale nearby; median asking price`, `Działki na sprzedaż w okolicy: ${listed.length}; mediana ceny ofertowej`)} <b>${perM2.length ? perM2[Math.floor(perM2.length / 2)] + ' zł/m²' : '–'}</b>${p?.median && perM2.length ? T(` (notarial median ${p.median} zł/m²)`, ` (mediana z aktów ${p.median} zł/m²)`) : ''}.</p><table><tr><th>${T('Listing', 'Ogłoszenie')}</th><th>${T('Area', 'Pow.')}</th><th>${T('Price', 'Cena')}</th><th>zł/m²</th></tr>${listed.slice(0, 12).map(i => `<tr><td><a href="${esc(i.url)}">${esc(i.title)}</a><br><small>${esc(i.source)}${i.place ? ' · ' + esc(i.place) : ''}${i.distance !== undefined ? ' · ' + esc(m(i.distance)) : ''}</small></td><td>${i.area ? esc(m(i.area)) + '²' : ''}</td><td>${esc(zl(i.price!))}</td><td>${i.perM2 ?? ''}</td></tr>`).join('')}</table>` : `<p>${l?.status === 'error' ? T('The listing portals did not answer.', 'Portale ogłoszeniowe nie odpowiedziały.') : T('No plot listings found nearby.', 'Nie znaleziono ogłoszeń działek w okolicy.')}</p>`}<p><small>${T('Otodom and OLX, read when the report was made.', 'Otodom i OLX, odczyt w chwili tworzenia raportu.')}</small></p>` : '';
  return `<h2>${T('Risks to check', 'Ryzyka do sprawdzenia')}</h2>${list(f.risks, 'risks')}
  <h2>${T('Strengths', 'Mocne strony')}</h2>${list(f.strengths, 'strengths')}
  <h2>${T('Detailed analysis', 'Szczegółowa analiza')}</h2>${osm?.status === 'error' ? `<p><small>${T('OpenStreetMap did not answer in time: road, transport and surroundings are missing. Generate the report again in a moment.', 'OpenStreetMap nie odpowiedział na czas: brak danych o drodze, komunikacji i otoczeniu. Wygeneruj raport ponownie za chwilę.')}</small></p>` : ''}<div class="sitegrid">${ground}${media}${access}${nature}${daily}</div>
  ${ins ? `<h2>${T('Energy, air and the commune', 'Energia, powietrze i gmina')}</h2><div class="sitegrid">${solar}${airCard}${commune}</div>` : ''}
  ${history}${prices}${listings}
  <h2>${T('Checklist before buying and designing', 'Lista kontrolna przed zakupem i projektem')}</h2><ol class="checks">${[...new Set(f.checks)].map(x => `<li>${esc(x)}</li>`).join('')}</ol>`;
}
