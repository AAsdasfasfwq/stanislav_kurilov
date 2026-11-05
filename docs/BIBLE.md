# ALONE IN THE OCEAN — Art Direction Bible

> Every author reads this file fully before designing a single frame. It is the
> shared taste of the whole film. Seven authors, one hand.

## 0. The film in one breath

* **What:** a 20-minute documentary motion-design film (YouTube, 1920×1080, 30 fps) about
  **Stanislav Kurilov**, a Soviet oceanographer barred from travelling abroad, who in December 1974
  jumped at night from the stern of the cruise liner *Sovetsky Soyuz* into a typhoon-tossed Philippine Sea
  and swam ~62 miles in 3 days without food, water or sleep to the island of Siargao — and freedom.
* **Narrator:** English voice-over (`assets/voiceover.mp3`) = the master clock. Word timings: `docs/transcript/sN.md`.
* **One message:** *A human will — armed with knowledge and a pure hunger for freedom — can cross any line a state draws.*
* **Three mood adjectives (resolve every judgement call with them):** **tense · luminous · defiant**.
* **It must feel like:** a premium documentary by a studio that can draw, animate, build 3D and edit —
  never a template, never PowerPoint, never "AI video".

## 1. Concept — THE LINE AND THE SEA

Two visual worlds fight through the whole film.

| THE SYSTEM (the State) | THE SEA (Kurilov, freedom) |
|---|---|
| straight lines, grids, right angles, borders | curves, swells, depth, gradients of light |
| paper, ink, typewriter, stamps, files | water, glow, plankton, stars, salt crystals |
| **Signal Vermilion** red line `#E8432E` | **Phosphor** cyan-green `#5CF2C4` |
| constructivist heavy type (Dela Gothic One) | editorial serif italic (Instrument Serif) |
| static, mechanical, stepped motion | fluid, eased, spring/wave motion |

**The arc:** the first act is ruled by lines (the liner is a floating piece of the State; the rail is a border).
Kurilov **crosses the line** (the stern rail) and enters the sea world. The sea tests him (storm, sharks, sun,
salt, hallucinations), then gives him land. In the epilogue the System tries to **erase** him (lines, black
bars, deletions) — but his phosphor line keeps crossing borders. The last image answers the first: a leap
into darkness that becomes a field of light.

### Recurring motifs (each segment uses ≥ 3 of them, in its own variation)
1. **The Red Line** `#E8432E` — the border. A 2–6 px vermilion line: the underline of a ruling, the border
   on a map, the ship's rail, a cutting wipe, the fishing net at the end. When the line *breaks*, freedom wins.
2. **The Phosphor Trail** `#5CF2C4` — Kurilov's path. The cruise route, a star-sight line, his wake,
   bioluminescent plankton, the route of his later free life. Always has a bright leading head.
3. **The Porthole / Circle** — circular frames & iris transitions: porthole → eye → diving-mask lens →
   sun → moon → island in the lens. Our signature match-cut shape.
4. **The Instruments (HUD)** — oceanographer's language: depth contours (isobaths), lat/long ticks,
   compass roses, sounding lines, and two counters that run from the jump to the shore:
   **T+ hh:mm** (time in water) and **NM / MI** (distance). Set in IBM Plex Mono.
5. **Paper & Ink** — Soviet documents (authentic wording only), newsprint, the school atlas, Kurilov's
   handwritten calculations (Caveat), his book *Alone in the Ocean*.

## 2. Colour system

Base neutrals (never pure black / pure white backgrounds; black only when it is the story):

| token | hex | use |
|---|---|---|
| ink | `#0B1620` | darkest navy (night, shadows) |
| night sea | `#0F2A3A` | storm/night water |
| slate | `#2B3A45` | storm sky, mid tones |
| paper | `#EDE6D6` | documents, editorial light backgrounds |
| bone | `#D8CFB6` | maps land, aged paper |
| fog | `#C9D3D6` | haze, mist |
| **red line** | `#E8432E` | the State, danger, verdicts |
| **phosphor** | `#5CF2C4` | freedom, path, plankton, data highlights |
| **brass** | `#D9A441` | warm light: portholes, lamps, sun, hope, champagne |
| ember | `#F2703A` | sunburn, heat |
| bleach | `#FFE9C2` | overexposed sun |
| jade | `#2FA36B` | the island, vegetation |
| reef coral | `#E77D6B` | coral, wounds (sparingly) |
| blueprint | `#10263F` | technical drawings / navigation |

