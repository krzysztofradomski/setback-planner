import { ProjectHistory, saveVariant, readVariants } from './core/projects.ts';
import { parseScene, serializeScene, encodeShare, decodeShare, plainShare, MAX_PROJECT_BYTES } from './core/scene.ts';
import { containsPolygon, polygonRelation, validRing } from './core/geometry.ts';

(async () => {
  const $ = s => document.querySelector(s);
  const svg = $('#sheet'), scene = $('#scene');

  // ---------- i18n ----------
  const I18N = {
    en: {
      redo:'Redo', downloadProject:'Download JSON', openFile:'Open JSON file', variants:'Local variants', variantName:'Variant name', saveVariant:'Save as variant', openVariant:'Open variant', variantHint:'Stored only in this browser, up to 20 variants. Download JSON for a backup.', variantError:'Could not save or read variants. Check the name, storage space and 20-variant limit.',
      docTitle: 'Setback Planner', title: 'Setback Planner', tagline: 'Plot outline on a 1 m grid, buildings, and every clearance.',
      language: 'Language', controls: 'Controls', addBuilding: 'Add building', house: 'House', garage: 'Garage', buildings: 'Buildings',
      plot: 'Plot', area: 'Area', perimeter: 'Perimeter', side: 'Side', cornersHint: 'Drag the corner points A–D on the plan, or type coordinates.',
      rectW: 'Rectangle width in metres', rectD: 'Rectangle depth in metres', makeRect: 'Make rectangle',
      drawing: 'Drawing', snapTo: 'Snap to', off: 'Off', dimsFor: 'Dimensions for', allBuildings: 'All buildings', selectedOnly: 'Selected only',
      showGaps: 'Show gaps between buildings', save: 'Save', copyLink: 'Copy share link', copyJson: 'Copy plan JSON', resetExample: 'Reset example',
      resetConfirm: 'Click again to reset', loadFromJson: 'Load plan from JSON', pastePlan: 'Paste a copied plan', loadPlan: 'Load plan',
      autosaveHint: 'Your plan autosaves in this browser and in the page address, so the link always opens this exact plan.',
      foot: 'Drag empty space to pan, scroll or pinch to zoom. With a building selected: <kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> nudge, <kbd>R</kbd> rotates 90°, <kbd>Del</kbd> removes. <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes.<br>Default setbacks follow Polish WT §12: 4&nbsp;m for a wall with windows or doors facing the boundary, 3&nbsp;m for a blank wall. Check your local plan (MPZP) for building lines.',
      plotPlan: 'Plot plan', undo: 'Undo', undoTitle: 'Undo (Ctrl+Z)', zoomOut: 'Zoom out', zoomIn: 'Zoom in', fit: 'Fit', fitTitle: 'Fit plot to view',
      lgBoundary: 'to boundary', lgBetween: 'between buildings', lgBelow: 'below min. setback',
      selection: 'Selection', selectionHint: 'Select a building on the plan to change its size, rotation and minimum setback. Drag its corner squares to resize it.',
      selected: 'Selected', name: 'Name', width: 'Width (m)', depth: 'Depth (m)', rotation: 'Rotation (°)', minSetback: 'Min. setback (m)',
      rotate90: 'Rotate 90°', duplicate: 'Duplicate', del: 'Delete', clearance: 'Clearance to boundary', gaps: 'Gaps to other buildings',
      outside: 'Part of the building is outside the plot', check: 'Check', noBoundary: 'No boundary', wall: '{side} wall', under: 'Under {v} m', ok: 'OK',
      Right: 'Right', Left: 'Left', Top: 'Top', Bottom: 'Bottom',
      overlap: 'Overlap', wallToWall: 'Wall to wall', corner: 'Corner', noOthers: 'No other buildings yet.',
      noBuildings: 'No buildings yet. Add a house or garage above; it lands in the middle of the plot.',
      built: 'built {v} %', toCheck: '{n} to check', allMet: 'Geometric checks passed', cornerAxis: 'Corner {c} {axis} in metres', copySuffix: ' copy',
      nothingToUndo: 'Nothing to undo', removed: '{name} removed. Ctrl+Z brings it back.', badRect: 'Enter a width and depth above 0 m',
      jsonBlocked: 'Copy blocked here. The JSON is selected below.', jsonCopied: 'Plan copied as JSON',
      linkBlocked: 'Copy blocked here. Copy the address bar instead.', linkCopied: 'Link copied',
      notAPlan: 'That text is not a plan. Paste JSON copied from this tool.', planLoaded: 'Plan loaded', planFromLink: 'Plan loaded from link',
      exampleRestored: 'Example restored. Ctrl+Z undoes this.',
    },
    pl: {
      redo:'Ponów', downloadProject:'Pobierz JSON', openFile:'Otwórz plik JSON', variants:'Warianty lokalne', variantName:'Nazwa wariantu', saveVariant:'Zapisz jako wariant', openVariant:'Otwórz wariant', variantHint:'Tylko w tej przeglądarce, do 20 wariantów. Pobierz JSON jako kopię zapasową.', variantError:'Nie można zapisać lub odczytać wariantów. Sprawdź nazwę, pamięć i limit 20 wariantów.',
      docTitle: 'Planer odległości od granic', title: 'Planer odległości', tagline: 'Obrys działki na siatce 1 m, budynki i wszystkie odległości.',
      language: 'Język', controls: 'Sterowanie', addBuilding: 'Dodaj budynek', house: 'Dom', garage: 'Garaż', buildings: 'Budynki',
      plot: 'Działka', area: 'Powierzchnia', perimeter: 'Obwód', side: 'Bok', cornersHint: 'Przeciągnij narożniki A–D na planie lub wpisz współrzędne.',
      rectW: 'Szerokość prostokąta w metrach', rectD: 'Głębokość prostokąta w metrach', makeRect: 'Utwórz prostokąt',
      drawing: 'Rysunek', snapTo: 'Przyciąganie', off: 'Wyłączone', dimsFor: 'Wymiary dla', allBuildings: 'Wszystkich budynków', selectedOnly: 'Tylko zaznaczonego',
      showGaps: 'Pokaż odstępy między budynkami', save: 'Zapis', copyLink: 'Kopiuj link do udostępnienia', copyJson: 'Kopiuj plan (JSON)', resetExample: 'Przywróć przykład',
      resetConfirm: 'Kliknij ponownie, aby przywrócić', loadFromJson: 'Wczytaj plan z JSON', pastePlan: 'Wklej skopiowany plan', loadPlan: 'Wczytaj plan',
      autosaveHint: 'Plan zapisuje się automatycznie w tej przeglądarce i w adresie strony, więc link zawsze otwiera dokładnie ten plan.',
      foot: 'Przeciągnij puste miejsce, aby przesunąć widok; przewiń lub uszczypnij, aby przybliżyć. Z zaznaczonym budynkiem: <kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> przesuwa, <kbd>R</kbd> obraca o 90°, <kbd>Del</kbd> usuwa. <kbd>Ctrl</kbd>+<kbd>Z</kbd> cofa.<br>Domyślne odległości wg §12 WT: 4&nbsp;m dla ściany z oknami lub drzwiami zwróconej w stronę granicy, 3&nbsp;m dla ściany bez otworów. Linie zabudowy sprawdź w miejscowym planie (MPZP).',
      plotPlan: 'Plan działki', undo: 'Cofnij', undoTitle: 'Cofnij (Ctrl+Z)', zoomOut: 'Oddal', zoomIn: 'Przybliż', fit: 'Dopasuj', fitTitle: 'Dopasuj działkę do widoku',
      lgBoundary: 'do granicy', lgBetween: 'między budynkami', lgBelow: 'poniżej min. odległości',
      selection: 'Zaznaczenie', selectionHint: 'Zaznacz budynek na planie, aby zmienić jego wymiary, obrót i minimalną odległość od granicy. Przeciągnij kwadraty w narożnikach, aby zmienić rozmiar.',
      selected: 'Zaznaczony', name: 'Nazwa', width: 'Szerokość (m)', depth: 'Głębokość (m)', rotation: 'Obrót (°)', minSetback: 'Min. odległość (m)',
      rotate90: 'Obróć o 90°', duplicate: 'Duplikuj', del: 'Usuń', clearance: 'Odległość od granicy', gaps: 'Odstępy od innych budynków',
      outside: 'Część budynku wychodzi poza działkę', check: 'Sprawdź', noBoundary: 'Brak granicy', wall: 'Ściana {side}', under: 'Poniżej {v} m', ok: 'OK',
      Right: 'prawa', Left: 'lewa', Top: 'górna', Bottom: 'dolna',
      overlap: 'Kolizja', wallToWall: 'Ściana–ściana', corner: 'Narożnik', noOthers: 'Brak innych budynków.',
      noBuildings: 'Brak budynków. Dodaj dom lub garaż powyżej; pojawi się na środku działki.',
      built: 'zabudowa {v} %', toCheck: 'Do sprawdzenia: {n}', allMet: 'Testy geometryczne spełnione', cornerAxis: 'Narożnik {c}, {axis} w metrach', copySuffix: ' kopia',
      nothingToUndo: 'Nie ma czego cofnąć', removed: 'Usunięto: {name}. Ctrl+Z przywraca.', badRect: 'Podaj szerokość i głębokość większe od 0 m',
      jsonBlocked: 'Kopiowanie zablokowane. JSON jest zaznaczony poniżej.', jsonCopied: 'Skopiowano plan jako JSON',
      linkBlocked: 'Kopiowanie zablokowane. Skopiuj adres z paska przeglądarki.', linkCopied: 'Skopiowano link',
      notAPlan: 'To nie jest plan. Wklej JSON skopiowany z tego narzędzia.', planLoaded: 'Wczytano plan', planFromLink: 'Wczytano plan z linku',
      exampleRestored: 'Przywrócono przykład. Ctrl+Z cofa.',
    },
  };
  const LANG_LS = 'setback-planner-lang';
  let lang = (() => {
    try { const s = localStorage.getItem(LANG_LS); if (I18N[s]) return s; } catch (e) {}
    return /^pl\b/i.test(navigator.language || '') ? 'pl' : 'en'; // ponytail: only pl is translated, everything else gets en
  })();
  const t = (k, v = {}) => (I18N[lang][k] ?? I18N.en[k]).replace(/\{(\w+)\}/g, (_, x) => v[x]);
  const dec = v => lang === 'pl' ? String(v).replace('.', ',') : String(v);
  function applyLang(){
    document.documentElement.lang = lang;
    document.title = t('docTitle');
    document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
    document.querySelectorAll('[data-t-html]').forEach(el => { el.innerHTML = t(el.dataset.tHtml); });
    document.querySelectorAll('[data-t-title]').forEach(el => { el.title = t(el.dataset.tTitle); });
    document.querySelectorAll('[data-t-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.tAria)); });
    document.querySelectorAll('#o-snap option:not([value="0"])').forEach(o => { o.textContent = dec(o.value) + ' m'; });
    document.querySelectorAll('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  }
  const TYPES = {
    house:  { w: 12, d: 10, setback: 4 },
    garage: { w: 6,  d: 6,  setback: 3 },
  };
  const LS = 'setback-planner-v1';
  const DEFAULT = () => ({
    plot: [{x:0,y:0},{x:24,y:0},{x:26,y:42},{x:-1,y:40}],
    items: [
      {id:'o1',type:'house', name:t('house'), x:12,  y:17, w:12, d:10, rot:0, setback:4},
      {id:'o2',type:'garage',name:t('garage'),x:20.5,y:31, w:6,  d:7,  rot:0, setback:3},
    ],
    snap: 0.5, dimScope: 'all', showPairs: true,
  });

  // ---------- state ----------
  let persistencePaused = false;
  function projectWarning(message, pause = true){
    persistencePaused = pause;
    const el = $('#project-warning'); el.hidden = false;
    el.textContent = message + (pause ? (lang === 'pl' ? ' Automatyczny zapis wstrzymany. Wczytaj poprawny projekt lub przywróć przykład.' : ' Autosave paused. Load a valid project or reset the example to continue.') : '');
  }
  function clean(o){ try { return parseScene(o); } catch { return null; } }
  function load(){
    try { const s = localStorage.getItem(LS); if (!s) return null;
      if (new TextEncoder().encode(s).length > MAX_PROJECT_BYTES) throw new Error('large');
      const result = clean(JSON.parse(s)); if (!result) throw new Error('invalid'); return result;
    } catch { projectWarning(lang === 'pl' ? 'Nie można odczytać zapisanego projektu.' : 'Stored project could not be read.'); return null; }
  }
  async function fromHash(){
    if (!location.hash) return null;
    try { return await decodeShare(location.hash); }
    catch { projectWarning(lang === 'pl' ? 'Nieprawidłowy lub nieobsługiwany link projektu.' : 'Invalid or unsupported project link.'); return null; }
  }
  let state = (await fromHash()) || load() || parseScene(DEFAULT());
  let saveT, saveRevision = 0;
  function save(){
    clearTimeout(saveT); const revision = ++saveRevision;
    if (persistencePaused) return;
    saveT = setTimeout(async () => {
      try {
        const json = serializeScene(state);
        localStorage.setItem(LS, json); $('#project-warning').hidden = true;
        const hash = await encodeShare(JSON.parse(json));
        if (revision === saveRevision && !persistencePaused) window.history.replaceState(null, '', hash);
      } catch { projectWarning(lang === 'pl' ? 'Nie można zapisać projektu. Sprawdź geometrię i pamięć przeglądarki.' : 'Project could not be saved. Check geometry and browser storage.', false); }
    }, 300);
  }
  let uid = state.items.reduce((m, i) => Math.max(m, parseInt(String(i.id).replace(/\D/g, '')) || 0), 0) + 1;
  let selected = state.items[0] ? state.items[0].id : null;
  const get = id => state.items.find(i => i.id === id);

  const history = new ProjectHistory();
  function snapshot(){ history.record(state); }
  function restoreHistory(next){
    if (!next){ toast(t('nothingToUndo')); return; }
    state = next;
    if (!get(selected)) selected = null;
    uid = state.items.reduce((m,i) => Math.max(m, parseInt(String(i.id).replace(/\D/g,'')) || 0),0)+1;
    $('#o-snap').value=String(state.snap); $('#o-dims').value=state.dimScope; $('#o-pairs').checked=state.showPairs;
    buildPanel(); render();
  }
  function undo(){ restoreHistory(history.undo(state)); }
  function redo(){ restoreHistory(history.redo(state)); }

  // ---------- geometry ----------
  const sub = (a,b) => ({x:a.x-b.x, y:a.y-b.y});
  const add = (a,b) => ({x:a.x+b.x, y:a.y+b.y});
  const mul = (a,k) => ({x:a.x*k, y:a.y*k});
  const dot = (a,b) => a.x*b.x + a.y*b.y;
  const cross = (a,b) => a.x*b.y - a.y*b.x;
  const len = a => Math.hypot(a.x, a.y);
  const edges = poly => poly.map((p,i) => [p, poly[(i+1) % poly.length]]);

  function corners(it){
    const r = it.rot * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), hw = it.w/2, hd = it.d/2;
    return [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([u,v]) => ({x: it.x + u*c - v*s, y: it.y + u*s + v*c}));
  }
  function rayHit(P, n, segs){
    let best = Infinity;
    for (const [Q,R] of segs){
      const e = sub(R,Q), den = cross(n,e);
      if (Math.abs(den) < 1e-12) continue;
      const w = sub(Q,P), t = cross(w,e)/den, s = cross(w,n)/den;
      if (t > 1e-9 && s >= -1e-9 && s <= 1 + 1e-9 && t < best) best = t;
    }
    return best;
  }
  // Shortest perpendicular distance from wall segment AB (outward normal n) to target segments.
  // The minimum of the nearest-hit distance lies at a wall end or where the ray passes a target vertex.
  function clearance(A, B, n, segs, verts){
    const ab = sub(B,A), L2 = dot(ab,ab), ss = [0, 1];
    for (const V of verts){ const s = dot(sub(V,A), ab) / L2; if (s > 0 && s < 1) ss.push(s); }
    let best = null;
    for (const s of ss){
      const P = add(A, mul(ab, s)), t = rayHit(P, n, segs);
      if (t < Infinity && (!best || t < best.t)) best = {P, Q: add(P, mul(n, t)), t};
    }
    return best;
  }
  const overlap = (a,b) => polygonRelation(a,b) !== 'disjoint';
  function closestOnSeg(V, Q, R){
    const e = sub(R,Q), L2 = dot(e,e);
    const s = L2 ? Math.max(0, Math.min(1, dot(sub(V,Q), e) / L2)) : 0;
    return add(Q, mul(e, s));
  }
  function outwardNormal(A, B){ const e = sub(B,A), L = len(e); return {x: e.y/L, y: -e.x/L}; }
  function sideName(n){
    const a = Math.atan2(n.y, n.x) * 180 / Math.PI;
    if (a > -45 && a <= 45) return 'Right';
    if (a > 45 && a <= 135) return 'Bottom';
    if (a > -135 && a <= -45) return 'Top';
    return 'Left';
  }
  function pairGap(ca, cb){
    if (overlap(ca, cb)) return {overlap: true, t: 0};
    let best = null;
    for (const [X,Y] of [[ca,cb],[cb,ca]]){
      const segs = edges(Y);
      for (let i = 0; i < 4; i++){
        const A = X[i], B = X[(i+1)%4];
        const r = clearance(A, B, outwardNormal(A,B), segs, Y);
        if (r && (!best || r.t < best.t)) best = {...r, perp: true};
      }
    }
    if (best) return best;
    for (const [X,Y] of [[ca,cb],[cb,ca]])
      for (const V of X) for (const [Q,R] of edges(Y)){
        const P2 = closestOnSeg(V,Q,R), t = len(sub(P2,V));
        if (!best || t < best.t) best = {P: V, Q: P2, t, perp: false};
      }
    return best;
  }
  function polyArea(p){ let a = 0; for (let i = 0; i < p.length; i++){ const q = p[(i+1)%p.length]; a += p[i].x*q.y - q.x*p[i].y; } return Math.abs(a)/2; }

  function compute(){
    const plotSegs = edges(state.plot), res = new Map();
    for (const it of state.items){
      const c = corners(it), inside = validRing(state.plot) && containsPolygon(state.plot, c);
      const sides = [];
      for (let i = 0; i < 4; i++){
        const A = c[i], B = c[(i+1)%4], n = outwardNormal(A,B);
        const r = clearance(A, B, n, plotSegs, state.plot);
        sides.push({name: sideName(n), P: r && r.P, Q: r && r.Q, t: r ? r.t : null, warn: r ? r.t < it.setback - 1e-9 : false});
      }
      const ts = sides.filter(s => s.t != null).map(s => s.t);
      res.set(it.id, {c, inside, sides, min: ts.length ? Math.min(...ts) : null});
    }
    const pairs = [], its = state.items;
    for (let i = 0; i < its.length; i++) for (let j = i+1; j < its.length; j++){
      const g = pairGap(res.get(its[i].id).c, res.get(its[j].id).c);
      if (g) pairs.push({a: its[i].id, b: its[j].id, ...g});
    }
    for (const it of its){
      const r = res.get(it.id);
      r.overlap = pairs.some(p => p.overlap && (p.a === it.id || p.b === it.id));
      r.warn = !r.inside || r.overlap || r.sides.some(s => s.warn);
    }
    return {res, pairs};
  }

  // ---------- formatting ----------
  const fmtN = v => String(Math.round(v * 100) / 100);
  const fmt = v => dec(v.toFixed(2)) + ' m';
  const fmtD = v => dec(fmtN(v)); // display only; inputs keep fmtN
  const group = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const snapV = v => state.snap > 0 ? Math.round(v / state.snap) * state.snap : v;

  // ---------- view ----------
  const view = {k: 12, ox: 40, oy: 40};
  let fitted = false;
  const toWorld = p => ({x: (p.x - view.ox) / view.k, y: (p.y - view.oy) / view.k});
  function fit(){
    const W = svg.clientWidth, H = svg.clientHeight; if (!W || !H) return;
    const pts = [...state.plot]; for (const it of state.items) pts.push(...corners(it));
    const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = W < 500 ? 36 : 64;
    const top = matchMedia('(max-width:760px)').matches ? 96 : pad; // phones: status chips sit below the tool row
    const k = Math.max(1, Math.min(200, Math.min((W - 2*pad) / Math.max(1, maxX - minX), (H - top - pad - 20) / Math.max(1, maxY - minY))));
    view.k = k;
    view.ox = W/2 - (minX + maxX)/2 * k;
    view.oy = (H + top - pad)/2 - (minY + maxY)/2 * k + 6;
    fitted = true;
  }
  function zoomAt(px, py, f){
    const w = toWorld({x:px, y:py});
    view.k = Math.max(1, Math.min(200, view.k * f));
    view.ox = px - w.x * view.k; view.oy = py - w.y * view.k;
    render();
  }

  // ---------- rendering ----------
  let C = compute();
  function render(){ C = compute(); renderSheet(); syncPanel(); save(); }

  function dim(a, b, cls, text){
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
    if (L < 2) return {line: '', label: ''};
    const ux = dx/L, uy = dy/L, tx = (ux - uy) * 3.6, ty = (uy + ux) * 3.6;
    const f = v => v.toFixed(1);
    const line = `<path class="dim ${cls}" d="M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}M${f(a.x-tx)} ${f(a.y-ty)}L${f(a.x+tx)} ${f(a.y+ty)}M${f(b.x-tx)} ${f(b.y-ty)}L${f(b.x+tx)} ${f(b.y+ty)}"/>`;
    let ang = Math.atan2(dy, dx) * 180 / Math.PI;
    if (ang > 90) ang -= 180; if (ang <= -90) ang += 180;
    const mx = (a.x + b.x)/2, my = (a.y + b.y)/2;
    const label = `<text class="dimt ${cls}" x="${f(mx)}" y="${f(my)}" dy="-5" text-anchor="middle" transform="rotate(${ang.toFixed(1)} ${f(mx)} ${f(my)})">${text}</text>`;
    return {line, label};
  }

  function renderSheet(){
    const W = svg.clientWidth, H = svg.clientHeight; if (!W || !H) return;
    if (!fitted) fit();
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const k = view.k, S = p => ({x: p.x * k + view.ox, y: p.y * k + view.oy});
    const f = v => v.toFixed(1);
    const out = [], labels = [];
    const x0 = -view.ox/k, x1 = (W - view.ox)/k, y0 = -view.oy/k, y1 = (H - view.oy)/k;
    const grid = step => {
      let d = '';
      for (let i = Math.floor(x0/step); i*step <= x1; i++) d += `M${f(i*step*k + view.ox)} 0V${H}`;
      for (let j = Math.floor(y0/step); j*step <= y1; j++) d += `M0 ${f(j*step*k + view.oy)}H${W}`;
      return d;
    };
    const major = k >= 4 ? 5 : k >= 1.5 ? 10 : 50;
    const pp = state.plot.map(S), pd = 'M' + pp.map(p => f(p.x) + ' ' + f(p.y)).join('L') + 'Z';
    out.push(`<clipPath id="plotclip"><path d="${pd}"/></clipPath>`);
    out.push(`<path class="gout" d="${grid(major)}"/>`);
    out.push(`<path class="plot-fill" d="${pd}"/>`);
    out.push(`<g clip-path="url(#plotclip)">${k >= 4 ? `<path class="gmin" d="${grid(1)}"/>` : ''}<path class="gmaj" d="${grid(major)}"/></g>`);
    out.push(`<path class="plot-edge" d="${pd}"/>`);

    // dimension lines
    const scope = state.dimScope === 'selected' ? new Set(selected ? [selected] : []) : new Set(state.items.map(i => i.id));
    for (const it of state.items){
      if (!scope.has(it.id)) continue;
      for (const s of C.res.get(it.id).sides){
        if (s.t == null) continue;
        const d = dim(S(s.P), S(s.Q), s.warn ? 'bad' : '', fmt(s.t));
        out.push(d.line); labels.push(d.label);
      }
    }
    if (state.showPairs) for (const p of C.pairs){
      if (p.overlap || !p.P) continue;
      if (!scope.has(p.a) && !scope.has(p.b)) continue;
      const d = dim(S(p.P), S(p.Q), 'pair' + (p.perp ? '' : ' diag'), fmt(p.t));
      out.push(d.line); labels.push(d.label);
    }

    // buildings
    for (const it of state.items){
      const r = C.res.get(it.id), sp = r.c.map(S);
      const d = 'M' + sp.map(p => f(p.x) + ' ' + f(p.y)).join('L') + 'Z';
      const bad = !r.inside || r.overlap;
      out.push(`<path class="bld ${it.type}${it.id === selected ? ' sel' : ''}${bad ? ' bad' : ''}" data-kind="item" data-id="${it.id}" d="${d}"/>`);
      const c = S(it), minSide = Math.min(it.w, it.d) * k;
      if (minSide > 26){
        const two = minSide > 46;
        labels.push(`<text class="bname" x="${f(c.x)}" y="${f(c.y + (two ? -1 : 4))}" text-anchor="middle">${esc(it.name)}</text>`);
        if (two) labels.push(`<text class="bsize" x="${f(c.x)}" y="${f(c.y + 13)}" text-anchor="middle">${fmtD(it.w)} × ${fmtD(it.d)} m</text>`);
      }
    }
    out.push(...labels);

    // plot side lengths and corners
    const cen = {x: pp.reduce((s,p)=>s+p.x,0)/4, y: pp.reduce((s,p)=>s+p.y,0)/4};
    const names = ['A','B','C','D'];
    for (let i = 0; i < 4; i++){
      const a = pp[i], b = pp[(i+1)%4], m = {x:(a.x+b.x)/2, y:(a.y+b.y)/2};
      let n = outwardNormal(a, b); if (dot(n, sub(m, cen)) < 0) n = mul(n, -1);
      const L = len(sub(state.plot[(i+1)%4], state.plot[i]));
      let ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang <= -90) ang += 180;
      const lx = m.x + n.x * 13, ly = m.y + n.y * 13;
      out.push(`<text class="edget" x="${f(lx)}" y="${f(ly)}" dy="4" text-anchor="middle" transform="rotate(${ang.toFixed(1)} ${f(lx)} ${f(ly)})">${names[i]}${names[(i+1)%4]} ${fmt(L)}</text>`);
    }
    pp.forEach((p, i) => {
      const v = sub(p, cen), l = len(v) || 1, lx = p.x + v.x/l * 20, ly = p.y + v.y/l * 20;
      out.push(`<text class="cornert" x="${f(lx)}" y="${f(ly)}" dy="4" text-anchor="middle">${names[i]}</text>`);
      out.push(`<circle class="corner" cx="${f(p.x)}" cy="${f(p.y)}" r="6.5"/>`);
      out.push(`<circle class="corner-hit" data-kind="corner" data-i="${i}" cx="${f(p.x)}" cy="${f(p.y)}" r="17"/>`);
    });

    // resize handles
    const s = get(selected);
    if (s){
      C.res.get(s.id).c.map(S).forEach((p, i) => {
        out.push(`<rect class="handle" data-kind="handle" data-id="${s.id}" data-ci="${i}" x="${f(p.x-5.5)}" y="${f(p.y-5.5)}" width="11" height="11" style="cursor:${i % 2 ? 'nesw' : 'nwse'}-resize"/>`);
      });
    }

    // scale bar
    const nice = [1,2,5,10,20,50,100].find(v => v * k >= 70) || 100, bw = nice * k, by = H - 18;
    out.push(`<path class="scale" d="M14 ${by-5}V${by}H${f(14+bw)}V${by-5}M${f(14+bw/2)} ${by}V${by-3}"/>`);
    out.push(`<text class="scalet" x="${f(14+bw+6)}" y="${by+1}">${nice} m</text>`);

    scene.innerHTML = out.join('');
  }

  // ---------- panel ----------
  function setVal(id, v){ const el = document.getElementById(id); if (el && el !== document.activeElement) el.value = v; }

  function bindNum(id, fn){
    const el = document.getElementById(id); if (!el) return;
    let pending = false;
    el.addEventListener('focus', () => { pending = true; });
    el.addEventListener('input', () => {
      const v = parseFloat(el.value);
      if (!isFinite(v)) return;
      if (pending){ snapshot(); pending = false; }
      fn(v); render();
    });
    el.addEventListener('blur', () => syncPanel(true));
  }

  function buildPanel(){
    C = compute(); // syncPanel below reads C; callers change items before render()
    const it = get(selected), box = $('#sel');
    if (!it){
      box.innerHTML = `<h2 class="lbl">${t('selection')}</h2><p class="hint">${t('selectionHint')}</p>`;
    } else {
      box.innerHTML = `
        <div class="sec-head"><h2 class="lbl">${t('selected')}</h2><span class="tag ${it.type}">${t(it.type)}</span></div>
        <div class="field"><label for="f-name">${t('name')}</label><input id="f-name" type="text" maxlength="60" value="${esc(it.name)}"></div>
        <div class="grid2">
          <div class="field"><label for="f-w">${t('width')}</label><input id="f-w" type="number" step="0.1" min="0.5" inputmode="decimal"></div>
          <div class="field"><label for="f-d">${t('depth')}</label><input id="f-d" type="number" step="0.1" min="0.5" inputmode="decimal"></div>
          <div class="field"><label for="f-rot">${t('rotation')}</label><input id="f-rot" type="number" step="1" inputmode="decimal"></div>
          <div class="field"><label for="f-sb">${t('minSetback')}</label><input id="f-sb" type="number" step="0.5" min="0" inputmode="decimal"></div>
        </div>
        <div class="row"><button id="b-rot">${t('rotate90')}</button><button id="b-dup">${t('duplicate')}</button><button id="b-del" class="danger">${t('del')}</button></div>
        <h3 class="lbl sm">${t('clearance')}</h3><div class="readout" id="f-clear"></div>
        <h3 class="lbl sm">${t('gaps')}</h3><div class="readout" id="f-gaps"></div>`;
      const nameEl = $('#f-name');
      let pending = false;
      nameEl.addEventListener('focus', () => { pending = true; });
      nameEl.addEventListener('input', () => { if (pending){ snapshot(); pending = false; } it.name = nameEl.value.slice(0, 60); render(); });
      bindNum('f-w', v => { it.w = Math.max(0.5, v); });
      bindNum('f-d', v => { it.d = Math.max(0.5, v); });
      bindNum('f-rot', v => { it.rot = ((v % 360) + 360) % 360; });
      bindNum('f-sb', v => { it.setback = Math.max(0, v); });
      $('#b-rot').onclick = () => rotate90();
      $('#b-dup').onclick = () => duplicate();
      $('#b-del').onclick = () => removeSelected();
    }
    syncPanel(true);
  }

  function syncPanel(force){
    const it = get(selected);
    if (it){
      setVal('f-w', fmtN(it.w)); setVal('f-d', fmtN(it.d)); setVal('f-rot', fmtN(it.rot)); setVal('f-sb', fmtN(it.setback));
      if (force) setVal('f-name', it.name);
      const r = C.res.get(it.id);
      let h = '';
      if (!r.inside) h += `<div class="ro bad"><span>${t('outside')}</span><b></b><span class="chip bad">${t('check')}</span></div>`;
      for (const s of r.sides){
        if (s.t == null){ h += `<div class="ro"><span>${t(s.name)}</span><b>–</b><span class="chip info">${t('noBoundary')}</span></div>`; continue; }
        h += `<div class="ro${s.warn ? ' bad' : ''}"><span>${t('wall', {side: t(s.name)})}</span><b>${fmt(s.t)}</b><span class="chip ${s.warn ? 'bad' : 'ok'}">${s.warn ? t('under', {v: fmtD(it.setback)}) : t('ok')}</span></div>`;
      }
      const cl = $('#f-clear'); if (cl) cl.innerHTML = h;
      let g = '';
      for (const p of C.pairs){
        if (p.a !== it.id && p.b !== it.id) continue;
        const other = get(p.a === it.id ? p.b : p.a);
        if (p.overlap) g += `<div class="ro bad"><span>${esc(other.name)}</span><b>${fmt(0)}</b><span class="chip bad">${t('overlap')}</span></div>`;
        else g += `<div class="ro"><span>${esc(other.name)}</span><b>${fmt(p.t)}</b><span class="chip info">${p.perp ? t('wallToWall') : t('corner')}</span></div>`;
      }
      const gp = $('#f-gaps'); if (gp) gp.innerHTML = g || `<p class="hint" style="padding-top:6px">${t('noOthers')}</p>`;
    }

    // building list
    const objs = $('#objs');
    if (!state.items.length) objs.innerHTML = `<p class="hint">${t('noBuildings')}</p>`;
    else objs.innerHTML = state.items.map(i => {
      const r = C.res.get(i.id);
      const chip = r.warn ? `<span class="chip bad">${t('check')}</span>` : `<span class="chip ok">${r.min != null ? fmt(r.min) : t('ok')}</span>`;
      return `<button class="obj${i.id === selected ? ' on' : ''}" data-id="${i.id}"><span class="sw ${i.type}"></span><span class="nm">${esc(i.name)}</span><span class="sz">${fmtD(i.w)}×${fmtD(i.d)}</span>${chip}</button>`;
    }).join('');

    // plot
    const area = polyArea(state.plot);
    let per = 0; edges(state.plot).forEach(([a,b]) => per += len(sub(b,a)));
    const built = state.items.reduce((s, i) => s + i.w * i.d, 0);
    $('#p-area').textContent = group(area) + ' m²';
    $('#p-ares').textContent = dec((area / 100).toFixed(2)) + ' a';
    $('#p-per').textContent = dec(per.toFixed(1)) + ' m';
    $('#p-cov').textContent = t('built', {v: dec(area ? (built / area * 100).toFixed(1) : '0')});
    const names = ['A','B','C','D'];
    state.plot.forEach((p, i) => {
      setVal('pc-x-' + i, fmtN(p.x)); setVal('pc-y-' + i, fmtN(p.y));
      const q = state.plot[(i+1)%4];
      document.getElementById('pc-l-' + i).textContent = names[i] + names[(i+1)%4] + ' ' + dec(len(sub(q,p)).toFixed(2));
    });

    const plotValid = validRing(state.plot);
    const warnCount = state.items.filter(i => C.res.get(i.id).warn).length;
    $('#chipbar').innerHTML = (!plotValid ? `<span style="color:var(--warn)">${lang === 'pl' ? 'Nieprawidłowa granica działki' : 'Invalid parcel boundary'}</span>` : '') + `<span>${group(area)} m² · ${dec((area/100).toFixed(2))} a</span>` +
      (state.items.length ? `<span style="color:var(${warnCount ? '--warn' : '--ok'})">${warnCount ? t('toCheck', {n: warnCount}) : t('allMet')}</span>` : '');
  }

  function buildCorners(){
    const names = ['A','B','C','D'];
    $('#p-corners').innerHTML = names.map((n, i) => `<tr><td>${n}</td>
      <td><input id="pc-x-${i}" type="number" step="0.1" inputmode="decimal" aria-label="${t('cornerAxis', {c: n, axis: 'x'})}"></td>
      <td><input id="pc-y-${i}" type="number" step="0.1" inputmode="decimal" aria-label="${t('cornerAxis', {c: n, axis: 'y'})}"></td>
      <td class="len" id="pc-l-${i}"></td></tr>`).join('');
    for (let i = 0; i < 4; i++){
      bindNum('pc-x-' + i, v => { state.plot[i].x = v; });
      bindNum('pc-y-' + i, v => { state.plot[i].y = v; });
    }
  }

  // ---------- actions ----------
  function snapItem(it){
    if (!(state.snap > 0)) return;
    const axis = Math.abs(((it.rot % 90) + 90) % 90) < 1e-6 || Math.abs(((it.rot % 90) + 90) % 90 - 90) < 1e-6;
    if (axis){
      const cs = corners(it), mx = Math.min(...cs.map(p=>p.x)), my = Math.min(...cs.map(p=>p.y));
      it.x += snapV(mx) - mx; it.y += snapV(my) - my;
    } else { it.x = snapV(it.x); it.y = snapV(it.y); }
  }
  function addItem(type){
    snapshot();
    const ty = TYPES[type], n = state.items.filter(i => i.type === type).length;
    const cx = state.plot.reduce((s,p)=>s+p.x,0)/4, cy = state.plot.reduce((s,p)=>s+p.y,0)/4;
    const it = {id: 'o' + (uid++), type, name: t(type) + (n ? ' ' + (n + 1) : ''), x: cx, y: cy, w: ty.w, d: ty.d, rot: 0, setback: ty.setback};
    snapItem(it);
    state.items.push(it); selected = it.id;
    buildPanel(); render();
  }
  function duplicate(){
    const it = get(selected); if (!it) return;
    snapshot();
    const c = {...structuredClone(it), id: 'o' + (uid++), name: (it.name + t('copySuffix')).slice(0, 60), x: it.x + 2, y: it.y + 2};
    state.items.push(c); selected = c.id; buildPanel(); render();
  }
  function removeSelected(){
    const it = get(selected); if (!it) return;
    snapshot();
    state.items = state.items.filter(i => i.id !== it.id); selected = null;
    buildPanel(); render(); toast(t('removed', {name: it.name}));
  }
  function rotate90(){
    const it = get(selected); if (!it) return;
    snapshot(); it.rot = (it.rot + 90) % 360; snapItem(it); render();
  }
  let toastT;
  function toast(msg){ const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2200); }

  // ---------- pointer ----------
  const ptrs = new Map();
  let drag = null;
  const local = e => { const r = svg.getBoundingClientRect(); return {x: e.clientX - r.left, y: e.clientY - r.top}; };

  svg.addEventListener('pointerdown', e => {
    if (e.button !== undefined && e.button > 0) return;
    const pt = local(e);
    try { svg.setPointerCapture(e.pointerId); } catch (_) {}
    ptrs.set(e.pointerId, pt);
    if (ptrs.size === 2){
      const [a, b] = [...ptrs.values()];
      drag = {mode: 'pinch', d0: Math.hypot(a.x-b.x, a.y-b.y) || 1, k0: view.k, wm: toWorld({x:(a.x+b.x)/2, y:(a.y+b.y)/2})};
      return;
    }
    if (ptrs.size > 2) return;
    const t = e.target.closest('[data-kind]'), w = toWorld(pt);
    if (!t){ drag = {mode: 'pan', sx: pt.x, sy: pt.y, ox: view.ox, oy: view.oy, moved: false}; svg.classList.add('panning'); return; }
    const kind = t.dataset.kind;
    if (kind === 'corner'){
      const i = +t.dataset.i;
      drag = {mode: 'corner', i, wx: w.x, wy: w.y, x0: state.plot[i].x, y0: state.plot[i].y, sx: pt.x, sy: pt.y, started: false};
    } else if (kind === 'item'){
      const it = get(t.dataset.id);
      if (selected !== it.id){ selected = it.id; buildPanel(); render(); }
      drag = {mode: 'item', id: it.id, wx: w.x, wy: w.y, x0: it.x, y0: it.y, sx: pt.x, sy: pt.y, started: false};
    } else if (kind === 'handle'){
      const it = get(t.dataset.id);
      drag = {mode: 'handle', id: it.id, ci: +t.dataset.ci, start: {...it}, sx: pt.x, sy: pt.y, started: false};
    }
  });

  svg.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    const pt = local(e); ptrs.set(e.pointerId, pt);
    if (!drag) return;
    if (drag.mode === 'pinch'){
      if (ptrs.size < 2) return;
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x-b.x, a.y-b.y);
      view.k = Math.max(1, Math.min(200, drag.k0 * d / drag.d0));
      const mx = (a.x+b.x)/2, my = (a.y+b.y)/2;
      view.ox = mx - drag.wm.x * view.k; view.oy = my - drag.wm.y * view.k;
      renderSheet(); return;
    }
    if (drag.mode === 'pan'){
      view.ox = drag.ox + pt.x - drag.sx; view.oy = drag.oy + pt.y - drag.sy;
      if (Math.hypot(pt.x - drag.sx, pt.y - drag.sy) > 3) drag.moved = true;
      renderSheet(); return;
    }
    if (!drag.started){
      if (Math.hypot(pt.x - drag.sx, pt.y - drag.sy) < 3) return;
      drag.started = true; snapshot();
    }
    const w = toWorld(pt);
    if (drag.mode === 'corner'){
      state.plot[drag.i] = {x: snapV(drag.x0 + w.x - drag.wx), y: snapV(drag.y0 + w.y - drag.wy)};
    } else if (drag.mode === 'item'){
      const it = get(drag.id); if (!it) return;
      it.x = drag.x0 + w.x - drag.wx; it.y = drag.y0 + w.y - drag.wy; snapItem(it);
    } else if (drag.mode === 'handle'){
      const it = get(drag.id); if (!it) return;
      const st = drag.start, F = corners(st)[(drag.ci + 2) % 4];
      const sx = [-1, 1, 1, -1][drag.ci], sy = [-1, -1, 1, 1][drag.ci];
      const r = st.rot * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
      const v = sub(w, F), u = v.x*c + v.y*s, vv = -v.x*s + v.y*c;
      const nw = Math.max(1, snapV(sx * u)), nd = Math.max(1, snapV(sy * vv));
      it.w = nw; it.d = nd;
      const lx = sx * nw / 2, ly = sy * nd / 2;
      it.x = F.x + lx*c - ly*s; it.y = F.y + lx*s + ly*c;
    }
    render();
  });

  function endPointer(e){
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    svg.classList.remove('panning');
    if (drag && drag.mode === 'pan' && !drag.moved && e.type === 'pointerup' && selected){ selected = null; buildPanel(); render(); }
    if (drag && drag.mode === 'pinch' && ptrs.size === 1){ drag = null; return; }
    if (ptrs.size === 0) drag = null;
  }
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const pt = local(e);
    zoomAt(pt.x, pt.y, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016)));
  }, {passive: false});

  // ---------- keyboard ----------
  window.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && tag !== 'input' && tag !== 'textarea'){ e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    const it = get(selected);
    if (!it) return;
    const step = (state.snap > 0 ? state.snap : 0.1) * (e.shiftKey ? 10 : 1);
    const moves = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]};
    if (moves[e.key]){ e.preventDefault(); snapshot(); it.x += moves[e.key][0]*step; it.y += moves[e.key][1]*step; render(); }
    else if (e.key === 'r' || e.key === 'R'){ rotate90(); }
    else if (e.key === 'Delete' || e.key === 'Backspace'){ e.preventDefault(); removeSelected(); }
    else if (e.key === 'Escape'){ selected = null; buildPanel(); render(); }
  });

  // ---------- wiring ----------
  $('#add-house').onclick = () => addItem('house');
  $('#add-garage').onclick = () => addItem('garage');
  $('#objs').addEventListener('click', e => {
    const b = e.target.closest('.obj'); if (!b) return;
    selected = b.dataset.id; buildPanel(); render();
  });
  $('#b-rect').onclick = () => {
    const w = parseFloat($('#rw').value), d = parseFloat($('#rd').value);
    if (!(w > 0 && d > 0)){ toast(t('badRect')); return; }
    snapshot(); state.plot = [{x:0,y:0},{x:w,y:0},{x:w,y:d},{x:0,y:d}]; fit(); render();
  };
  const snapSel = $('#o-snap'); snapSel.value = String(state.snap);
  if (snapSel.value === '') snapSel.value = '0.5';
  snapSel.onchange = () => { snapshot(); state.snap = parseFloat(snapSel.value) || 0; render(); };
  const dimSel = $('#o-dims'); dimSel.value = state.dimScope;
  dimSel.onchange = () => { snapshot(); state.dimScope = dimSel.value; render(); };
  const pairChk = $('#o-pairs'); pairChk.checked = state.showPairs;
  pairChk.onchange = () => { snapshot(); state.showPairs = pairChk.checked; render(); };

  $('#b-copy').onclick = () => {
    let txt; try { txt = serializeScene(state); } catch { toast(t('notAPlan')); return; }
    const fallback = () => {
      const box = $('#io-box'), io = $('#io');
      box.open = true; io.value = txt; io.focus(); io.select();
      toast(t('jsonBlocked'));
    };
    try {
      navigator.clipboard.writeText(txt).then(() => toast(t('jsonCopied')), fallback);
    } catch (_) { fallback(); }
  };
  $('#b-link').onclick = () => {
    // Build synchronously from the current scene to preserve clipboard activation and the latest edit.
    let url; try { url = location.href.split('#')[0] + plainShare(state); } catch { toast(t('notAPlan')); return; }
    const fallback = () => toast(t('linkBlocked'));
    try { navigator.clipboard.writeText(url).then(() => toast(t('linkCopied')), fallback); } catch (_) { fallback(); }
  };
  function applyPlan(o, msg){
    snapshot();
    state = parseScene(o);
    persistencePaused = false; $('#project-warning').hidden = true;
    snapSel.value = String(state.snap); dimSel.value = state.dimScope; pairChk.checked = state.showPairs;
    uid = state.items.reduce((m, i) => Math.max(m, parseInt(String(i.id).replace(/\D/g, '')) || 0), 0) + 1;
    selected = state.items[0] ? state.items[0].id : null;
    fit(); buildPanel(); render(); toast(msg);
  }
  $('#b-load').onclick = () => {
    let o; try { if (new TextEncoder().encode($('#io').value).length > MAX_PROJECT_BYTES) throw new Error('large'); o = clean(JSON.parse($('#io').value)); } catch (_) { o = null; }
    if (!o){ toast(t('notAPlan')); return; }
    applyPlan(o, t('planLoaded'));
  };
  function downloadFile(text, name, type){
    const url = URL.createObjectURL(new Blob([text],{type}));
    const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('#b-download').onclick=()=>{try{downloadFile(serializeScene(state),'setback-project.json','application/json');}catch{toast(t('notAPlan'));}};
  $('#b-file').onclick=()=>$('#project-file').click();
  $('#project-file').onchange=async e=>{
    const file=e.target.files[0]; if(!file)return;
    try { if(file.size>MAX_PROJECT_BYTES)throw new Error('large'); applyPlan(parseScene(JSON.parse(await file.text())),t('planLoaded')); }
    catch { toast(t('notAPlan')); } finally { e.target.value=''; }
  };
  const VARIANT_LS='setback-planner-variants-v1';
  const loadVariants=()=>readVariants(localStorage.getItem(VARIANT_LS)||'[]');
  function updateVariants(){
    try { $('#variant-list').innerHTML=loadVariants().map(v=>`<option value="${esc(v.id)}">${esc(v.name)}</option>`).join(''); }
    catch { $('#variant-list').innerHTML=''; toast(t('variantError')); }
  }
  $('#variant-save').onclick=()=>{
    try {
      const variants=saveVariant(loadVariants(),{id:crypto.randomUUID(),name:$('#variant-name').value,scene:parseScene(state)});
      localStorage.setItem(VARIANT_LS,JSON.stringify(variants));updateVariants();$('#variant-list').value=variants.at(-1).id;
    } catch { toast(t('variantError')); }
  };
  $('#variant-open').onclick=()=>{
    try { const variant=loadVariants().find(v=>v.id===$('#variant-list').value);if(variant)applyPlan(variant.scene,t('planLoaded')); }
    catch { toast(t('variantError')); }
  };
  $('#variant-delete').onclick=()=>{
    try { localStorage.setItem(VARIANT_LS,JSON.stringify(loadVariants().filter(v=>v.id!==$('#variant-list').value)));updateVariants(); }
    catch { toast(t('variantError')); }
  };
  updateVariants();
  // A shared link pasted into an already-open tab only changes the hash.
  window.addEventListener('hashchange', async () => { const o = await fromHash(); if (o) applyPlan(o, t('planFromLink')); });
  let resetArmed = false, resetT;
  $('#b-reset').onclick = e => {
    const b = e.currentTarget;
    if (!resetArmed){ resetArmed = true; b.textContent = t('resetConfirm'); resetT = setTimeout(() => { resetArmed = false; b.textContent = t('resetExample'); }, 3000); return; }
    clearTimeout(resetT); resetArmed = false; b.textContent = t('resetExample');
    snapshot(); state = parseScene(DEFAULT()); persistencePaused = false; $('#project-warning').hidden = true;
    uid = 3; selected = 'o1'; fit(); buildPanel(); render(); toast(t('exampleRestored'));
  };
  $('#t-undo').onclick = undo; $('#t-redo').onclick = redo;
  $('#t-in').onclick = () => zoomAt(svg.clientWidth/2, svg.clientHeight/2, 1.25);
  $('#t-out').onclick = () => zoomAt(svg.clientWidth/2, svg.clientHeight/2, 0.8);
  $('#t-fit').onclick = () => { fit(); renderSheet(); };

  document.querySelectorAll('.lang button').forEach(b => b.onclick = () => {
    lang = b.dataset.lang;
    try { localStorage.setItem(LANG_LS, lang); } catch (e) {}
    applyLang();
    'ABCD'.split('').forEach((c, i) => ['x', 'y'].forEach(axis =>
      document.getElementById(`pc-${axis}-${i}`).setAttribute('aria-label', t('cornerAxis', {c, axis}))));
    buildPanel(); render();
  });

  applyLang();
  buildCorners();
  buildPanel();
  new ResizeObserver(() => renderSheet()).observe(svg);
  render();
})();
