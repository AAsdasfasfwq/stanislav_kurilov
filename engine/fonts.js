// ─────────────────────────────────────────────────────────────────────────────
//  engine/fonts.js — the typographic system (all fonts are local, SIL OFL).
//  ROLES (see docs/BIBLE.md §Typography). Use the constants, never raw names.
//
//   F.display  "Dela Gothic One"      heavy constructivist display — the STATE, verdicts, big takes
//   F.serif    "Instrument Serif"     editorial serif (+italic) — the HUMAN voice, poetic lines
//   F.wide     "Unbounded"            wide variable grotesk (200–900) — numbers, counters, data
//   F.mono     "IBM Plex Mono"        technical mono (300–600) — HUD, coordinates, labels, charts
//   F.cond     "Big Shoulders Display" tall condensed variable (100–900) — captions, map labels
//   F.slim     "Alumni Sans"          elegant condensed variable (100–900, +italic, Cyrillic)
//   F.hand     "Caveat"               handwriting variable (400–700) — Kurilov's notes / calculations
//   F.news     "Old Standard TT"      19th-c. newspaper serif (Cyrillic) — Soviet press, book cover
//   F.type     "Special Elite"+"PT Mono" typewriter (Latin) with Cyrillic fallback — documents
// ─────────────────────────────────────────────────────────────────────────────

const base = new URL('../assets/fonts/', import.meta.url).href;
const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD, U+2190-21FF, U+00B0';
const CYR = 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116';

const defs = [
  ['Dela Gothic One', 'dela-gothic-one-latin-400-normal.woff2', '400', 'normal', LATIN],
  ['Dela Gothic One', 'dela-gothic-one-cyrillic-400-normal.woff2', '400', 'normal', CYR],
  ['Instrument Serif', 'instrument-serif-latin-400-normal.woff2', '400', 'normal', LATIN],
  ['Instrument Serif', 'instrument-serif-latin-400-italic.woff2', '400', 'italic', LATIN],
  ['Unbounded', 'unbounded-latin-wght-normal.woff2', '200 900', 'normal', LATIN],
  ['Unbounded', 'unbounded-cyrillic-wght-normal.woff2', '200 900', 'normal', CYR],
  ['IBM Plex Mono', 'ibm-plex-mono-latin-300-normal.woff2', '300', 'normal', LATIN],
  ['IBM Plex Mono', 'ibm-plex-mono-latin-400-normal.woff2', '400', 'normal', LATIN],
  ['IBM Plex Mono', 'ibm-plex-mono-latin-500-normal.woff2', '500', 'normal', LATIN],
  ['IBM Plex Mono', 'ibm-plex-mono-latin-600-normal.woff2', '600', 'normal', LATIN],
  ['IBM Plex Mono', 'ibm-plex-mono-latin-400-italic.woff2', '400', 'italic', LATIN],
  ['IBM Plex Mono', 'ibm-plex-mono-cyrillic-300-normal.woff2', '300', 'normal', CYR],
  ['IBM Plex Mono', 'ibm-plex-mono-cyrillic-400-normal.woff2', '400', 'normal', CYR],
  ['IBM Plex Mono', 'ibm-plex-mono-cyrillic-500-normal.woff2', '500', 'normal', CYR],
  ['IBM Plex Mono', 'ibm-plex-mono-cyrillic-600-normal.woff2', '600', 'normal', CYR],
  ['Big Shoulders Display', 'big-shoulders-display-latin-wght-normal.woff2', '100 900', 'normal', LATIN],
  ['Alumni Sans', 'alumni-sans-latin-wght-normal.woff2', '100 900', 'normal', LATIN],
  ['Alumni Sans', 'alumni-sans-cyrillic-wght-normal.woff2', '100 900', 'normal', CYR],
  ['Alumni Sans', 'alumni-sans-latin-wght-italic.woff2', '100 900', 'italic', LATIN],
  ['Alumni Sans', 'alumni-sans-cyrillic-wght-italic.woff2', '100 900', 'italic', CYR],
  ['Caveat', 'caveat-latin-wght-normal.woff2', '400 700', 'normal', LATIN],
  ['Caveat', 'caveat-cyrillic-wght-normal.woff2', '400 700', 'normal', CYR],
  ['Old Standard TT', 'old-standard-tt-latin-400-normal.woff2', '400', 'normal', LATIN],
  ['Old Standard TT', 'old-standard-tt-cyrillic-400-normal.woff2', '400', 'normal', CYR],
  ['Old Standard TT', 'old-standard-tt-latin-400-italic.woff2', '400', 'italic', LATIN],
  ['Old Standard TT', 'old-standard-tt-cyrillic-400-italic.woff2', '400', 'italic', CYR],
  ['Old Standard TT', 'old-standard-tt-latin-700-normal.woff2', '700', 'normal', LATIN],
  ['Old Standard TT', 'old-standard-tt-cyrillic-700-normal.woff2', '700', 'normal', CYR],
  ['Special Elite', 'special-elite-latin-400-normal.woff2', '400', 'normal', LATIN],
  ['PT Mono', 'pt-mono-latin-400-normal.woff2', '400', 'normal', LATIN],
  ['PT Mono', 'pt-mono-cyrillic-400-normal.woff2', '400', 'normal', CYR],
];

export const F = {
  display: '"Dela Gothic One"',
  serif: '"Instrument Serif"',
  wide: '"Unbounded"',
  mono: '"IBM Plex Mono"',
  cond: '"Big Shoulders Display"',
  slim: '"Alumni Sans"',
  hand: '"Caveat"',
  news: '"Old Standard TT"',
  type: '"Special Elite", "PT Mono"',
};

/**
 * Build a canvas font string.
 *   font(F.wide, 120, 800)            → '800 120px "Unbounded"'
 *   font(F.serif, 90, 400, 'italic')  → 'italic 400 90px "Instrument Serif"'
 */
export function font(family, size, weight = 400, style = 'normal') {
  return `${style === 'italic' ? 'italic ' : ''}${weight} ${size}px ${family}, serif`;
}

let loaded = null;
export function loadFonts() {
  if (loaded) return loaded;
  loaded = (async () => {
    const faces = defs.map(([fam, file, weight, style, range]) =>
      new FontFace(fam, `url(${base}${file}) format("woff2")`, { weight, style, unicodeRange: range, display: 'block' }));
    await Promise.all(faces.map(async (f) => { try { await f.load(); document.fonts.add(f); } catch (e) { console.warn('font failed', f.family, e); } }));
    // warm-up: force every family to be resolved by the canvas text shaper
    const c = document.createElement('canvas').getContext('2d');
    for (const fam of Object.values(F)) for (const w of [300, 400, 700, 900]) { c.font = `${w} 40px ${fam}`; c.fillText('AaЖж09', 0, 40); c.font = `italic ${w} 40px ${fam}`; c.fillText('Aa', 0, 40); }
    await document.fonts.ready;
  })();
  return loaded;
}
