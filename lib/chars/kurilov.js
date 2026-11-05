// ─────────────────────────────────────────────────────────────────────────────
//  lib/chars/kurilov.js — the cast. Character design sheet (keep consistent!):
//
//  STANISLAV KURILOV (38 in 1974). Lean, wiry, long-limbed. LONG gaunt face,
//  strong jaw, deep-set intense grey-blue eyes under thick dark brows, a big
//  aquiline nose with a hump, thick dark 70s mustache, sun-tanned skin, dark
//  tousled wavy hair with one forelock falling over his right brow.
//  Signature props: oval single-window diving mask, black J-snorkel with an
//  orange tip, long black rubber fins, navy swim briefs. On the ship: navy-white
//  telnyashka under a dark wool jacket. Scientist look: oatmeal turtleneck.
//
//  Use:  drawCharacter(ctx, CAST.kurilov, pose, { outfit: 'deck' | 'telnyashka' | 'swim' | 'swimBare' | 'sweater' | 'diver' | 'civil' | 'prison', … })
// ─────────────────────────────────────────────────────────────────────────────
const ADULT_BODY = { torso: 240, neck: 34, neckW: 40, headUp: 52, headFwd: 10, shoulderW: 84, shoulderDrop: 30, upperArm: 122, foreArm: 112, hand: 80, armW: 40,
  hipW: 42, hipDrop: 14, thigh: 182, shin: 170, legW: 60, foot: 92, footDown: 26, chestW: 72, waistW: 56, depth: 38 };

const KURILOV_HEAD = {
  rings: [[-70, 10, 12, -6], [-62, 32, 36, -6], [-48, 44, 48, -5], [-30, 48, 52, -4], [-10, 49, 51, -2], [8, 47, 48, 0], [24, 41, 43, 2], [40, 35, 37, 5], [54, 28, 30, 9], [64, 20, 22, 14], [71, 10, 13, 18], [74, 3, 6, 19]],
  eyes: { x: 20, y: -2, w: 11, h: 6.5, iris: 5.2, inset: 4, browH: 14, browThick: 6.5, tilt: -1 },
  nose: { top: 2, tipY: 29, baseY: 34, wingY: 30, w: 11, len: 24, hump: 0.3 },
  mouth: { y: 47, w: 15, h: 3 },
  ear: { x: 46, y: 4, z: -6, w: 13, h: 28 },
  cheekX: 31, cheekY: 26,
  hairline: { front: -42, side: -6, back: 36 },
  hairVol: 14, hairWave: 1.0, hairSeed: 3,
  hairClumps: [
    { at: [-4, -46, 48], dir: [-0.5, 0.82, 0.4], len: 40, w: 14, curl: 0.9, flex: 0.6 },
    { at: [-20, -40, 42], dir: [-0.6, 0.7, 0.3], len: 24, w: 8, curl: 0.5, flex: 0.5 },
    { at: [0, -36, -50], dir: [0, 1, -0.2], len: 30, w: 30, back: true, flex: 0.3 },
  ],
};