**Chapter colour states (related, not random):**
* **Storm night** (S1 open, S3 storm & jump, S4 night): ink/night-sea/slate + brass portholes + white spray. Red only for danger words.
* **Soviet system** (S2 bureaucracy, S7 court/erasure): paper + ink + red line + olive grey `#6B6F5A`. Desaturated (post saturation 0.8), contrast up.
* **Memory** (S1 childhood, S2 Cousteau dream): warm sepia/ochre `#C9A36A` + paper + faded teal; post `sepia` 0.2–0.5.
* **Science / navigation** (S2 plan, S3 hull & trajectory): blueprint navy + paper lines + phosphor + brass.
* **Bioluminescence** (S4): near-black blue `#020A10` + phosphor glow — the ONE place deep black is justified.
* **Sun & thirst** (S5): bleached highlights, ember, salt-white `#F4F1E6`, hard shadows; post exposure up, temperature warm, saturation selective.
* **Hallucination** (S5): pearl, lilac `#B9A6E0`, gold, iridescent gradients — dreamy but in the same hue family.
* **Reef & island** (S6): turquoise `#2FB5B0`, coral, jade, foam white, dawn gold.
* **New life** (S7): clean daylight — cold white & red for Canada, warm sand `#E6CFA0` + Mediterranean blue `#2C6E9E` for Haifa; the Galilee in muted grey-green `#6F8577`; finale = dawn ocean brass + phosphor.

Rules: max 2 accents per frame; accents mean something (red = state/danger, phosphor = freedom/path, brass = warmth/light).
Never crossfade two saturated colour fields (muddy midpoint) — cut or carry an object across.

## 3. Typography (all fonts local — `engine/fonts.js`)

| role | font | when |
|---|---|---|
| `F.display` | **Dela Gothic One** (Cyrillic ✓) | the State's voice: verdicts, "INADVISABLE", "TREASON", big one-word takes |
| `F.serif` | **Instrument Serif** (+ italic, Latin only) | the human voice: "absolute freedom", "alone with eternity", chapter poetry |
| `F.wide` | **Unbounded** (200–900, Cyrillic ✓) | numbers & counters: 46 FT, 62 MILES, 60 HOURS, 1974 |
| `F.mono` | **IBM Plex Mono** (Cyrillic ✓) | HUD, coordinates, labels, chart axes, captions |
| `F.cond` | **Big Shoulders Display** (Latin only) | tall condensed labels, map names, dates in interstitials |
| `F.slim` | **Alumni Sans** (Cyrillic ✓, +italic) | elegant condensed secondary lines, Cyrillic condensed |
| `F.hand` | **Caveat** (Cyrillic ✓) | Kurilov's handwritten notes & calculations on the atlas |
| `F.news` | **Old Standard TT** (Cyrillic ✓) | Soviet newspaper, book cover, archival captions |
| `F.type` | **Special Elite** → **PT Mono** fallback for Cyrillic | typewritten documents |

Rules:
* **Text is a design element, not subtitles.** Show only: dates, numbers, names, places, key terms, short authentic quotes. **≤ 5 words on screen at once** (authentic document lines excepted). Never transcribe the narration.
* Pair at most **two** families in a frame (e.g. wide number + mono label).
* Big contrast of scale: hero word 140–260 px, labels 20–28 px. Tracking: display +0…4 px, mono labels +2…6 px.
* Text must sit inside the **title-safe area** (x 192–1728, y 108–972) and hold ≥ 0.7 s after it lands.
* Russian strings only in Cyrillic-capable fonts (see table). Authentic Soviet wording, e.g. the file note
  **«Посещение капстран нецелесообразно»** ("Visits to capitalist countries: inadvisable") and status **НЕВЫЕЗДНОЙ** ("barred from travel").
