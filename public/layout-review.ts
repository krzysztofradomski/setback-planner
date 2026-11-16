import type { Scene } from "./core/scene.ts";
import { parcelArea } from "./core/topology.ts";
import { worldFootprint } from "./core/footprints.ts";
import { polygonArea } from "./core/geometry.ts";
type Check = {
  id: string;
  inside: boolean;
  overlap: boolean;
  warn: boolean;
  sides: { warn: boolean; t: number | null }[];
};
const requests = new WeakMap<HTMLElement, number>();
export function renderLayoutReview(
  container: HTMLElement,
  {
    scene,
    language,
    checks,
    selectedId,
    onShowPlan,
    onReport,
    onSources,
  }: {
    scene: Scene;
    language: "en" | "pl";
    checks: Check[];
    selectedId: string | null;
    onShowPlan: (id?: string) => void;
    onReport: () => void;
    onSources: () => void;
  },
) {
  const pl = language === "pl",
    request = (requests.get(container) ?? 0) + 1;
  requests.set(container, request);
  container.replaceChildren();
  const text = (
    tag: string,
    value: string,
    parent: HTMLElement = container,
  ) => {
    const e = document.createElement(tag);
    e.textContent = value;
    parent.append(e);
    return e;
  };
  const action = (
    value: string,
    run: () => void,
    parent: HTMLElement = container,
  ) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = value;
    b.onclick = run;
    parent.append(b);
    return b;
  };
  text("h3", pl ? "Sprawdź swój układ" : "Review your layout");
  const warnings = checks.filter((c) => c.warn),
    title = !scene.items.length
      ? pl
        ? "Zacznij od wyboru domu"
        : "Start by choosing a house"
      : warnings.length
        ? pl
          ? `${warnings.length} obiektów wymaga sprawdzenia`
          : `${warnings.length} objects need attention`
        : pl
          ? "Geometria spełnia wybrane odległości"
          : "Geometry meets your selected setbacks";
  text("p", title).className = warnings.length
    ? "review-warning"
    : "review-result";
  if (!scene.parcel)
    text(
      "p",
      pl
        ? "To granica lokalna lub przykładowa. Potwierdź swoją działkę, zanim wykorzystasz ten układ."
        : "This is a local or example boundary. Confirm your parcel before relying on this layout.",
    ).className = "review-warning";
  const metrics = document.createElement("div");
  metrics.className = "review-metrics";
  container.append(metrics);
  const metric = (label: string, value: string) => {
    const box = document.createElement("div");
    metrics.append(box);
    text("small", label, box);
    return text("b", value, box);
  };
  const format = (n: number) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(n);
  metric(pl ? "Działka" : "Parcel", format(parcelArea(scene)) + " m²");
  metric(
    pl ? "Obrysy budynków" : "Building footprints",
    format(
      scene.items
        .filter((i) => i.type !== "landscape")
        .reduce((n, i) => n + polygonArea(worldFootprint(i)), 0),
    ) + " m²",
  );
  const house =
    scene.items.find((i) => i.id === selectedId && i.type === "house") ??
    scene.items.find((i) => i.type === "house");
  if (house) {
    const area = metric(
        pl
          ? `Obszar po odsunięciu o ${house.setback} m`
          : `Region inside ${house.setback} m edge offset`,
        "…",
      ),
      snapshot = structuredClone(scene);
    void import("./core/placement.ts")
      .then(({ setbackArea }) => {
        if (requests.get(container) !== request) return;
        area.textContent =
          format(setbackArea(snapshot, house.setback).area) + " m²";
      })
      .catch(() => {
        if (requests.get(container) === request)
          area.textContent = pl ? "Brak wyniku" : "Unavailable";
      });
  }
  metric(
    pl ? "Obiekty do sprawdzenia" : "Objects to check",
    String(warnings.length),
  );
  for (const check of warnings) {
    const item = scene.items.find((i) => i.id === check.id);
    if (!item) continue;
    const row = document.createElement("div");
    row.className = "review-issue";
    const reasons = [
      !check.inside ? (pl ? "poza granicą działki" : "outside parcel") : null,
      check.overlap
        ? pl
          ? "kolizja z innym obiektem"
          : "overlaps another object"
        : null,
      check.sides.some((s) => s.warn)
        ? pl
          ? `bliżej granicy niż ${item.setback} m`
          : `closer than ${item.setback} m to boundary`
        : null,
    ].filter(Boolean);
    text("strong", item.name, row);
    text("p", reasons.join(" · "), row);
    action(
      pl ? "Pokaż na planie →" : "Show on plan →",
      () => onShowPlan(item.id),
      row,
    );
    container.append(row);
  }
  text(
    "p",
    pl
      ? "Obliczenia geometryczne korzystają z Twoich ustawień odległości, a nie z potwierdzonych przepisów. Obszar po odsunięciu granic nie uwzględnia innych budynków ani ograniczeń MPZP."
      : "Geometry uses your selected setbacks. The edge-offset region does not subtract other buildings or establish planning/legal feasibility.",
  );
  text(
    "p",
    pl
      ? "Warunki zabudowy, ryzyka i warunki gruntu sprawdź w źródłach. Samo wyświetlenie mapy nie jest potwierdzonym ustaleniem."
      : "Planning rules and site conditions still require verification in their sources. Opening a map is not a verified finding.",
  );
  action(
    scene.items.length
      ? pl
        ? "Pokaż cały układ →"
        : "Show full layout →"
      : pl
        ? "Wybierz dom →"
        : "Choose a house →",
    () => onShowPlan(),
  ).className = "review-action";
  const report = action(
    pl ? "Otwórz raport projektu" : "Open project report",
    onReport,
  );
  report.id = "review-report";
  const sources = action(
    pl ? "Sprawdź mapy otoczenia" : "Review surrounding maps",
    onSources,
  );
  sources.id = "review-surroundings";
}