const OUTFITS = {
  deck: { torso: '#efeadf', stripes: '#1d2f57', stripesOn: ['torso'], jacket: '#2a3037', upperArm: '#2a3037', foreArm: '#2a3037', thigh: '#23272d', shin: '#23272d', shoes: '#19140f', folds: true },
  telnyashka: { torso: '#efeadf', stripes: '#1d2f57', stripesOn: ['torso', 'arms'], upperArm: '#efeadf', foreArm: '#efeadf', thigh: '#2c323b', shin: '#2c323b', shoes: '#19140f', folds: true },
  swim: { torso: null, upperArm: null, foreArm: null, thigh: null, shin: null, briefs: '#15264a', fins: true },
  swimBare: { torso: null, upperArm: null, foreArm: null, thigh: null, shin: null, briefs: '#15264a' },
  sweater: { torso: '#cbbd9f', upperArm: '#cbbd9f', foreArm: '#cbbd9f', collar: 'turtleneck', thigh: '#3a3e44', shin: '#3a3e44', shoes: '#2a2018', folds: true },
  diver: { torso: '#1b2124', upperArm: '#1b2124', foreArm: '#1b2124', collar: 'turtleneck', collarColor: '#1b2124', thigh: '#1b2124', shin: '#1b2124', fins: true },
  civil: { torso: '#9fb2bf', upperArm: '#9fb2bf', foreArm: '#9fb2bf', thigh: '#4a4235', shin: '#4a4235', shoes: '#2a2018', belt: '#2a2018', folds: true },
  prison: { torso: '#e3ddcf', upperArm: '#e3ddcf', sleeves: 'short', foreArm: null, thigh: '#5a5446', shin: '#5a5446', folds: true },
};
// null → skin (resolved below)
function resolveOutfits(skin, outfits) {
  const o = {}; for (const [k, v] of Object.entries(outfits)) { o[k] = {}; for (const [kk, vv] of Object.entries(v)) o[k][kk] = vv === null ? skin : vv; if (o[k].skin === undefined) o[k].skin = skin; } return o;
}

function character(def) {
  return { lineW: 3.2, handZBias: 0, defaultOutfit: Object.keys(def.outfits)[0], ...def, outfits: resolveOutfits(def.skin, def.outfits) };
}

const scaleHead = (H, sx = 1, sy = 1, extra = {}) => ({ ...H, rings: H.rings.map(([y, w, d, z]) => [y * sy, w * sx, d * sx, z]), ...extra });