* Type moves with the world: masked reveals, tracking-in, perspective on surfaces (`quadWarp`), parallax planes, counters that roll. No default fades on text.

## 4. Motion language

* **Easing vocabulary** (`engine/ease.js`): entrances `E.out` (hard decel) · repositioning `E.std` · exits `E.inn` · hero reveals `E.hero` · camera `E.inOut` · physical objects → **springs** (`spring/springTo/jiggle`, ζ 0.5–0.85). Overshoot (`E.back`) only for playful beats (pizzeria, cruise ad) — never on facts/numbers.
* **Timing unit 0.4 s:** micro 0.2 · standard 0.4 · hero 0.8–1.2 · camera moves 1–3 s. Exits ~30 % faster than entrances. Stagger: letters 30–50 ms, items 80 ms.
* **Nothing is ever frozen.** Every shot has at least one living layer (camera drift, water, particles, breathing, light flicker). Holds are "alive holds": 1–2 % scale drift, handheld 1–3 px.
* **Shot length:** average **2.5–4 s**; tension/action **0.8–1.8 s**; contemplative holds up to **6 s** only with internal change. A visual idea must evolve or be replaced at least every ~4 s. Never exceed 8 s on one unchanging composition.
* **Sync:** every key noun/number gets its visual within **±0.2 s** of the word (lead by ~0.1 s). The picture must never lag the narration into the next thought.
* **Camera** (`engine/camera.js` Cam25 + Three.js cameras): push-in, pull-out reveal, dolly, truck, crane, tilt, parallax, foreground wipes, rack focus (aperture/focus), pass-through, handheld for danger. One camera idea per beat. No endless zoom-in; no 360° orbits.
* **Characters:** anticipation → action → follow-through; overlapping action (hair, hands lag); blinks (`blinkAt`), breathing (`idle`), eye darts; emotional poses (`P.*`, `EXPR`). Never stiff T-poses, never sliding-paper movement — characters move in depth (yaw/pitch/z), not just left-right.
* **One WOW per segment.** Save the strongest image for the strongest line (listed in PLAN.md).

## 5. Edit & transitions

* Default is the **hard cut**, placed on a word or a sound accent. Motivated transitions carry an object, line, light or shape across the cut:
  porthole/iris (`TR.circle`), water-surface wipe (`TR.water`), red-line wipe (`TR.wipe({line:'#e8432e'})`), ink bleed for documents (`TR.ink`),
  zoom-through (`TR.zoomThrough`), exposure flash on impacts (`TR.flash`), rack blur (`TR.blur`), light leak for memories (`TR.lightLeak`),
  graphic slices for data (`TR.slices`), glitch for surveillance/radio (`TR.glitch`), halftone for print (`TR.halftone`), match cuts by composition.
* **Never the same transition twice in a row**; no more than ~25 % of cuts with a transition effect.
* Map → real environment, infographic → physical scene, typography → scene: build these "medium-shifting" transitions; they are the signature of a great motion designer.

## 6. Dimensionality & ratios (per segment, by screen time)

* **2D ≈ 50 %** (illustration, motion graphics, typography, flat-but-lit infographics),
  **2.5D ≈ 35 %** (multiplane Cam25 scenes, perspective cards/maps, parallax depth), **3D ≈ 15 %** (Three.js: liner, ocean, propellers, globe, book, reef…).
* **Motion graphics (infographics, diagrams, maps, kinetic type, object animation) ≥ 60 %** of the runtime; **character scenes ≤ 30 %**.
* "2D that looks 3D": every shape gets form shading (`volume()`, `shadeCyl`), a key light direction, a contact/cast shadow, rim light,
  texture (paper/grain/noise), and depth (planes, haze, DOF). **No flat vector clip-art. No primitive geometry left untextured.**

## 7. The look (post pass — `engine/post.js`)

Defaults already give grain 0.045, vignette 0.26, halation 0.10, bloom 0.16, CA 0.0011. Adjust per chapter via `E.postSet()`:
storm: `temperature -0.3, contrast 1.1`; memory: `sepia 0.3, temperature 0.3`; sun: `exposure 0.25, temperature 0.5`;
bioluminescence: `bloom 0.35, bloomThreshold 0.55`; system/paper: `saturation 0.82`. Letterbox (`letterbox 1`) ONLY for the jump and the finale.
"If a viewer can name the effect, it is too strong."

