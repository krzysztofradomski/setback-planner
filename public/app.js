import {createCatalogItem} from './catalogs/placement.ts';
import {sourceDirectory,mapOverlayIds} from './map/sources.ts';
import {mountWorkspace} from './workspace.ts';
import {transformGroup} from './core/operations.ts';
import {parcelPolygons,parcelContains,parcelArea} from './core/topology.ts';
import {fenceSchema,fenceSegments} from './core/fences.ts';
import { objectLibrary, blocksPlacement } from './core/objects.ts';
import { catalogRegistrations, loadCatalog, catalogAvailable } from './core/catalogs.ts';
import { materialPresets, resolveAppearance, resetAppearance } from './core/materials.ts';
import { worldFootprint, boundingCorners } from './core/footprints.ts';
import { ProjectHistory, saveVariant, readVariants } from './core/projects.ts';
import { parseScene, serializeScene, encodeShare, decodeShare, plainShare, MAX_PROJECT_BYTES } from './core/scene.ts';
import { polygonRelation, validRing, polygonArea, perpendicularClearance } from './core/geometry.ts';

(async () => {
  const $ = s => document.querySelector(s);
  const svg = $('#sheet'), scene = $('#scene');

  // ---------- i18n ----------
  const I18N = {
    en: {
      doorColor:'Door color',
      environment:'Season and sunlight', solarHint:'Sun location uses the imported parcel, otherwise the manual coordinates below. Date/time uses this device’s timezone. Shadows omit unmodeled terrain and neighbors.',
      landscape:'Landscape', garden:'Garden library', addOutdoor:'Add outdoor object', mature:'Maturity (0–1)',
      objectLimit:'This project supports up to 100 buildings.',
      exportSvg:'Export SVG', report:'Report / PDF', printReport:'Print / Save PDF', close:'Close',
      pickParcel:'Select parcel', pickHint:'Click a parcel to replace the current boundary. Coordinates are sent to GUGiK ULDK. Buildings keep their local positions.',
      mapView:'Map', mapLayer:'Map layer', ortho:'Orthophoto · GUGiK', cadastre:'Cadastre · GUGiK', mapHint:'Visual context only. Image dates and neighboring heights are unknown. Import a georeferenced parcel to see your project here. Map views contact the selected tile providers.', mapError:'Map or layer unavailable. Switch layers or continue planning in 2D.',
      findParcel:'Find Polish parcel (ULDK)', parcelId:'Full parcel identifier', uldkHint:'Lookup sends this identifier to GUGiK ULDK. Service availability varies. The imported boundary replaces the parcel; verify building positions. You can still draw or import a parcel when the service is unavailable.', uldkLoading:'Looking up parcel…', uldkError:'Could not import this parcel. Check its full identifier, service availability and supported geometry. Current plan retained.', uldkChanged:'Project changed during lookup. Request again to replace the parcel.',
      importParcel:'Import parcel (GeoJSON)', sourceCrs:'Source coordinates', openParcel:'Open parcel file', parcelImportHint:'One polygon, up to 512 vertices. Holes and separate components are preserved. Replaces the parcel; keeps buildings at their local positions. Confirm their placement after import.', parcelImportError:'Parcel import failed. Check CRS, closure and geometry; rings must be valid and components disjoint.', parcelEdited:'Boundary edited locally; source geometry has changed.', north:'Grid north ↑',
      topView:'Top', axonView:'Axonometric', screenshot:'Screenshot', lowQuality:'Low power', viewerHint:'Conceptual massing. Calculated sunlight; no terrain or neighboring heights. Shadows are approximate. Concave pitched roofs use a flat schematic cap.', viewerFailure:'3D is unavailable on this device. Continue planning in 2D.', loading3d:'Loading 3D…',
      catalogs:'Optional catalogs', catalogHint:'Manufacturer photos and dimensioned plans. Main-building envelopes exclude terraces, carports and roof overhangs. 3D heights and roof pitch are illustrative.', catalogUnavailable:'Catalog unavailable or disabled. Saved user-defined fallback geometry is retained.', enableCatalog:'Enable catalog', catalogError:'Catalog could not be loaded. Generic planning remains available.', source:'Source', verifiedOn:'Checked', noDimensions:'Main envelope from published plan',
      materials:'Materials', facade:'Façade finish', grout:'Grout color', roofColor:'Roof color', frameColor:'Window / door color', gutterColor:'Gutter color', trimColor:'Trim color', tileWidth:'Tile width (m)', tileHeight:'Tile height (m)', layout:'Tile direction', horizontal:'Horizontal', vertical:'Vertical', wallFinish:'Individual wall', allWalls:'All walls', inherit:'Use façade finish', resetMaterials:'Reset all finishes', resetFacade:'Reset façade', original:'Compare original', materialHint:'Conceptual finishes, not manufacturer-approved options. No price calculation. Patterns are schematic.',
      shape:'Footprint shape', rectangle:'Rectangular', wingRatio:'Wing proportion', height:'Wall height total (m)', storeys:'Storeys', roof:'Roof', flat:'Flat', gable:'Gable', pitch:'Roof pitch (°)', genericHint:'Generic conceptual house. Dimensions are user-defined; no manufacturer specifications or legal approval.',
      redo:'Redo', downloadProject:'Download JSON', openFile:'Open JSON file', variants:'Local variants', variantName:'Variant name', saveVariant:'Save as variant', openVariant:'Open variant', variantHint:'Stored only in this browser, up to 20 variants. Download JSON for a backup.', variantError:'Could not save or read variants. Check the name, storage space and 20-variant limit.',
      docTitle: 'Setback Planner', title: 'Setback Planner', tagline: 'Plot outline on a 1 m grid, buildings, and every clearance.',
      language: 'Language', controls: 'Controls', addBuilding: 'Add building', house: 'House', garage: 'Garage', buildings: 'Buildings',
      plot: 'Plot', area: 'Area', perimeter: 'Perimeter', side: 'Side', cornersHint: 'Drag the corner points A–D on the plan, or type coordinates.',
      rectW: 'Rectangle width in metres', rectD: 'Rectangle depth in metres', makeRect: 'Make rectangle',
      drawing: 'Drawing', snapTo: 'Snap to', off: 'Off', dimsFor: 'Dimensions for', allBuildings: 'All buildings', selectedOnly: 'Selected only',
      showGaps: 'Show gaps between buildings', save: 'Save', copyLink: 'Copy share link', copyJson: 'Copy plan JSON', resetExample: 'Reset example',
      resetConfirm: 'Click again to reset', loadFromJson: 'Load plan from JSON', pastePlan: 'Paste a copied plan', loadPlan: 'Load plan',
      autosaveHint: 'Your plan autosaves in this browser and in the page address, so the link always opens this exact plan.',
      foot: 'Drag empty space to pan, scroll or pinch to zoom. With a building selected: <kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> nudge, <kbd>R</kbd> rotates 90°, <kbd>Del</kbd> removes. <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes.<br>Setbacks are user-selected geometric parameters: defaults are 4&nbsp;m for houses and 3&nbsp;m for garages. This tool does not verify legal applicability. Check official planning documents and other requirements.',
      plotPlan: 'Plot plan', undo: 'Undo', undoTitle: 'Undo (Ctrl+Z)', zoomOut: 'Zoom out', zoomIn: 'Zoom in', fit: 'Fit', fitTitle: 'Fit plot to view',
      lgBoundary: 'to boundary', lgBetween: 'between buildings', lgBelow: 'below min. setback',
      selection: 'Selection', selectionHint: 'Select a building on the plan to change its size, rotation and minimum setback. Drag its corner squares to resize it.',
      selected: 'Selected', name: 'Name', width: 'Width (m)', depth: 'Depth (m)', rotation: 'Rotation (°)', minSetback: 'Min. setback (m)',
      rotate90: 'Rotate 90°', duplicate: 'Duplicate', del: 'Delete', clearance: 'Clearance to boundary', gaps: 'Gaps to other buildings',
      outside: 'Part of the building is outside the plot', check: 'Check', noBoundary: 'No boundary', wall: '{side} wall', under: 'Under {v} m', ok: 'OK',
      Right: 'Right', Left: 'Left', Top: 'Top', Bottom: 'Bottom',
      overlap: 'Touch / overlap', wallToWall: 'Wall to wall', corner: 'Corner', noOthers: 'No other buildings yet.',
      noBuildings: 'No buildings yet. Add a house or garage above; it lands in the middle of the plot.',
      built: 'built {v} %', toCheck: '{n} to check', allMet: 'Geometric checks passed', cornerAxis: 'Corner {c} {axis} in metres', copySuffix: ' copy',
      nothingToUndo: 'Nothing to undo', removed: '{name} removed. Ctrl+Z brings it back.', badRect: 'Enter a width and depth above 0 m',
      jsonBlocked: 'Copy blocked here. The JSON is selected below.', jsonCopied: 'Plan copied as JSON',
      linkBlocked: 'Copy blocked here. Copy the address bar instead.', linkCopied: 'Link copied',
      notAPlan: 'That text is not a plan. Paste JSON copied from this tool.', planLoaded: 'Plan loaded', planFromLink: 'Plan loaded from link',
      exampleRestored: 'Example restored. Ctrl+Z undoes this.',
    },
    pl: {
      doorColor:'Kolor drzwi',
      environment:'Pora roku i słońce', solarHint:'Pozycja słońca wynika z położenia działki lub poniższych współrzędnych. Data i czas w strefie urządzenia. Cienie pomijają nieznany teren i sąsiadów.',
      landscape:'Ogród', garden:'Biblioteka ogrodu', addOutdoor:'Dodaj obiekt ogrodowy', mature:'Dojrzałość (0–1)',
      objectLimit:'Projekt obsługuje do 100 budynków.',
      exportSvg:'Eksport SVG', report:'Raport / PDF', printReport:'Drukuj / Zapisz PDF', close:'Zamknij',
      pickParcel:'Wybierz działkę', pickHint:'Kliknij działkę, aby zastąpić granicę. Współrzędne zostaną wysłane do GUGiK ULDK. Budynki zachowają pozycje lokalne.',
      mapView:'Mapa', mapLayer:'Warstwa mapy', ortho:'Ortofotomapa · GUGiK', cadastre:'Ewidencja · GUGiK', mapHint:'Kontekst wizualny. Daty zdjęć i wysokości sąsiadów są nieznane. Zaimportuj działkę z georeferencją, aby zobaczyć projekt. Mapa łączy się z wybranymi dostawcami kafelków.', mapError:'Mapa lub warstwa niedostępna. Zmień warstwę lub kontynuuj w 2D.',
      findParcel:'Znajdź działkę (ULDK)', parcelId:'Pełny identyfikator działki', uldkHint:'Zapytanie wysyła identyfikator do GUGiK ULDK. Dostępność usługi jest zmienna. Granica zastąpi działkę; sprawdź pozycje budynków. Przy awarii możesz nadal rysować lub importować działkę.', uldkLoading:'Wyszukiwanie działki…', uldkError:'Nie można zaimportować działki. Sprawdź identyfikator, usługę i obsługiwaną geometrię. Bieżący plan zachowano.', uldkChanged:'Projekt zmieniono podczas wyszukiwania. Ponów zapytanie, aby zastąpić działkę.',
      importParcel:'Import działki (GeoJSON)', sourceCrs:'Współrzędne źródłowe', openParcel:'Otwórz plik działki', parcelImportHint:'Jeden wielokąt, do 512 wierzchołków. Otwory i odrębne części są zachowane. Zastępuje działkę; budynki pozostają na pozycjach lokalnych. Sprawdź ich położenie po imporcie.', parcelImportError:'Import nieudany. Sprawdź układ, zamknięcie i geometrię; pierścienie muszą być poprawne, a części rozłączne.', parcelEdited:'Granica edytowana lokalnie; geometria źródłowa została zmieniona.', north:'Północ siatki ↑',
      topView:'Z góry', axonView:'Aksonometria', screenshot:'Zrzut ekranu', lowQuality:'Oszczędzanie energii', viewerHint:'Bryły koncepcyjne. Obliczona pozycja słońca, brak terenu i wysokości sąsiadów. Cienie przybliżone. Dachy spadziste brył wklęsłych pokazano jako płaski schemat.', viewerFailure:'Widok 3D niedostępny na tym urządzeniu. Kontynuuj w 2D.', loading3d:'Wczytywanie 3D…',
      catalogs:'Katalogi opcjonalne', catalogHint:'Zdjęcia i wymiarowane rzuty producenta. Obrys głównej bryły bez tarasów, wiat i okapów. Wysokość i kąt dachu w 3D są poglądowe.', catalogUnavailable:'Katalog niedostępny lub wyłączony. Zachowano zapisany obrys użytkownika.', enableCatalog:'Włącz katalog', catalogError:'Nie można wczytać katalogu. Planowanie ogólne jest nadal dostępne.', source:'Źródło', verifiedOn:'Sprawdzono', noDimensions:'Obrys głównej bryły wg rzutu',
      materials:'Materiały', facade:'Wykończenie elewacji', grout:'Kolor fugi', roofColor:'Kolor dachu', frameColor:'Kolor okien / drzwi', gutterColor:'Kolor rynien', trimColor:'Kolor detali', tileWidth:'Szerokość płytki (m)', tileHeight:'Wysokość płytki (m)', layout:'Kierunek płytek', horizontal:'Poziomo', vertical:'Pionowo', wallFinish:'Pojedyncza ściana', allWalls:'Wszystkie ściany', inherit:'Wykończenie elewacji', resetMaterials:'Resetuj wykończenia', resetFacade:'Resetuj elewację', original:'Porównaj oryginał', materialHint:'Wykończenia koncepcyjne, bez zatwierdzenia producenta i kalkulacji cen. Wzory są schematyczne.',
      shape:'Kształt obrysu', rectangle:'Prostokątny', wingRatio:'Proporcja skrzydła', height:'Łączna wysokość ścian (m)', storeys:'Kondygnacje', roof:'Dach', flat:'Płaski', gable:'Dwuspadowy', pitch:'Kąt dachu (°)', genericHint:'Dom koncepcyjny. Wymiary określa użytkownik; bez specyfikacji producenta i potwierdzenia zgodności z prawem.',
      redo:'Ponów', downloadProject:'Pobierz JSON', openFile:'Otwórz plik JSON', variants:'Warianty lokalne', variantName:'Nazwa wariantu', saveVariant:'Zapisz jako wariant', openVariant:'Otwórz wariant', variantHint:'Tylko w tej przeglądarce, do 20 wariantów. Pobierz JSON jako kopię zapasową.', variantError:'Nie można zapisać lub odczytać wariantów. Sprawdź nazwę, pamięć i limit 20 wariantów.',
      docTitle: 'Planer odległości od granic', title: 'Planer odległości', tagline: 'Obrys działki na siatce 1 m, budynki i wszystkie odległości.',
      language: 'Język', controls: 'Sterowanie', addBuilding: 'Dodaj budynek', house: 'Dom', garage: 'Garaż', buildings: 'Budynki',
      plot: 'Działka', area: 'Powierzchnia', perimeter: 'Obwód', side: 'Bok', cornersHint: 'Przeciągnij narożniki A–D na planie lub wpisz współrzędne.',
      rectW: 'Szerokość prostokąta w metrach', rectD: 'Głębokość prostokąta w metrach', makeRect: 'Utwórz prostokąt',
      drawing: 'Rysunek', snapTo: 'Przyciąganie', off: 'Wyłączone', dimsFor: 'Wymiary dla', allBuildings: 'Wszystkich budynków', selectedOnly: 'Tylko zaznaczonego',
      showGaps: 'Pokaż odstępy między budynkami', save: 'Zapis', copyLink: 'Kopiuj link do udostępnienia', copyJson: 'Kopiuj plan (JSON)', resetExample: 'Przywróć przykład',
      resetConfirm: 'Kliknij ponownie, aby przywrócić', loadFromJson: 'Wczytaj plan z JSON', pastePlan: 'Wklej skopiowany plan', loadPlan: 'Wczytaj plan',
      autosaveHint: 'Plan zapisuje się automatycznie w tej przeglądarce i w adresie strony, więc link zawsze otwiera dokładnie ten plan.',
      foot: 'Przeciągnij puste miejsce, aby przesunąć widok; przewiń lub uszczypnij, aby przybliżyć. Z zaznaczonym budynkiem: <kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> przesuwa, <kbd>R</kbd> obraca o 90°, <kbd>Del</kbd> usuwa. <kbd>Ctrl</kbd>+<kbd>Z</kbd> cofa.<br>Odległości to parametry geometryczne użytkownika: domyślnie 4&nbsp;m dla domu i 3&nbsp;m dla garażu. Narzędzie nie sprawdza zgodności z prawem. Zweryfikuj oficjalne dokumenty planistyczne i pozostałe wymagania.',
      plotPlan: 'Plan działki', undo: 'Cofnij', undoTitle: 'Cofnij (Ctrl+Z)', zoomOut: 'Oddal', zoomIn: 'Przybliż', fit: 'Dopasuj', fitTitle: 'Dopasuj działkę do widoku',
      lgBoundary: 'do granicy', lgBetween: 'między budynkami', lgBelow: 'poniżej min. odległości',
      selection: 'Zaznaczenie', selectionHint: 'Zaznacz budynek na planie, aby zmienić jego wymiary, obrót i minimalną odległość od granicy. Przeciągnij kwadraty w narożnikach, aby zmienić rozmiar.',
      selected: 'Zaznaczony', name: 'Nazwa', width: 'Szerokość (m)', depth: 'Głębokość (m)', rotation: 'Obrót (°)', minSetback: 'Min. odległość (m)',
      rotate90: 'Obróć o 90°', duplicate: 'Duplikuj', del: 'Usuń', clearance: 'Odległość od granicy', gaps: 'Odstępy od innych budynków',
      outside: 'Część budynku wychodzi poza działkę', check: 'Sprawdź', noBoundary: 'Brak granicy', wall: 'Ściana {side}', under: 'Poniżej {v} m', ok: 'OK',
      Right: 'prawa', Left: 'lewa', Top: 'górna', Bottom: 'dolna',
      overlap: 'Styk / kolizja', wallToWall: 'Ściana–ściana', corner: 'Narożnik', noOthers: 'Brak innych budynków.',
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
    document.querySelectorAll('[data-object-kind]').forEach(o=>{o.textContent=objectLibrary[o.dataset.objectKind][lang];});
    document.title = t('docTitle');
    document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
    document.querySelectorAll('[data-t-html]').forEach(el => { el.innerHTML = t(el.dataset.tHtml); });
    document.querySelectorAll('[data-t-title]').forEach(el => { el.title = t(el.dataset.tTitle); });
    document.querySelectorAll('[data-t-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.tAria)); });
    document.querySelectorAll('#o-snap option:not([value="0"])').forEach(o => { o.textContent = dec(o.value) + ' m'; });
    document.querySelectorAll('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  }
  const CATALOG_LS='setback-planner-catalogs';
  let enabledCatalogs;
  try { const saved=JSON.parse(localStorage.getItem(CATALOG_LS)||'null');enabledCatalogs=Array.isArray(saved)?saved.filter(id=>catalogRegistrations.some(r=>r.id===id)):catalogRegistrations.map(r=>r.id); }
  catch { enabledCatalogs=catalogRegistrations.map(r=>r.id); }
  let catalogRevision=0;const loadedCatalogModels=new Map();
  async function renderCatalogs(){
    const revision=++catalogRevision;
    $('#catalog-switches').innerHTML=catalogRegistrations.map(r=>`<label class="check"><input type="checkbox" data-catalog="${r.id}" ${enabledCatalogs.includes(r.id)?'checked':''}>${esc(r.name)}</label>`).join('');
    $('#catalog-models').textContent='';
    const entries=await Promise.all(enabledCatalogs.map(async id=>{try{return await loadCatalog(id);}catch{return null;}}));
    if(revision!==catalogRevision)return;for(const c of entries.filter(Boolean))for(const m of c.models)loadedCatalogModels.set(c.id+':'+m.id,m);
    $('#catalog-models').innerHTML=entries.map(c=>c?`<div class="catalog-attribution"><span>${esc(c.name)}</span><a href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">${lang==='pl'?'Strona producenta':'Manufacturer website'} ↗</a></div><div class="catalog-grid">${c.models.map(m=>`<article class="catalog-card"><img src="${esc(m.thumbnail)}" alt="${esc(m.name)} — ${esc(c.name)}" loading="lazy" width="600" height="340"><div class="catalog-card-body"><div class="catalog-card-heading"><h3>${esc(m.name)}</h3><span>${m.footprint.width.toFixed(2)} × ${m.footprint.depth.toFixed(2)} m</span></div><p>${lang==='pl'?'Wymiary wg rzutu producenta':'Dimensions from manufacturer plan'}</p><div class="catalog-actions"><button class="catalog-place" data-place-catalog="${esc(c.id)}" data-model="${esc(m.id)}">+ ${lang==='pl'?'Umieść na działce':'Place on parcel'}</button><button class="catalog-plan" data-plan-src="${esc(m.plan)}" data-plan-name="${esc(m.name)}">${lang==='pl'?'Rzut':'Plan'} ↗</button></div></div></article>`).join('')}</div>`:`<p class="hint">${t('catalogError')}</p>`).join('');
    $('#catalog-models').querySelectorAll('[data-place-catalog]').forEach(button=>button.onclick=async()=>{if(state.items.length>=100){toast(t('objectLimit'));return;}button.disabled=true;try{const catalog=await loadCatalog(button.dataset.placeCatalog),x=state.plot.reduce((n,p)=>n+p.x,0)/state.plot.length,y=state.plot.reduce((n,p)=>n+p.y,0)/state.plot.length,item=createCatalogItem(catalog,button.dataset.model,{id:'o'+uid++,x,y});snapshot();state.items.push(item);selected=item.id;buildPanel();render();toast(lang==='pl'?'Dodano projekt. Przeciągnij dom, aby go ustawić.':'Design added. Drag the house to position it.');}catch{toast(t('catalogError'));}finally{button.disabled=false;}});
    $('#catalog-models').querySelectorAll('[data-plan-src]').forEach(button=>button.onclick=()=>showCatalogPlan(button.dataset.planSrc,button.dataset.planName));

  }
  const planDialog=document.createElement('dialog');planDialog.className='catalog-plan-dialog';planDialog.setAttribute('aria-labelledby','catalog-plan-title');planDialog.innerHTML='<header><h2 id="catalog-plan-title"></h2><button data-plan-close type="button">×</button></header><div class="plan-toolbar"><button type="button" data-plan-zoom></button><a target="_blank" rel="noopener noreferrer" data-plan-full></a></div><div class="plan-image-wrap"><img alt=""></div><p>Udana Budowa · udanabudowa.pl</p>';document.body.append(planDialog);planDialog.querySelector('[data-plan-close]').onclick=()=>planDialog.close();
  planDialog.querySelector('[data-plan-zoom]').onclick=async()=>{const zoomed=planDialog.classList.toggle('zoomed');planDialog.querySelector('[data-plan-zoom]').textContent=zoomed?(lang==='pl'?'Dopasuj cały rzut':'Fit full plan'):(lang==='pl'?'+ Powiększ rzut':'+ Zoom plan');await planDialog.querySelector('img').decode().catch(()=>{});requestAnimationFrame(()=>{const viewport=planDialog.querySelector('.plan-image-wrap');viewport.scrollTo({left:zoomed?(viewport.scrollWidth-viewport.clientWidth)/2:0,top:zoomed?(viewport.scrollHeight-viewport.clientHeight)/2:0});});};
  function showCatalogPlan(src,name){planDialog.classList.remove('zoomed');planDialog.querySelector('h2').textContent=name;const image=planDialog.querySelector('img');image.src=src;image.alt=name+' — '+(lang==='pl'?'wymiarowany rzut producenta':'dimensioned manufacturer plan');planDialog.querySelector('[data-plan-close]').setAttribute('aria-label',lang==='pl'?'Zamknij rzut':'Close plan');planDialog.querySelector('[data-plan-zoom]').textContent=lang==='pl'?'+ Powiększ rzut':'+ Zoom plan';const full=planDialog.querySelector('[data-plan-full]');full.href=src;full.textContent=lang==='pl'?'Pełny rozmiar ↗':'Open full-size ↗';planDialog.showModal();}
  function toggleCatalog(id,enabled){
    enabledCatalogs=enabled?[...new Set([...enabledCatalogs,id])]:enabledCatalogs.filter(c=>c!==id);
    try {localStorage.setItem(CATALOG_LS,JSON.stringify(enabledCatalogs));}catch{toast(t('catalogError'));}
    renderCatalogs();buildPanel();
  }
  $('#catalog-switches').onchange=e=>toggleCatalog(e.target.dataset.catalog,e.target.checked);
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
    snap: 0.5, dimScope: 'selected', showPairs: false,
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
  let showroomActive=false;
  let state = (await fromHash()) || load() || parseScene(DEFAULT());
  let saveT, saveRevision = 0;
  function save(){
    clearTimeout(saveT); const revision = ++saveRevision;
    if (persistencePaused || showroomActive) return;
    saveT = setTimeout(async () => {
      try {
        const json = serializeScene(state);
        localStorage.setItem(LS, json); $('#project-warning').hidden = true;
        const hash = await encodeShare(JSON.parse(json));
        if (revision === saveRevision && !persistencePaused && !showroomActive) window.history.replaceState(null, '', hash);
      } catch { projectWarning(lang === 'pl' ? 'Nie można zapisać projektu. Sprawdź geometrię i pamięć przeglądarki.' : 'Project could not be saved. Check geometry and browser storage.', false); }
    }, 300);
  }
  let uid = state.items.reduce((m, i) => Math.max(m, parseInt(String(i.id).replace(/\D/g, '')) || 0), 0) + 1;
  let selected = state.items[0] ? state.items[0].id : null;
  const get = id => state.items.find(i => i.id === id);
  const cornerName=i=>i<26?String.fromCharCode(65+i):String(i+1);
  function markParcelEdited(){if(state.parcel)state.parcel.edited=true;}

  let history = new ProjectHistory();
  function snapshot(){ history.record(state); }
  function restoreHistory(next){
    if (!next){ toast(t('nothingToUndo')); return; }
    state = next;
    if (!get(selected)) selected = null;
    uid = state.items.reduce((m,i) => Math.max(m, parseInt(String(i.id).replace(/\D/g,'')) || 0),0)+1;
    $('#o-snap').value=String(state.snap); $('#o-dims').value=state.dimScope; $('#o-pairs').checked=state.showPairs;
    buildCorners(); buildPanel(); render();
  }
  function undo(){ restoreHistory(history.undo(state)); }
  function redo(){ restoreHistory(history.redo(state)); }

  // ---------- geometry ----------
  const sub = (a,b) => ({x:a.x-b.x, y:a.y-b.y});
  const add = (a,b) => ({x:a.x+b.x, y:a.y+b.y});
  const mul = (a,k) => ({x:a.x*k, y:a.y*k});
  const dot = (a,b) => a.x*b.x + a.y*b.y;
  const len = a => Math.hypot(a.x, a.y);
  const edges = poly => poly.map((p,i) => [p, poly[(i+1) % poly.length]]);

  const corners = worldFootprint;
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
      for (let i = 0; i < X.length; i++){
        const A = X[i], B = X[(i+1)%X.length];
        const r = perpendicularClearance(A, B, outwardNormal(A,B), Y);
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

  function compute(){
    const plotValid = validRing(state.plot), res = new Map();
    for (const it of state.items){
      const c = corners(it), inside = plotValid && parcelContains(state,c);
      const sides = [];
      for (let i = 0; i < c.length; i++){
        const A = c[i], B = c[(i+1)%c.length], n = outwardNormal(A,B);
        const hits=parcelPolygons(state).flat().map(ring=>perpendicularClearance(A,B,n,ring)).filter(Boolean);const r=hits.sort((a,b)=>a.t-b.t)[0]||null;
        sides.push({name: sideName(n), P: r && r.P, Q: r && r.Q, t: r ? r.t : null, warn: r ? r.t < it.setback - 1e-9 : false});
      }
      const ts = sides.filter(s => s.t != null).map(s => s.t);
      res.set(it.id, {c, inside, sides, min: ts.length ? Math.min(...ts) : null});
    }
    const pairs = [], its = state.items;
    for (let i = 0; i < its.length; i++) for (let j = i+1; j < its.length; j++){
      if(!blocksPlacement(its[i])||!blocksPlacement(its[j]))continue;
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
    const pts = [...parcelPolygons(state).flat(2)]; for (const it of state.items) pts.push(...corners(it));
    const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = W < 500 ? 36 : 64;
    const top = matchMedia('(max-width:760px)').matches ? 74 : pad;
    const k = Math.max(1, Math.min(200, Math.min((W - 2*pad) / Math.max(1, maxX - minX), (H - top - pad - 60) / Math.max(1, maxY - minY))));
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
  let viewer = null, view3d = false, parcelMap = null, mapActive = false;
  let originalAppearance = false;
  let C = compute();
  function render(){ syncFences(); syncEnvironment(); C = compute(); syncPanel(); renderSheet(); if(viewer && view3d)viewer.update(state,originalAppearance); if(parcelMap && mapActive)parcelMap.update(state); save(); }

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
    const pp = state.plot.map(S), pd = parcelPolygons(state).flat().map(ring=>'M'+ring.map(S).map(p=>f(p.x)+' '+f(p.y)).join('L')+'Z').join(' ');
    out.push(`<clipPath id="plotclip"><path clip-rule="evenodd" d="${pd}"/></clipPath>`);
    out.push(`<path class="gout" d="${grid(major)}"/>`);
    out.push(`<path class="plot-fill" fill-rule="evenodd" d="${pd}"/>`);
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
    for (const it of state.items.filter(i=>i.visible)){
      const r = C.res.get(it.id), sp = r.c.map(S);
      const d = 'M' + sp.map(p => f(p.x) + ' ' + f(p.y)).join('L') + 'Z';
      const bad = !r.inside || r.overlap;
      const appearance=resolveAppearance(originalAppearance?{}:it.appearance); let finish=materialPresets[appearance.facade];
      if(it.type==='landscape'&&it.kind)finish={...finish,color:objectLibrary[it.kind].color};
      out.push(`<path class="bld ${it.type}${it.id === selected ? ' sel' : ''}${bad ? ' bad' : ''}" data-kind="item" data-id="${it.id}" style="fill:${finish.color};fill-opacity:.55;${it.type==='landscape'?'stroke:'+finish.color+';':''}" d="${d}"/>`);
      const c = S(it), minSide = Math.min(it.w, it.d) * k;
      if (minSide > 26){
        const two = minSide > 46;
        labels.push(`<text class="bname" x="${f(c.x)}" y="${f(c.y + (two ? -1 : 4))}" text-anchor="middle">${esc(it.name)}</text>`);
        if (two) labels.push(`<text class="bsize" x="${f(c.x)}" y="${f(c.y + 13)}" text-anchor="middle">${fmtD(it.w)} × ${fmtD(it.d)} m</text>`);
      }
    }
    for(const fence of state.fences)for(const segment of fenceSegments(fence)){
      if(segment.gate&&fence.gate?.open)continue;const a=S(segment.a),b=S(segment.b);out.push(`<path d="M${a.x} ${a.y}L${b.x} ${b.y}" fill="none" stroke="${segment.gate?'#39799b':fence.color}" stroke-width="${fence.type.startsWith('hedge')?fence.width*k:3}"/>`);
    }
    out.push(...labels);

    // plot side lengths and corners
    const cen = {x: pp.reduce((s,p)=>s+p.x,0)/pp.length, y: pp.reduce((s,p)=>s+p.y,0)/pp.length};
    const names = state.plot.map((_,i)=>cornerName(i));
    for (let i = 0; i < pp.length; i++){
      const a = pp[i], b = pp[(i+1)%pp.length], m = {x:(a.x+b.x)/2, y:(a.y+b.y)/2};
      let n = outwardNormal(a, b); if (dot(n, sub(m, cen)) < 0) n = mul(n, -1);
      const L = len(sub(state.plot[(i+1)%state.plot.length], state.plot[i]));
      let ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang <= -90) ang += 180;
      const lx = m.x + n.x * 13, ly = m.y + n.y * 13;
      out.push(`<text class="edget" x="${f(lx)}" y="${f(ly)}" dy="4" text-anchor="middle" transform="rotate(${ang.toFixed(1)} ${f(lx)} ${f(ly)})">${names[i]}${names[(i+1)%names.length]} ${fmt(L)}</text>`);
    }
    pp.forEach((p, i) => {
      const v = sub(p, cen), l = len(v) || 1, lx = p.x + v.x/l * 20, ly = p.y + v.y/l * 20;
      out.push(`<text class="cornert" x="${f(lx)}" y="${f(ly)}" dy="4" text-anchor="middle">${names[i]}</text>`);
      out.push(`<circle class="corner" cx="${f(p.x)}" cy="${f(p.y)}" r="6.5"/>`);
      out.push(`<circle class="corner-hit" data-kind="corner" data-i="${i}" cx="${f(p.x)}" cy="${f(p.y)}" r="17"/>`);
    });

    // resize handles
    const s = get(selected);
    if (s && s.visible && !s.locked){
      boundingCorners(s).map(S).forEach((p, i) => {
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
    const it = get(selected), box = $('#sel'),catalogModel=it?.catalog?loadedCatalogModels.get(it.catalog.catalogId+':'+it.catalog.modelId):null;
    const openDetails=[...box.querySelectorAll('details[open]')].map(el=>el.id);
    if (!it){
      box.innerHTML = `<h2 class="lbl">${t('selection')}</h2><p class="hint">${t('selectionHint')}</p>`;
    } else {
      box.innerHTML = `
        <div class="sec-head"><h2 class="lbl">${t('selected')}</h2><span class="tag ${it.type}">${t(it.type)}</span></div>
        ${it.catalog?`<p class="hint">${esc(it.catalog.catalogId)} / ${esc(it.catalog.modelId)} · ${esc(it.catalog.modelVersion)}<br>${catalogAvailable(it.catalog,enabledCatalogs)?(catalogModel&&(Math.abs(it.w-catalogModel.footprint.width)>.001||Math.abs(it.d-catalogModel.footprint.depth)>.001)?(lang==='pl'?'Wymiary zmienione przez użytkownika.':'Dimensions customized by the user.'):(lang==='pl'?'Obrys wg rzutu producenta · wysokość i dach poglądowe.':'Envelope from manufacturer plan · illustrative height and roof.')) :t('catalogUnavailable')}</p>${!catalogAvailable(it.catalog,enabledCatalogs)&&catalogRegistrations.some(r=>r.id===it.catalog.catalogId)?`<button id="enable-missing-catalog">${t('enableCatalog')}</button>`:''}`:''}
        ${catalogModel?`<figure class="selected-catalog"><img src="${esc(catalogModel.thumbnail)}" alt="${esc(catalogModel.name)}"><figcaption>${esc(catalogModel.name)} · Udana Budowa<button id="selected-plan">${lang==='pl'?'Zobacz rzut':'View plan'} ↗</button></figcaption></figure>`:''}
        <div class="field"><label for="f-name">${t('name')}</label><input id="f-name" type="text" maxlength="60" value="${esc(it.name)}"></div>
        <div class="grid2">
          <div class="field"><label for="f-w">${t('width')}</label><input id="f-w" type="number" step="0.1" min="0.5" inputmode="decimal"></div>
          <div class="field"><label for="f-d">${t('depth')}</label><input id="f-d" type="number" step="0.1" min="0.5" inputmode="decimal"></div>
          <div class="field"><label for="f-rot">${t('rotation')}</label><input id="f-rot" type="number" step="1" inputmode="decimal"></div>
          <div class="field"><label for="f-sb">${t('minSetback')}</label><input id="f-sb" type="number" step="0.5" min="0" inputmode="decimal"></div>
        </div>
        <details id="architecture-options"><summary>${t('shape')} · ${t('roof')}</summary>
          <p class="hint">${t('genericHint')}</p>
          <div class="grid2">
            <div class="field"><label for="f-shape">${t('shape')}</label><select id="f-shape">${['rectangle','L','T','U','custom'].map(s=>`<option value="${s}">${s==='rectangle'?t('rectangle'):s}</option>`).join('')}</select></div>
            <div class="field"><label for="f-wing">${t('wingRatio')}</label><input id="f-wing" type="number" min="0.15" max="0.45" step="0.05"></div>
            <div class="field"><label for="f-storeys">${t('storeys')}</label><input id="f-storeys" type="number" min="1" max="3" step="1"></div>
            <div class="field"><label for="f-height">${t('height')}</label><input id="f-height" type="number" min="0.02" max="30" step="0.1"></div>
            <div class="field"><label for="f-roof">${t('roof')}</label><select id="f-roof"><option value="flat">${t('flat')}</option><option value="gable">${t('gable')}</option><option value="hip">Hip / Kopertowy</option><option value="shed">Shed / Jednospadowy</option></select></div>
            <div class="field"><label for="f-pitch">${t('pitch')}</label><input id="f-pitch" type="number" min="0" max="60" step="1"></div>
          </div>
        </details>
        <details id="material-options"><summary>${t('materials')}</summary>
          <p class="hint">${t('materialHint')}</p>
          <div class="field"><label for="f-facade">${t('facade')}</label><select id="f-facade">${Object.entries(materialPresets).map(([id,m])=>`<option value="${id}">${m[lang]}</option>`).join('')}</select></div>
          <div class="grid2">${['grout','roofColor','frameColor','doorColor','gutterColor','trimColor'].map(key=>`<div class="field"><label for="f-${key}">${t(key)}</label><input id="f-${key}" type="color"></div>`).join('')}
          <div class="field"><label for="f-roofCovering">${lang==='pl'?'Pokrycie dachu':'Roof covering'}</label><select id="f-roofCovering"><option>metal</option><option>tile</option><option>shingle</option><option>membrane</option></select></div><div class="field"><label for="f-layout">${t('layout')}</label><select id="f-layout"><option value="horizontal">${t('horizontal')}</option><option value="vertical">${t('vertical')}</option></select></div>
          ${['tileWidth','tileHeight'].map(key=>`<div class="field"><label for="f-${key}">${t(key)}</label><input id="f-${key}" type="number" min="0.02" max="3" step="0.005"></div>`).join('')}</div>
          <div class="grid2"><div class="field"><label for="f-wall">${t('wallFinish')}</label><select id="f-wall">${corners(it).map((_,i)=>`<option value="${i}">${i+1}</option>`).join('')}</select></div>
          <div class="field"><label for="f-wall-material">${t('facade')}</label><select id="f-wall-material"><option value="">${t('inherit')}</option>${Object.entries(materialPresets).map(([id,m])=>`<option value="${id}">${m[lang]}</option>`).join('')}</select></div></div>
          <label class="check"><input id="f-original" type="checkbox" ${originalAppearance?'checked':''}>${t('original')}</label>
          <div class="row"><button id="f-reset-facade">${t('resetFacade')}</button><button id="f-reset-materials">${t('resetMaterials')}</button></div>
        </details>
        <div class="row"><button id="b-rot">${t('rotate90')}</button><button id="b-dup">${t('duplicate')}</button><button id="b-del" class="danger">${t('del')}</button></div>
        <h3 class="lbl sm">${t('clearance')}</h3><div class="readout" id="f-clear"></div>
        <h3 class="lbl sm">${t('gaps')}</h3><div class="readout" id="f-gaps"></div>`;
      if($('#selected-plan'))$('#selected-plan').onclick=()=>showCatalogPlan(catalogModel.plan,catalogModel.name);
      if ($('#enable-missing-catalog')) $('#enable-missing-catalog').onclick=()=>toggleCatalog(it.catalog.catalogId,true);
      if(it.type==='landscape'){const f=document.createElement('div');f.className='field';f.innerHTML=`<label for="outdoor-maturity">${t('mature')}</label><input id="outdoor-maturity" type="number" min="0" max="1" step="0.1" value="${it.outdoor.maturity}">`;f.insertAdjacentHTML('beforeend',`<label for="outdoor-paving">${lang==='pl'?'Nawierzchnia':'Paving'}</label><select id="outdoor-paving">${['granite','concrete','gravel','timber','grass-pavers'].map(v=>`<option ${v===it.outdoor.paving?'selected':''}>${v}</option>`).join('')}</select>`);box.append(f);$('#outdoor-paving').onchange=e=>{snapshot();it.outdoor.paving=e.target.value;render();};bindNum('outdoor-maturity',v=>it.outdoor.maturity=Math.max(0,Math.min(1,v)));}
      if(it.type!=='landscape'){
        const openingPanel=document.createElement('details');openingPanel.id='opening-editor';openingPanel.innerHTML=`<summary>${lang==='pl'?'Okna i drzwi':'Windows & doors'}</summary><div class="grid2"><label>${lang==='pl'?'Element':'Element'}<select id="opening-type"><option value="window">${lang==='pl'?'Okno':'Window'}</option><option value="door">${lang==='pl'?'Drzwi':'Door'}</option></select></label><label>${lang==='pl'?'Ściana':'Wall'}<select id="opening-edge">${corners(it).map((_,i)=>`<option value="${i}">${i+1}</option>`).join('')}</select></label>${[['offset',lang==='pl'?'Od narożnika (m)':'From corner (m)',1],['width',lang==='pl'?'Szerokość (m)':'Width (m)',1.2],['height',lang==='pl'?'Wysokość (m)':'Height (m)',1.2],['sill',lang==='pl'?'Parapet (m)':'Sill (m)',.9]].map(([key,label,value])=>`<label>${label}<input id="opening-${key}" type="number" min="0" step=".1" value="${value}"></label>`).join('')}</div><button id="opening-add">+ ${lang==='pl'?'Dodaj element':'Add opening'}</button><p id="opening-error" role="status" class="hint"></p><div class="opening-list">${it.openings.map((o,i)=>`<button data-delete-opening="${i}">${lang==='pl'?'Ściana':'Wall'} ${o.edge+1} · ${o.width} × ${o.height} m <span>×</span></button>`).join('')}</div><p class="hint">${lang==='pl'?'Koncepcyjne otwory. Dobierz je do projektu architektonicznego.':'Conceptual openings. Match them to the architectural drawings.'}</p>`;$('#material-options').before(openingPanel);
        $('#opening-add').onclick=()=>{try{const opening={type:$('#opening-type').value,edge:Number($('#opening-edge').value),...Object.fromEntries(['offset','width','height','sill'].map(k=>[k,Number($('#opening-'+k).value)]))},next=parseScene({...state,items:state.items.map(i=>i.id===it.id?{...i,openings:[...i.openings,opening]}:i)});applyPlan(next,t('planLoaded'));}catch{$('#opening-error').textContent=lang==='pl'?'Element musi mieścić się w wybranej ścianie.':'The opening must fit inside the selected wall.';}};
        openingPanel.querySelectorAll('[data-delete-opening]').forEach(button=>button.onclick=()=>{snapshot();it.openings.splice(Number(button.dataset.deleteOpening),1);buildPanel();render();});
      }
      const ops=document.createElement('details');ops.id='scene-operations';ops.innerHTML=`<summary>${lang==='pl'?'Zaawansowane ustawienia':'Advanced settings'}</summary><label class="check"><input id="object-visible" type="checkbox" ${it.visible?'checked':''}>${lang==='pl'?'Widoczny':'Visible'}</label><label class="check"><input id="object-locked" type="checkbox" ${it.locked?'checked':''}>${lang==='pl'?'Zablokowany':'Locked'}</label><label>${lang==='pl'?'Grupa':'Group'}<input id="object-group" type="text" maxlength="60" value="${esc(it.group)}"></label><label>Custom normalized footprint [[x,y],…], each −0.5…0.5<textarea id="object-custom">${esc(JSON.stringify(it.custom?.map(p=>[p.x,p.y])??[]))}</textarea></label><label>Openings JSON [{edge,offset,width,height,sill,type}]<textarea id="object-openings">${esc(JSON.stringify(it.openings))}</textarea></label><button id="object-apply">Apply geometry / Zastosuj</button><div class="row"><button id="attach-garage">+ Garage / Garaż</button><button id="attach-carport">+ Carport / Wiata</button></div><p id="object-error" role="status"></p>`;box.append(ops);
      $('#object-visible').onchange=e=>{snapshot();it.visible=e.target.checked;render();};$('#object-locked').onchange=e=>{snapshot();it.locked=e.target.checked;buildPanel();render();};$('#object-group').onchange=e=>{snapshot();it.group=e.target.value;render();};
      $('#object-apply').onclick=()=>{try{const openings=JSON.parse($('#object-openings').value),custom=JSON.parse($('#object-custom').value).map(([x,y])=>({x,y})),next=parseScene({...state,items:state.items.map(i=>i.id===it.id?{...i,openings,...(custom.length?{shape:'custom',custom}:{})}:i)});applyPlan(next,t('planLoaded'));}catch{$('#object-error').textContent='Invalid geometry / Nieprawidłowa geometria';}};
      for(const kind of ['garage','carport'])$('#attach-'+kind).onclick=()=>{if(state.items.length>=100)return;const group=it.group||crypto.randomUUID(),w=3,d=6,r=it.rot*Math.PI/180,offset=(it.w+w)/2;const attached=parseScene({plot:state.plot,items:[{id:'o'+(uid++),type:kind==='garage'?'garage':'landscape',...(kind==='carport'?{kind:'pergola'}:{}),name:kind,x:it.x+Math.cos(r)*offset,y:it.y+Math.sin(r)*offset,w,d,rot:it.rot,setback:0,group,architecture:{height:2.6,storeys:1,roof:'flat',pitch:0}}]}).items[0];snapshot();it.group=group;state.items.push(attached);buildPanel();render();};
      if(it.locked)box.querySelectorAll('input,select,textarea,button').forEach(el=>{if(!['object-locked','object-visible'].includes(el.id))el.disabled=true;});
      const nameEl = $('#f-name');
      let pending = false;
      nameEl.addEventListener('focus', () => { pending = true; });
      nameEl.addEventListener('input', () => { if (pending){ snapshot(); pending = false; } it.name = nameEl.value.slice(0, 60); render(); });
      bindNum('f-w', v => { it.w = Math.min(1000, Math.max(0.5, v)); });
      bindNum('f-d', v => { it.d = Math.min(1000, Math.max(0.5, v)); });
      bindNum('f-rot', v => { it.rot = ((v % 360) + 360) % 360; });
      bindNum('f-sb', v => { it.setback = Math.min(1000, Math.max(0, v)); });
      $('#f-shape').onchange=e=>{snapshot();it.shape=e.target.value;if(it.shape==='custom'&&!it.custom)it.custom=[{x:-.5,y:-.5},{x:.5,y:-.5},{x:0,y:.5}];it.appearance.walls={};buildPanel();render();};
      $('#f-roof').onchange=e=>{snapshot();it.architecture.roof=e.target.value;render();};
      bindNum('f-wing',v=>it.wingRatio=Math.max(0.15,Math.min(0.45,v)));
      bindNum('f-storeys',v=>it.architecture.storeys=Math.max(1,Math.min(3,Math.round(v))));
      bindNum('f-height',v=>it.architecture.height=Math.max(0.02,Math.min(30,v)));
      bindNum('f-pitch',v=>it.architecture.pitch=Math.max(0,Math.min(60,v)));
      const setAppearance=(key,value)=>{snapshot();it.appearance={...it.appearance,[key]:value};render();};
      for(const key of ['facade','grout','roofColor','frameColor','doorColor','gutterColor','trimColor','layout','roofCovering']) $('#f-'+(key==='facade'?'facade':key)).onchange=e=>setAppearance(key,e.target.value);
      for(const key of ['tileWidth','tileHeight']) bindNum('f-'+key,v=>it.appearance={...it.appearance,[key]:Math.max(0.02,Math.min(3,v))});
      $('#f-wall').onchange=()=>{$('#f-wall-material').value=it.appearance.walls?.[$('#f-wall').value]||'';};
      $('#f-wall-material').onchange=e=>{snapshot();const walls={...it.appearance.walls};if(e.target.value)walls[$('#f-wall').value]=e.target.value;else delete walls[$('#f-wall').value];it.appearance={...it.appearance,walls};render();};
      $('#f-original').onchange=e=>{originalAppearance=e.target.checked;render();};
      $('#f-reset-materials').onclick=()=>{snapshot();it.appearance=resetAppearance(it.appearance);render();};
      $('#f-reset-facade').onclick=()=>{snapshot();it.appearance=resetAppearance(it.appearance,'facade');render();};
      $('#b-rot').onclick = () => rotate90();
      $('#b-dup').onclick = () => duplicate();
      $('#b-del').onclick = () => removeSelected();
    }
    openDetails.forEach(id=>{const detail=document.getElementById(id);if(detail)detail.open=true;});
    syncPanel(true);
  }

  function syncPanel(force){
    const it = get(selected);
    if (it){
      setVal('f-w', fmtN(it.w)); setVal('f-d', fmtN(it.d)); setVal('f-rot', fmtN(it.rot)); setVal('f-sb', fmtN(it.setback));
      const appearance=resolveAppearance(it.appearance);
      for(const key of ['facade','grout','roofColor','frameColor','doorColor','gutterColor','trimColor','layout','roofCovering','tileWidth','tileHeight'])setVal('f-'+key,appearance[key]);
      setVal('f-wall-material',it.appearance.walls?.[$('#f-wall')?.value]||'');
      setVal('f-shape',it.shape); setVal('f-wing',it.wingRatio);setVal('f-height',it.architecture.height);setVal('f-storeys',it.architecture.storeys);setVal('f-roof',it.architecture.roof);setVal('f-pitch',it.architecture.pitch);
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
    const area = parcelArea(state);
    let per = 0; parcelPolygons(state).flat().forEach(ring=>edges(ring).forEach(([a,b])=>per+=len(sub(b,a))));
    const built = state.items.reduce((s, i) => s + (i.type==='landscape'?0:polygonArea(corners(i))), 0);
    $('#parcel-source').textContent=state.parcel ? `${state.parcel.source.name}${state.parcel.identifier?' · '+state.parcel.identifier:''} · ${state.parcel.source.retrievedAt} · ${state.parcel.source.crs}${state.parcel.edited?' · '+t('parcelEdited'):''}` : '';
    $('#p-area').textContent = group(area) + ' m²';
    $('#p-ares').textContent = dec((area / 100).toFixed(2)) + ' a';
    $('#p-per').textContent = dec(per.toFixed(1)) + ' m';
    $('#p-cov').textContent = t('built', {v: dec(area ? (built / area * 100).toFixed(1) : '0')});
    const names = state.plot.map((_,i)=>cornerName(i));
    state.plot.forEach((p, i) => {
      setVal('pc-x-' + i, fmtN(p.x)); setVal('pc-y-' + i, fmtN(p.y));
      const q = state.plot[(i+1)%state.plot.length];
      document.getElementById('pc-l-' + i).textContent = names[i] + names[(i+1)%names.length] + ' ' + dec(len(sub(q,p)).toFixed(2));
    });

    const plotValid = validRing(state.plot);
    const warnCount = state.items.filter(i => C.res.get(i.id).warn).length;
    $('#chipbar').innerHTML = (!plotValid ? `<span style="color:var(--warn)">${lang === 'pl' ? 'Nieprawidłowa granica działki' : 'Invalid parcel boundary'}</span>` : '') + `<span>${group(area)} m² · ${dec((area/100).toFixed(2))} a</span>` +
      (state.coordinates.projected?`<span>${t('north')}</span>`:'') + (state.items.length ? `<span style="color:var(${warnCount ? '--warn' : '--ok'})">${warnCount ? t('toCheck', {n: warnCount}) : t('allMet')}</span>` : '');
  }

  function buildCorners(){
    const names = state.plot.map((_,i)=>cornerName(i));
    $('#p-corners').innerHTML = names.map((n, i) => `<tr><td>${n}</td>
      <td><input id="pc-x-${i}" type="number" step="0.1" inputmode="decimal" aria-label="${t('cornerAxis', {c: n, axis: 'x'})}"></td>
      <td><input id="pc-y-${i}" type="number" step="0.1" inputmode="decimal" aria-label="${t('cornerAxis', {c: n, axis: 'y'})}"></td>
      <td class="len" id="pc-l-${i}"></td></tr>`).join('');
    for (let i = 0; i < state.plot.length; i++){
      bindNum('pc-x-' + i, v => { state.plot[i].x = v; markParcelEdited(); });
      bindNum('pc-y-' + i, v => { state.plot[i].y = v; markParcelEdited(); });
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
    if(state.items.length>=100){toast(t('objectLimit'));return;}
    snapshot();
    const ty = TYPES[type], n = state.items.filter(i => i.type === type).length;
    const cx = state.plot.reduce((s,p)=>s+p.x,0)/state.plot.length, cy = state.plot.reduce((s,p)=>s+p.y,0)/state.plot.length;
    const it = {...parseScene({plot:state.plot,items:[{id:'new',type,name:t(type),x:cx,y:cy,w:ty.w,d:ty.d,rot:0,setback:ty.setback}]}).items[0], id: 'o' + (uid++), type, name: t(type) + (n ? ' ' + (n + 1) : ''), x: cx, y: cy, w: ty.w, d: ty.d, rot: 0, setback: ty.setback};
    snapItem(it);
    state.items.push(it); selected = it.id;
    buildPanel(); render();
  }
  function duplicate(){
    if(state.items.length>=100){toast(t('objectLimit'));return;}
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
    const next=transformGroup(state.items,it.id,0,0,90);if(next){snapshot();state.items=next;buildPanel();render();}
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
      if(it.locked)return;
      drag = {mode: 'item', groupStart:structuredClone(state.items), id: it.id, wx: w.x, wy: w.y, x0: it.x, y0: it.y, sx: pt.x, sy: pt.y, started: false};
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
      markParcelEdited();
      state.plot[drag.i] = {x: snapV(drag.x0 + w.x - drag.wx), y: snapV(drag.y0 + w.y - drag.wy)};
    } else if (drag.mode === 'item'){
      const it = get(drag.id); if (!it) return;
      const next=transformGroup(drag.groupStart,it.id,snapV(w.x-drag.wx),snapV(w.y-drag.wy));if(next)state.items=next;
    } else if (drag.mode === 'handle'){
      const it = get(drag.id); if (!it) return;
      const st = drag.start, F = boundingCorners(st)[(drag.ci + 2) % 4];
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
    if (!it || it.locked) return;
    const step = (state.snap > 0 ? state.snap : 0.1) * (e.shiftKey ? 10 : 1);
    const moves = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]};
    if (moves[e.key]){ e.preventDefault(); const next=transformGroup(state.items,it.id,moves[e.key][0]*step,moves[e.key][1]*step);if(next){snapshot();state.items=next;render();} }
    else if (e.key === 'r' || e.key === 'R'){ rotate90(); }
    else if (e.key === 'Delete' || e.key === 'Backspace'){ e.preventDefault(); removeSelected(); }
    else if (e.key === 'Escape'){ selected = null; buildPanel(); render(); }
  });

  function setStageMode(mode){
    view3d=mode==='3d';mapActive=mode==='map';
    if(!mapActive){mapPick=false;$('#map-pick').setAttribute('aria-pressed','false');}
    $('#viewer').hidden=!view3d;$('#sheet').hidden=mode!=='2d';$('#viewer-controls').hidden=!view3d;
    $('#parcel-map').hidden=!mapActive;$('#map-controls').hidden=!mapActive;$('#map-status').hidden=!mapActive;
    $('.tools').hidden=mode!=='2d';$('.legend').hidden=mode!=='2d';$('#chipbar').hidden=mode!=='2d';$('#viewer-note').hidden=!view3d;
    $('#view-2d').setAttribute('aria-pressed',String(mode==='2d'));$('#view-3d').setAttribute('aria-pressed',String(view3d));$('#view-map').setAttribute('aria-pressed',String(mapActive));
    if(viewer){viewer.setActive(view3d);if(view3d)viewer.update(state,originalAppearance);}
    if(parcelMap){parcelMap.setActive(mapActive);if(mapActive)parcelMap.update(state);}
    if(mode==='2d')renderSheet();
  }
  const setViewerMode=enabled=>setStageMode(enabled?'3d':'2d');
  $('#view-map').onclick=async()=>{
    $('#view-map').disabled=true;
    try{
      if(!parcelMap){const {createParcelMap}=await import('./map/map.ts');parcelMap=createParcelMap($('#parcel-map'),()=>{$('#map-status').textContent=t('mapError');});parcelMap.onClick(pickMapParcel);parcelMap.setBase($('#map-base').value);parcelMap.setCadastre($('#map-cadastre').checked);for(const id of mapOverlayIds)parcelMap.setOverlay(id,$('#map-'+id).checked);}
      $('#map-status').textContent=t('mapHint');setStageMode('map');
    }catch{parcelMap?.dispose();parcelMap=null;setStageMode('2d');toast(t('mapError'));}
    finally{$('#view-map').disabled=false;}
  };
  $('#map-base').onchange=e=>parcelMap?.setBase(e.target.value);
  $('#map-cadastre').onchange=e=>parcelMap?.setCadastre(e.target.checked);
  for(const [id,label]of [['planning','Planning / MPZP'],['utilities','Utilities / Uzbrojenie'],['environment','Protected areas / Ochrona przyrody'],['flood','Flood zones / Powódź'],['groundwater','Groundwater / Podtopienia'],['relief','Terrain relief / Rzeźba terenu'],['landslides','Landslides / Osuwiska'],['mining','Mining and deposits / Górnictwo i złoża'],['wells','Hydrogeological objects / Otwory hydrogeologiczne']]){const labelEl=document.createElement('label');labelEl.className='check';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.id='map-'+id;checkbox.onchange=()=>parcelMap?.setOverlay(id,checkbox.checked);const text=document.createElement('span');text.dataset.ui='layer'+id;text.textContent=label;labelEl.append(checkbox,text);$('#map-controls').append(labelEl);}
  $('#map-fit').onclick=()=>parcelMap?.fitProject();
  let mapPick=false;
  $('#map-pick').onclick=()=>{mapPick=!mapPick;$('#map-pick').setAttribute('aria-pressed',String(mapPick));$('#map-status').textContent=t(mapPick?'pickHint':'mapHint');};
  async function pickMapParcel(longitude,latitude){
    if(!mapPick||Date.now()-lastParcelLookup<2000)return;
    mapPick=false;lastParcelLookup=Date.now();$('#map-pick').setAttribute('aria-pressed','false');$('#map-pick').disabled=true;
    const before=JSON.stringify(state);$('#map-status').textContent=t('uldkLoading');
    try{
      const {lookupParcelAt}=await import('./core/uldk.ts');const parcel=await lookupParcelAt(longitude,latitude);
      if(JSON.stringify(state)!==before){$('#map-status').textContent=t('uldkChanged');return;}
      applyPlan(parseScene({...state,...parcel,terrain:undefined}),t('planLoaded'));$('#map-status').textContent=t('planLoaded');
    }catch{$('#map-status').textContent=t('uldkError');}
    finally{$('#map-pick').disabled=false;}
  }
  $('#view-2d').onclick=()=>setViewerMode(false);
  $('#view-3d').onclick=async()=>{
    $('#view-3d').disabled=true;
    try {
      if(!viewer){
        const {createViewer}=await import('./viewer/viewer.ts');
        viewer=createViewer($('#viewer'),()=>{viewer?.dispose();viewer=null;setViewerMode(false);toast(t('viewerFailure'));});
      }
      $('#viewer-note').textContent=t('viewerHint');setViewerMode(true);
    } catch {viewer?.dispose();viewer=null;setViewerMode(false);toast(t('viewerFailure'));}
    finally {$('#view-3d').disabled=false;}
  };
  const walkButton=document.createElement('button');walkButton.textContent='Walk / Spacer';walkButton.onclick=()=>viewer?.view('walk');$('#viewer-controls').append(walkButton);
  $('#view-top').onclick=()=>viewer?.view('top');$('#view-axon').onclick=()=>viewer?.view('axonometric');
  $('#view-low').onchange=e=>viewer?.quality(e.target.checked);
  $('#view-capture').onclick=()=>{try{const a=document.createElement('a');a.download='setback-3d.png';a.href=viewer.screenshot();a.click();}catch{toast(t('viewerFailure'));}};
  window.addEventListener('pagehide',()=>{viewer?.dispose();viewer=null;parcelMap?.dispose();parcelMap=null;});
  // ---------- wiring ----------
  const terrainPanel=document.createElement('details');terrainPanel.innerHTML='<summary>Terrain / Planning / Risks · Teren i źródła</summary><p class="hint">GUGiK NMT: nine elevation samples, approximate interpolated terrain and slope. Survey datum and acquisition date unspecified. Remote failures leave the project unchanged. / Przybliżony model z 9 próbek, nie zastępuje pomiarów.</p><button id="terrain-sample">Fetch elevation / Pobierz wysokości</button><button id="terrain-clear">Flat ground / Płaski teren</button><p id="terrain-result" role="status"></p><p class="hint">Map layers are visual context. No flood clearance, utility availability or legal planning conclusion is inferred. / Warstwy nie potwierdzają bezpieczeństwa ani warunków zabudowy.</p><a href="https://wody.isok.gov.pl/imap_kzgw/?gpmap=gpMZP" target="_blank" rel="noopener noreferrer">Official flood hazard · Wody Polskie</a><br><a href="https://geoserwis.gdos.gov.pl/mapy/" target="_blank" rel="noopener noreferrer">Protected environments · GDOŚ</a>';$('#sel').before(terrainPanel);
  $('#terrain-clear').onclick=()=>{snapshot();delete state.terrain;$('#terrain-result').textContent='';render();};
  $('#terrain-sample').onclick=async()=>{const before=JSON.stringify(state);$('#terrain-sample').disabled=true;$('#terrain-result').textContent='…';try{const {sampleTerrain}=await import('./core/terrain.ts'),terrain=await sampleTerrain(state);if(JSON.stringify(state)!==before)throw new Error('Project changed; request again');snapshot();state.terrain=terrain;$('#terrain-result').textContent=`${terrain.source} · ${terrain.retrievedAt} · approximate slope ${terrain.slopePercent.toFixed(1)}%`;render();}catch(e){$('#terrain-result').textContent=e.message;}finally{$('#terrain-sample').disabled=false;}};
  const sourcePanel=document.createElement('details');sourcePanel.id='source-directory';function renderSourceDirectory(){sourcePanel.innerHTML=`<summary>${lang==='pl'?'Rejestry i źródła danych':'Public data sources'}</summary><p class="hint">${lang==='pl'?'Urzędowe rejestry i mapy. Każda warstwa wskazuje źródło. Brak danych nie oznacza braku ryzyka.':'Official registries and maps. Each layer identifies its source. Missing data does not mean no risk.'}</p>${sourceDirectory.map(s=>`<a class="source-row" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer"><span>${esc(lang==='pl'?s.plName:s.name)} ↗<small>${esc(lang==='pl'?s.plDetail:s.detail)}</small></span><em>${s.status==='Available'?(lang==='pl'?'Warstwa':'Layer'):(lang==='pl'?'Rejestr':'Reference')}</em></a>`).join('')}`;}renderSourceDirectory();$('#sel').before(sourcePanel);
  const planningPanel=document.createElement('details');planningPanel.innerHTML='<summary>Geometric placement · Ustawienie geometryczne</summary><p class="hint">Source: user-selected setback input. Miter-corner offsets, millimetre precision. Not legal compliance. Grid suggestions are sampled, not exhaustive. / Źródło: odległość użytkownika. Obliczenia geometryczne, bez oceny prawnej.</p><button id="placement-analyze">Analyze selected object / Analizuj zaznaczony</button><p id="placement-result" role="status"></p><div id="placement-options"></div>';$('#sel').before(planningPanel);
  $('#placement-analyze').onclick=async()=>{const item=get(selected);if(!item)return;$('#placement-analyze').disabled=true;$('#placement-result').textContent='…';try{const {suggestPlacements}=await import('./core/placement.ts'),result=suggestPlacements(state,item),token=JSON.stringify(state);$('#placement-result').textContent=`${item.name}: ${result.area.toFixed(2)} m² inside geometric setback region; ${result.suggestions.length} sampled placements.`;$('#placement-options').replaceChildren();for(const p of result.suggestions){const button=document.createElement('button');button.textContent=`${p.x.toFixed(1)}, ${p.y.toFixed(1)} m / ${p.rot}°`;button.onclick=()=>{if(JSON.stringify(state)!==token){toast('Recalculate / Przelicz');return;}snapshot();Object.assign(item,{x:p.x,y:p.y,rot:p.rot});buildPanel();render();};$('#placement-options').append(button);}}catch{$('#placement-result').textContent='No region / Brak obszaru';}finally{$('#placement-analyze').disabled=false;}};
  const topologyPanel=document.createElement('details');topologyPanel.innerHTML='<summary>Parcel holes / parts · Otwory i części działki</summary><p class="hint">Local metric coordinates / Lokalne współrzędne w metrach. {holes: [[[x,y],…]], parts: [[outerRing, holeRing,…],…]}</p><textarea id="topology-json" aria-label="Additional parcel rings"></textarea><button id="topology-read">Read boundaries / Odczytaj</button><button id="topology-apply">Apply / Zastosuj</button><p id="topology-message" role="status"></p>';$('#sel').before(topologyPanel);
  $('#topology-read').onclick=()=>{$('#topology-json').value=JSON.stringify({holes:state.plotHoles.map(r=>r.map(p=>[p.x,p.y])),parts:state.plotParts.map(part=>part.map(r=>r.map(p=>[p.x,p.y])))},null,2);};
  $('#topology-apply').onclick=()=>{try{if($('#topology-json').value.length>MAX_PROJECT_BYTES)throw new Error('large');const value=JSON.parse($('#topology-json').value),point=([x,y])=>({x,y});const next=parseScene({...state,plotHoles:value.holes.map(r=>r.map(point)),plotParts:value.parts.map(part=>part.map(r=>r.map(point)))});if(next.parcel)next.parcel.edited=true;applyPlan(next,t('planLoaded'));$('#topology-message').textContent='';}catch{$('#topology-message').textContent=t('parcelImportError');}};
  const fencesPanel=document.createElement('details');fencesPanel.innerHTML=`<summary>Fences / Gates / Hedges · Ogrodzenia</summary><label>Design / Typ<select id="fence-type">${['metal-panel','palisade-horizontal','palisade-vertical','wood','gabion','masonry','mixed','hedge-evergreen','hedge-deciduous'].map(v=>`<option>${v}</option>`).join('')}</select></label><div class="grid2"><label>Height / Wysokość (m)<input id="fence-height" type="number" min="0.2" max="5" value="1.8" step=".1"></label><label>Post spacing / Rozstaw (m)<input id="fence-spacing" type="number" min=".5" max="10" value="2" step=".1"></label><label>Width / Szerokość (m)<input id="fence-width" type="number" min=".05" max="3" value=".15" step=".05"></label><label>Color / Kolor<input id="fence-color" type="color" value="#59645b"></label></div><label>Local path [[x,y],…] / Trasa lokalna<textarea id="fence-path" aria-label="Fence path"></textarea></label><button id="fence-boundary">Use parcel boundary / Granica działki</button><label>Gate on first edge / Brama na 1. boku<select id="fence-gate"><option value="">None / Brak</option><option>sliding</option><option>swing</option><option>wicket</option></select></label><label>Gate opening width / Światło bramy (m)<input id="fence-gate-width" type="number" min=".5" max="10" step=".1" value="3.5"></label><label class="check"><input id="fence-open" type="checkbox">Open / Otwarta</label><button id="fence-add">Add path / Dodaj trasę</button><div id="fence-list"></div><p id="fence-message" class="hint" role="status"></p>`;$('#sel').before(fencesPanel);
  $('#fence-boundary').onclick=()=>{$('#fence-path').value=JSON.stringify([...state.plot,state.plot[0]].map(p=>[p.x,p.y]));};
  function syncFences(){if(!$('#fence-list'))return;$('#fence-list').innerHTML=state.fences.map(f=>`<button data-remove-fence="${esc(f.id)}">× ${esc(f.name)} · ${f.height} m${f.gate?' · gate '+f.gate.width+' m':''}</button>`).join('');}
  $('#fence-list').onclick=e=>{const id=e.target.dataset.removeFence;if(id){snapshot();state.fences=state.fences.filter(f=>f.id!==id);render();}};
  $('#fence-add').onclick=()=>{try{if(state.fences.length>=12)throw new Error('Maximum 12 paths');const points=JSON.parse($('#fence-path').value),type=$('#fence-type').value;const fence=fenceSchema.parse({id:crypto.randomUUID(),name:type,type,path:points.map(([x,y])=>({x,y})),height:Number($('#fence-height').value),spacing:Number($('#fence-spacing').value),width:Number($('#fence-width').value),color:$('#fence-color').value,foundation:0,maturity:1,gate:$('#fence-gate').value?{edge:0,offset:0,width:Number($('#fence-gate-width').value),type:$('#fence-gate').value,open:$('#fence-open').checked,inward:true}:null});snapshot();state.fences.push(fence);$('#fence-message').textContent='';render();}catch{$('#fence-message').textContent='Invalid path or gate dimensions / Nieprawidłowa trasa lub wymiary bramy';}};
  const environmentPanel=document.createElement('details');environmentPanel.innerHTML=`<summary data-t="environment">${t('environment')}</summary><p class="hint" data-t="solarHint">${t('solarHint')}</p><div class="grid2"><label>Season / Pora roku<select id="env-season">${['spring','summer','autumn','winter'].map(v=>`<option>${v}</option>`).join('')}</select></label><label>Weather / Pogoda<select id="env-weather">${['clear','clouds','rain','snow'].map(v=>`<option>${v}</option>`).join('')}</select></label></div><label>Date / Data<input id="env-date" type="datetime-local"></label><div class="grid2"><label>Latitude / Szerokość<input id="env-latitude" type="number" min="-90" max="90" step="0.01"></label><label>Longitude / Długość<input id="env-longitude" type="number" min="-180" max="180" step="0.01"></label></div>`;$('#sel').before(environmentPanel);
  function syncEnvironment(){if(!$('#env-season'))return;const e=state.environment;setVal('env-season',e.season);setVal('env-weather',e.weather);setVal('env-latitude',e.latitude);setVal('env-longitude',e.longitude);const date=new Date(e.date);setVal('env-date',new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16));}
  for(const key of ['season','weather','latitude','longitude','date'])$('#env-'+key).onchange=e=>{let value=e.target.value;if(key==='date'){if(!Number.isFinite(new Date(value).getTime()))return;value=new Date(value).toISOString();}if(key==='latitude'||key==='longitude'){value=Number(value);if(!Number.isFinite(value)||Math.abs(value)>(key==='latitude'?90:180))return;}snapshot();state.environment[key]=value;render();};
  const garden=document.createElement('details');garden.innerHTML=`<summary data-t="garden">${t('garden')}</summary><select id="garden-kind" aria-label="${t('garden')}">${Object.entries(objectLibrary).map(([id,v])=>`<option data-object-kind="${id}" value="${id}">${v[lang]}</option>`).join('')}</select><button id="garden-add" data-t="addOutdoor">${t('addOutdoor')}</button>`;$('#sel').before(garden);
  $('#garden-add').onclick=()=>{
    if(state.items.length>=100){toast(t('objectLimit'));return;}
    const kind=$('#garden-kind').value,spec=objectLibrary[kind],x=state.plot.reduce((n,p)=>n+p.x,0)/state.plot.length,y=state.plot.reduce((n,p)=>n+p.y,0)/state.plot.length;
    const item=parseScene({plot:state.plot,items:[{id:'o'+(uid++),type:'landscape',kind,name:spec[lang],x,y,w:spec.w,d:spec.d,setback:0,architecture:{height:spec.height,roof:'flat',pitch:0,storeys:1}}]}).items[0];
    snapshot();state.items.push(item);selected=item.id;buildPanel();render();
  };
  $('#add-house').onclick = () => addItem('house');
  $('#add-garage').onclick = () => addItem('garage');
  $('#objs').addEventListener('click', e => {
    const b = e.target.closest('.obj'); if (!b) return;
    selected = b.dataset.id; buildPanel(); render();
  });
  $('#b-rect').onclick = () => {
    const w = parseFloat($('#rw').value), d = parseFloat($('#rd').value);
    if (!(w > 0 && d > 0)){ toast(t('badRect')); return; }
    snapshot(); state.plotHoles=[];state.plotParts=[]; state.plot = [{x:0,y:0},{x:w,y:0},{x:w,y:d},{x:0,y:d}]; delete state.parcel; delete state.coordinates.projected; delete state.terrain; buildCorners(); fit(); render();
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
    buildCorners(); buildPanel(); fit(); render(); toast(msg);
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
  $('#b-svg').onclick=async()=>{try{const {projectSvg}=await import('./core/reports.ts');downloadFile(projectSvg(state,lang),'setback-plan.svg','image/svg+xml');}catch{toast(t('notAPlan'));}};
  $('#b-report').onclick=async()=>{
    try{const {projectReport}=await import('./core/reports.ts');$('#report-frame').srcdoc=projectReport(state,lang,new Date().toISOString(),viewer&&view3d?viewer.screenshot():undefined);$('#report-dialog').showModal();}
    catch{toast(t('notAPlan'));}
  };
  $('#report-print').onclick=()=>$('#report-frame').contentWindow.print();
  $('#report-close').onclick=()=>$('#report-dialog').close();
  $('#b-download').onclick=()=>{try{downloadFile(serializeScene(state),'setback-project.json','application/json');}catch{toast(t('notAPlan'));}};
  $('#b-file').onclick=()=>$('#project-file').click();
  $('#project-file').onchange=async e=>{
    const file=e.target.files[0]; if(!file)return;
    try { if(file.size>MAX_PROJECT_BYTES)throw new Error('large'); applyPlan(parseScene(JSON.parse(await file.text())),t('planLoaded')); }
    catch { toast(t('notAPlan')); } finally { e.target.value=''; }
  };
  let lastParcelLookup=0;
  $('#parcel-search').onclick=async()=>{
    if(Date.now()-lastParcelLookup<2000)return;lastParcelLookup=Date.now();
    const before=JSON.stringify(state),identifier=$('#parcel-id').value.trim();
    $('#parcel-search').disabled=true;$('#parcel-result').textContent=t('uldkLoading');
    try{
      const {lookupParcel}=await import('./core/uldk.ts');const parcel=await lookupParcel(identifier);
      if(JSON.stringify(state)!==before){$('#parcel-result').textContent=t('uldkChanged');return;}
      applyPlan(parseScene({...state,...parcel,terrain:undefined}),t('planLoaded'));$('#parcel-result').textContent=t('planLoaded');
    }catch{$('#parcel-result').textContent=t('uldkError');}
    finally{$('#parcel-search').disabled=false;}
  };
  $('#parcel-file-button').onclick=()=>$('#parcel-file').click();
  $('#parcel-file').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try{
      if(file.size>MAX_PROJECT_BYTES)throw new Error('large');
      const {importParcel}=await import('./core/geospatial.ts');
      const parcel=importParcel(JSON.parse(await file.text()),$('#parcel-crs').value,file.name.slice(0,120),new Date().toISOString());
      applyPlan(parseScene({...state,...parcel,terrain:undefined}),t('planLoaded'));
    }catch{toast(t('parcelImportError'));}finally{e.target.value='';}
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
  const compareVariant=document.createElement('button'),comparison=document.createElement('p');compareVariant.textContent='Compare variant / Porównaj wariant';comparison.className='hint';$('#variant-delete').after(compareVariant,comparison);compareVariant.onclick=()=>{try{const v=loadVariants().find(v=>v.id===$('#variant-list').value);if(!v)return;const changed=state.items.filter(i=>{const old=v.scene.items.find(o=>o.id===i.id);return !old||JSON.stringify(old)!==JSON.stringify(i);}).length;comparison.textContent=`${v.name}: ${v.scene.items.length} objects, ${parcelArea(v.scene).toFixed(2)} m² parcel. Current: ${state.items.length} objects, ${parcelArea(state).toFixed(2)} m². Changed/added: ${changed}.`;}catch{toast(t('variantError'));}};
  updateVariants();
  // A shared link pasted into an already-open tab only changes the hash.
  window.addEventListener('hashchange', async () => { const hash=location.hash;const o = await fromHash(); if (o && location.hash===hash) applyPlan(o, t('planFromLink')); });
  let resetArmed = false, resetT;
  $('#b-reset').onclick = e => {
    const b = e.currentTarget;
    if (!resetArmed){ resetArmed = true; b.textContent = t('resetConfirm'); resetT = setTimeout(() => { resetArmed = false; b.textContent = t('resetExample'); }, 3000); return; }
    clearTimeout(resetT); resetArmed = false; b.textContent = t('resetExample');
    snapshot(); state = parseScene(DEFAULT()); persistencePaused = false; $('#project-warning').hidden = true;
    uid = 3; selected = 'o1'; buildCorners(); buildPanel(); fit(); render(); toast(t('exampleRestored'));
  };
  $('#t-undo').onclick = undo; $('#t-redo').onclick = redo;
  $('#t-in').onclick = () => zoomAt(svg.clientWidth/2, svg.clientHeight/2, 1.25);
  $('#t-out').onclick = () => zoomAt(svg.clientWidth/2, svg.clientHeight/2, 0.8);
  $('#t-fit').onclick = () => { fit(); renderSheet(); };

  document.querySelectorAll('.lang button').forEach(b => b.onclick = () => {
    lang = b.dataset.lang;
    try { localStorage.setItem(LANG_LS, lang); } catch (e) {}
    applyLang(); renderCatalogs(); renderSourceDirectory(); $('#viewer-note').textContent=t('viewerHint');
    state.plot.forEach((_, i) => ['x', 'y'].forEach(axis =>
      document.getElementById(`pc-${axis}-${i}`).setAttribute('aria-label', t('cornerAxis', {c:cornerName(i), axis}))));
    buildPanel(); render();
  });

  const showroomHost=document.createElement('div');showroomHost.id='showroom-host';$('.rail').append(showroomHost);
  let ordinaryHistory=null,ordinarySelected=null,ordinaryPaused=false,ordinaryWarning=null,business=null;
  const {mountShowroom}=await import('./showroom.ts');
  const showroom=mountShowroom({beforeEnter:async()=>{await business?.logout?.();},container:showroomHost,getScene:()=>state,applyScene:next=>{applyPlan(parseScene(next),t('planLoaded'));if(showroomActive)history=new ProjectHistory();},shareUrl:()=>location.href.split('#')[0]+plainShare(state),setView:mode=>{if(mode==='3d')$('#view-3d').click();else if(mode==='map')$('#view-map').click();else setStageMode('2d');},onActiveChange:active=>{
    if(active){ordinaryHistory=history;ordinarySelected=selected;ordinaryPaused=persistencePaused;ordinaryWarning={hidden:$('#project-warning').hidden,text:$('#project-warning').textContent};showroomActive=true;clearTimeout(saveT);saveRevision++;history=new ProjectHistory();}
    else{showroomActive=false;history=ordinaryHistory||new ProjectHistory();selected=get(ordinarySelected)?ordinarySelected:null;persistencePaused=ordinaryPaused;if(ordinaryWarning){$('#project-warning').hidden=ordinaryWarning.hidden;$('#project-warning').textContent=ordinaryWarning.text;}buildPanel();render();}
    $('#b-download').closest('section').hidden=active;document.body.classList.toggle('showroom-active',active);
  },onSessionReset:()=>{history=new ProjectHistory();selected=null;$('#io').value='';$('#report-frame').srcdoc='';$('#report-dialog').close();business?.clearPersonalData?.();}});
  const businessHost=document.createElement('div');businessHost.id='business-host';$('.rail').append(businessHost);const {mountBusiness}=await import('./business.ts');business=mountBusiness({container:businessHost,getScene:()=>structuredClone(state),getAttribution:()=>showroom.getAttribution()});

  mountWorkspace();
  applyLang(); renderCatalogs();
  buildCorners();
  buildPanel();
  new ResizeObserver(() => renderSheet()).observe(svg);
  render();
})();