export const CAST = {
  kurilov: character({
    name: 'Stanislav Kurilov', skin: '#d39a72', hair: '#261a15', irisColor: '#5d7c8a', lip: '#a4604f', mustache: 'thick', stubble: 0.15, gaunt: 0.75, deepEyes: 0.85, folds: 0.55, bags: 0.3,
    body: ADULT_BODY, head: KURILOV_HEAD, outfits: OUTFITS,
  }),
  /** Kurilov as a boy in Semipalatinsk (≈10 y.o.) — same nose & brows, softer */
  kurilovBoy: character({
    name: 'Stas (boy)', skin: '#e2b08a', hair: '#2e2019', irisColor: '#5d7c8a', lip: '#b56a58', gaunt: 0.1, deepEyes: 0.3, folds: 0, lineW: 3,
    body: { torso: 160, neck: 20, neckW: 26, headUp: 50, headFwd: 8, shoulderW: 50, shoulderDrop: 16, upperArm: 80, foreArm: 74, hand: 52, armW: 24, hipW: 28, hipDrop: 10, thigh: 112, shin: 104, legW: 34, foot: 60, footDown: 18, chestW: 42, waistW: 38, depth: 24 },
    head: scaleHead({ ...KURILOV_HEAD, rings: [[-68, 12, 14, -6], [-60, 36, 40, -6], [-44, 48, 52, -5], [-24, 52, 54, -4], [-4, 52, 53, -2], [14, 48, 48, 0], [30, 41, 41, 3], [44, 31, 31, 7], [54, 19, 20, 11], [60, 6, 8, 13]],
      eyes: { x: 21, y: 4, w: 13, h: 8.5, iris: 6.8, inset: 2, browH: 15, browThick: 4.5, tilt: 0 }, nose: { top: 10, tipY: 28, baseY: 31, wingY: 28, w: 9, len: 13, hump: 0.1 }, mouth: { y: 42, w: 12, h: 3 }, ear: { x: 50, y: 6, z: -4, w: 13, h: 26 }, cheekX: 30, cheekY: 26,
      hairline: { front: -36, side: -6, back: 34 },
      hairClumps: [{ at: [-4, -50, 46], dir: [0.1, 1, 0.35], len: 26, w: 22, flex: 0.4 }, { at: [20, -48, 42], dir: [0.4, 0.9, 0.3], len: 24, w: 18, flex: 0.4 }, { at: [-24, -46, 40], dir: [-0.4, 0.9, 0.3], len: 24, w: 18, flex: 0.4 },
        { at: [0, -66, 10], dir: [0, -0.3, -0.8], len: 24, w: 30, flex: 0.3 }, { at: [46, -30, -10], dir: [0.2, 1, -0.2], len: 30, w: 18 }, { at: [-46, -30, -10], dir: [-0.2, 1, -0.2], len: 30, w: 18 }, { at: [0, -40, -50], dir: [0, 1, -0.2], len: 44, w: 32, back: true }] }),
    outfits: { boy: { torso: '#efeadf', stripes: '#3b6aa0', stripesOn: ['torso', 'arms'], upperArm: '#efeadf', foreArm: null, sleeves: 'short', thigh: '#5a4632', shin: null, shoes: '#3a2a1c' } },
  }),
  /** Jacques-Yves Cousteau (stylised): very lean, long face, long nose, red cap */
  cousteau: character({
    name: 'Cousteau', skin: '#d8a585', hair: '#c9c4bc', irisColor: '#4f6b7a', lip: '#a76555', gaunt: 0.9, deepEyes: 0.7, folds: 0.8, hat: { type: 'beanie', color: '#c7322a' },
    body: { ...ADULT_BODY, shoulderW: 70, chestW: 56, waistW: 44, armW: 30, legW: 44, torso: 236 },
    head: scaleHead({ ...KURILOV_HEAD, nose: { top: 0, tipY: 32, baseY: 36, wingY: 33, w: 10, len: 30, hump: 0.15 }, eyes: { ...KURILOV_HEAD.eyes, w: 10, browThick: 4 }, hairClumps: KURILOV_HEAD.hairClumps.filter((c, i) => i > 4 && i < 9) }, 0.9, 1.08),
    outfits: { navy: { torso: '#1f3047', upperArm: '#1f3047', foreArm: '#1f3047', collar: 'turtleneck', thigh: '#e8e2d4', shin: '#e8e2d4', shoes: '#3a2a1c' } },
  }),
  /** KGB officer aboard: heavy-set, square jaw, small eyes, grey fedora & coat */
  kgb: character({
    name: 'KGB officer', skin: '#d6a98a', hair: '#3a3029', irisColor: '#2e2a26', lip: '#9a5a4c', gaunt: 0.05, deepEyes: 0.9, folds: 0.6, bags: 0.6, hat: { type: 'fedora', color: '#4a4c4a', band: '#1f201f' },
    body: { ...ADULT_BODY, shoulderW: 92, chestW: 78, waistW: 74, depth: 46, neckW: 46, armW: 40, legW: 56, torso: 232 },
    head: scaleHead({ ...KURILOV_HEAD, rings: [[-66, 12, 12, -6], [-58, 36, 38, -6], [-44, 48, 50, -5], [-26, 52, 52, -4], [-6, 54, 52, -2], [12, 56, 50, 0], [28, 56, 46, 2], [44, 54, 40, 4], [56, 48, 34, 7], [66, 36, 26, 11], [72, 18, 14, 14]],
      eyes: { x: 21, y: -2, w: 8.5, h: 4.5, iris: 4, inset: 5, browH: 11, browThick: 7.5, tilt: 1.5 }, nose: { top: 4, tipY: 26, baseY: 31, wingY: 28, w: 14, len: 16, hump: -0.1 }, mouth: { y: 46, w: 16, h: 3 }, hairClumps: [] }),
    outfits: { coat: { torso: '#55595a', upperArm: '#55595a', foreArm: '#55595a', thigh: '#3b3e40', shin: '#3b3e40', shoes: '#141210', folds: true, jacket: '#55595a' } },
  }),
  /** Soviet bureaucrat: bald dome, round glasses, jowls, brown suit */
  bureaucrat: character({
    name: 'Bureaucrat', skin: '#e0b597', hair: '#5a4a3e', irisColor: '#3a3028', lip: '#a46a5a', gaunt: 0, deepEyes: 0.4, folds: 0.7, bags: 0.8, glasses: { round: true, r: 13, color: '#2a2018', thick: 3 },
    body: { ...ADULT_BODY, shoulderW: 76, chestW: 74, waistW: 82, depth: 52, neckW: 44, torso: 220, thigh: 160, shin: 150 },
    head: scaleHead({ ...KURILOV_HEAD, rings: [[-64, 18, 18, -6], [-56, 40, 42, -6], [-40, 50, 52, -5], [-20, 53, 53, -4], [0, 54, 52, -2], [18, 56, 50, 0], [34, 58, 46, 2], [48, 54, 40, 4], [60, 44, 32, 7], [68, 28, 20, 10], [72, 12, 10, 12]],
      eyes: { x: 20, y: -2, w: 9, h: 5, iris: 4.5, inset: 2, browH: 13, browThick: 4, tilt: 1 }, nose: { top: 6, tipY: 27, baseY: 31, wingY: 28, w: 14, len: 14, hump: 0 }, mouth: { y: 44, w: 13, h: 3 },
      hairline: { front: 10, side: -2, back: 30 }, hairClumps: [{ at: [46, -12, -6], dir: [0.2, 1, -0.3], len: 26, w: 12 }, { at: [-46, -12, -6], dir: [-0.2, 1, -0.3], len: 26, w: 12 }, { at: [0, -18, -52], dir: [0, 1, -0.2], len: 36, w: 30, back: true }] }),
    outfits: { suit: { torso: '#e8e4da', jacket: '#6a5038', upperArm: '#6a5038', foreArm: '#6a5038', thigh: '#5a4430', shin: '#5a4430', shoes: '#1e1712', collarColor: '#e8e4da', folds: true } },
  }),
  /** Filipino farmer (older man): wiry, salakot hat, thin mustache */
  farmer: character({
    name: 'Farmer', skin: '#a8683f', hair: '#1c1714', irisColor: '#23170f', lip: '#7d4436', mustache: 'thin', gaunt: 0.6, deepEyes: 0.5, folds: 0.8, hat: { type: 'salakot', color: '#c8a463' },
    body: { ...ADULT_BODY, shoulderW: 68, chestW: 54, waistW: 46, armW: 28, legW: 40, torso: 220, thigh: 166, shin: 156 },
    head: scaleHead({ ...KURILOV_HEAD, nose: { top: 8, tipY: 27, baseY: 31, wingY: 28, w: 15, len: 13, hump: -0.1 }, eyes: { ...KURILOV_HEAD.eyes, h: 5.5, browThick: 4.5 }, hairClumps: [] }, 1.02, 0.94),
    outfits: { field: { torso: '#e4ddd0', upperArm: null, foreArm: null, sleeves: 'short', thigh: '#3d4a3a', shin: null, folds: true } },
  }),
  /** Filipino farmer (young woman): hair in a bun, patterned blouse */
  farmerWoman: character({
    name: 'Farmer woman', skin: '#b67a52', hair: '#120e0c', irisColor: '#1e140e', lip: '#9a4f45', gaunt: 0.2, deepEyes: 0.3, folds: 0.1,
    body: { ...ADULT_BODY, shoulderW: 62, chestW: 52, waistW: 42, armW: 26, legW: 42, torso: 210, thigh: 160, shin: 150 },
    head: scaleHead({ ...KURILOV_HEAD, eyes: { x: 20, y: 0, w: 11.5, h: 7, iris: 5.8, inset: 2, browH: 14, browThick: 3.5, tilt: 0 }, nose: { top: 8, tipY: 26, baseY: 30, wingY: 27, w: 12, len: 11, hump: 0 }, mouth: { y: 44, w: 13, h: 3.5 },
      hairline: { front: -40, side: -4, back: 30 }, hairClumps: [{ at: [0, -60, -40], dir: [0, -0.4, -1], len: 22, w: 26, back: true }, { at: [30, -46, 30], dir: [0.6, 0.8, 0], len: 26, w: 16 }, { at: [-30, -46, 30], dir: [-0.6, 0.8, 0], len: 26, w: 16 }] }, 0.94, 0.95),
    outfits: { blouse: { torso: '#d9573f', upperArm: '#d9573f', foreArm: null, sleeves: 'short', thigh: '#2f3a52', shin: '#2f3a52', folds: true } },
  }),
  /** Philippine Constabulary officer: khaki uniform, peaked cap */
  police: character({
    name: 'Police officer', skin: '#b07a52', hair: '#16110e', irisColor: '#1c130d', lip: '#8c4b3e', mustache: 'thin', gaunt: 0.2, deepEyes: 0.6, folds: 0.5, hat: { type: 'police', color: '#8a7a52', band: '#2a2418' },
    body: { ...ADULT_BODY, shoulderW: 80, chestW: 66, waistW: 60, depth: 40 },
    head: scaleHead({ ...KURILOV_HEAD, nose: { top: 6, tipY: 27, baseY: 31, wingY: 28, w: 14, len: 14, hump: 0 }, hairClumps: [] }, 1.04, 0.96),
    outfits: { uniform: { torso: '#b9a777', upperArm: '#b9a777', foreArm: '#b9a777', thigh: '#7d6f4c', shin: '#7d6f4c', shoes: '#141210', belt: '#2a2418', folds: true } },
  }),
  /** Soviet cruise passengers (1970s): sideburns man & beehive woman */
  passengerMan: character({
    name: 'Passenger', skin: '#e2b08e', hair: '#5b3b26', irisColor: '#4a6a3a', lip: '#a86858', gaunt: 0.2, deepEyes: 0.3, folds: 0.3,
    body: { ...ADULT_BODY, chestW: 70, waistW: 66, depth: 42 },
    head: scaleHead({ ...KURILOV_HEAD, nose: { top: 6, tipY: 26, baseY: 30, wingY: 27, w: 12, len: 14, hump: 0 }, hairClumps: KURILOV_HEAD.hairClumps.slice(3) }, 1.04, 0.96),
    outfits: { party: { torso: '#f4efe6', jacket: '#8a5a2b', upperArm: '#8a5a2b', foreArm: '#8a5a2b', thigh: '#3a3128', shin: '#3a3128', shoes: '#1a1410', folds: true } },
  }),
  passengerWoman: character({
    name: 'Passenger woman', skin: '#ecc2a2', hair: '#c9873f', irisColor: '#3b5d74', lip: '#c2504a', gaunt: 0.1, deepEyes: 0.2, folds: 0.1, blush: 0.4,
    body: { ...ADULT_BODY, shoulderW: 60, chestW: 54, waistW: 44, armW: 26, legW: 42, torso: 212, thigh: 168, shin: 156 },
    head: scaleHead({ ...KURILOV_HEAD, eyes: { x: 20, y: 0, w: 12, h: 7.5, iris: 6, inset: 2, browH: 16, browThick: 3, tilt: -1 }, nose: { top: 8, tipY: 25, baseY: 29, wingY: 26, w: 9, len: 12, hump: 0 }, mouth: { y: 44, w: 13, h: 3.5 },
      hairline: { front: -40, side: -2, back: 30 }, hairClumps: [{ at: [0, -70, 0], dir: [0, -1, -0.2], len: 40, w: 46, flex: 0.2 }, { at: [36, -40, 20], dir: [0.5, 0.9, 0], len: 34, w: 20 }, { at: [-36, -40, 20], dir: [-0.5, 0.9, 0], len: 34, w: 20 }, { at: [0, -40, -50], dir: [0, 1, -0.3], len: 46, w: 36, back: true }] }, 0.92, 0.94),
    outfits: { dress: { torso: '#2e7a6b', upperArm: '#2e7a6b', foreArm: null, sleeves: 'short', thigh: '#2e7a6b', shin: null, shoes: '#d8c8a8', folds: true } },
  }),
};
export const KURILOV = CAST.kurilov;
