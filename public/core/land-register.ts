// Land and mortgage register (księga wieczysta) entries pasted by the user from the court's EKW browser.
// The page is behind a CAPTCHA, so the user opens it and copies sections III and IV; nothing is fetched here.
// Section II (owners) is deliberately not collected: names would travel in share links.

export const EKW_SEARCH = 'https://przegladarka-ekw.ms.gov.pl/eukw_prz/KsiegiWieczyste/wyszukiwanieKW';

/** Register number in the court format: 4-character court code / 8 digits / check digit, e.g. WA1G/00012345/6. */
export function kwNumber(input: string) {
  const n = input.trim().toUpperCase().replace(/\s+/g, '');
  const ok = /^[A-Z0-9]{4}\/\d{8}\/\d$/.test(n);
  return { number: n, ok };
}

export interface RegisterFindings {
  /** Section III: rights and claims burdening the land (kind, as named in the entry). */
  burdens: string[];
  /** Section III has the court's "no entries" wording. */
  section3Empty: boolean;
  /** Section IV: mortgages, with the amounts written in the entries. */
  mortgages: string[];
  mortgage: boolean;
  section4Empty: boolean;
}

// Section and rubric headings ("Dział III - Prawa, roszczenia i ograniczenia", "Rubryka 3.4 - Prawa osobiste i roszczenia") print
// even when empty: drop them, keep the entries.
const norm = (s: string) => s.split('\n').map(l => l.replace(/^\s*(dział\s+[IV]+(-O)?|(pod)?rubryka\s+[\d.]+)\s*[-–]\s*[^:\n]*:?/i, '')).join(' ').toUpperCase().replace(/\s+/g, ' ');
const NO_ENTRIES = /BRAK WPIS[ÓO]W|NIE MA WPIS[ÓO]W/;
// Kinds of entries in section III, in the wording the courts use.
const burdenKinds: [RegExp, string][] = [
  [/SŁUŻEBNOŚĆ PRZESYŁU/, 'służebność przesyłu'],
  [/SŁUŻEBNOŚĆ GRUNTOWA|SŁUŻEBNOŚĆ DROGI|PRAWO PRZEJAZDU|PRAWO PRZECHODU/, 'służebność gruntowa (np. przejazd)'],
  [/SŁUŻEBNOŚĆ OSOBISTA|SŁUŻEBNOŚĆ MIESZKANIA/, 'służebność osobista'],
  [/DOŻYWOCI/, 'dożywocie'],
  [/UŻYTKOWANIE(?! WIECZYSTE)/, 'użytkowanie'],
  [/PRAWO PIERWOKUPU/, 'prawo pierwokupu'],
  [/ROSZCZENI/, 'roszczenie'],
  [/OSTRZEŻENI/, 'ostrzeżenie (np. o niezgodności wpisu)'],
  [/EGZEKUCJ|ZAJĘCI/, 'wszczęcie egzekucji / zajęcie'],
  [/HIPOTEK/, 'wzmianka o hipotece w dziale III'],
];

/** Plain reading of the pasted text: which kinds of entries appear, and the sums named in mortgage entries. */
export function readRegister(section3 = '', section4 = ''): RegisterFindings {
  const s3 = norm(section3), s4 = norm(section4);
  const burdens = burdenKinds.filter(([re]) => re.test(s3)).map(([, label]) => label);
  // Sums as written: "300 000,00 ZŁ", "150000 PLN", "50.000,00 (PIĘĆDZIESIĄT TYSIĘCY) ZŁ".
  const mortgages = [...s4.matchAll(/(\d{1,3}(?:[ .\u00a0]\d{3})+|\d+)(,\d{2})?\s*(?:\([^)]{0,120}\)\s*)?(ZŁ|PLN|EUR|CHF|USD)(?![A-ZĄĆĘŁŃÓŚŹŻ])/g)]
    .map(m => `${m[1].replace(/[.\u00a0]/g, ' ')}${m[2] ?? ''} ${m[3] === 'ZŁ' ? 'zł' : m[3]}`)
    .filter((v, i, all) => all.indexOf(v) === i).slice(0, 8);
  const mortgage = /HIPOTEK/.test(s4) || mortgages.length > 0;// section IV holds only mortgages: a sum there is one
  return { burdens, section3Empty: !!s3 && NO_ENTRIES.test(s3) && !burdens.length, mortgages, mortgage, section4Empty: !!s4 && NO_ENTRIES.test(s4) && !mortgage };
}

/** One line per section for the panel and the report; says plainly when nothing typical was recognised. */
export function registerSummary(f: RegisterFindings, section3: string | undefined, section4: string | undefined, pl: boolean) {
  const T = (en: string, p: string) => pl ? p : en, out: string[] = [];
  if (section3?.trim()) out.push(f.burdens.length ? T(`Section III: ${f.burdens.join(', ')}.`, `Dział III: ${f.burdens.join(', ')}.`) : f.section3Empty ? T('Section III: no entries.', 'Dział III: brak wpisów.') : T('Section III: no typical entry recognised – read the text.', 'Dział III: nie rozpoznano typowych wpisów – przeczytaj treść.'));
  if (section4?.trim()) out.push(f.mortgage ? T(`Section IV: mortgage${f.mortgages.length ? ' ' + f.mortgages.join(', ') : ''}.`, `Dział IV: hipoteka${f.mortgages.length ? ' ' + f.mortgages.join(', ') : ''}.`) : f.section4Empty ? T('Section IV: no entries.', 'Dział IV: brak wpisów.') : T('Section IV: no mortgage recognised – read the text.', 'Dział IV: nie rozpoznano hipoteki – przeczytaj treść.'));
  return out;
}
