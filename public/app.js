import {houseAnnex, houseParking, setHouseParking, resolveHouseOptions} from './core/house-options.ts';
import {createCatalogItem} from './catalogs/placement.ts';
import {fitItemsToParcel, parcelAxis} from './core/placement.ts';
import {planFromBrief} from './core/brief.ts';
import {designGarden} from './core/garden.ts';
import {sourceDirectory,mapOverlayIds} from './map/sources.ts';
import {siteFrame,siteLayerIds,siteSummary,mercatorPixel,buildingLineSetbacks,networkIds} from './core/site-data.ts';
import {pointsToParcel} from './core/site-insights.ts';
import {mountWorkspace} from './workspace.ts';
import {mountParcelJourney} from './parcel-journey.ts';
import {ATTRIBUTION_KEY,readAttribution,validateAttribution} from './core/attribution.ts';
import {renderLayoutReview as renderReview} from './layout-review.ts';
import {transformGroup} from './core/operations.ts';
import {parcelPolygons,parcelContains,parcelArea} from './core/topology.ts';
import {fenceSchema,fenceSegments,boundaryFence,facingEdge,BOUNDARY_FENCE_ID} from './core/fences.ts';
import { objectLibrary, blocksPlacement } from './core/objects.ts';
import { catalogRegistrations, loadCatalog, catalogAvailable } from './core/catalogs.ts';
import { materialPresets, resolveAppearance, resetAppearance } from './core/materials.ts';
import { worldFootprint, boundingCorners, fitOpenings } from './core/footprints.ts';
import { ProjectHistory, saveVariant, readVariants } from './core/projects.ts';
import { parseScene, serializeScene, encodeShare, decodeShare, plainShare, MAX_PROJECT_BYTES } from './core/scene.ts';
import { polygonRelation, validRing, polygonArea, perpendicularClearance, pointLocation } from './core/geometry.ts';

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
      mapView:'Map', mapLayer:'Map layer', ortho:'Orthophoto · GUGiK', cadastre:'Cadastre · GUGiK', mapHint:'Visual context only. Image dates and neighboring heights are unknown. Import a georeferenced parcel to see your project here. Map views contact the selected tile providers.', mapError:'Some map imagery could not load. Other layers may still work; your project is unchanged.',
      findParcel:'Find Polish parcel (ULDK)', parcelId:'Full parcel identifier', uldkHint:'Lookup sends this identifier to GUGiK ULDK. Service availability varies. The imported boundary replaces the parcel; verify building positions. You can still draw or import a parcel when the service is unavailable.', uldkLoading:'Looking up parcel…', uldkError:'Could not import this parcel. Check its full identifier, service availability and supported geometry. Current plan retained.', uldkChanged:'Project changed during lookup. Request again to replace the parcel.',
      importParcel:'Import parcel (GeoJSON)', sourceCrs:'Source coordinates', openParcel:'Open parcel file', parcelImportHint:'One polygon, up to 512 vertices. Holes and separate components are preserved. Replaces the parcel; keeps buildings at their local positions. Confirm their placement after import.', parcelImportError:'Parcel import failed. Check CRS, closure and geometry; rings must be valid and components disjoint.', parcelEdited:'Boundary edited locally; source geometry has changed.', north:'Grid north ↑',
      topView:'Top', axonView:'Overview', screenshot:'Screenshot', lowQuality:'Low power', viewerHint:'Conceptual massing. Calculated sunlight; no terrain or neighboring heights. Shadows are approximate. Concave pitched roofs use a flat schematic cap.', viewerFailure:'3D is unavailable on this device. Continue planning in 2D.', loading3d:'Loading 3D…',
      catalogs:'Optional catalogs', catalogHint:'Manufacturer photos and dimensioned plans. Main-building envelopes exclude terraces, carports and roof overhangs. 3D heights and roof pitch are illustrative.', catalogUnavailable:'Catalog unavailable or disabled. Saved user-defined fallback geometry is retained.', enableCatalog:'Enable catalog', catalogError:'Catalog could not be loaded. Generic planning remains available.', source:'Source', verifiedOn:'Checked', noDimensions:'Main envelope from published plan',
      materials:'Materials', facade:'Façade finish', grout:'Grout color', roofColor:'Roof color', frameColor:'Window / door color', gutterColor:'Gutter color', trimColor:'Trim color', tileWidth:'Tile width (m)', tileHeight:'Tile height (m)', layout:'Tile direction', horizontal:'Horizontal', vertical:'Vertical', wallFinish:'Individual wall', allWalls:'All walls', inherit:'Use façade finish', resetMaterials:'Reset all finishes', resetFacade:'Reset façade', original:'Compare original', materialHint:'Conceptual finishes, not manufacturer-approved options. No price calculation. Patterns are schematic.',
      shape:'Footprint shape', rectangle:'Rectangular', wingRatio:'Wing proportion', height:'Wall height total (m)', storeys:'Storeys', roof:'Roof', flat:'Flat', gable:'Gable', pitch:'Roof pitch (°)', genericHint:'Generic conceptual house. Dimensions are user-defined; no manufacturer specifications or legal approval.',
      redo:'Redo', downloadProject:'Download JSON', openFile:'Open JSON file', variants:'Local variants', variantName:'Variant name', saveVariant:'Save as variant', openVariant:'Open variant', variantHint:'Stored only in this browser, up to 20 variants. Download JSON for a backup.', variantError:'Could not save or read variants. Check the name, storage space and 20-variant limit.',
      docTitle: 'Setback Planner', title: 'Setback Planner', tagline: 'Plot outline on a 1 m grid, buildings, and every clearance.',
      language: 'Language', controls: 'Controls', addBuilding: 'Add building', house: 'House', garage: 'Garage', buildings: 'Buildings',
      plot: 'Plot', area: 'Area', perimeter: 'Perimeter', side: 'Side', cornersHint: 'Drag the corner points A–D on the plan, or type coordinates.',
      rectW: 'Rectangle width in metres', rectD: 'Rectangle depth in metres', makeRect: 'Make rectangle',
      drawing: 'Drawing', showGarden: 'Show garden objects and fences on the plan and in the report', deleteProject: 'Delete project', snapTo: 'Snap to', off: 'Off', dimsFor: 'Dimensions for', allBuildings: 'All buildings', selectedOnly: 'Selected only',
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
      mapView:'Mapa', mapLayer:'Warstwa mapy', ortho:'Ortofotomapa · GUGiK', cadastre:'Ewidencja · GUGiK', mapHint:'Kontekst wizualny. Daty zdjęć i wysokości sąsiadów są nieznane. Zaimportuj działkę z georeferencją, aby zobaczyć projekt. Mapa łączy się z wybranymi dostawcami kafelków.', mapError:'Nie udało się wczytać części mapy. Inne warstwy mogą działać; projekt pozostał bez zmian.',
      findParcel:'Znajdź działkę (ULDK)', parcelId:'Pełny identyfikator działki', uldkHint:'Zapytanie wysyła identyfikator do GUGiK ULDK. Dostępność usługi jest zmienna. Granica zastąpi działkę; sprawdź pozycje budynków. Przy awarii możesz nadal rysować lub importować działkę.', uldkLoading:'Wyszukiwanie działki…', uldkError:'Nie można zaimportować działki. Sprawdź identyfikator, usługę i obsługiwaną geometrię. Bieżący plan zachowano.', uldkChanged:'Projekt zmieniono podczas wyszukiwania. Ponów zapytanie, aby zastąpić działkę.',
      importParcel:'Import działki (GeoJSON)', sourceCrs:'Współrzędne źródłowe', openParcel:'Otwórz plik działki', parcelImportHint:'Jeden wielokąt, do 512 wierzchołków. Otwory i odrębne części są zachowane. Zastępuje działkę; budynki pozostają na pozycjach lokalnych. Sprawdź ich położenie po imporcie.', parcelImportError:'Import nieudany. Sprawdź układ, zamknięcie i geometrię; pierścienie muszą być poprawne, a części rozłączne.', parcelEdited:'Granica edytowana lokalnie; geometria źródłowa została zmieniona.', north:'Północ siatki ↑',
      topView:'Z góry', axonView:'Widok ogólny', screenshot:'Zrzut ekranu', lowQuality:'Oszczędzanie energii', viewerHint:'Bryły koncepcyjne. Obliczona pozycja słońca, brak terenu i wysokości sąsiadów. Cienie przybliżone. Dachy spadziste brył wklęsłych pokazano jako płaski schemat.', viewerFailure:'Widok 3D niedostępny na tym urządzeniu. Kontynuuj w 2D.', loading3d:'Wczytywanie 3D…',
      catalogs:'Katalogi opcjonalne', catalogHint:'Zdjęcia i wymiarowane rzuty producenta. Obrys głównej bryły bez tarasów, wiat i okapów. Wysokość i kąt dachu w 3D są poglądowe.', catalogUnavailable:'Katalog niedostępny lub wyłączony. Zachowano zapisany obrys użytkownika.', enableCatalog:'Włącz katalog', catalogError:'Nie można wczytać katalogu. Planowanie ogólne jest nadal dostępne.', source:'Źródło', verifiedOn:'Sprawdzono', noDimensions:'Obrys głównej bryły wg rzutu',
      materials:'Materiały', facade:'Wykończenie elewacji', grout:'Kolor fugi', roofColor:'Kolor dachu', frameColor:'Kolor okien / drzwi', gutterColor:'Kolor rynien', trimColor:'Kolor detali', tileWidth:'Szerokość płytki (m)', tileHeight:'Wysokość płytki (m)', layout:'Kierunek płytek', horizontal:'Poziomo', vertical:'Pionowo', wallFinish:'Pojedyncza ściana', allWalls:'Wszystkie ściany', inherit:'Wykończenie elewacji', resetMaterials:'Resetuj wykończenia', resetFacade:'Resetuj elewację', original:'Porównaj oryginał', materialHint:'Wykończenia koncepcyjne, bez zatwierdzenia producenta i kalkulacji cen. Wzory są schematyczne.',
      shape:'Kształt obrysu', rectangle:'Prostokątny', wingRatio:'Proporcja skrzydła', height:'Łączna wysokość ścian (m)', storeys:'Kondygnacje', roof:'Dach', flat:'Płaski', gable:'Dwuspadowy', pitch:'Kąt dachu (°)', genericHint:'Dom koncepcyjny. Wymiary określa użytkownik; bez specyfikacji producenta i potwierdzenia zgodności z prawem.',
      redo:'Ponów', downloadProject:'Pobierz JSON', openFile:'Otwórz plik JSON', variants:'Warianty lokalne', variantName:'Nazwa wariantu', saveVariant:'Zapisz jako wariant', openVariant:'Otwórz wariant', variantHint:'Tylko w tej przeglądarce, do 20 wariantów. Pobierz JSON jako kopię zapasową.', variantError:'Nie można zapisać lub odczytać wariantów. Sprawdź nazwę, pamięć i limit 20 wariantów.',
      docTitle: 'Planer odległości od granic', title: 'Planer odległości', tagline: 'Obrys działki na siatce 1 m, budynki i wszystkie odległości.',
      language: 'Język', controls: 'Sterowanie', addBuilding: 'Dodaj budynek', house: 'Dom', garage: 'Garaż', buildings: 'Budynki',
      plot: 'Działka', area: 'Powierzchnia', perimeter: 'Obwód', side: 'Bok', cornersHint: 'Przeciągnij narożniki A–D na planie lub wpisz współrzędne.',
      rectW: 'Szerokość prostokąta w metrach', rectD: 'Głębokość prostokąta w metrach', makeRect: 'Utwórz prostokąt',
      drawing: 'Rysunek', showGarden: 'Pokazuj obiekty ogrodowe i ogrodzenia na planie i w raporcie', deleteProject: 'Usuń projekt', snapTo: 'Przyciąganie', off: 'Wyłączone', dimsFor: 'Wymiary dla', allBuildings: 'Wszystkich budynków', selectedOnly: 'Tylko zaznaczonego',
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
  const LANG_LS = 'setback-planner-test-lang'; // ponytail: test-only key; the old 'setback-planner-lang' from the removed toggle no longer forces English
  let lang = (() => {
    // Polish-only interface. English strings remain only for the automated tests, which pin them via this key.
    try { if (localStorage.getItem(LANG_LS) === 'en') return 'en'; } catch (e) {}
    return 'pl';
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
    document.querySelectorAll('[data-bi]').forEach(el => { const [en, pl] = el.dataset.bi.split('|'); el.textContent = lang === 'pl' ? pl : en; });
    document.querySelectorAll('[data-bi-placeholder]').forEach(el => { const [en, pl] = el.dataset.biPlaceholder.split('|'); el.placeholder = lang === 'pl' ? pl : en; });
  }
  const bi = (en, pl) => lang === 'pl' ? pl : en;
  // Panels built after start-up carry data-bi="English|Polski" labels; translate them as they are inserted.
  new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes){if(n.nodeType!==1)continue;for(const el of [...(n.matches('[data-bi]')?[n]:[]),...n.querySelectorAll('[data-bi]')]){const v=bi(...el.dataset.bi.split('|'));if(el.textContent!==v)el.textContent=v;}}}).observe(document.body,{childList:true,subtree:true});
  const CATALOG_LS='setback-planner-catalogs';
  // Catalogue exterior for an item, only while its catalogue is enabled and loaded; otherwise the generic model renders.
  const exteriorFor=i=>i.catalog&&catalogAvailable(i.catalog,enabledCatalogs)?loadedCatalogModels.get(i.catalog.catalogId+':'+i.catalog.modelId)?.exterior:undefined;
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
    $('#catalog-models').innerHTML=entries.map(c=>c?`<div class="catalog-attribution"><span>${esc(c.name)}</span><a href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">${lang==='pl'?'Strona producenta':'Manufacturer website'} ↗</a></div><div class="catalog-grid">${c.models.map(m=>`<article class="catalog-card"><img src="${esc(m.thumbnail)}" alt="${esc(m.name)} — ${esc(c.name)}" loading="lazy" width="600" height="340"><div class="catalog-card-body"><div class="catalog-card-heading"><h3>${esc(m.name)}</h3><span>${m.footprint.width.toFixed(2)} × ${m.footprint.depth.toFixed(2)} m</span></div><p>${lang==='pl'?'Wymiary wg rzutu producenta':'Dimensions from manufacturer plan'}</p><div class="catalog-actions"><button class="catalog-place" data-place-catalog="${esc(c.id)}" data-model="${esc(m.id)}">+ ${lang==='pl'?'Użyj tego projektu':'Use this design'}</button><button class="catalog-add" data-add-catalog="${esc(c.id)}" data-add-model="${esc(m.id)}" aria-label="${lang==='pl'?'Dodaj kolejny':'Add another'} ${esc(m.name)}" title="${lang==='pl'?'Dodaj kolejny dom':'Add another house'}">＋</button><button class="catalog-plan" data-plan-src="${esc(m.plan)}" data-plan-name="${esc(m.name)}">${lang==='pl'?'Rzut':'Plan'} ↗</button></div></div></article>`).join('')}</div>`:`<p class="hint">${t('catalogError')}</p>`).join('');
    $('#catalog-models').querySelectorAll('[data-place-catalog],[data-add-catalog]').forEach(button=>button.onclick=async()=>{
      const current=get(selected),replace=!button.dataset.addCatalog&&current?.type==='house';
      if(replace&&current.locked){toast(lang==='pl'?'Odblokuj dom przed zmianą projektu.':'Unlock the house before changing its design.');return;}
      if(!replace&&state.items.length>=100){toast(t('objectLimit'));return;}
      button.disabled=true;
      try{
        const catalog=await loadCatalog(button.dataset.placeCatalog||button.dataset.addCatalog),x=replace?current.x:state.plot.reduce((n,p)=>n+p.x,0)/state.plot.length,y=replace?current.y:state.plot.reduce((n,p)=>n+p.y,0)/state.plot.length,item=createCatalogItem(catalog,button.dataset.model||button.dataset.addModel,{id:replace?current.id:'o'+uid++,x,y,rot:replace?current.rot:parcelAxis(state.plot)});
        if(replace){item.setback=current.setback;item.group=current.group;}else{const {suggestPlacements}=await import('./core/placement.ts'),candidate=suggestPlacements(state,item).suggestions[0];if(!candidate){toast(lang==='pl'?'Brak wolnego miejsca. Przesuń istniejące obiekty lub wybierz większą działkę.':'No free placement found. Move existing objects or use a larger parcel.');return;}Object.assign(item,{x:candidate.x,y:candidate.y,rot:candidate.rot});}
        const exterior=catalog.models.find(m=>m.id===(button.dataset.model||button.dataset.addModel))?.exterior;
        const parking=replace?houseParking(state.items,current):null;
        if(replace&&current.houseOptions)item.houseOptions={...current.houseOptions};
        let items=replace?state.items.map(i=>i.id===current.id?item:i):[...state.items,item];
        if(exterior?.carport){
          const kind=replace&&current.catalog?parking:(exterior.carport.kind||'carport');
          if(kind!=='none')items=setHouseParking(items,item.id,kind,exterior,'o'+uid++);
        }
        snapshot();state.items=items;selected=item.id;buildPanel();render();toast(replace?(lang==='pl'?'Zmieniono projekt wybranego domu.':'Selected house design updated.'):(lang==='pl'?'Dodano dom w wolnym miejscu. Możesz go przesunąć.':'House added in a free position. Drag it to adjust.'));
      }catch{toast(t('catalogError'));}finally{button.disabled=false;}
    });
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
  // The example parcel comes fenced, gate on the edge in front of the house.
  const exampleScene = () => { const scene = parseScene(DEFAULT()), f = boundaryFence(scene.plot, 2, bi('Boundary fence','Ogrodzenie działki')); if (f) scene.fences = [f]; return scene; };
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
  const sharedScene=await fromHash(),savedScene=sharedScene?null:load();let freshScene=!sharedScene&&!savedScene&&!persistencePaused,entryDismissed=false;try{entryDismissed=window.sessionStorage.getItem('setback-entry-dismissed')==='1';}catch{}
  const freshVisit=freshScene&&!entryDismissed;let entryPending=freshVisit,journey=null,workspace=null;
  let state = sharedScene || savedScene || exampleScene();
  let saveT, saveRevision = 0;
  // View preference, not project data: garden objects and fences are hidden on the 2D plan, SVG and report unless switched on.
  const GARDEN_LS='setback-planner-show-garden';
  let showGarden=(()=>{try{return localStorage.getItem(GARDEN_LS)==='1';}catch{return false;}})();
  const structure=i=>i.type!=='landscape'||i.kind==='carport';
  const planItems=()=>state.items.filter(i=>i.visible&&(showGarden||structure(i)));
  const reportScene=()=>showGarden?state:{...state,items:state.items.filter(structure),fences:state.fences.filter(f=>f.id===BOUNDARY_FENCE_ID)};
  function save(){
    clearTimeout(saveT); const revision = ++saveRevision;
    if (persistencePaused || entryPending) return;
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
  const cornerName=i=>i<26?String.fromCharCode(65+i):String(i+1);
  function markParcelEdited(){if(state.parcel)state.parcel.edited=true;}

  let history = new ProjectHistory();
  function snapshot(){ freshScene=false;history.record(state); }
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

  // Building lines (nieprzekraczalne linie zabudowy) read from the local plan: metres from each parcel edge, null where none.
  let planSetbacks=[];
  const edgeOf=q=>{let best=-1,d=0.1;state.plot.forEach((a,i)=>{const b=state.plot[(i+1)%state.plot.length],dd=len(sub(closestOnSeg(q,a,b),q));if(dd<d){d=dd;best=i;}});return best;};
  function compute(){
    const plotValid = validRing(state.plot), res = new Map();
    for (const it of state.items){
      const c = corners(it), inside = plotValid && parcelContains(state,c);
      const sides = [];
      for (let i = 0; i < c.length; i++){
        const A = c[i], B = c[(i+1)%c.length], n = outwardNormal(A,B);
        const hits=parcelPolygons(state).flat().map(ring=>perpendicularClearance(A,B,n,ring)).filter(Boolean);const r=hits.sort((a,b)=>a.t-b.t)[0]||null;
        const edge=r?edgeOf(r.Q):-1,line=it.type!=='landscape'&&edge>=0?planSetbacks[edge]??0:0,req=Math.max(it.setback,line);
        sides.push({name: sideName(n), P: r && r.P, Q: r && r.Q, t: r ? r.t : null, req, line: line>it.setback?line:0, edge, warn: r ? r.t < req - 1e-9 : false});
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
  let sheetW = 0, sheetH = 0; // size the current view was laid out for; resizes keep the plan centred
  let fitted = false;
  const toWorld = p => ({x: (p.x - view.ox) / view.k, y: (p.y - view.oy) / view.k});
  function fit(){
    const W = svg.clientWidth, H = svg.clientHeight; if (!W || !H) return;
    const pts = [...parcelPolygons(state).flat(2)]; for (const it of state.items) pts.push(...corners(it));
    const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = W < 500 ? 36 : 64;
    // keep clear of the two toolbar rows at the top and of a panel floating over the right edge (--cover)
    const top = matchMedia('(max-width:1000px)').matches ? 116 : 128, cover = parseFloat(getComputedStyle($('.stage')).getPropertyValue('--cover')) || 0, w = W - cover;
    const k = Math.max(1, Math.min(200, Math.min((w - 2*pad) / Math.max(1, maxX - minX), (H - top - pad - 60) / Math.max(1, maxY - minY))));
    view.k = k;
    view.ox = w/2 - (minX + maxX)/2 * k;
    view.oy = (H + top - pad)/2 - (minY + maxY)/2 * k + 6;
    sheetW = W; sheetH = H;
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
  let siteData=null,siteJob=Promise.resolve(),insightsJob=Promise.resolve(),siteKey='',siteTimer=0,siteState='idle',sitePanel=null;
  const parcelRing=()=>{const o=state.coordinates.projected.origin;return state.plot.map(p=>[o.x+p.x,o.y-p.y]);};
  /** Distance from the parcel to each utility network drawn on its GESUT layer image (1 m per pixel). */
  async function readNetworks(d,key){
    if(!d.networks)return;const out={},ring=parcelRing(),[minE,,,maxN]=d.networks.bbox,S=d.networks.size,m=(d.networks.bbox[2]-minE)/S;
    for(const id of networkIds){const src=d.networks.images[id];if(!src){out[id]=undefined;continue;}
      try{const img=await window.createImageBitmap(await (await window.fetch(src)).blob()),c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d');g.drawImage(img,0,0);const px=g.getImageData(0,0,S,S).data,points=[];
        // ponytail: every opaque pixel counts, labels included; good to a few metres, which is what a showroom estimate needs
        for(let v=0;v<S;v+=1)for(let u=0;u<S;u+=1)if(px[(v*S+u)*4+3]>100)points.push([minE+(u+.5)*m,maxN-(v+.5)*m]);
        out[id]=pointsToParcel(ring,points);}catch{out[id]=undefined;}}
    if(siteKey===key&&siteData){siteData.networkDistances=out;renderSitePanel();}
  }
  /** Roads, transit, prices and listings from the worker (OpenStreetMap, OSRM, RCN, Otodom, OLX). */
  async function readInsights(d,key){
    try{const r=await window.fetch('/api/site-insights',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({point:d.point,ring:parcelRing(),area:parcelArea(state)})});
      if(r.ok&&siteKey===key&&siteData){siteData.insights=await r.json();renderSitePanel();}}catch{/* report without insights */}
  }
  /** Decodes the plan's building-line image and measures each edge's line distance (see buildingLineSetbacks). */
  async function readPlanLines(d,key){
    if(!d.planLines)return;
    try{
      const img=await window.createImageBitmap(await (await window.fetch(d.planLines.image)).blob());// decodes in background tabs too
      const c=document.createElement('canvas');c.width=c.height=d.size;const g=c.getContext('2d');g.drawImage(img,0,0);const px=g.getImageData(0,0,d.size,d.size).data,origin=state.coordinates.projected.origin,points=[];
      for(let v=0;v<d.size;v++)for(let u=0;u<d.size;u++)if(px[(v*d.size+u)*4+3]>100){const [e,n]=mercatorPixel(d.planLines.mercator,d.size,u+.5,v+.5);points.push({x:e-origin.x,y:origin.y-n});}
      if(siteKey!==key)return;
      planSetbacks=buildingLineSetbacks(state.plot,points,(d.bbox[2]-d.bbox[0])/d.size,p=>pointLocation(p,state.plot)!=='outside');siteData.planSetbacks=planSetbacks;render();renderSitePanel();
    }catch{/* no plan lines: user setbacks only */}
  }
  /** The local plan from the official journal. The browser reads the journal (it refuses server requests); the worker's
   *  Workers AI picks the plan covering the parcel and quotes its building rules verbatim. */
  async function ocr(data,pages){const lp=await import('./core/local-plan.ts'),out=[];for(const img of await lp.pdfPages(data,pages)){const r=await window.fetch('/api/ocr-page',{method:'POST',headers:{'Content-Type':'image/jpeg'},body:img});if(r.ok)out.push((await r.json()).text);}return out.join('\n');}
  async function readPlanRules(d,key){
    const id=state.parcel?.identifier;if(!id)return;
    const lp=await import('./core/local-plan.ts'),base=lp.journals[id.slice(0,2)],[e,n]=d.point,done=rules=>{if(siteKey!==key)return;siteData.planRules=rules;renderSitePanel();};
    if(!base){done({status:'unsupported',note:bi('Plan lookup currently covers the Masovian voivodeship.','Wyszukiwanie planów działa na razie dla województwa mazowieckiego.')});return;}
    try{
      const get=u=>window.fetch(u).then(r=>r.ok?r.text():'').catch(()=>'');
      const [uldk,uug,lines]=await Promise.all([get(`https://uldk.gugik.gov.pl/?request=GetParcelById&id=${encodeURIComponent(id)}&result=commune`),get(`https://services.gugik.gov.pl/uug/?request=GetAddressReverse&location=POINT(${e}%20${n})&srid=2180`),lp.streetLines(e,n).catch(()=>[])]);
      let address={};try{address=JSON.parse(uug).results?.['1']??{};}catch{/* no nearby address */}
      const commune=uldk.split('\n')[1]?.trim()??'',streets=lp.streetsNear(lines,e,n);
      const candidates=(await lp.searchPlans(base,address.city??'',commune)).slice(0,14);
      // Zone symbols on the plan drawing at the parcel (OCR of the national plan map) identify the plan that defines them.
      let symbols=[];
      try{const img=d.layers.planning?.image;if(img&&img.length>4000){const bmp=await window.createImageBitmap(await (await window.fetch(img)).blob()),c=document.createElement('canvas');c.width=c.height=1024;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,1024,1024);g.drawImage(bmp,0,0,1024,1024);
        const jpeg=await new Promise(r=>c.toBlob(r,'image/jpeg',.9)),r=await window.fetch('/api/ocr-page?kind=map',{method:'POST',headers:{'Content-Type':'image/jpeg'},body:jpeg});if(r.ok)symbols=lp.planSymbols((await r.json()).text);}}catch{/* no drawing: streets only */}
      if(!candidates.length){done({status:'none',note:bi('The official journal lists no local plans for this place.','W dzienniku urzędowym nie ma planów miejscowych dla tej miejscowości.')});return;}
      // HTML text for most acts; PDF-only acts (up to six) are converted by the worker.
      let pdfs=0;
      const texts=await Promise.all(candidates.map(async c=>{
        const html=await lp.actText(base,c.oid).catch(()=>null);if(html)return {c,text:html,source:'html'};
        if(pdfs++>=6)return {c,text:'',source:'none'};
        try{const blob=await (await window.fetch(c.pdf)).blob();
          if(blob.size<=20e6){const r=await window.fetch('/api/pdf-text',{method:'POST',headers:{'Content-Type':'application/pdf'},body:blob});const text=r.ok?(await r.json()).text:'';if(!lp.looksScanned(text,blob.size))return {c,text,source:'pdf'};}
          // Scanned act: OCR the first two pages now (they say which area the plan covers); the rest only if it is chosen.
          const data=await blob.arrayBuffer(),head=await ocr(data,[1,2]),pages=lp.actPages(head,c.position);
          return {c,text:pages?await ocr(data,[pages.start,pages.start+1]):head,source:'ocr',data,pages:pages??{start:1,end:40}};}catch{return {c,text:'',source:'none'};}
      }));
      const opposite={'północ':'południe','północny wschód':'południowy zachód','wschód':'zachód','południowy wschód':'północny zachód','południe':'północ','południowy zachód':'północny wschód','zachód':'wschód','północny zachód':'południowy wschód'},stem=name=>name.split(' ').at(-1).slice(0,-2),named=streets.filter(s=>stem(s.name).length>=5),scored=texts.filter(t=>t.text).map(t=>({...t,sym:lp.symbolHits(t.text,symbols),hits:3*lp.symbolHits(t.text,symbols)+named.filter(s=>t.text.includes(stem(s.name))).length})).sort((a,b)=>b.hits-a.hits||b.c.year-a.c.year);
      let shortlist=(scored.some(t=>t.hits)?scored.filter(t=>t.hits):scored).slice(0,5);
      // The drawing's zone symbols decide when one plan defines clearly more of them than any other; the AI only breaks ties.
      const bySym=[...shortlist].sort((a,b)=>b.sym-a.sym),decided=bySym[0]?.sym>0&&bySym[0].sym>(bySym[1]?.sym??0)?bySym[0]:null,alternatives=shortlist;
      if(decided)shortlist=[decided];
      if(!shortlist.length){done({status:'none',note:bi('Plan texts are not available in the journal.','Teksty planów są niedostępne w dzienniku.')});return;}
      const r=await window.fetch('/api/plan-pick',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address:[address.street,address.number,address.city].filter(Boolean).join(' '),streets:[...streets.slice(0,7).map(s=>`działka leży na ${opposite[s.side]} od ul. ${s.name} (${s.distance} m)`),...(symbols.length?[`symbole na rysunku planu przy działce: ${symbols.join(', ')}`.slice(0,160)]:[])],plans:shortlist.map(t=>({title:t.c.title,scope:lp.planScope(t.text).slice(0,800),rules:lp.ruleExcerpt(t.text,12000)}))})});
      const ai=r.ok?await r.json():{best:0,reason:bi('Most mentions of the streets next to the parcel (AI unavailable).','Najwięcej wzmianek o ulicach przy działce (AI niedostępne).'),aiUsed:false,extraction:null};
      const pick=shortlist[ai.best]??shortlist[0];if(decided)ai.reason=bi(`The plan text defines the zone symbols drawn at the parcel: ${symbols.join(', ')}.`,`Tekst planu definiuje symbole terenów z rysunku planu przy działce: ${symbols.join(', ')}.`);
      // A scanned winner: OCR the remaining pages and read its rules from the full text.
      if(pick.source==='ocr'&&pick.data){const {start,end}=pick.pages;pick.text+='\n'+await ocr(pick.data,Array.from({length:Math.max(0,Math.min(end,start+11)-start-1)},(_,i)=>start+2+i));
        const r2=await window.fetch('/api/plan-pick',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address:'',streets:[],plans:[{title:pick.c.title,scope:lp.planScope(pick.text).slice(0,800),rules:lp.ruleExcerpt(pick.text,12000)}]})});
        if(r2.ok)ai.extraction=(await r2.json()).extraction;}
      done({status:'found',plan:{title:pick.c.title,url:pick.c.url,pdf:pick.c.pdf,scope:lp.planScope(pick.text).slice(0,600),source:pick.source},reason:ai.reason,aiUsed:ai.aiUsed,extraction:ai.extraction,alternatives:alternatives.filter(t=>t!==pick).slice(0,4).map(t=>({title:t.c.title,url:t.c.url}))});
    }catch{done({status:'error',note:bi('The official journal did not respond.','Dziennik urzędowy nie odpowiedział.')});}
  }
  function syncSiteData(){
    const frame=siteFrame(state),key=frame?.query??'';if(key===siteKey)return;
    siteKey=key;siteData=null;planSetbacks=[];clearTimeout(siteTimer);siteState=frame?'loading':'idle';renderSitePanel();if(!frame){siteJob=Promise.resolve();return;}
    // ponytail: 1.2 s debounce so dragging a corner does not query every registry on every frame
    siteJob=new Promise(resolve=>{siteTimer=setTimeout(async()=>{try{const r=await fetch('/api/site-data?v=2&'+key);if(!r.ok)throw new Error('site data');const d=await r.json();if(siteKey===key){siteData=d;siteState='ready';void readPlanLines(d,key);void readPlanRules(d,key);void readNetworks(d,key);insightsJob=readInsights(d,key);}}catch{if(siteKey===key)siteState='error';}if(siteKey===key)renderSitePanel();resolve();},1200);});
  }
  // The boundary fence follows the parcel: corner edits move it, the gate stays on its edge where possible.
  function syncBoundaryFence(){
    const i=state.fences.findIndex(f=>f.id===BOUNDARY_FENCE_ID);if(i<0)return;
    const f=state.fences[i],ring=[...state.plot,state.plot[0]];
    if(f.path.length===ring.length&&f.path.every((p,j)=>Math.abs(p.x-ring[j].x)<1e-6&&Math.abs(p.y-ring[j].y)<1e-6))return;
    const edge=f.gate&&f.gate.edge<state.plot.length?f.gate.edge:facingEdge(state.plot,state.items.find(x=>x.type==='house'));
    const next=boundaryFence(state.plot,edge,f.name);state.fences=next?state.fences.map(x=>x.id===f.id?next:x):state.fences.filter(x=>x.id!==f.id);
  }
  function setBoundaryFence(on,edge){
    state.fences=state.fences.filter(f=>f.id!==BOUNDARY_FENCE_ID);if(!on)return;
    const f=boundaryFence(state.plot,edge??facingEdge(state.plot,state.items.find(x=>x.type==='house')),bi('Boundary fence','Ogrodzenie działki'));
    if(f&&state.fences.length<12)state.fences=[f,...state.fences];
  }
  // Moves the gate to the edge facing a mapped street once OpenStreetMap roads are known.
  async function gateToStreet(){
    if(!state.coordinates.projected||!state.fences.some(f=>f.id===BOUNDARY_FENCE_ID))return;
    const key=JSON.stringify(state.plot);
    try{const {loadStreets,streetEdge}=await import('./core/context.ts'),edge=streetEdge(state.plot,await loadStreets(state));
      if(edge===null||JSON.stringify(state.plot)!==key)return;const f=state.fences.find(x=>x.id===BOUNDARY_FENCE_ID);if(!f||f.gate?.edge===edge)return;
      setBoundaryFence(true,edge);render();}catch{/* no map data: keep the facing edge */}
  }
  function render(){ for(const it of state.items)if(it.openings.length)it.openings=fitOpenings(it); syncBoundaryFence(); syncFences(); syncEnvironment(); C = compute(); syncPanel(); renderSheet(); if(viewer && view3d){viewer.update(state,originalAppearance,exteriorFor);void refreshContext();} if(parcelMap && mapActive)parcelMap.update(state); save(); journey?.refresh(); syncSiteData(); }

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
    const shown = new Set(planItems().map(i => i.id)), scope = state.dimScope === 'selected' ? new Set(selected && shown.has(selected) ? [selected] : []) : shown;
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
      if (!shown.has(p.a) || !shown.has(p.b)) continue;
      const d = dim(S(p.P), S(p.Q), 'pair' + (p.perp ? '' : ' diag'), fmt(p.t));
      out.push(d.line); labels.push(d.label);
    }

    // buildings
    for (const it of planItems()){
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
    for(const fence of showGarden?state.fences:state.fences.filter(f=>f.id===BOUNDARY_FENCE_ID))for(const segment of fenceSegments(fence)){
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
    document.querySelector('.app').classList.toggle('has-selection', !!it);
    if (!it){
      box.innerHTML = `<h2 class="lbl">${t('selection')}</h2><p class="hint">${t('selectionHint')}</p>`;
    } else {
      box.innerHTML = `
        <div class="sec-head"><h2 class="lbl">${t('selected')}</h2><span class="tag ${it.type}">${t(it.type)}</span></div>
        ${it.catalog?`<p class="hint"><b>${esc(catalogRegistrations.find(r=>r.id===it.catalog.catalogId)?.name??it.catalog.catalogId)} · ${esc(catalogModel?.name??it.catalog.modelId)}</b><br>${catalogAvailable(it.catalog,enabledCatalogs)?(catalogModel&&(Math.abs(it.w-catalogModel.footprint.width)>.001||Math.abs(it.d-catalogModel.footprint.depth)>.001)?(lang==='pl'?'Wymiary zmienione przez użytkownika.':'Dimensions customized by the user.'):(lang==='pl'?'Obrys wg rzutu producenta · wysokość i dach poglądowe.':'Envelope from manufacturer plan · illustrative height and roof.')) :t('catalogUnavailable')}</p>${!catalogAvailable(it.catalog,enabledCatalogs)&&catalogRegistrations.some(r=>r.id===it.catalog.catalogId)?`<button id="enable-missing-catalog">${t('enableCatalog')}</button>`:''}`:''}
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
            <div class="field"><label for="f-roof">${t('roof')}</label><select id="f-roof"><option value="flat">${t('flat')}</option><option value="gable">${t('gable')}</option><option value="hip" data-bi="Hip|Kopertowy">Hip</option><option value="shed" data-bi="Shed|Jednospadowy">Shed</option></select></div>
            <div class="field"><label for="f-pitch">${t('pitch')}</label><input id="f-pitch" type="number" min="0" max="60" step="1"></div>
          </div>
        </details>
        <details id="material-options"><summary>${t('materials')}</summary>
          <p class="hint">${t('materialHint')}</p>
          <div class="field"><label for="f-facade">${t('facade')}</label><select id="f-facade">${Object.entries(materialPresets).map(([id,m])=>`<option value="${id}">${m[lang]}</option>`).join('')}</select></div>
          <div class="grid2">${['grout','roofColor','frameColor','doorColor','gutterColor','trimColor'].map(key=>`<div class="field"><label for="f-${key}">${t(key)}</label><input id="f-${key}" type="color"></div>`).join('')}
          <div class="field"><label for="f-roofCovering">${lang==='pl'?'Pokrycie dachu':'Roof covering'}</label><select id="f-roofCovering"><option value="metal">${bi('metal','blacha')}</option><option value="tile">${bi('tile','dachówka')}</option><option value="shingle">${bi('shingle','gont')}</option><option value="membrane">${bi('membrane','membrana')}</option></select></div><div class="field"><label for="f-layout">${t('layout')}</label><select id="f-layout"><option value="horizontal">${t('horizontal')}</option><option value="vertical">${t('vertical')}</option></select></div>
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
      if(it.type==='house'&&catalogModel?.exterior&&catalogAvailable(it.catalog,enabledCatalogs)){
        const exterior=catalogModel.exterior,options=resolveHouseOptions(it,exterior),panel=document.createElement('details');
        panel.id='house-options';panel.open=true;
        panel.innerHTML=`<summary>${bi('House options','Opcje domu')}</summary><div class="field"><label for="house-parking">${bi('Parking beside the house','Parking przy domu')}</label><select id="house-parking">${[['none','None','Brak'],['carport','Carport','Wiata'],['garage','Garage','Garaż']].map(([v,en,pl])=>`<option value="${v}" ${houseParking(state.items,it)===v?'selected':''}>${bi(en,pl)}</option>`).join('')}</select></div><div class="house-option-grid">${[['fireplace','Fireplace','Kominek'],['recuperation','Heat recovery ventilation','Rekuperacja'],['solarPanels','Solar panels','Fotowoltaika'],['heatPump','Heat pump','Pompa ciepła']].map(([key,en,pl])=>`<label class="check"><input type="checkbox" data-house-option="${key}" ${options[key]?'checked':''}><span>${bi(en,pl)}</span></label>`).join('')}</div><p class="hint">${bi('Illustrative equipment and placement. In Top view, the roof is removed to show the fireplace and ventilation ducts. Confirm dimensions and installation layout with the manufacturer.','Urządzenia i położenie poglądowe. Widok Z góry odsłania kominek i przewody rekuperacji. Potwierdź wymiary i układ instalacji u producenta.')}</p><p class="house-option-status" role="status"></p>`;
        $('#architecture-options').before(panel);
        panel.querySelectorAll('[data-house-option]').forEach(input=>input.onchange=()=>{snapshot();it.houseOptions={...resolveHouseOptions(it,exterior),[input.dataset.houseOption]:input.checked};render();});
        $('#house-parking').onchange=e=>{
          try{const items=setHouseParking(state.items,it.id,e.target.value,exterior,'o'+uid++);snapshot();state.items=items;buildPanel();render();}
          catch{e.target.value=houseParking(state.items,it);panel.querySelector('[role=status]').textContent=bi('Unlock the house and its annex, and leave room in the object list.','Odblokuj dom i jego dobudówkę oraz zostaw miejsce na liście obiektów.');}
        };
      }
      if(it.type==='landscape'){const f=document.createElement('div');f.className='field';f.innerHTML=`<label for="outdoor-maturity">${t('mature')}</label><input id="outdoor-maturity" type="number" min="0" max="1" step="0.1" value="${it.outdoor.maturity}">`;f.insertAdjacentHTML('beforeend',`<label for="outdoor-paving">${lang==='pl'?'Nawierzchnia':'Paving'}</label><select id="outdoor-paving">${['granite','concrete','gravel','timber','grass-pavers'].map(v=>`<option ${v===it.outdoor.paving?'selected':''}>${v}</option>`).join('')}</select>`);box.append(f);$('#outdoor-paving').onchange=e=>{snapshot();it.outdoor.paving=e.target.value;render();};bindNum('outdoor-maturity',v=>it.outdoor.maturity=Math.max(0,Math.min(1,v)));}
      if(it.type!=='landscape'){
        const openingPanel=document.createElement('details');openingPanel.id='opening-editor';openingPanel.innerHTML=`<summary>${lang==='pl'?'Okna i drzwi':'Windows & doors'}</summary><div class="grid2"><label>${lang==='pl'?'Element':'Element'}<select id="opening-type"><option value="window">${lang==='pl'?'Okno':'Window'}</option><option value="door">${lang==='pl'?'Drzwi':'Door'}</option></select></label><label>${lang==='pl'?'Ściana':'Wall'}<select id="opening-edge">${corners(it).map((_,i)=>`<option value="${i}">${i+1}</option>`).join('')}</select></label>${[['offset',lang==='pl'?'Od narożnika (m)':'From corner (m)',1],['width',lang==='pl'?'Szerokość (m)':'Width (m)',1.2],['height',lang==='pl'?'Wysokość (m)':'Height (m)',1.2],['sill',lang==='pl'?'Parapet (m)':'Sill (m)',.9]].map(([key,label,value])=>`<label>${label}<input id="opening-${key}" type="number" min="0" step=".1" value="${value}"></label>`).join('')}</div><button id="opening-add">+ ${lang==='pl'?'Dodaj element':'Add opening'}</button><p id="opening-error" role="status" class="hint"></p><div class="opening-list">${it.openings.map((o,i)=>`<button data-delete-opening="${i}">${lang==='pl'?'Ściana':'Wall'} ${o.edge+1} · ${o.width} × ${o.height} m <span>×</span></button>`).join('')}</div><p class="hint">${lang==='pl'?'Koncepcyjne otwory. Dobierz je do projektu architektonicznego.':'Conceptual openings. Match them to the architectural drawings.'}</p>`;$('#material-options').before(openingPanel);
        $('#opening-add').onclick=()=>{try{const opening={type:$('#opening-type').value,edge:Number($('#opening-edge').value),...Object.fromEntries(['offset','width','height','sill'].map(k=>[k,Number($('#opening-'+k).value)]))},next=parseScene({...state,items:state.items.map(i=>i.id===it.id?{...i,openings:[...i.openings,opening]}:i)});applyPlan(next,t('planLoaded'));}catch{$('#opening-error').textContent=lang==='pl'?'Element musi mieścić się w wybranej ścianie.':'The opening must fit inside the selected wall.';}};
        openingPanel.querySelectorAll('[data-delete-opening]').forEach(button=>button.onclick=()=>{snapshot();it.openings.splice(Number(button.dataset.deleteOpening),1);buildPanel();render();});
      }
      const ops=document.createElement('details');ops.id='scene-operations';ops.innerHTML=`<summary>${lang==='pl'?'Zaawansowane ustawienia':'Advanced settings'}</summary><label class="check"><input id="object-visible" type="checkbox" ${it.visible?'checked':''}>${lang==='pl'?'Widoczny':'Visible'}</label><label class="check"><input id="object-locked" type="checkbox" ${it.locked?'checked':''}>${lang==='pl'?'Zablokowany':'Locked'}</label><label>${lang==='pl'?'Grupa':'Group'}<input id="object-group" type="text" maxlength="60" value="${esc(it.group)}"></label><label>${bi('Custom normalized footprint [[x,y],…], each −0.5…0.5','Własny obrys znormalizowany [[x,y],…], każda wartość −0,5…0,5')}<textarea id="object-custom">${esc(JSON.stringify(it.custom?.map(p=>[p.x,p.y])??[]))}</textarea></label><label>${bi('Openings JSON [{edge,offset,width,height,sill,type}]','Otwory w JSON [{edge,offset,width,height,sill,type}]')}<textarea id="object-openings">${esc(JSON.stringify(it.openings))}</textarea></label><button id="object-apply"><span data-bi="Apply geometry|Zastosuj">Apply geometry</span></button><div class="row"><button id="attach-garage"><span data-bi="+ Garage|+ Garaż">+ Garage</span></button><button id="attach-carport"><span data-bi="+ Carport|+ Wiata">+ Carport</span></button></div><p id="object-error" role="status"></p>`;box.append(ops);
      $('#object-visible').onchange=e=>{snapshot();it.visible=e.target.checked;render();};$('#object-locked').onchange=e=>{snapshot();it.locked=e.target.checked;buildPanel();render();};$('#object-group').onchange=e=>{snapshot();it.group=e.target.value;render();};
      $('#object-apply').onclick=()=>{try{const openings=JSON.parse($('#object-openings').value),custom=JSON.parse($('#object-custom').value).map(([x,y])=>({x,y})),next=parseScene({...state,items:state.items.map(i=>i.id===it.id?{...i,openings,...(custom.length?{shape:'custom',custom}:{})}:i)});applyPlan(next,t('planLoaded'));}catch{$('#object-error').textContent=bi('Invalid geometry','Nieprawidłowa geometria');}};
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
      setVal('house-parking',houseParking(state.items,it));
      const options=resolveHouseOptions(it,exteriorFor(it));for(const input of document.querySelectorAll('[data-house-option]'))input.checked=options[input.dataset.houseOption];
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
        h += `<div class="ro${s.warn ? ' bad' : ''}"><span>${t('wall', {side: t(s.name)})}</span><b>${fmt(s.t)}</b><span class="chip ${s.warn ? 'bad' : 'ok'}">${s.warn ? t('under', {v: fmtD(s.req)}) : t('ok')}</span></div>`;
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
      (state.coordinates.projected?`<span>${t('north')}</span>`:'') + (state.items.length ? (warnCount ? `<button type="button" class="check-pill" data-issues aria-expanded="${issuesOpen}">${t('toCheck', {n: warnCount})}</button>` : `<span style="color:var(--ok)">${t('allMet')}</span>`) : '') +
      (warnCount && issuesOpen ? `<div class="issues-pop" role="list">${issueRows()}</div>` : '');
  }
  // Issues behind the "to check" pill: why each building fails, one click selects it on the plan.
  let issuesOpen=false;
  function issueRows(){
    const pl=lang==='pl',m=v=>dec(v.toFixed(2))+' m';
    return state.items.filter(i=>C.res.get(i.id).warn).map(i=>{const r=C.res.get(i.id),why=[
      !r.inside?(pl?'Wychodzi poza granicę działki':'Outside the parcel boundary'):null,
      r.overlap?(pl?'Koliduje z innym obiektem':'Overlaps another object'):null,
      ...r.sides.filter(s=>s.warn).map(s=>`${t('wall',{side:t(s.name)})}: ${m(s.t)} ${pl?'zamiast':'instead of'} ${m(s.req)}${s.line?(pl?' (linia zabudowy z planu miejscowego)':' (local plan building line)'):''}`)].filter(Boolean);
      return `<button type="button" role="listitem" data-issue="${esc(i.id)}"><b>${esc(i.name)}</b>${why.map(w=>`<small>${esc(w)}</small>`).join('')}</button>`;}).join('');
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
    const it = {...parseScene({plot:state.plot,items:[{id:'new',type,name:t(type),x:cx,y:cy,w:ty.w,d:ty.d,rot:0,setback:ty.setback}]}).items[0], id: 'o' + (uid++), type, name: t(type) + (n ? ' ' + (n + 1) : ''), x: cx, y: cy, w: ty.w, d: ty.d, rot: parcelAxis(state.plot), setback: ty.setback};
    snapItem(it);
    state.items.push(it); selected = it.id;
    buildPanel(); render();
  }
  function duplicate(){
    if(state.items.length>=100){toast(t('objectLimit'));return;}
    const it = get(selected); if (!it) return;
    snapshot();
    const c = {...structuredClone(it), id: 'o' + (uid++), name: (it.name + t('copySuffix')).slice(0, 60), x: it.x + 2, y: it.y + 2};
    const annex=it.type==='house'?houseAnnex(state.items,it):null;
    if(annex&&state.items.length>=99){toast(t('objectLimit'));return;}
    if(annex){c.group=crypto.randomUUID();state.items.push({...structuredClone(annex),id:'o'+uid++,attachedTo:c.id,group:c.group,x:annex.x+2,y:annex.y+2});}
    else{delete c.attachedTo;c.group='';}
    state.items.push(c); selected = c.id; buildPanel(); render();
  }
  function removeSelected(){
    const it = get(selected); if (!it) return;
    snapshot();
    state.items = state.items.filter(i => i.id !== it.id && i.attachedTo !== it.id); selected = null;
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

  let quietTimer=0;
  function setStageMode(mode){
    view3d=mode==='3d';mapActive=mode==='map';
    if(!mapActive){mapPick=false;$('#map-pick').setAttribute('aria-pressed','false');}
    $('#viewer').hidden=!view3d;$('#sheet').toggleAttribute('hidden',mode!=='2d');$('#viewer-controls').hidden=!view3d;
    $('#parcel-map').hidden=!mapActive;$('#map-controls').hidden=!mapActive;$('#map-status').hidden=!mapActive;
    $('.tools').hidden=mode!=='2d';if(mode!=='3d')document.getElementById('context-hint')?.setAttribute('hidden','');document.querySelector('.canvas-hint')?.toggleAttribute('hidden',mode!=='2d');$('.legend').hidden=mode!=='2d';$('#chipbar').hidden=mode!=='2d';$('#viewer-note').hidden=!view3d;
    $('#view-2d').setAttribute('aria-pressed',String(mode==='2d'));$('#view-3d').setAttribute('aria-pressed',String(view3d));$('#view-map').setAttribute('aria-pressed',String(mapActive));
    // Entering 3D on a phone folds the bottom sheets away; the first touch on the scene also hides the notes.
    $('.stage').classList.remove('viewer-quiet');clearTimeout(quietTimer);if(view3d)quietTimer=setTimeout(()=>$('.stage').classList.add('viewer-quiet'),5000);if(view3d&&matchMedia('(max-width:1000px)').matches)workspace?.collapse();
    if(viewer){viewer.setActive(view3d);if(view3d)viewer.update(state,originalAppearance,exteriorFor);}
    if(parcelMap){parcelMap.setActive(mapActive);if(mapActive)parcelMap.update(state);}
    if(mode==='2d')renderSheet();
  }
  const setViewerMode=enabled=>setStageMode(enabled?'3d':'2d');
  $('#view-map').onclick=async()=>{
    $('#view-map').disabled=true;
    try{
      if(!parcelMap){const {createParcelMap}=await import('./map/map.ts');parcelMap=createParcelMap($('#parcel-map'),source=>{const entry=sourceDirectory.find(s=>s.id===({ortho:'imagery',cadastre:'parcels'}[source]||source));$('#map-status').textContent=t('mapError')+(entry?' '+(lang==='pl'?entry.plName:entry.name):'');});parcelMap.onClick(pickMapParcel);parcelMap.setBase($('#map-base').value);parcelMap.setCadastre($('#map-cadastre').checked);for(const id of mapOverlayIds)parcelMap.setOverlay(id,$('#map-'+id).checked);}
      $('#map-status').textContent=t('mapHint');setStageMode('map');
    }catch{parcelMap?.dispose();parcelMap=null;setStageMode('2d');toast(t('mapError'));}
    finally{$('#view-map').disabled=false;}
  };
  $('#map-base').onchange=e=>parcelMap?.setBase(e.target.value);
  $('#map-cadastre').onchange=e=>parcelMap?.setCadastre(e.target.checked);
  for(const [id,label]of [['planning','Planning / MPZP'],['utilities','Utilities / Uzbrojenie'],['environment','Protected areas / Ochrona przyrody'],['flood','Flood zones / Powódź'],['groundwater','Groundwater / Podtopienia'],['relief','Terrain relief / Rzeźba terenu'],['landslides','Landslides / Osuwiska'],['mining','Mining and deposits / Górnictwo i złoża'],['wells','Hydrogeological objects / Otwory hydrogeologiczne']]){const labelEl=document.createElement('label');labelEl.className='check';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.id='map-'+id;checkbox.onchange=()=>parcelMap?.setOverlay(id,checkbox.checked);const text=document.createElement('span');text.dataset.ui='layer'+id;text.textContent=label;labelEl.append(checkbox,text);$('#map-controls').append(labelEl);}
  $('#map-fit').onclick=()=>parcelMap?.fitProject();
  let mapPick=false;
  $('#map-pick').onclick=()=>{if(journey){if(journey.isPicking())journey.stopSelection();else void journey.beginMapPick();return;}mapPick=!mapPick;$('#map-pick').setAttribute('aria-pressed',String(mapPick));$('#map-status').textContent=t(mapPick?'pickHint':'mapHint');};
  async function pickMapParcel(longitude,latitude){
    if(journey?.isPicking()){await journey.previewAt(longitude,latitude);return;}
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
        viewer=createViewer($('#viewer'),()=>{viewer?.dispose();viewer=null;setViewerMode(false);toast(t('viewerFailure'));});viewer.setPlain(!$('#view-colour').checked);
      }
      $('#viewer-note').textContent=t('viewerHint');setViewerMode(true);void refreshContext();
    } catch {viewer?.dispose();viewer=null;setViewerMode(false);toast(t('viewerFailure'));}
    finally {$('#view-3d').disabled=false;}
  };
  // Views start as a white model; the switch brings back colours and textures in the plan, map and 3D scene.
  const setColour=(on,save)=>{document.documentElement.dataset.colour=on?'on':'plain';viewer?.setPlain(!on);if(save)try{localStorage.setItem('setback-colour',on?'1':'0');}catch{/* private mode */}};
  $('#view-colour').checked=(()=>{try{return localStorage.getItem('setback-colour')==='1';}catch{return false;}})();setColour($('#view-colour').checked);
  $('#view-colour').onchange=e=>setColour(e.target.checked,true);
  // Surroundings (orthophoto + neighbouring buildings) for georeferenced parcels; derived data, never saved.
  let contextKey='',lastContext=null,contextJob=Promise.resolve();
  const contextToggle=document.createElement('label');contextToggle.className='check';contextToggle.innerHTML='<input type="checkbox" id="view-context" checked><span data-bi="Surroundings|Otoczenie">'+bi('Surroundings','Otoczenie')+'</span>';$('#viewer-controls').append(contextToggle);
  $('#view-context').onchange=e=>{viewer?.setContext(e.target.checked?lastContext:null);$('#context-hint').hidden=!!lastContext||!e.target.checked;};
  async function refreshContext(){
    if(!viewer)return;
    const origin=state.coordinates.projected?.origin,key=origin?JSON.stringify([origin,state.plot]):'';
    $('#context-hint').hidden=!!key||!view3d||!$('#view-context').checked;
    if(key===contextKey)return;contextKey=key;lastContext=null;viewer.setContext(null);
    if(!key)return;
    let finish;contextJob=new Promise(r=>finish=r);
    try{
      const {loadContext,contextFrame}=await import('./core/context.ts');if(contextKey!==key||!viewer)return;lastContext=contextFrame(state);if($('#view-context').checked)viewer.setContext(lastContext);
      const context=await loadContext(state);
      if(contextKey!==key||!viewer)return;lastContext=context;
      if($('#view-context').checked)viewer.setContext(context);
      // Neighbouring parcels arrive later (one ULDK request per edge); their property lines get fences too.
      void import('./core/context.ts').then(async({loadNeighbourParcels,neighbourFenceSegments})=>{const rings=await loadNeighbourParcels(state);if(contextKey!==key||!viewer||!lastContext)return;const fences=neighbourFenceSegments(state.plot,rings);lastContext={...lastContext,fences};if($('#view-context').checked)viewer.addContextFences(fences);}).catch(()=>{/* registry unavailable: own fence only */});
      $('#viewer-note').textContent=t('viewerHint')+' '+bi(`Surroundings: GUGiK orthophoto and ${context.buildings.length} building footprints © OpenStreetMap contributors. Neighbour heights are estimated (2 storeys), not measured.`,`Otoczenie: ortofotomapa GUGiK i ${context.buildings.length} obrysów budynków © OpenStreetMap. Wysokości sąsiadów są szacowane (2 kondygnacje), nie mierzone.`);
    }catch{if(contextKey===key){contextKey='';toast(bi('Surroundings could not be loaded. The plan is unchanged.','Nie udało się wczytać otoczenia. Plan bez zmian.'));}}
    finally{finish();}
  }
  const focusButton=document.createElement('button');focusButton.id='view-house';focusButton.dataset.bi='House|Dom';focusButton.textContent=bi('House','Dom');focusButton.onclick=()=>{const it=get(selected)?.type==='house'?get(selected):state.items.find(i=>i.type==='house');if(it)viewer?.focus(it);};$('#viewer-controls').append(focusButton);
  // Describe-your-house: Workers AI reads the words, geometry is computed locally and shown before anything is added.
  const brief=document.createElement('div');brief.id='house-brief';
  brief.innerHTML='<h3><span data-bi="Describe your house|Opisz swój dom">Describe your house</span></h3><textarea id="brief-text" rows="3" maxlength="400" data-bi-placeholder="e.g. single-storey, about 110 m², gable roof, garage for 2 cars|np. parterowy ok. 110 m², dach dwuspadowy, garaż na 2 auta"></textarea><button id="brief-run" type="button"><span data-bi="Fill in from description (AI)|Uzupełnij z opisu (AI)">Fill in from description (AI)</span></button><p id="brief-status" class="hint" role="status"></p><div id="brief-result"></div>';
  $('#add-house').closest('section').prepend(brief);
  const fmtM=n=>new Intl.NumberFormat(lang==='pl'?'pl-PL':'en-GB',{maximumFractionDigits:1}).format(n);
  async function addBriefHouse(plan){
    if(state.items.length>=98){toast(t('objectLimit'));return;}
    const {suggestPlacements}=await import('./core/placement.ts'),group=plan.garage?crypto.randomUUID():'';
    const cx=state.plot.reduce((n,p)=>n+p.x,0)/state.plot.length,cy=state.plot.reduce((n,p)=>n+p.y,0)/state.plot.length;
    const house=parseScene({plot:state.plot,items:[{id:'o'+uid++,type:'house',name:bi('House (from description)','Dom (z opisu)'),x:cx,y:cy,w:plan.w,d:plan.d,rot:parcelAxis(state.plot),setback:4,group,architecture:{storeys:plan.storeys,height:plan.height,roof:plan.roof,pitch:plan.pitch,roofAxis:'width'}}]}).items[0];
    const spot=suggestPlacements(state,house).suggestions[0];if(spot)Object.assign(house,{x:spot.x,y:spot.y,rot:spot.rot});
    snapshot();state.items.push(house);
    if(plan.garage){const g=plan.garage,lx=-((house.w+g.w)/2+.02),ly=house.d/2-g.d/2,r=house.rot*Math.PI/180;state.items.push(parseScene({plot:state.plot,items:[{id:'o'+uid++,type:g.kind==='attached'?'garage':'landscape',...(g.kind==='carport'?{kind:'carport'}:{}),name:g.kind==='attached'?t('garage'):bi('Carport','Wiata'),x:house.x+lx*Math.cos(r)-ly*Math.sin(r),y:house.y+lx*Math.sin(r)+ly*Math.cos(r),w:g.w,d:g.d,rot:house.rot,setback:3,group,architecture:{storeys:1,height:2.8,roof:'flat',pitch:0}}]}).items[0]);}
    selected=house.id;buildPanel();render();toast(spot?bi('House added in a free position. Check the values.','Dodano dom w wolnym miejscu. Sprawdź wartości.'):bi('Added in the centre: no free position found.','Dodano na środku: brak wolnego miejsca.'));
  }
  function showBrief(answer,plan){
    const out=$('#brief-result');out.replaceChildren();
    const card=document.createElement('div');card.className='brief-card';
    const said=document.createElement('p');said.textContent=answer.summary;
    const chips=document.createElement('ul'),est=k=>plan.estimated.includes(k)?' *':'';
    for(const text of [`${fmtM(plan.w)} × ${fmtM(plan.d)} m${est('size')}`,`${plan.storeys} ${bi(plan.storeys===1?'storey':'storeys',plan.storeys===1?'kondygnacja':'kondygnacje')}${est('storeys')}`,`${{gable:bi('Gable roof','Dach dwuspadowy'),hip:bi('Hip roof','Dach kopertowy'),flat:bi('Flat roof','Dach płaski'),shed:bi('Mono-pitch roof','Dach jednospadowy')}[plan.roof]} ${Math.round(plan.pitch)}°${est('roof')}`,...(plan.garage?[plan.garage.kind==='attached'?`${t('garage')} ${fmtM(plan.garage.w)} × ${fmtM(plan.garage.d)} m`:bi('Carport','Wiata')]:[])]){const li=document.createElement('li');li.textContent=text;chips.append(li);}
    const add=document.createElement('button');add.type='button';add.className='brief-add';add.textContent=bi('Add this house','Dodaj ten dom');add.onclick=()=>void addBriefHouse(plan);
    card.append(said,chips,add);
    const model=plan.match&&[...loadedCatalogModels.values()].find(m=>m.id===plan.match);
    if(model){const alt=document.createElement('button');alt.type='button';alt.textContent=bi(`Similar catalogue design: ${model.name}`,`Podobny projekt z katalogu: ${model.name}`);alt.onclick=()=>{const b=[...document.querySelectorAll('[data-place-catalog]')].find(x=>x.dataset.model===model.id);b?.scrollIntoView({block:'center'});b?.focus();};card.append(alt);}
    const note=document.createElement('small');note.textContent=bi('AI interpretation of your words. * estimated from floor area or defaults. Nothing changes until you add it.','Interpretacja AI Twojego opisu. * oszacowane z powierzchni lub domyślnie. Nic się nie zmieni, dopóki nie dodasz domu.');card.append(note);
    out.append(card);
  }
  $('#brief-run').onclick=async()=>{
    const text=$('#brief-text').value.trim();if(text.length<3){$('#brief-text').focus();return;}
    $('#brief-run').disabled=true;$('#brief-result').replaceChildren();$('#brief-status').textContent=bi('Reading your description…','Analizuję opis…');
    try{
      const r=await window.fetch('/api/ai/house',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,lang})}),j=await r.json().catch(()=>({}));
      if(!r.ok||!j.answer)throw new Error('unavailable');
      showBrief(j.answer,planFromBrief(j.answer,[...loadedCatalogModels.values()].map(m=>({id:m.id,width:m.footprint.width,depth:m.footprint.depth}))));$('#brief-status').textContent='';
    }catch{$('#brief-status').textContent=bi('The assistant is unavailable right now. Add a house below or pick one from the catalogue.','Asystent jest teraz niedostępny. Dodaj dom poniżej lub wybierz z katalogu.');}
    finally{$('#brief-run').disabled=false;}
  };
  // One-click garden: deterministic layout around the main house; re-running replaces the previous auto-garden.
  const gardenCard=document.createElement('div');gardenCard.id='garden-designer';
  const boundaryToggle=document.createElement('label');boundaryToggle.className='check boundary-toggle';boundaryToggle.innerHTML='<input type="checkbox" id="boundary-fence"><span data-bi="Fence on the property lines (gate on the street side)|Ogrodzenie na granicy działki (brama od ulicy)"></span>';
  gardenCard.innerHTML='<h3><span data-bi="Design my garden|Zaprojektuj ogród"></span></h3><div class="garden-chat" aria-live="polite"><p class="bubble ai"><span data-bi="Tell me what you would like: a pool, a vegetable patch, lots of trees, a place for kids… I will design it on your parcel.|Napisz, czego chcesz: basen, warzywnik, dużo drzew, miejsce dla dzieci… Zaprojektuję to na Twojej działce."></span></p></div><form class="garden-ask"><input id="garden-wish" type="text" maxlength="500" autocomplete="off" data-bi-placeholder="e.g. lush garden with a pergola and a vegetable patch|np. bujny ogród z pergolą i warzywnikiem"><button type="submit" aria-label="Send"><span data-bi="Design|Projektuj"></span></button></form><div class="garden-styles" role="radiogroup"><button type="button" role="radio" aria-checked="true" data-style="lush"><span data-bi="Lush|Bujny"></span></button><button type="button" role="radio" aria-checked="false" data-style="family"><span data-bi="Family|Rodzinny"></span></button><button type="button" role="radio" aria-checked="false" data-style="modern"><span data-bi="Modern|Nowoczesny"></span></button><button type="button" role="radio" aria-checked="false" data-style="natural"><span data-bi="Natural|Naturalny"></span></button></div><label class="gate-edge"><span data-bi="Gate on the side|Brama od strony"></span><select id="garden-gate"></select></label><button type="button" id="garden-design"><span data-bi="Design garden|Zaprojektuj ogród"></span></button>';
  gardenCard.querySelectorAll('[data-style]').forEach(b=>b.onclick=()=>gardenCard.querySelectorAll('[data-style]').forEach(x=>x.setAttribute('aria-checked',String(x===b))));
  // Garden chat: Workers AI turns a wish into style + elements; the deterministic designer places them.
  const chat=gardenCard.querySelector('.garden-chat'),chatHistory=[];
  const bubble=(text,who)=>{const p=document.createElement('p');p.className='bubble '+who;p.textContent=text;chat.append(p);chat.scrollTop=chat.scrollHeight;return p;};
  gardenCard.querySelector('.garden-ask').onsubmit=async e=>{
    e.preventDefault();const input=$('#garden-wish'),text=input.value.trim();if(text.length<2)return;
    input.value='';bubble(text,'me');const waiting=bubble(bi('Designing…','Projektuję…'),'ai');gardenCard.classList.add('busy');
    try{
      const r=await window.fetch('/api/ai/garden',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,lang,history:chatHistory.slice(-6)})}),j=await r.json().catch(()=>({}));
      if(!r.ok||!j.answer)throw new Error('unavailable');
      const a=j.answer;pickStyle(a.style);chatHistory.push(text);
      if(a.season||a.weather){if(a.season)state.environment.season=a.season;if(a.weather)state.environment.weather=a.weather;}
      const count=runGarden({add:a.add,avoid:a.avoid});
      waiting.textContent=count===false?bi('Add a house first, then ask again.','Najpierw dodaj dom, potem napisz ponownie.'):a.reply;
    }catch{waiting.textContent=bi('The assistant is unavailable right now, so I used the selected style.','Asystent jest teraz niedostępny, więc użyłem wybranego stylu.');runGarden({});}
    finally{gardenCard.classList.remove('busy');}
  };
  let autoGarden={items:[],fences:[]},streetKey='',detectedStreet=null;
  // Gate edge: every parcel edge is selectable; the edge facing a mapped road is pre-selected.
  async function syncGateEdges(){
    const select=$('#garden-gate');if(!select)return;
    const key=JSON.stringify([state.plot,state.coordinates.projected?.origin??null]);
    if(key!==streetKey){streetKey=key;detectedStreet=null;
      if(state.coordinates.projected){try{const {loadStreets,streetEdge}=await import('./core/context.ts'),streets=await loadStreets(state);if(streetKey===key)detectedStreet=streetEdge(state.plot,streets);}catch{/* no map data: fall back to the side the house faces */}}
      select.dataset.auto='1';}
    const keep=select.dataset.auto==='1'?null:select.value;
    select.innerHTML=`<option value="">${bi('Side the house faces','Strona, na którą patrzy dom')}</option>`+state.plot.map((a,i)=>{const b=state.plot[(i+1)%state.plot.length];return `<option value="${i}">${cornerName(i)}${cornerName((i+1)%state.plot.length)} · ${dec(Math.hypot(b.x-a.x,b.y-a.y).toFixed(1))} m${i===detectedStreet?bi(' · street',' · ulica'):''}</option>`;}).join('');
    select.value=keep??(detectedStreet===null?'':String(detectedStreet));
  }
  gardenCard.addEventListener('change',e=>{if(e.target.id==='garden-gate')e.target.dataset.auto='0';});
  const pickStyle=style=>gardenCard.querySelectorAll('[data-style]').forEach(x=>x.setAttribute('aria-checked',String(x.dataset.style===style)));
  gardenCard.querySelector('#garden-design').onclick=()=>runGarden({});
  function runGarden(options){
    const style=gardenCard.querySelector('[aria-checked=true]').dataset.style;
    const base={...state,items:state.items.filter(i=>!autoGarden.items.includes(i.id)),fences:state.fences.filter(f=>!autoGarden.fences.includes(f.id)&&f.id!==BOUNDARY_FENCE_ID)},gateValue=$('#garden-gate').value;
    let result;try{result=designGarden(base,style,()=>'o'+uid++,kind=>objectLibrary[kind][lang],gateValue===''?null:Number(gateValue),options);}catch{toast(bi('Add a house first.','Najpierw dodaj dom.'));return false;}
    if(base.items.length+result.items.length>100){toast(t('objectLimit'));return false;}
    snapshot();state.items=[...base.items,...result.items];state.fences=base.fences;
    const fences=[];
    if(state.fences.length<11){
      fences.push(fenceSchema.parse({id:crypto.randomUUID(),name:bi('Boundary hedge','Żywopłot przy granicy'),type:'hedge-evergreen',path:result.hedge,height:1.6,spacing:.6,width:.8,color:'#3f6a4e',foundation:0,maturity:1,gate:null}));
      fences.push(fenceSchema.parse({id:crypto.randomUUID(),name:bi('Street fence and gate','Ogrodzenie od ulicy z bramą'),type:'metal-panel',path:result.front.path,height:1.5,spacing:2.5,width:.08,color:'#3a3d41',foundation:.3,maturity:1,gate:{edge:0,offset:result.front.gate.offset,width:result.front.gate.width,type:'sliding',open:false,inward:true}}));
      state.fences.push(...fences);}
    const fence=fences.length;autoGarden={items:result.items.map(i=>i.id),fences:fences.map(f=>f.id)};
    buildPanel();render();toast(bi(`Garden designed: ${result.items.length} elements${fence?', hedge and a street gate':''}. Drag or delete anything.`,`Ogród gotowy: ${result.items.length} elementów${fence?', żywopłot i brama od ulicy':''}. Możesz wszystko przesuwać i usuwać.`));
    return result.items.length;
  }
  const walkButton=document.createElement('button');walkButton.dataset.bi='Walk|Spacer';walkButton.textContent=bi('Walk','Spacer');walkButton.onclick=()=>viewer?.view('walk');$('#viewer-controls').append(walkButton);
  // Toolbar: one camera group, the surroundings toggle, and a "more" menu for screenshot and low power.
  const cameraGroup=document.createElement('div');cameraGroup.className='camera-group';cameraGroup.setAttribute('role','group');cameraGroup.setAttribute('aria-label',bi('Camera','Kamera'));
  cameraGroup.append($('#view-axon'),$('#view-top'),focusButton,walkButton);
  const more=document.createElement('details');more.className='viewer-more';more.innerHTML='<summary aria-label="More">⋯</summary><div class="viewer-more-menu"></div>';
  more.querySelector('.viewer-more-menu').append($('#view-capture'),$('#view-low').closest('label'));
  // Season, weather and time of day: a chip that opens a small popover (same data as Garden → Season and sunlight).
  const env=document.createElement('details');env.className='env-chip';
  const seasons=[['spring','Spring','Wiosna'],['summer','Summer','Lato'],['autumn','Autumn','Jesień'],['winter','Winter','Zima']],weathers=[['clear','Clear','Słońce'],['clouds','Cloudy','Chmury'],['rain','Rain','Deszcz'],['snow','Snow','Śnieg']];
  const seg=(key,list)=>`<div class="env-seg" data-env="${key}">${list.map(([v,en,pl])=>`<button type="button" data-value="${v}"><span data-bi="${en}|${pl}">${bi(en,pl)}</span></button>`).join('')}</div>`;
  env.innerHTML=`<summary><span class="env-label"></span></summary><div class="env-pop"><small><span data-bi="Season|Pora roku">${bi('Season','Pora roku')}</span></small>${seg('season',seasons)}<small><span data-bi="Weather|Pogoda">${bi('Weather','Pogoda')}</span></small>${seg('weather',weathers)}<small><span data-bi="Time of day|Pora dnia">${bi('Time of day','Pora dnia')}</span> <b class="env-time"></b></small><input type="range" min="5" max="21" step="0.25" class="env-hour" aria-label="${bi('Time of day','Pora dnia')}"></div>`;
  env.querySelectorAll('.env-seg').forEach(group=>group.onclick=e=>{const b=e.target.closest('button');if(!b)return;snapshot();state.environment[group.dataset.env]=b.dataset.value;render();});
  const hourInput=env.querySelector('.env-hour');
  hourInput.oninput=()=>{const d=new Date(state.environment.date),h=Number(hourInput.value);d.setHours(Math.floor(h),Math.round((h%1)*60),0,0);state.environment.date=d.toISOString();render();};
  hourInput.onpointerdown=()=>snapshot();
  document.addEventListener('click',e=>{if(!env.contains(e.target))env.open=false;});
  function syncEnvChip(){const e=state.environment,d=new Date(e.date),label=s=>{const m=[...seasons,...weathers].find(x=>x[0]===s);return m?bi(m[1],m[2]):s;};
    env.querySelector('.env-label').textContent=`${{clear:'☀',clouds:'☁',rain:'☂',snow:'❄'}[e.weather]??'☀'} ${label(e.season)} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    env.querySelectorAll('.env-seg').forEach(g=>g.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===e[g.dataset.env]))));
    hourInput.value=String(d.getHours()+d.getMinutes()/60);env.querySelector('.env-time').textContent=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}
  contextToggle.classList.add('context-toggle');$('#viewer-controls').replaceChildren(cameraGroup,contextToggle,env,more);syncEnvChip();
  document.addEventListener('click',e=>{if(!more.contains(e.target))more.open=false;});
  const contextHint=document.createElement('div');contextHint.id='context-hint';contextHint.hidden=true;
  contextHint.innerHTML='<p><span data-bi="This plan has no map location, so there is no aerial photo or neighbouring buildings yet.|Ten plan nie ma lokalizacji na mapie, więc nie ma jeszcze zdjęcia lotniczego ani sąsiednich budynków."></span></p><button type="button"><span data-bi="Find your parcel|Znajdź swoją działkę"></span></button>';
  contextHint.querySelectorAll('[data-bi]').forEach(el=>{const [en,pl]=el.dataset.bi.split('|');el.textContent=lang==='pl'?pl:en;});
  contextHint.querySelector('button').onclick=()=>{setStageMode('2d');workspace.activate('parcel');};
  $('#viewer').after(contextHint);
  $('#view-top').onclick=()=>viewer?.view('top');$('#view-axon').onclick=()=>viewer?.view('axonometric');
  $('#view-low').onchange=e=>viewer?.quality(e.target.checked);
  $('#view-capture').onclick=()=>{try{const a=document.createElement('a');a.download='setback-3d.png';a.href=viewer.screenshot();a.click();}catch{toast(t('viewerFailure'));}};
  window.addEventListener('pagehide',()=>{viewer?.dispose();viewer=null;parcelMap?.dispose();parcelMap=null;});
  // ---------- wiring ----------
  const terrainPanel=document.createElement('details');terrainPanel.innerHTML=`<summary>${bi('Terrain and sources','Teren i źródła')}</summary><p class="hint">${bi('GUGiK NMT: nine elevation samples, approximate interpolated terrain and slope. Survey datum and acquisition date unspecified. Remote failures leave the project unchanged.','GUGiK NMT: dziewięć próbek wysokości, przybliżony teren i spadek. Układ wysokości i data pomiaru nie są podane. Błąd usługi nie zmienia projektu.')}</p><button id="terrain-sample">${bi('Fetch elevation','Pobierz wysokości')}</button><button id="terrain-clear">${bi('Flat ground','Płaski teren')}</button><p id="terrain-result" role="status"></p><p class="hint">${bi('Map layers are visual context. No flood clearance, utility availability or legal planning conclusion is inferred.','Warstwy mapy są kontekstem. Nie potwierdzają braku zagrożenia powodziowego, dostępności sieci ani warunków zabudowy.')}</p><a href="https://wody.isok.gov.pl/imap_kzgw/?gpmap=gpMZP" target="_blank" rel="noopener noreferrer">${bi('Official flood hazard · Wody Polskie','Mapy zagrożenia powodziowego · Wody Polskie')}</a><br><a href="https://geoserwis.gdos.gov.pl/mapy/" target="_blank" rel="noopener noreferrer">${bi('Protected environments · GDOŚ','Formy ochrony przyrody · GDOŚ')}</a>`;$('#sel').before(terrainPanel);
  $('#terrain-clear').onclick=()=>{snapshot();delete state.terrain;$('#terrain-result').textContent='';render();};
  $('#terrain-sample').onclick=async()=>{const before=JSON.stringify(state);$('#terrain-sample').disabled=true;$('#terrain-result').textContent='…';try{const {sampleTerrain}=await import('./core/terrain.ts'),terrain=await sampleTerrain(state);if(JSON.stringify(state)!==before)throw new Error(bi('Project changed; request again','Projekt się zmienił; pobierz ponownie'));snapshot();state.terrain=terrain;$('#terrain-result').textContent=`${terrain.source} · ${new Date(terrain.retrievedAt).toLocaleString(bi('en-GB','pl-PL'))} · ${bi('approximate slope','przybliżony spadek')} ${dec(terrain.slopePercent.toFixed(1))}%`;render();}catch(e){$('#terrain-result').textContent=state.coordinates.projected?bi('Elevation service unavailable. Try again later.','Usługa wysokości jest niedostępna. Spróbuj później.'):bi('Locate the parcel first.','Najpierw znajdź działkę na mapie.');}finally{$('#terrain-sample').disabled=false;}};
  const sourcePanel=document.createElement('details');sourcePanel.id='source-directory';function renderSourceDirectory(){sourcePanel.innerHTML=`<summary>${lang==='pl'?'Rejestry i źródła danych':'Public data sources'}</summary><p class="hint">${lang==='pl'?'Urzędowe rejestry i mapy. Każda warstwa wskazuje źródło. Brak danych nie oznacza braku ryzyka.':'Official registries and maps. Each layer identifies its source. Missing data does not mean no risk.'}</p>${sourceDirectory.map(s=>`<a class="source-row" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer"><span>${esc(lang==='pl'?s.plName:s.name)} ↗<small>${esc(lang==='pl'?s.plDetail:s.detail)}</small></span><em>${s.status==='Available'?(lang==='pl'?'Warstwa':'Layer'):(lang==='pl'?'Rejestr':'Reference')}</em></a>`).join('')}`;}renderSourceDirectory();$('#sel').before(sourcePanel);
  const planningPanel=document.createElement('details');planningPanel.innerHTML=`<summary>${bi('Geometric placement','Ustawienie geometryczne')}</summary><p class="hint">${bi('Source: user-selected setback input. Miter-corner offsets, millimetre precision. Not legal compliance. Grid suggestions are sampled, not exhaustive.','Źródło: odległości wybrane przez użytkownika. Obliczenia geometryczne z dokładnością do milimetra, bez oceny prawnej. Propozycje są próbkowane, nie wyczerpujące.')}</p><button id="placement-analyze">${bi('Analyze selected object','Analizuj zaznaczony')}</button><p id="placement-result" role="status"></p><div id="placement-options"></div>`;$('#sel').before(planningPanel);
  $('#placement-analyze').onclick=async()=>{const item=get(selected);if(!item)return;$('#placement-analyze').disabled=true;$('#placement-result').textContent='…';try{const {suggestPlacements}=await import('./core/placement.ts'),result=suggestPlacements(state,item),token=JSON.stringify(state);$('#placement-result').textContent=`${item.name}: ${result.area.toFixed(2)} m² inside geometric setback region; ${result.suggestions.length} sampled placements.`;$('#placement-options').replaceChildren();for(const p of result.suggestions){const button=document.createElement('button');button.textContent=`${p.x.toFixed(1)}, ${p.y.toFixed(1)} m / ${p.rot}°`;button.onclick=()=>{if(JSON.stringify(state)!==token){toast(bi('Recalculate first','Najpierw przelicz'));return;}snapshot();Object.assign(item,{x:p.x,y:p.y,rot:p.rot});buildPanel();render();};$('#placement-options').append(button);}}catch{$('#placement-result').textContent=bi('No free region','Brak wolnego obszaru');}finally{$('#placement-analyze').disabled=false;}};
  const topologyPanel=document.createElement('details');topologyPanel.innerHTML='<summary><span data-bi="Parcel holes and parts|Otwory i części działki">Parcel holes and parts</span></summary><p class="hint"><span data-bi="Local metric coordinates|Lokalne współrzędne w metrach. {holes: [[[x,y],…]], parts: [[outerRing, holeRing,…],…]}">Local metric coordinates</span></p><textarea id="topology-json" aria-label="Additional parcel rings"></textarea><button id="topology-read"><span data-bi="Read boundaries|Odczytaj">Read boundaries</span></button><button id="topology-apply"><span data-bi="Apply|Zastosuj">Apply</span></button><p id="topology-message" role="status"></p>';$('#sel').before(topologyPanel);
  $('#topology-read').onclick=()=>{$('#topology-json').value=JSON.stringify({holes:state.plotHoles.map(r=>r.map(p=>[p.x,p.y])),parts:state.plotParts.map(part=>part.map(r=>r.map(p=>[p.x,p.y])))},null,2);};
  $('#topology-apply').onclick=()=>{try{if($('#topology-json').value.length>MAX_PROJECT_BYTES)throw new Error('large');const value=JSON.parse($('#topology-json').value),point=([x,y])=>({x,y});const next=parseScene({...state,plotHoles:value.holes.map(r=>r.map(point)),plotParts:value.parts.map(part=>part.map(r=>r.map(point)))});if(next.parcel)next.parcel.edited=true;applyPlan(next,t('planLoaded'));$('#topology-message').textContent='';}catch{$('#topology-message').textContent=t('parcelImportError');}};
  const fencesPanel=document.createElement('details');fencesPanel.innerHTML=`<summary><span data-bi="Fences, gates and hedges|Ogrodzenia, bramy i żywopłoty">Fences, gates and hedges</span></summary><label><span data-bi="Design|Typ">Design</span><select id="fence-type">${[['metal-panel','Metal panels','Panele metalowe'],['palisade-horizontal','Horizontal palisade','Palisada pozioma'],['palisade-vertical','Vertical palisade','Palisada pionowa'],['wood','Timber','Drewniane'],['gabion','Gabion','Gabion'],['masonry','Masonry','Murowane'],['mixed','Mixed','Mieszane'],['hedge-evergreen','Evergreen hedge','Żywopłot zimozielony'],['hedge-deciduous','Deciduous hedge','Żywopłot liściasty']].map(([v,en,pl])=>`<option value="${v}" data-bi="${en}|${pl}">${en}</option>`).join('')}</select></label><div class="grid2"><label><span data-bi="Height (m)|Wysokość (m)">Height (m)</span><input id="fence-height" type="number" min="0.2" max="5" value="1.8" step=".1"></label><label><span data-bi="Post spacing (m)|Rozstaw (m)">Post spacing (m)</span><input id="fence-spacing" type="number" min=".5" max="10" value="2" step=".1"></label><label><span data-bi="Width (m)|Szerokość (m)">Width (m)</span><input id="fence-width" type="number" min=".05" max="3" value=".15" step=".05"></label><label><span data-bi="Color|Kolor">Color</span><input id="fence-color" type="color" value="#59645b"></label></div><label><span data-bi="Custom path [[x,y],…] (empty = whole parcel boundary)|Własna trasa [[x,y],…] (puste = cała granica działki)">Custom path [[x,y],…] (empty = whole parcel boundary)</span><textarea id="fence-path" aria-label="${bi('Fence path','Przebieg ogrodzenia')}"></textarea></label><button id="fence-boundary"><span data-bi="Use parcel boundary|Granica działki">Use parcel boundary</span></button><label><span data-bi="Gate on first edge|Brama na 1. boku">Gate on first edge</span><select id="fence-gate"><option value="" data-bi="None|Brak">None</option><option value="sliding" data-bi="Sliding gate|Brama przesuwna">Sliding gate</option><option value="swing" data-bi="Swing gate|Brama skrzydłowa">Swing gate</option><option value="wicket" data-bi="Wicket|Furtka">Wicket</option></select></label><label><span data-bi="Gate opening width (m)|Światło bramy (m)">Gate opening width (m)</span><input id="fence-gate-width" type="number" min=".5" max="10" step=".1" value="3.5"></label><label class="check"><input id="fence-open" type="checkbox"><span data-bi="Open|Otwarta">Open</span></label><button id="fence-add"><span data-bi="Add fence|Dodaj ogrodzenie">Add fence</span></button><div id="fence-list"></div><p id="fence-message" class="hint" role="status"></p>`;$('#sel').before(fencesPanel);
  $('#fence-boundary').onclick=()=>{$('#fence-path').value=JSON.stringify([...state.plot,state.plot[0]].map(p=>[p.x,p.y]));};
  function syncFences(){const bt=$('#boundary-fence');if(bt)bt.checked=state.fences.some(f=>f.id===BOUNDARY_FENCE_ID);if(!$('#fence-list'))return;$('#fence-list').innerHTML=state.fences.map(f=>`<button data-remove-fence="${esc(f.id)}">× ${esc(f.name)} · ${f.height} m${f.gate?' · gate '+f.gate.width+' m':''}</button>`).join('');}
  $('#fence-list').onclick=e=>{const id=e.target.dataset.removeFence;if(id){snapshot();state.fences=state.fences.filter(f=>f.id!==id);render();}};
  $('#fence-add').onclick=()=>{try{if(state.fences.length>=12)throw new Error('Maximum 12 paths');const raw=$('#fence-path').value.trim(),points=raw?JSON.parse(raw):[...state.plot,state.plot[0]].map(p=>[p.x,p.y]),type=$('#fence-type').value;const fence=fenceSchema.parse({id:crypto.randomUUID(),name:type,type,path:points.map(([x,y])=>({x,y})),height:Number($('#fence-height').value),spacing:Number($('#fence-spacing').value),width:Number($('#fence-width').value),color:$('#fence-color').value,foundation:0,maturity:1,gate:$('#fence-gate').value?{edge:0,offset:0,width:Number($('#fence-gate-width').value),type:$('#fence-gate').value,open:$('#fence-open').checked,inward:true}:null});snapshot();state.fences.push(fence);$('#fence-message').textContent='';render();}catch{$('#fence-message').textContent=bi('Check the fence path and gate width.','Sprawdź trasę ogrodzenia i szerokość bramy.');}};
  const environmentPanel=document.createElement('details');environmentPanel.innerHTML=`<summary data-t="environment">${t('environment')}</summary><p class="hint" data-t="solarHint">${t('solarHint')}</p><div class="grid2"><label><span data-bi="Season|Pora roku">Season</span><select id="env-season">${[['spring','Spring','Wiosna'],['summer','Summer','Lato'],['autumn','Autumn','Jesień'],['winter','Winter','Zima']].map(([v,en,pl])=>`<option value="${v}" data-bi="${en}|${pl}">${en}</option>`).join('')}</select></label><label><span data-bi="Weather|Pogoda">Weather</span><select id="env-weather">${[['clear','Clear','Bezchmurnie'],['clouds','Cloudy','Pochmurno'],['rain','Rain','Deszcz'],['snow','Snow','Śnieg']].map(([v,en,pl])=>`<option value="${v}" data-bi="${en}|${pl}">${en}</option>`).join('')}</select></label></div><label><span data-bi="Date|Data">Date</span><input id="env-date" type="datetime-local"></label><div class="grid2"><label><span data-bi="Latitude|Szerokość">Latitude</span><input id="env-latitude" type="number" min="-90" max="90" step="0.01"></label><label><span data-bi="Longitude|Długość">Longitude</span><input id="env-longitude" type="number" min="-180" max="180" step="0.01"></label></div>`;$('#sel').before(environmentPanel);
  function syncEnvironment(){if(typeof syncEnvChip==='function'&&document.querySelector('.env-chip'))syncEnvChip();if(!$('#env-season'))return;const e=state.environment;setVal('env-season',e.season);setVal('env-weather',e.weather);setVal('env-latitude',e.latitude);setVal('env-longitude',e.longitude);const date=new Date(e.date);setVal('env-date',new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16));}
  for(const key of ['season','weather','latitude','longitude','date'])$('#env-'+key).onchange=e=>{let value=e.target.value;if(key==='date'){if(!Number.isFinite(new Date(value).getTime()))return;value=new Date(value).toISOString();}if(key==='latitude'||key==='longitude'){value=Number(value);if(!Number.isFinite(value)||Math.abs(value)>(key==='latitude'?90:180))return;}snapshot();state.environment[key]=value;render();};
  const garden=document.createElement('details');garden.innerHTML=`<summary data-t="garden">${t('garden')}</summary><select id="garden-kind" aria-label="${t('garden')}">${Object.entries(objectLibrary).map(([id,v])=>`<option data-object-kind="${id}" value="${id}">${v[lang]}</option>`).join('')}</select><button id="garden-add" data-t="addOutdoor">${t('addOutdoor')}</button><div class="garden-tiles">${Object.entries(objectLibrary).map(([id,v])=>`<button type="button" data-tile="${id}"><i style="background:${v.color}"></i><span data-object-kind="${id}">${v[lang]}</span></button>`).join('')}</div>`;$('#sel').before(garden);
  garden.querySelector('.garden-tiles').onclick=e=>{const b=e.target.closest('[data-tile]');if(!b)return;$('#garden-kind').value=b.dataset.tile;$('#garden-add').click();};
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
  const gardenChk = $('#o-garden'); gardenChk.checked = showGarden;
  gardenChk.onchange = () => { showGarden = gardenChk.checked; try{localStorage.setItem(GARDEN_LS,showGarden?'1':'0');}catch{/* private mode */} renderSheet(); };
  // Delete the current project: clear the autosave and the address, then start over with the parcel search.
  const deleteButton=document.createElement('button');deleteButton.id='b-delete';deleteButton.className='danger';deleteButton.dataset.t='deleteProject';deleteButton.textContent=t('deleteProject');
  $('#b-reset').after(deleteButton);
  // An in-app dialog, not confirm(): embedded browsers and some phones block native dialogs, which made this a silent no-op.
  const startOver=document.createElement('dialog');startOver.className='start-over';
  startOver.innerHTML=`<h3>${bi('Start over?','Zacząć od nowa?')}</h3><p>${bi('This clears your project, saved variants and settings from this browser and takes you back to the start page. Download the project file first if you want to keep it.','To usunie projekt, zapisane warianty i ustawienia z tej przeglądarki i wróci na stronę startową. Jeśli chcesz go zachować, najpierw pobierz plik projektu.')}</p><div class="row"><button type="button" value="cancel">${bi('Cancel','Anuluj')}</button><button type="button" class="danger" value="wipe">${bi('Clear everything','Wyczyść wszystko')}</button></div>`;
  document.querySelector('.app').append(startOver);
  startOver.onclick=e=>{const v=e.target.closest?.('button')?.value;if(v==='cancel'||e.target===startOver)startOver.close();if(v!=='wipe')return;
    persistencePaused=true;clearTimeout(saveT);
    // every key this app stores starts with "setback": project, variants, catalogs, language, view and mode switches, attribution, intro flag
    try{for(const store of [localStorage,sessionStorage])for(const key of Object.keys(store))if(key.startsWith('setback'))store.removeItem(key);}catch{/* storage unavailable */}
    location.replace(location.origin+location.pathname+location.search); // full load without the project link
  };
  deleteButton.onclick=()=>startOver.showModal();

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
  $('#b-svg').onclick=async()=>{try{const {projectSvg}=await import('./core/reports.ts');downloadFile(projectSvg(reportScene(),lang),'setback-plan.svg','image/svg+xml');}catch{toast(t('notAPlan'));}};
  // Full report in one click: 3D views with surroundings, terrain slope and all checks are gathered automatically.
  $('#b-report').onclick=async()=>{
    const button=$('#b-report');if(button.disabled)return;button.disabled=true;toast(bi('Preparing the full report…','Przygotowuję pełny raport…'));
    const wait=ms=>new Promise(r=>setTimeout(r,ms)),frames=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    try{
      const {projectReport}=await import('./core/reports.ts'),previous=view3d?'3d':mapActive?'map':'2d';
      let shots=[],scene=reportScene();
      if(!view3d)await $('#view-3d').onclick();
      if(viewer&&view3d){
        await Promise.race([contextJob,wait(15000)]);await Promise.race([viewer.ready(),wait(8000)]);await frames();
        const house=get(selected)?.type==='house'?get(selected):state.items.find(i=>i.type==='house');
        shots=viewer.snapshots(house).map(s=>({label:s.kind==='house'?bi('House close-up','Zbliżenie domu'):bi('Parcel and surroundings','Działka i otoczenie'),src:s.src}));
      }
      if(previous==='2d')setStageMode('2d');else if(previous==='map')await $('#view-map').onclick();
      if(state.coordinates.projected&&!state.terrain){try{const {sampleTerrain}=await import('./core/terrain.ts');scene={...scene,terrain:await sampleTerrain(state)};}catch{/* report without terrain */}}
      await Promise.race([siteJob,wait(25000)]);if(siteData?.insights?.osm?.status==='error')insightsJob=readInsights(siteData,siteKey);await Promise.race([insightsJob,wait(60000)]);
      $('#report-frame').srcdoc=projectReport(scene,lang,new Date().toISOString(),{screenshots:shots,neighbours:lastContext?.buildings.length?lastContext.buildings:undefined,exteriorFor,site:siteData??undefined});$('#report-dialog').showModal();
    }catch{toast(t('notAPlan'));}
    finally{button.disabled=false;}
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
  const compareVariant=document.createElement('button'),comparison=document.createElement('p');compareVariant.dataset.bi='Compare variant|Porównaj wariant';compareVariant.textContent=bi('Compare variant','Porównaj wariant');comparison.className='hint';$('#variant-delete').after(compareVariant,comparison);compareVariant.onclick=()=>{try{const v=loadVariants().find(v=>v.id===$('#variant-list').value);if(!v)return;const changed=state.items.filter(i=>{const old=v.scene.items.find(o=>o.id===i.id);return !old||JSON.stringify(old)!==JSON.stringify(i);}).length;comparison.textContent=`${v.name}: ${v.scene.items.length} objects, ${parcelArea(v.scene).toFixed(2)} m² parcel. Current: ${state.items.length} objects, ${parcelArea(state).toFixed(2)} m². Changed/added: ${changed}.`;}catch{toast(t('variantError'));}};
  updateVariants();
  // A shared link pasted into an already-open tab only changes the hash.
  window.addEventListener('hashchange', async () => { const hash=location.hash;const o = await fromHash(); if (o && location.hash===hash) applyPlan(o, t('planFromLink')); });
  let resetArmed = false, resetT;
  $('#b-reset').onclick = e => {
    const b = e.currentTarget;
    if (!resetArmed){ resetArmed = true; b.textContent = t('resetConfirm'); resetT = setTimeout(() => { resetArmed = false; b.textContent = t('resetExample'); }, 3000); return; }
    clearTimeout(resetT); resetArmed = false; b.textContent = t('resetExample');
    snapshot(); state = exampleScene(); persistencePaused = false; $('#project-warning').hidden = true;
    uid = 3; selected = 'o1'; buildCorners(); buildPanel(); fit(); render(); toast(t('exampleRestored'));
  };
  $('#t-undo').onclick = undo; $('#t-redo').onclick = redo;
  $('#t-in').onclick = () => zoomAt(svg.clientWidth/2, svg.clientHeight/2, 1.25);
  $('#t-out').onclick = () => zoomAt(svg.clientWidth/2, svg.clientHeight/2, 0.8);
  $('#t-fit').onclick = () => { fit(); renderSheet(); };

  document.querySelectorAll('.lang button').forEach(b => b.onclick = () => {
    lang = b.dataset.lang;
    try { localStorage.setItem(LANG_LS, lang); } catch (e) {}
    applyLang(); renderCatalogs(); renderSourceDirectory(); renderLayoutReview(); $('#viewer-note').textContent=t('viewerHint');
    state.plot.forEach((_, i) => ['x', 'y'].forEach(axis =>
      document.getElementById(`pc-${axis}-${i}`).setAttribute('aria-label', t('cornerAxis', {c:cornerName(i), axis}))));
    buildPanel(); render();
  });

  let business=null,attribution=null;
  try{attribution=validateAttribution(JSON.parse(window.sessionStorage.getItem(ATTRIBUTION_KEY)??'null'));}catch{/* storage unavailable */}
  attribution=readAttribution(location.search,attribution);
  try{if(attribution)window.sessionStorage.setItem(ATTRIBUTION_KEY,JSON.stringify(attribution));}catch{/* in-memory attribution still works */}
  const businessHost=document.createElement('div');businessHost.id='business-host';$('.rail').append(businessHost);const {mountBusiness}=await import('./business.ts');business=mountBusiness({container:businessHost,getScene:()=>structuredClone(state),getAttribution:()=>(attribution?structuredClone(attribution):null)});

  workspace=mountWorkspace({initialTab:freshVisit?'parcel':'houses',onTab:tab=>{journey?.tabChanged(tab);if(tab==='garden')void syncGateEdges();if(tab==='project')renderLayoutReview();}});
  $('#viewer').addEventListener('pointerdown',()=>$('.stage').classList.add('viewer-quiet'));
  // Phone: a "Więcej" tab opens the most used actions, so nothing depends on the desktop header.
  const quickActions=[['📄',bi('Full report','Pełny raport'),'#b-report'],['🔗',bi('Share link','Udostępnij link'),'#b-link'],['🧊',bi('3D view','Widok 3D'),'#view-3d'],['🗺️',bi('Map','Mapa'),'#view-map'],['↶',bi('Undo','Cofnij'),'#t-undo'],['↷',bi('Redo','Ponów'),'#t-redo'],['📐',bi('Plan as SVG','Plan SVG'),'#b-svg'],['💾',bi('Save project file','Zapisz projekt'),'#b-download'],['↺',bi('Start over','Zacznij od nowa'),'#b-delete']];
  const quick=document.createElement('div');quick.className='quick-sheet';quick.hidden=true;
  quick.innerHTML=`<div class="quick-panel" role="dialog" aria-label="${bi('Quick actions','Szybkie akcje')}"><h3>${bi('Quick actions','Szybkie akcje')}</h3><div class="quick-grid">${quickActions.map(([icon,label,target])=>`<button type="button" data-quick="${target}"><span aria-hidden="true">${icon}</span>${esc(label)}</button>`).join('')}</div><div class="quick-advanced"><p class="hint">${bi('Shows manual drawing, parcel import and coordinates, materials, openings and expert garden tools.','Pokazuje ręczne rysowanie, import działki i współrzędne, materiały, otwory i narzędzia eksperckie ogrodu.')}</p></div></div>`;
  const quickTab=document.createElement('button');quickTab.type='button';quickTab.className='quick-tab';quickTab.setAttribute('aria-pressed','false');
  quickTab.innerHTML=`<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg><span>${bi('More','Więcej')}</span>`;
  const showQuick=open=>{quick.hidden=!open;quickTab.setAttribute('aria-pressed',String(open));};
  quickTab.onclick=()=>showQuick(quick.hidden);
  quick.onclick=e=>{const b=e.target.closest('[data-quick]');if(!b&&e.target.closest('.quick-panel'))return;showQuick(false);if(b)$(b.dataset.quick).click();};
  document.querySelector('.app').append(quick);document.querySelector('.project-identity .workspace-nav')?.append(quickTab);
  // Choosing any other tab closes the sheet, so it never covers the panel the user just opened.
  document.querySelector('.project-identity .workspace-nav')?.addEventListener('click',e=>{if(!e.target.closest('.quick-tab'))showQuick(false);});
  // Starting over is one click from the header (it still asks first), not buried under Project > Save.
  const restart=document.createElement('button');restart.type='button';restart.className='restart-action';restart.innerHTML=`<span aria-hidden="true">↺</span><span data-bi="Start over|Zacznij od nowa">${bi('Start over','Zacznij od nowa')}</span>`;restart.title=bi('Start over','Zacznij od nowa');restart.setAttribute('aria-label',restart.title);restart.onclick=()=>$('#b-delete').click();
  $('#b-link').before(restart);
  document.querySelector('[data-panel=houses]')?.prepend($('#house-brief'));
  document.querySelector('[data-panel=garden]')?.prepend(boundaryToggle,gardenCard);
  $('#chipbar').onclick=e=>{const pill=e.target.closest('[data-issues]'),row=e.target.closest('[data-issue]');if(pill)issuesOpen=!issuesOpen;else if(row){selected=row.dataset.issue;issuesOpen=false;buildPanel();}else return;render();};
  $('#boundary-fence').onchange=e=>{snapshot();setBoundaryFence(e.target.checked);render();if(e.target.checked)void gateToStreet();};
  // Simple mode hides manual, expert setup; the header switch reveals it and remembers the choice.
  const ADV_LS='setback-planner-advanced',advanced=document.createElement('label');advanced.className='advanced-switch';
  advanced.innerHTML='<input type="checkbox" id="advanced-mode" role="switch"><span data-bi="Advanced|Zaawansowane">'+bi('Advanced','Zaawansowane')+'</span>';
  // Phones have no room for its label in the header, so there it lives, labelled, in the "Więcej" sheet.
  const phone=matchMedia('(max-width:1000px)'),placeAdvanced=()=>{if(phone.matches)quick.querySelector('.quick-advanced')?.prepend(advanced);else document.querySelector('.header-actions')?.prepend(advanced);};
  placeAdvanced();phone.addEventListener('change',placeAdvanced);
  const setAdvanced=(on,save)=>{document.querySelector('.app').classList.toggle('simple',!on);$('#advanced-mode').checked=on;if(save)try{localStorage.setItem(ADV_LS,on?'1':'0');}catch{/* private mode */}};
  $('#advanced-mode').onchange=e=>setAdvanced(e.target.checked,true);
  setAdvanced((()=>{try{return localStorage.getItem(ADV_LS)==='1';}catch{return false;}})());
  const parcelPanel=document.querySelector('[data-panel=parcel]'),parcelAdvanced=document.createElement('details');parcelAdvanced.className='parcel-advanced';parcelAdvanced.innerHTML=`<summary>${lang==='pl'?'Rysowanie, import i współrzędne':'Drawing, import & coordinates'}</summary>`;parcelAdvanced.append($('#p-area').closest('section'));parcelPanel.append(parcelAdvanced);
  const review=document.createElement('section');review.id='review-layout';document.querySelector('[data-panel=project]').prepend(review);
  function renderLayoutReview(){const data=compute();renderReview(review,{scene:state,language:lang,checks:state.items.map(i=>({id:i.id,...data.res.get(i.id)})),selectedId:selected,onShowPlan:id=>{if(id){selected=id;buildPanel();}setStageMode('2d');fit();render();workspace.activate('houses');if(matchMedia('(max-width:1000px)').matches)document.querySelector('.library-close').click();},onReport:()=>$('#b-report').click(),onSources:()=>{workspace.activate('parcel');document.querySelector('.journey-topics').scrollIntoView({block:'start'});}});}
  async function journeyMap(point){await $('#view-map').onclick();if(!parcelMap||!mapActive)throw new Error('Map unavailable');await parcelMap.ready;$('#map-cadastre').checked=true;parcelMap.setCadastre(true);if(point)parcelMap.focusLocation(point.longitude,point.latitude,point.label);}
  journey=mountParcelJourney({container:parcelPanel,stage:$('.stage'),fresh:freshVisit,language:()=>lang,getScene:()=>state,onIntroEnd:()=>{entryPending=false;requestAnimationFrame(()=>{fit();renderSheet();});},onExploreExample:()=>{freshScene=false;entryPending=false;},
    lookupId:async id=>(await import('./core/uldk.ts')).lookupParcel(id),lookupAt:async(longitude,latitude)=>(await import('./core/uldk.ts')).lookupParcelAt(longitude,latitude),
    showMap:journeyMap,showPreview:parcel=>{if(parcelMap){parcelMap.clearLocation();parcelMap.update(parcel?parseScene({...state,...parcel,items:[],terrain:undefined}):state);if(parcel)parcelMap.fitProject();}},
    applyParcel:parcel=>{entryPending=false;const next=parseScene({...state,...parcel,items:freshScene?[]:state.items,terrain:undefined});next.items=fitItemsToParcel(next);next.fences=next.fences.filter(f=>f.id!==BOUNDARY_FENCE_ID);{const f=boundaryFence(next.plot,facingEdge(next.plot,next.items.find(x=>x.type==='house')),bi('Boundary fence','Ogrodzenie działki'));if(f&&next.fences.length<12)next.fences.unshift(f);}applyPlan(next,t('planLoaded'));void gateToStreet();freshScene=false;setStageMode('2d');fit();render();requestAnimationFrame(()=>{fit();renderSheet();});},activate:tab=>workspace.activate(tab),
    pickMap:()=>{mapPick=true;$('#map-pick').setAttribute('aria-pressed','true');},stopPicking:()=>{mapPick=false;$('#map-pick').setAttribute('aria-pressed','false');},
    showTopic:async topic=>{workspace.activate('parcel');await journeyMap();const ids={planning:['planning'],water:['flood','groundwater'],utilities:['utilities'],nature:['environment'],ground:['relief','landslides','mining','wells']}[topic];for(const id of mapOverlayIds){const enabled=ids.includes(id);$('#map-'+id).checked=enabled;parcelMap.setOverlay(id,enabled);}},reviewLayout:renderLayoutReview});
  // Public registry data: fetched in the background whenever the located parcel changes, listed here and included in the report.
  sitePanel=document.createElement('section');sitePanel.id='site-data';sitePanel.className='site-data';parcelPanel.querySelector('.journey-parcel-summary')?.after(sitePanel);
  function renderSitePanel(){
    if(!sitePanel)return;if(!siteKey){sitePanel.hidden=true;return;}sitePanel.hidden=false;
    const name=id=>{const s=sourceDirectory.find(d=>d.id===(id==='cadastre'?'parcels':id));return s?(lang==='pl'?s.plName:s.name).split(' · ')[0]:id;};
    const head=siteState==='loading'?bi('Fetching official registry data…','Pobieram dane z rejestrów publicznych…'):siteState==='error'?bi('Registry data could not be fetched. The report lists the sources to check.','Nie udało się pobrać danych z rejestrów. Raport wskaże źródła do sprawdzenia.'):bi('Fetched automatically from official registries. Results apply to a point inside the parcel; the full report shows a map for each source.','Pobrane automatycznie z rejestrów urzędowych. Wyniki dotyczą punktu w środku działki; pełny raport zawiera mapę dla każdego źródła.');
    const rows=siteData?siteLayerIds.map(id=>{const layer=siteData.layers[id];return `<li class="${id==='cadastre'?'none':layer.status}"><b>${esc(name(id))}</b><span>${esc(siteSummary(id,layer))}</span></li>`;}).join('')+(siteData.planRules?.status==='found'?`<li class="found plan-doc"><b>${esc(bi('Local plan text','Tekst planu miejscowego'))}</b><span><a href="${esc(siteData.planRules.plan.url)}" target="_blank" rel="noopener noreferrer">${esc(siteData.planRules.plan.title)} ↗</a>${(siteData.planRules.extraction?.claims??[]).slice(0,8).map(c=>`<br>• ${esc(c.parameter)}: <i>${esc(c.value)}</i>`).join('')}</span></li>`:siteData.planRules?.note?`<li class="none"><b>${esc(bi('Local plan text','Tekst planu miejscowego'))}</b><span>${esc(siteData.planRules.note)}</span></li>`:'')+(planSetbacks.some(v=>v)?`<li class="found"><b>${esc(bi('Building lines (local plan)','Linie zabudowy (MPZP)'))}</b><span>${planSetbacks.map((v,i)=>v?`${cornerName(i)}${cornerName((i+1)%state.plot.length)}: ${dec(v.toFixed(1))} m`:'').filter(Boolean).join(' · ')} ${esc(bi('from the boundary; checked against every building.','od granicy; uwzględnione w sprawdzeniu budynków.'))}</span></li>`:'')+(siteData.ortho.captures[0]?`<li class="none"><b>${esc(bi('Orthophoto','Ortofotomapa'))}</b><span>${esc(bi('Latest capture','Najnowsze zdjęcie'))}: ${esc(siteData.ortho.captures[0].date)}</span></li>`:''):'';
    sitePanel.innerHTML=`<h3>${bi('Public registry data','Dane z rejestrów publicznych')}</h3><p class="hint" role="status" aria-busy="${siteState==='loading'}">${head}</p>${rows?`<ul>${rows}</ul>`:''}`;
  }
  renderSitePanel();
  applyLang(); renderCatalogs();
  buildCorners();
  buildPanel();
  new ResizeObserver(() => { const W = svg.clientWidth, H = svg.clientHeight; if (W && H && sheetW && sheetH) { view.ox += (W - sheetW) / 2; view.oy += (H - sheetH) / 2; } sheetW = W; sheetH = H; renderSheet(); }).observe(svg);
  render();
})();
