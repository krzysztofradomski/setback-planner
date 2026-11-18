import { parcelArea } from "./core/topology.ts";
import type { Scene } from "./core/scene.ts";
import type { parseUldkResponse } from "./core/uldk.ts";
type Parcel = ReturnType<typeof parseUldkResponse>;
type Tab = "houses" | "parcel" | "garden" | "project" | "presentation";
type Topic = "planning" | "water" | "utilities" | "nature" | "ground";
interface Options {
  container: HTMLElement;
  stage: HTMLElement;
  fresh: boolean;
  language: () => "en" | "pl";
  getScene: () => Scene;
  lookupId: (id: string) => Promise<Parcel>;
  lookupAt: (longitude: number, latitude: number) => Promise<Parcel>;
  showMap: (point?: {
    longitude: number;
    latitude: number;
    label: string;
  }) => Promise<void>;
  showPreview: (parcel: Parcel | null) => void;
  applyParcel: (parcel: Parcel) => void;
  onIntroEnd: () => void;
  onExploreExample: () => void;
  activate: (tab: Tab) => void;
  pickMap: () => void;
  stopPicking: () => void;
  showTopic: (topic: Topic) => Promise<void>;
  reviewLayout: () => void;
}
const words = {
  en: {
    title: "Start with your parcel",
    intro: "Find its boundary, choose a house, then review your layout.",
    address: "Address or place",
    id: "Parcel identifier",
    addressLabel: "Town, street and house number",
    idLabel: "Full cadastral parcel identifier",
    placeholder: "e.g. Marki, Andersa 1",
    idPlaceholder: "e.g. 141201_1.0001.6509",
    search: "Find parcel",
    pick: "Choose on map",
    gps: "Use my location",
    example: "Explore the example project",
    examples: "Try an example",
    privacy:
      "Your query is sent to GUGiK only when you search. Location access is optional.",
    finding: "Finding matching locations in GUGiK…",
    boundary: "Retrieving the parcel boundary from GUGiK…",
    pickHint:
      "Click the parcel you want on the map. You will confirm its boundary before changing your project.",
    addressHint:
      "We picked the parcel at this address. If it is not yours, click your parcel on the map.",
    results: "Choose the right location",
    empty:
      "No matching locations. Add a town and street, or choose directly on the map.",
    failed:
      "The public search service did not return a result. Try again or choose on the map. Your project is unchanged.",
    shortId:
      "A local parcel number is not unique. Enter its full identifier, or search the town and select the parcel on the map.",
    confirm: "Is this the right parcel?",
    use: "Use this parcel",
    another: "Choose another",
    preserve:
      "Nothing changes until you confirm. Your buildings will then move into the free space on this parcel.",
    changed:
      "Your project changed while searching. Search again to preview the latest version.",
    source: "Boundary source",
    known: "Parcel selected",
    chooseHouse: "Choose a house",
    change: "Change parcel",
    location: "Finding your location…",
    gpsError:
      "Location is unavailable. Search an address or choose on the map instead.",
    gpsHint:
      "Location found. Click the parcel boundary to confirm it. GPS accuracy is approximate.",
    next: "Next: review your layout",
    review: "Review layout & surroundings",
    overview: "What to check next",
    overviewText:
      "Review the geometric layout and open the relevant official maps. Viewing a layer is not a verified finding.",
    planning: "Planning rules",
    water: "Flood & groundwater",
    utilities: "Utilities",
    nature: "Protected nature",
    ground: "Ground conditions",
    openMap: "Open map",
    step1: "Find parcel",
    step2: "Choose house",
    step3: "Review layout",
    continue: "Continue planning",
    found: "Location found",
    summary: "Current parcel",
    exampleBadge: "Example project · not your parcel",
    back: "Back to search",
    close: "Close introduction",
    placeHint: "This pin marks the town or street, not a confirmed parcel. Click your parcel on the map.",
    drawingHouse: "House",
    drawingFits: "Fits within a 4 m setback",
  },
  pl: {
    title: "Zacznij od swojej działki",
    intro: "Znajdź granicę, wybierz dom i sprawdź swój układ.",
    address: "Adres lub miejscowość",
    id: "Identyfikator działki",
    addressLabel: "Miejscowość, ulica i numer domu",
    idLabel: "Pełny identyfikator ewidencyjny działki",
    placeholder: "np. Marki, Andersa 1",
    idPlaceholder: "np. 141201_1.0001.6509",
    search: "Znajdź działkę",
    pick: "Wybierz na mapie",
    gps: "Użyj mojej lokalizacji",
    example: "Poznaj przykładowy projekt",
    examples: "Wypróbuj przykład",
    privacy:
      "Zapytanie trafia do GUGiK dopiero po wyszukaniu. Lokalizacja jest opcjonalna.",
    finding: "Szukamy pasujących lokalizacji w GUGiK…",
    boundary: "Pobieramy granicę działki z GUGiK…",
    pickHint:
      "Kliknij właściwą działkę na mapie. Potwierdzisz jej granicę przed zmianą projektu.",
    addressHint:
      "Zaznaczyliśmy działkę pod tym adresem. Jeśli to nie Twoja, kliknij swoją działkę na mapie.",
    results: "Wybierz właściwą lokalizację",
    empty:
      "Nie znaleziono lokalizacji. Dopisz miejscowość i ulicę lub wybierz działkę na mapie.",
    failed:
      "Usługa publiczna nie zwróciła wyniku. Spróbuj ponownie lub wybierz na mapie. Twój projekt pozostał bez zmian.",
    shortId:
      "Lokalny numer działki nie jest unikalny. Wpisz pełny identyfikator lub wyszukaj miejscowość i wybierz działkę na mapie.",
    confirm: "Czy to właściwa działka?",
    use: "Użyj tej działki",
    another: "Wybierz inną",
    preserve:
      "Nic się nie zmieni przed potwierdzeniem. Potem Twoje budynki przeniosą się w wolne miejsce na tej działce.",
    changed:
      "Projekt zmienił się podczas wyszukiwania. Wyszukaj ponownie, aby zobaczyć aktualny podgląd.",
    source: "Źródło granicy",
    known: "Wybrano działkę",
    chooseHouse: "Wybierz dom",
    change: "Zmień działkę",
    location: "Ustalamy Twoją lokalizację…",
    gpsError:
      "Lokalizacja jest niedostępna. Wpisz adres lub wybierz działkę na mapie.",
    gpsHint:
      "Znaleziono lokalizację. Kliknij działkę, aby ją potwierdzić. Dokładność GPS jest przybliżona.",
    next: "Dalej: sprawdź swój układ",
    review: "Układ i otoczenie działki",
    overview: "Co warto sprawdzić",
    overviewText:
      "Sprawdź geometrię układu i otwórz odpowiednie mapy urzędowe. Samo wyświetlenie warstwy nie jest potwierdzonym ustaleniem.",
    planning: "Zasady zabudowy",
    water: "Powódź i podtopienia",
    utilities: "Uzbrojenie terenu",
    nature: "Ochrona przyrody",
    ground: "Warunki gruntowe",
    openMap: "Otwórz mapę",
    step1: "Znajdź działkę",
    step2: "Wybierz dom",
    step3: "Sprawdź układ",
    continue: "Kontynuuj planowanie",
    found: "Znaleziono lokalizację",
    summary: "Twoja działka",
    exampleBadge: "Projekt przykładowy · to nie Twoja działka",
    back: "Wróć do wyszukiwania",
    close: "Zamknij wprowadzenie",
    placeHint: "Pinezka wskazuje miejscowość lub ulicę, a nie potwierdzoną działkę. Kliknij swoją działkę na mapie.",
    drawingHouse: "Dom",
    drawingFits: "Mieści się w odstępie 4 m",
  },
};
export function mountParcelJourney(o: Options) {
  const app = document.querySelector<HTMLElement>(".app")!,
    root = document.createElement("section");
  root.className = "parcel-journey";
  root.id = "parcel-journey";
  let mode: "address" | "id" = "address",
    revision = 0,
    abort: AbortController | null = null,
    candidate: Parcel | null = null,
    baseline = "",
    picking = false,
    intro = o.fresh;
  const w = () => words[o.language()];
  const welcome = document.createElement("div");
  welcome.className = "journey-welcome";
  welcome.innerHTML =
    '<div class="welcome-copy"><h2></h2><p></p></div><div class="welcome-form"></div><ol class="welcome-explanation"></ol>' +
    // Illustrative site plan, drawn flat (2D) and then tilted into 3D while the house and garage rise from their footprints.
    '<figure class="welcome-drawing" aria-hidden="true"><div class="wd-world"><svg viewBox="0 0 600 440" width="600" height="440">' +
    '<path class="wd-plot" d="M70 60 L520 40 L560 390 L40 400 Z"/>' +
    '<path class="wd-setback" d="M106 95 L487 78 L521 357 L76 365 Z"/>' +
    '<g class="wd-build"><rect class="wd-house" x="170" y="130" width="230" height="150"/><text class="wd-label" x="285" y="200" text-anchor="middle" data-wd="house"></text><text class="wd-size" x="285" y="220" text-anchor="middle">12 × 8 m</text></g>' +
    '<g class="wd-build"><rect class="wd-garage" x="404" y="268" width="84" height="70"/><text class="wd-size" x="446" y="308" text-anchor="middle">6 × 5 m</text></g>' +
    '<g class="wd-measure"><path class="wd-dim" d="M57 205 H170 M57 198 v14 M170 198 v14"/><text class="wd-dim-t" x="113" y="196" text-anchor="middle">6,30 m</text>' +
    '<path class="wd-dim" d="M285 50 V130 M278 50 h14 M278 130 h14"/><text class="wd-dim-t" x="296" y="95">4,10 m</text></g>' +
    '<g><circle class="wd-corner" cx="70" cy="60" r="6"/><circle class="wd-corner" cx="520" cy="40" r="6"/><circle class="wd-corner" cx="560" cy="390" r="6"/><circle class="wd-corner" cx="40" cy="400" r="6"/>' +
    '<text class="wd-corner-t" x="56" y="48">A</text><text class="wd-corner-t" x="530" y="30">B</text><text class="wd-corner-t" x="572" y="404">C</text><text class="wd-corner-t" x="20" y="418">D</text></g>' +
    '<g class="wd-badge"><rect x="150" y="300" width="234" height="34" rx="17"/><circle cx="170" cy="317" r="6"/><text x="184" y="322" data-wd="fits"></text></g>' +
    "</svg>" +
    // Boxes in CSS 3D: --w/--d footprint, --h wall height, --r ridge height (0 = flat roof).
    '<div class="wd-box wd-house3d" style="left:170px;top:130px;--w:230px;--d:150px;--h:64px;--r:44px;--L:87px;--p:30.4deg"><i class="wf"></i><i class="wb"></i><i class="wl"></i><i class="wr"></i><i class="rf"></i><i class="rb"></i></div>' +
    '<div class="wd-box wd-garage3d" style="left:404px;top:268px;--w:84px;--d:70px;--h:38px;--r:0px"><i class="wf"></i><i class="wb"></i><i class="wl"></i><i class="wr"></i><i class="rt"></i></div>' +
    "</div></figure>";
  o.stage.append(welcome);
  // The scene is laid out at 600 × 440 px; scale it to the figure, whatever shape the banner has.
  const figure = welcome.querySelector<HTMLElement>(".welcome-drawing")!;
  new ResizeObserver(() =>
    figure.style.setProperty("--s", String(0.9 * Math.min(figure.clientWidth / 640, figure.clientHeight / 470))),
  ).observe(figure);
  o.container.prepend(root);
  const summary = document.createElement("section");
  summary.className = "journey-parcel-summary";
  o.container.prepend(summary);
  const topics = document.createElement("section");
  topics.className = "journey-topics";
  o.container.append(topics);
  const next = document.createElement("button");
  next.type = "button";
  next.className = "journey-next";
  document.querySelector("[data-panel=houses]")?.prepend(next);
  next.onclick = () => review();
  const inspectorNext = document.createElement("button");
  inspectorNext.type = "button";
  inspectorNext.className = "journey-inspector-next";
  inspectorNext.onclick = review;
  document.querySelector(".inspector-heading")?.after(inspectorNext);
  function leaveIntro() {
    intro = false;
    o.onIntroEnd();
    welcome.hidden = true;
    app.classList.remove("journey-intro");
    for (const id of ["b-link", "b-report"])
      (document.getElementById(id) as HTMLButtonElement).disabled = false;
    o.container.prepend(root);
  }
  function enterSearch() {
    leaveIntro();
    cancel();
    root.hidden = false;
    o.activate("parcel");
    root.querySelector<HTMLInputElement>("input")?.focus();
  }
  function review() {
    leaveIntro();
    cancel();
    o.activate("project");
    o.reviewLayout();
    document
      .querySelector("#review-layout")
      ?.scrollIntoView({ block: "start" });
  }
  function status(message: string, error = false) {
    const e = root.querySelector<HTMLElement>(".journey-status")!;
    e.textContent = message;
    e.classList.toggle("error", error);
    e.setAttribute("role", error ? "alert" : "status");
  }
  function setBusy(value: boolean) {
    root.setAttribute("aria-busy", String(value));
    root
      .querySelectorAll<HTMLButtonElement>("[data-search], [data-gps]")
      .forEach((e) => (e.disabled = value));
  }
  function cancel() {
    revision++;
    abort?.abort();
    abort = null;
    candidate = null;
    picking = false;
    o.stopPicking();
    o.showPreview(null);
    root.querySelector(".journey-preview")?.remove();
    root.classList.remove("previewing");
    setBusy(false);
  }
  function render() {
    const l = w();
    root.innerHTML = `<div class="journey-search-heading"><span>${l.step1}</span><h3>${l.title}</h3></div><div class="search-modes" role="group" aria-label="${l.search}"><button type="button" data-mode="address" aria-pressed="${mode === "address"}">${l.address}</button><button type="button" data-mode="id" aria-pressed="${mode === "id"}">${l.id}</button></div><form class="parcel-search-form"><label for="journey-query">${mode === "address" ? l.addressLabel : l.idLabel}</label><div class="search-field"><input id="journey-query" type="search" autocomplete="off" maxlength="180" placeholder="${mode === "address" ? l.placeholder : l.idPlaceholder}" required minlength="3"><button type="submit" data-search>${l.search} →</button></div></form><div class="journey-example">${l.examples}: <button type="button" data-example>Marki, Andersa 1</button></div><div class="journey-search-options"><button type="button" data-pick>⌖ ${l.pick}</button><button type="button" data-gps>◎ ${l.gps}</button></div><p class="journey-status" role="status" aria-live="polite"></p><div class="journey-results"></div><p class="journey-privacy">${l.privacy}</p><button type="button" class="journey-explore" data-explore>${l.example} ↗</button>`;
    root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach(
      (b) =>
        (b.onclick = () => {
          cancel();
          mode = b.dataset.mode as typeof mode;
          render();
          root.querySelector("input")!.focus();
        }),
    );
    root.querySelector("form")!.onsubmit = (e) => {
      e.preventDefault();
      void search();
    };
    root.querySelector<HTMLButtonElement>("[data-example]")!.onclick = () => {
      root.querySelector<HTMLInputElement>("input")!.value = "Marki, Andersa 1";
      void search();
    };
    root.querySelector<HTMLButtonElement>("[data-pick]")!.onclick = () =>
      void chooseMap();
    root.querySelector<HTMLButtonElement>("[data-gps]")!.onclick = () =>
      void locate();
    root.querySelector<HTMLButtonElement>("[data-explore]")!.onclick = () => {
      o.onExploreExample();
      try {
        sessionStorage.setItem("setback-entry-dismissed", "1");
      } catch {
        /* Session storage can be disabled. */
      }
      leaveIntro();
      cancel();
      root.hidden = false;
      o.activate("houses");
    };
    welcome.querySelector("h2")!.textContent = l.title;
    welcome.querySelector("p")!.textContent = l.intro;
    welcome.querySelector("ol")!.replaceChildren(
      ...[l.step1, l.step2, l.step3].map((text, i) => {
        const li = document.createElement("li"),
          n = document.createElement("b");
        n.textContent = String(i + 1);
        li.append(n, text);
        return li;
      }),
    );
    welcome.querySelector('[data-wd="house"]')!.textContent = l.drawingHouse;
    welcome.querySelector('[data-wd="fits"]')!.textContent = l.drawingFits;
    next.textContent = l.next;
    inspectorNext.textContent = l.next;
    renderSummary();
    renderTopics();
  }
  async function search() {
    const query = root.querySelector<HTMLInputElement>("input")!.value.trim();
    if (query.length < 3) return;
    cancel();
    const ticket = revision;
    baseline = JSON.stringify(o.getScene());
    setBusy(true);
    status(mode === "id" ? w().boundary : w().finding);
    try {
      if (/^\d+(?:\/\d+)?$/.test(query)) {
        status(w().shortId, true);
        return;
      }
      if (mode === "id" || /^\d{6}_\d\./.test(query)) {
        if (!/^\d{6}_\d\./.test(query)) {
          status(w().shortId, true);
          return;
        }
        const parcel = await o.lookupId(query);
        if (ticket !== revision) return;
        await preview(parcel, ticket);
      } else {
        abort = new AbortController();
        const { searchLocations } = await import("./core/address-search.ts");
        const locations = await searchLocations(query, fetch, abort.signal);
        if (ticket !== revision) return;
        const list = root.querySelector(".journey-results")!;
        list.replaceChildren();
        status(locations.length ? w().results : w().empty, !locations.length);
        if (locations.length === 1 && locations[0].kind === "address") {
          void chooseMap(locations[0]);
          return;
        }
        for (const location of locations) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "journey-location";
          const name = document.createElement("span"),
            provider = document.createElement("small");
          name.textContent = location.label;
          provider.textContent = "GUGiK · " + w().openMap;
          b.append(name, provider);
          b.onclick = () => void chooseMap(location);
          list.append(b);
        }
      }
    } catch {
      if (ticket === revision) status(w().failed, true);
    } finally {
      if (ticket === revision) setBusy(false);
    }
  }
  async function chooseMap(point?: {
    longitude: number;
    latitude: number;
    label: string;
    kind?: "address" | "street" | "locality";
  }) {
    leaveIntro();
    app.classList.add("journey-discovery");
    cancel();
    o.activate("parcel");
    try {
      await o.showMap(point);
      picking = true;
      o.pickMap();
      // An exact address or GPS point usually sits on the right parcel: preview it straight away; the map stays
      // clickable. Towns and streets only centre the map.
      const exact = !!point && (!point.kind || point.kind === "address");
      status(exact ? w().addressHint : point ? w().placeHint : w().pickHint);
      if (exact) void previewAt(point.longitude, point.latitude);
    } catch {
      status(w().failed, true);
    }
  }
  async function locate() {
    if (!navigator.geolocation) {
      status(w().gpsError, true);
      return;
    }
    cancel();
    const ticket = revision;
    status(w().location);
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (ticket !== revision) return;
        setBusy(false);
        const { longitude, latitude } = position.coords;
        if (
          longitude < 13 ||
          longitude > 25 ||
          latitude < 48 ||
          latitude > 56
        ) {
          status(w().gpsError, true);
          return;
        }
        void chooseMap({ longitude, latitude, label: w().found }).then(() =>
          status(w().gpsHint),
        );
      },
      () => {
        if (ticket === revision) {
          status(w().gpsError, true);
          setBusy(false);
        }
      },
      { timeout: 12000, maximumAge: 60000, enableHighAccuracy: true },
    );
  }
  async function preview(parcel: Parcel, ticket: number) {
    if (ticket !== revision) return;
    if (JSON.stringify(o.getScene()) !== baseline) {
      status(w().changed, true);
      return;
    }
    leaveIntro();
    o.activate("parcel");
    await o.showMap();
    if (ticket !== revision) return;
    candidate = parcel;
    picking = true;
    o.pickMap();
    app.classList.add("journey-discovery");
    o.showPreview(parcel);
    root.querySelector(".journey-results")!.replaceChildren();
    root.querySelector(".journey-preview")?.remove();
    const l = w(),
      card = document.createElement("article");
    card.className = "journey-preview";
    const identifier = parcel.parcel.identifier ?? "",
      area = parcelArea({ ...o.getScene(), ...parcel });
    card.innerHTML = `<span class="journey-eyebrow">${l.confirm}</span><h3></h3><strong>${new Intl.NumberFormat(o.language(), { maximumFractionDigits: 0 }).format(area)} m²</strong><small>${l.source}: GUGiK ULDK</small><button type="button" data-confirm>${l.use} →</button><button type="button" data-another>${l.another}</button><p>${l.preserve}</p>`;
    card.querySelector("h3")!.textContent = identifier;
    root.append(card);
    root.classList.add("previewing");
    requestAnimationFrame(() => {
      root.closest<HTMLElement>(".rail")?.scrollTo({ top: 0 });
      card
        .querySelector<HTMLButtonElement>("[data-confirm]")
        ?.focus({ preventScroll: true });
    });
    status(l.confirm);
    card.querySelector<HTMLButtonElement>("[data-confirm]")!.onclick = () => {
      if (!candidate) return;
      if (JSON.stringify(o.getScene()) !== baseline) {
        status(w().changed, true);
        return;
      }
      const accepted = candidate;
      cancel();
      o.applyParcel(accepted);
      root.hidden = true;
      renderSummary();
      o.activate("houses");
    };
    card.querySelector<HTMLButtonElement>("[data-another]")!.onclick = () => {
      cancel();
      status(w().pickHint);
      picking = true;
      o.pickMap();
    };
  }
  async function previewAt(longitude: number, latitude: number) {
    if (!picking) return;
    const ticket = ++revision;
    abort?.abort();
    candidate = null;
    root.classList.remove("previewing");
    root.querySelector(".journey-preview")?.remove();
    baseline = JSON.stringify(o.getScene());
    status(w().boundary);
    setBusy(true);
    try {
      const parcel = await o.lookupAt(longitude, latitude);
      await preview(parcel, ticket);
    } catch {
      if (ticket === revision) status(w().failed, true);
    } finally {
      if (ticket === revision) setBusy(false);
    }
  }
  function renderSummary() {
    const scene = o.getScene(),
      l = w();
    summary.replaceChildren();
    if (!scene.parcel) return;
    const label = document.createElement("span"),
      id = document.createElement("strong"),
      area = document.createElement("p"),
      change = document.createElement("button"),
      house = document.createElement("button");
    label.textContent = l.summary;
    id.textContent = scene.parcel.identifier ?? scene.parcel.source.name;
    area.textContent =
      new Intl.NumberFormat(o.language(), { maximumFractionDigits: 0 }).format(
        parcelArea(scene),
      ) +
      " m² · " +
      scene.parcel.source.name;
    change.type = house.type = "button";
    change.textContent = l.change;
    house.textContent = l.chooseHouse + " →";
    change.onclick = enterSearch;
    house.onclick = () => {
      o.activate("houses");
    };
    summary.append(label, id, area, house, change);
  }
  function renderTopics() {
    const l = w();
    topics.replaceChildren();
    const heading = document.createElement("h3"),
      hint = document.createElement("p");
    heading.textContent = l.overview;
    hint.textContent = l.overviewText;
    topics.append(heading, hint);
    for (const id of [
      "planning",
      "water",
      "utilities",
      "nature",
      "ground",
    ] as const) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = l[id] + " ↗";
      b.onclick = () => {
        leaveIntro();
        void o.showTopic(id).catch(() => status(w().failed, true));
      };
      topics.append(b);
    }
  }
  function tabChanged(tab: Tab) {
    if (tab !== "parcel") app.classList.remove("journey-discovery");
    else if (picking || candidate) app.classList.add("journey-discovery");
    if (intro && tab !== "parcel") {
      o.onExploreExample();
      leaveIntro();
    }
  }
  function refresh() {
    renderSummary();
    if (!o.getScene().parcel && !intro && !candidate) root.hidden = false;
    next.hidden = !o.getScene().items.length;
    inspectorNext.hidden = next.hidden;
    if (candidate && JSON.stringify(o.getScene()) !== baseline) {
      root
        .querySelector<HTMLButtonElement>("[data-confirm]")
        ?.setAttribute("disabled", "");
      status(w().changed, true);
    }
  }
  const langObserver = new MutationObserver(() => {
    const query = root.querySelector<HTMLInputElement>("input")?.value ?? "";
    cancel();
    render();
    root.querySelector<HTMLInputElement>("input")!.value = query;
  });
  langObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
  render();
  for (const id of ["b-link", "b-report"])
    (document.getElementById(id) as HTMLButtonElement).disabled = intro;
  if (intro) {
    app.classList.add("journey-intro");
    welcome.hidden = false;
    welcome.querySelector(".welcome-form")!.append(root);
  } else {
    welcome.hidden = true;
    root.hidden = !!o.getScene().parcel;
  }
  return {
    previewAt,
    beginMapPick: () => chooseMap(),
    stopSelection: () => {
      picking = false;
      o.stopPicking();
    },
    isPicking: () => picking,
    refresh,
    tabChanged,
    destroy() {
      cancel();
      langObserver.disconnect();
      root.remove();
      welcome.remove();
      topics.remove();
      summary.remove();
      next.remove();
      inspectorNext.remove();
    },
  };
}
