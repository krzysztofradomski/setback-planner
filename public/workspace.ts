import "./ui.css";
type Tab = "houses" | "parcel" | "garden" | "project" | "presentation";
const copy = {
  en: {
    layerplanning: "Local spatial plans",
    layerutilities: "Utility networks",
    layerenvironment: "Protected natural areas",
    layerflood: "River flood zones",
    layergroundwater: "Groundwater susceptibility",
    layerrelief: "Terrain relief",
    layerlandslides: "Landslides (SOPO)",
    layermining: "Mining and deposits (MIDAS)",
    layerwells: "Hydrogeological objects (CBDH)",
    mapLayers: "Map layers",
    openMap: "Open geographical map",
    layerHint:
      "Switch layers on in the map view. Empty coverage is not evidence that a risk or utility is absent.",
    houses: "Houses",
    parcel: "Parcel",
    garden: "Garden",
    project: "Project",
    presentation: "Present",
    backPlan: "Back to plan",
    selected: "Inspector",
    houseTitle: "Find your home",
    houseIntro: "Choose a published design or create your own.",
    parcelTitle: "Your parcel",
    parcelIntro:
      "Find a Polish parcel, explore its surroundings, and check the sources.",
    gardenTitle: "Make room for life",
    gardenIntro: "Structures, planting, paths and outdoor spaces.",
    projectTitle: "Your project",
    projectIntro: "Saved locally. Export a backup or share the current layout.",
    presentationTitle: "Presentation",
    presentationIntro: "Prepare a display or manage private inquiries.",
    workspace: "Concept project",
    saved: "Saved on this device",
    share: "Share project",
    report: "Export report",
    inspect: "Selected object",
    help: "Drag to move · Scroll to zoom",
    advanced: "Advanced geometry",
    empty: "Select a building or garden object on the plan to edit it.",
    objects: "Objects in your project",
    library: "Library",
    close: "Close panel",
    draw: "Drawing settings",
    custom: "Create a custom house",
    clearance: "Placement checks",
  },
  pl: {
    layerplanning: "Miejscowe plany (MPZP)",
    layerutilities: "Sieci uzbrojenia terenu",
    layerenvironment: "Ochrona przyrody",
    layerflood: "Zagrożenie powodziowe",
    layergroundwater: "Podatność na podtopienia",
    layerrelief: "Rzeźba terenu",
    layerlandslides: "Osuwiska (SOPO)",
    layermining: "Górnictwo i złoża (MIDAS)",
    layerwells: "Otwory hydrogeologiczne (CBDH)",
    mapLayers: "Warstwy mapy",
    openMap: "Otwórz mapę działki",
    layerHint:
      "Włącz warstwy w widoku mapy. Pusta warstwa nie oznacza braku ryzyka lub sieci.",
    houses: "Domy",
    parcel: "Działka",
    garden: "Ogród",
    project: "Projekt",
    presentation: "Pokaz",
    backPlan: "Wróć do planu",
    selected: "Właściwości",
    houseTitle: "Wybierz swój dom",
    houseIntro: "Gotowy projekt z katalogu lub Twoja własna bryła.",
    parcelTitle: "Twoja działka",
    parcelIntro: "Znajdź działkę, poznaj otoczenie i sprawdź źródła danych.",
    gardenTitle: "Miejsce do życia",
    gardenIntro: "Mała architektura, zieleń, ścieżki i wypoczynek.",
    projectTitle: "Twój projekt",
    projectIntro: "Zapisany lokalnie. Pobierz kopię lub udostępnij układ.",
    presentationTitle: "Prezentacja",
    presentationIntro: "Przygotuj pokaz lub zarządzaj prywatnymi zapytaniami.",
    workspace: "Projekt koncepcyjny",
    saved: "Zapis na tym urządzeniu",
    share: "Udostępnij projekt",
    report: "Eksportuj raport",
    inspect: "Wybrany obiekt",
    help: "Przeciągnij, aby przesunąć · Przewiń, aby przybliżyć",
    advanced: "Zaawansowana geometria",
    empty: "Wybierz dom lub obiekt ogrodowy na planie, aby go edytować.",
    objects: "Obiekty w projekcie",
    library: "Biblioteka",
    close: "Zamknij panel",
    draw: "Ustawienia rysunku",
    custom: "Zaprojektuj własny dom",
    clearance: "Sprawdzenie ustawienia",
  },
};
const icons = {
  houses: '<path d="m3 10 9-7 9 7v11H3Z M9 21v-8h6v8"/>',
  parcel: '<path d="m3 5 7-2 5 4 6-2-1 15-9 1-8-5Z M10 3l1 18 M15 7l-1 13"/>',
  garden:
    '<path d="M12 21v-9 M12 15C3 15 3 5 3 5s9-1 9 10Zm0-5c0-7 8-7 8-7s1 8-8 9"/>',
  project: '<path d="M4 3h11l5 5v13H4Z M14 3v6h6 M8 13h8 M8 17h5"/>',
  presentation: '<path d="M3 4h18v12H3Z M12 16v5 M8 21h8 M8 8l3 3 5-4"/>',
  selected: '<path d="M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6"/>',
};
const icon = (key: keyof typeof icons) =>
  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[key]}</svg>`;
export function mountWorkspace({
  onTab,
  initialTab = "houses",
}: { onTab?: (tab: Tab) => void; initialTab?: Tab } = {}) {
  const app = document.querySelector<HTMLElement>(".app")!,
    rail = document.querySelector<HTMLElement>(".rail")!,
    brand = rail.querySelector<HTMLElement>(".brand")!,
    selection = document.querySelector<HTMLElement>("#sel")!;
  const lang = () => (document.documentElement.lang === "pl" ? "pl" : "en");
  let active: Tab = "houses";
  let mobileInspector = false;
  app.classList.add("workspace");
  const header = document.createElement("header");
  header.className = "workspace-header";
  header.innerHTML =
    '<div class="project-identity"><span class="project-eyebrow" data-ui="workspace"></span><span class="project-name" data-ui="saved"></span></div><div class="header-actions"></div>';
  header.prepend(brand);
  app.prepend(header);
  const actions = header.querySelector(".header-actions")!;
  actions.append(brand.querySelector(".lang")!);
  for (const [id, key] of [
    ["b-link", "share"],
    ["b-report", "report"],
  ]) {
    const button = document.getElementById(id)!;
    button.removeAttribute("data-t");
    button.dataset.ui = key;
    button.classList.add(
      id === "b-link" ? "primary-action" : "secondary-action",
    );
    actions.append(button);
  }
  const nav = document.createElement("nav");
  nav.className = "workspace-nav";
  nav.setAttribute("aria-label", "Workspace");
  for (const tab of [
    "houses",
    "parcel",
    "garden",
    "project",
    "presentation",
    "selected",
  ] as const) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.workspaceTab = tab;
    button.innerHTML = icon(tab) + `<span data-ui="${tab}"></span>`;
    button.onclick = () => {
      if (tab === "selected") {
        setInspector(!mobileInspector);
        return;
      }
      activate(tab);
    };
    nav.append(button);
  }
  app.append(nav);
  const intro = document.createElement("div");
  intro.className = "library-heading";
  intro.innerHTML =
    '<button class="library-close" aria-label="Close panel" type="button">×</button><span class="panel-eyebrow" data-ui="library"></span><h2></h2><p></p>';
  rail.prepend(intro);
  intro.querySelector("button")!.onclick = () => {
    app.classList.add("library-collapsed");
    updateNav();
    window.dispatchEvent(new Event("resize"));
  };
  const panelContent = document.createElement("div");
  panelContent.className = "library-content";
  rail.append(panelContent);
  const panels = {} as Record<Tab, HTMLElement>;
  for (const tab of [
    "houses",
    "parcel",
    "garden",
    "project",
    "presentation",
  ] as const) {
    const panel = document.createElement("div");
    panel.className = "workspace-panel";
    panel.dataset.panel = tab;
    panels[tab] = panel;
    panelContent.append(panel);
  }
  const addSection = document.getElementById("add-house")!.closest("section")!,
    objectSection = document.getElementById("objs")!.closest("section")!,
    parcelSection = document.getElementById("p-area")!.closest("section")!,
    drawSection = document.getElementById("o-snap")!.closest("section")!,
    saveSection = document.getElementById("b-download")!.closest("section")!;
  const catalog = document.getElementById("catalog-options")!;
  catalog.setAttribute("open", "");
  panels.houses.append(catalog, addSection, objectSection);
  addSection.classList.add("custom-house-tools");
  const move = (selector: string, tab: Tab) => {
    const e = document.querySelector<HTMLElement>(selector);
    if (e) panels[tab].append(e);
  };
  const mapLayers = document.createElement("section");
  mapLayers.className = "map-layer-list";
  mapLayers.innerHTML =
    '<h3 data-ui="mapLayers"></h3><button class="map-entry" type="button" data-ui="openMap"></button><p data-ui="layerHint"></p>';
  for (const checkbox of document.querySelectorAll("#map-controls label.check"))
    mapLayers.append(checkbox);
  mapLayers.querySelector("button")!.onclick = () =>
    document.getElementById("view-map")!.click();
  panels.parcel.append(mapLayers, parcelSection);
  for (const selector of [
    "#terrain-sample",
    "#topology-json",
    "#source-directory",
  ]) {
    const e = document.querySelector(selector)?.closest("details");
    if (e) panels.parcel.append(e);
  }
  for (const selector of ["#garden-kind", "#fence-type", "#env-season"]) {
    const e = document.querySelector(selector)?.closest("details");
    if (e) {
      panels.garden.append(e);
      if (selector === "#garden-kind") e.open = true;
    }
  }
  panels.project.append(saveSection, drawSection);
  move(".foot", "project");
  move("#showroom-host", "presentation");
  move("#business-host", "presentation");
  const inspector = document.createElement("aside");
  inspector.className = "inspector";
  inspector.setAttribute("aria-label", "Object inspector");
  inspector.innerHTML =
    '<div class="inspector-heading"><span class="panel-eyebrow" data-ui="inspect"></span><button type="button" class="inspector-close" data-ui="backPlan"></button></div>';
  inspector.querySelector("button")!.onclick = () => setInspector(false);
  inspector.append(selection);
  const placement = document
    .querySelector("#placement-analyze")
    ?.closest("details");
  if (placement) inspector.append(placement);
  app.append(inspector);
  const warning = document.getElementById("project-warning");
  if (warning) header.after(warning);
  const stage = document.querySelector(".stage")!,
    canvasHint = document.createElement("div");
  canvasHint.className = "canvas-hint";
  canvasHint.dataset.ui = "help";
  stage.append(canvasHint);
  document.addEventListener("click", (e) => {
    if (
      matchMedia("(max-width:760px)").matches &&
      (e.target as Element)?.closest?.(".view-switch")
    )
      app.classList.add("library-collapsed");
    if (
      matchMedia("(max-width:1000px)").matches &&
      (e.target as Element)?.closest?.(
        ".bld,.obj,.catalog-place,.catalog-add,#garden-add,#add-house,#add-garage",
      )
    ) {
      setInspector(true);
    }
  });
  rail.setAttribute("aria-label", "Object library");
  document.documentElement.dataset.theme = "light";
  const localize = () => {
    const l = copy[lang()];
    app.querySelectorAll<HTMLElement>("[data-ui]").forEach((e) => {
      const key = e.dataset.ui as keyof typeof l;
      if (l[key]) e.textContent = l[key];
    });
    intro.querySelector("h2")!.textContent =
      l[
        (
          {
            houses: "houseTitle",
            parcel: "parcelTitle",
            garden: "gardenTitle",
            project: "projectTitle",
            presentation: "presentationTitle",
          } as const
        )[active]
      ];
    intro.querySelector("p")!.textContent =
      l[
        (
          {
            houses: "houseIntro",
            parcel: "parcelIntro",
            garden: "gardenIntro",
            project: "projectIntro",
            presentation: "presentationIntro",
          } as const
        )[active]
      ];
  };
  function updateNav() {
    nav
      .querySelectorAll<HTMLButtonElement>("button")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(
            mobileInspector
              ? button.dataset.workspaceTab === "selected"
              : !app.classList.contains("library-collapsed") &&
                  button.dataset.workspaceTab === active,
          ),
        ),
      );
  }
  function setInspector(open: boolean) {
    mobileInspector = open;
    app.classList.toggle("mobile-inspector", open);
    if (!open) app.classList.add("library-collapsed");
    updateNav();
    if (open)
      requestAnimationFrame(() =>
        inspector
          .querySelector<HTMLButtonElement>(".inspector-close")
          ?.focus({ preventScroll: true }),
      );
  }
  function activate(tab: Tab) {
    active = tab;
    app.classList.remove("library-collapsed");
    app.classList.remove("mobile-inspector");
    mobileInspector = false;
    for (const [name, panel] of Object.entries(panels))
      panel.hidden = name !== tab;
    updateNav();
    rail.scrollTop = 0;
    localize();
    onTab?.(tab);
  }
  const observer = new MutationObserver(() => localize());
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
  document
    .getElementById("view-map")!
    .addEventListener("click", () => activate("parcel"));
  activate(initialTab);
  window.dispatchEvent(new Event("resize"));
  return {
    activate,
    destroy() {
      observer.disconnect();
    },
  };
}