## 8. Characters (lib/chars — see API.md)

**Stanislav Kurilov** (`CAST.kurilov`): lean, wiry, long-limbed; long gaunt face, strong jaw, deep-set grey-blue eyes under thick dark
brows, big aquiline nose, thick dark 70s mustache, tanned skin, dark tousled wavy hair with a forelock over his right brow.
Outfits: `deck` (telnyashka under dark wool jacket — the ship), `telnyashka`, `swim` (navy briefs + black fins; add `mask:true, snorkel:true`),
`swimBare`, `sweater` (oatmeal turtleneck — the scientist), `diver`, `civil`, `prison`. In the water: `wetHair:true`, later `burn`, `stubble`.
Boy (`CAST.kurilovBoy`, Semipalatinsk), **Cousteau** (red cap), **KGB officer** (grey fedora/coat), **bureaucrat** (bald, round glasses),
**farmer** & **farmerWoman** (Siargao), **police** (Philippine Constabulary khaki), **passengerMan/Woman** (1970s tourists).
Use lighting presets (`LIGHT.stormNight/porthole/tropicSun/underwater/biolum/office/dawn/memory`) — the character must sit in the scene's light.
Draw characters in **medium/close shots** where they shine (faces, hands, expression) or as **backlit silhouettes** in wide shots.
You may add your own hand-drawn insert shots (hands, eyes, tongue, skin) in the same style.

## 9. Sound & music

* Voice-over is king. Music is **almost always present** but sits under the voice (render.js also sidechain-ducks the bed).
  Targets inside your segment audio: music peaks ≈ −16 dBFS, SFX accents ≈ −12 dBFS, ambience ≈ −24 dBFS. Check with `node tools/qa.mjs sN --audio`.
* Music **changes with the story** — genre, instrumentation, tempo. Use the leitmotifs (`engine/audio/theory.js` MOTIFS):
  **FREEDOM** (Kurilov), **SYSTEM** (the State), **OCEAN** (the sea), **WATCH** (surveillance). Vary them (tempo, mode, instrument).
* Genres available through the synth orchestra: epic (strings+brass+taiko+choir+braam), thriller (ostinato, pulses, ticking), horror (theremin, dissonant clusters, heartbeat),
  sardonic/ехидная (pizzicato/stacc, bassoon-like reed, plucks), retro Soviet estrada (bayan/reed, bass, brushes/shaker), wonder (glass harmonica, celesta, harp, choir "oo"),
  tender (piano, music box), Filipino warmth (marimba, plucks, gongs), Mediterranean (koto/pluck in hijaz), finale (full orchestra).
* SFX accent *meaning*: a number landing, a stamp, a scale change, a transition that carries weight. Not every cut. 60 ms of near-silence before a big hit.
* Ambience beds for places: storm, waves, wind, propellers, crowd murmur, underwater, jail.

## 10. NEVER

primitive stick/capsule people · generic SVG/flat icons (lightbulbs, gears, checkmarks, clouds, money, documents-as-icons) · card grids & identical rectangles with text ·
scenes of bare cubes/spheres · white untextured 3D · empty Three.js demo look · one object floating in a void without reason · the same transition or zoom repeated ·
endless orbit · text instead of an image · paragraphs · permanent black backgrounds · random particles · heavy glow/bloom · cheap gradients · acid colours without reason ·
generic AI aesthetic · ten ideas in one frame · invented facts (numbers, quotes, names, logos) · static frames.

## 11. Shot gate (ask before you accept any shot)

1. **Meaning** — why this image on this exact phrase? 2. **Focus** — one clear hero? 3. **Read** — understood in 1–2 s (also on a phone)?
4. **Motion** — does movement tell the story? 5. **Craft** — lit, textured, deep, never flat? 6. **Subtraction** — what can go to make it stronger?
7. **AI-smell** — does it look templated? Then redo it. 8. **Sync** — visual lands with the word? 9. **Safe area & overlaps** — nothing clipped, nothing colliding.
