# SKILLS_DIGEST — craft rules distilled for the Kurilov film

Distilled from 11 skill repositories for the 7 segment authors of the ~20-minute documentary
about Stanislav Kurilov (the 1974 jump from the liner *Sovetsky Soyuz*, ~3 days of swimming to Siargao).
The film is code-built: Canvas 2D, Three.js/WebGL and Web Audio, rendered frame by frame with Puppeteer.
Project constants (from `segments/manifest.js`): **30 fps, 1920×1080, TAIL 1.5 s, DURATION 1226 s.**

---

## 0. How to use this digest

Read §1–§2 before you design your segment, §3–§9 while you build, and §13–§15 before you render. Every rule ends
with a source tag in brackets. Where sources disagree, a **[digest]** note gives the ruling for *this* film, a
restrained, resonant historical documentary, and not for a SaaS reel. Source numbers come from UI or social-video
contexts. Scale them for a 20-minute narrated film: holds get longer, pacing gets slower, and effects get rarer.
Each item tells you what to do, so treat it as an instruction.

**Source tags**

| Tag | Source |
|---|---|
| DA | 62656456/ai-film-skills · director-agent (+references) |
| CD | rampstackco · creative-direction |
| AT:dir / mot / gen / type / col / crit / perf | jangles-byte/atelier · design-direction, motion, generative-motion, typography-and-layout, color, critique, performance-craft |
| IA:dir / prin / beat / comp / col / bg | iart-ai · motion-art-direction, animation-principles, beat-sync-editing, shot-composition, color-motion, motion-background |
| MG:md / des / moves / cont / jump / vox / paper / glass / 3d / beat / sfx / mix / chart / mile / bible / fx / rev / safe / gate / tone | immamdouhaboammar/motion-graphics-skills · motion-director, motion-design, canonical-motion-moves, continuous-shot-engine, jump-cut-pacing, vox-explainer, paper-cut-motion, liquid-glass-25d, title-sequence-3d, beat-sheet-director, sfx-picker, audio-mastering-mixer, animated-chart, milestone-reveal, motion-bible, motion-effects, video-review-loop, safe-zone-qa, director-gate-check, tonejs |
| MG:FL | motion-graphics-skills · Failure-lessons/ (render-pipeline, composition-and-transitions, testing-and-verification, lessons-index) |
| LJ:mg / cam | liamrjohnston · motion-graphics (visual-critic, rejected-patterns, approved-references), cinematic-camera |
| RM:x | remotion-dev/skills · remotion-markup (x = transitions, light-leaks, motion-blur, timing, voiceover, 3d, color, audioviz, maps) |
| HR | haidrrrry · remotion-motion-graphics |
| MC | motion-canvas (packages/core + docs) |
| LM | liangming99 · motion-design-director |
| VE | theneoai · video-editor persona |

**Already in our engine.** `engine/ease.js` exports `out (0.16,1,0.3,1)`, `hero (0.22,1,0.36,1)`, `std (0.4,0,0.2,1)`,
`inn (0.7,0,0.84,0)`, `inOut (0.65,0,0.35,1)`, `soft (0.25,0.1,0.25,1)`, `back (0.34,1.56,0.64,1)`, `anticip`,
plus `ep(t,start,dur,fn)` and `env(t,start,end,in,out)`. `engine/math.js` exports `prog`, `onTwos`, `hash*`, `rng`
and `noise1/2/3`. `engine/post.js` holds the single film-wide lens/grade pass (`E.post.*`). Use these and do not
write your own copies [digest].

---

## 1. Director mindset & pre-production protocol

### 1.1 Decision priority (resolve conflicts top-down)
1. Approved script, VO and locked facts. 2. The film's style bible (MOTION.md / motion bible). 3. Factual,
accessibility and platform hard gates. 4. The narrative job of the beat. 5. Hierarchy, composition, readability.
6. Motion craft and continuity. 7. Taste and decorative finish. "A lower-priority preference never overwrites a
higher-priority lock." [MG:md]
- "The brief wins. Refinement preserves working identity and structure. Redesign replaces the visual world
  intentionally. Do not drift between the two." [MG:md]
- Three principles: audience experience first, form is content, restraint beats accumulation. [DA]

### 1.2 One governing idea → motion thesis
- Every major choice serves one **director's idea**, and that idea must change performance, space, camera, sound
  and edit at the same time. A theme sentence that changes nothing is decoration. [DA]
  Chain: `director's idea → audience endpoint → action → spatial design → camera/edit/sound`.
- Write a **motion thesis** paragraph for your segment. It answers: What is the visual world? What moves? What stays
  stable? Which recurring device carries continuity? What is the dominant transition family? What does the film
  refuse to do? [MG:md] Example form: "Cinematic dark stage where light reveals information and the camera moves
  only when the story changes depth." [MG:md]
- "A thesis prevents the film from becoming a bag of unrelated effects." [MG:md]

### 1.3 Segment pre-production protocol (do these in order)
1. **Establish truth.** Collect the exact VO, facts, dates, numbers and sources. Never invent a figure, quote, date or
   logo. Label illustrative content as illustrative. [MG:md][MG:vox][LJ:mg]
2. **Measure the audio.** The VO is the master timeline. Take word timestamps from `assets/transcript.json`, then
   detect pauses, breaths and emphasis words. Do not estimate timing from the written script. [MG:md][MG:beat]
3. **Find the visual idea per beat** on three layers: *Message* (what the viewer must understand or feel),
   *Mechanism* (the physical, graphic, typographic or spatial action that carries it) and *Handoff* (what from this
   beat becomes the next beat). "A good scene is rarely 'text appears, icon appears.'" [MG:md]
4. **Write the beat map** (format in §1.4).
5. **Explore before you commit.** Build 2–3 genuinely different openings that differ in *mechanism* (type-led,
   object-led, camera-led, depth-led, image-led, negative-space-led, material-led), not just in colour. Snapshot
   the first 2–4 s of each and judge first-frame strength, readability, originality and transition potential.
   "Do not pick the busiest route by default." [MG:md]
6. **Pick one visual lane per scene**: kinetic type, editorial collage, graphic system (paths, maps, diagrams), data
   motion, 2.5D or true 3D. "Do not mix lanes only to show technical range." [MG:md]
7. **Choreograph** (§5), then run the gates: still-frame gate, motion gate, technical gate, review loop (§14). [MG:md]

### 1.4 Beat-map format (one row per beat)
`Beat | start–end (s) | spoken phrase | visual idea/mechanism | visible text (1–5 words) | asset | transition in |
transition out | motion intensity (0–3) | SFX/music cue | what must NOT be shown yet` [MG:md][MG:beat][DA]
- "The visible text is not a transcript. Design the VO." The viewer hears a full sentence and sees 1–5 important
  words. [MG:md]
- Plan the end hold *now*. Compute `VO end − last key word`. If you need a longer clean hold than that gap, decide on
  a silent tail up front. [MG:md][MG:FL]
- Example beat-sheet cadence from a 21 s ad. Beats are 0.5–4.6 s and each one changes the visual mechanism. The hero
  climax gets **60 ms of isolated acoustic space**. [MG:beat][MG:cont]

### 1.5 Questions to ask of every shot
- **Why now? What changed? What does the viewer know now that they did not know before? What visual element
  survives into the next beat?** If the answer is "nothing", combine the beat with another or cut it. [MG:md narrative]
- Per-beat fields: information gained · emotional shift · visual mechanism · new question created · handoff. [MG:md]
- Shot direction note: PURPOSE / HERO (enters and lands how) / SUPPORT (yields how) / TEXTURE / TRANSITION IN-OUT
  (from the locked family only) / BEAT (the audio mark it lands on) / NOTE (deliberate break from the spec and why).
  [IA:dir]
- For a creative transition idea, specify: the surrounding action, the start image, the trigger (action or sound),
  the camera/focus/cut mechanism, the end image, and the continuity requirement. [DA]
- Cut motive check: a cut needs an information, emotion, action, sound, eyeline or rhythm motive. Every major scene
  needs a sound relation, and silence is a valid one. [DA]
- **"A scene may end unresolved, but it may not end unchanged."** [DA]

### 1.6 Anti-default director test
Reject the plan if it reduces to: establishing wide → standard coverage → reaction close-up → music swell → pretty
final image. Replace it with: the power geometry of the scene, a playable action, a sound relation, a cut logic, a
motif or physical carrier, and **one deliberately withheld element**. [DA]
- Banned words unless converted into execution: *cinematic, more tension, stronger, richer emotion, visual impact,
  more artistic, deeper theme*. Conversion example: "more tension" → "delay the reveal two beats; keep the object
  off-screen; let the sound arrive before the image." [DA]
- Physicalize inner states with space, weather, light, objects, rhythm and silence, but only when the element is
  *active* (it changes action, visibility or risk). Never use rain, fog or slow motion as decoration. [DA]
- Information design: audience knows first → **suspense**. Character knows first → **mystery**. Everyone learns
  together → **surprise**. Remind the audience of the danger and do not just show it once. [DA]
- Sound (Chion): causal listening (identifies a source), semantic listening (carries speech or code) and reduced
  listening (pure texture). Decide whether each sound confirms, contradicts, precedes or outlasts the image. [DA]

### 1.7 Narrative shapes & emotional curve
- Pick ONE dominant narrative job: reveal, explain, prove, document, provoke, invite... [MG:md narrative]
- Shapes: Reveal (mystery → clues → recognition → full reveal → resolve), Proof (claim → evidence → mechanism →
  consequence), Transformation (before → catalyst → changing system → after), Accumulation (one → several → system →
  scale → one meaning), Contrast (what is → what could be → what is → transformed). [MG:md narrative]
- Name the emotional register precisely, e.g. *controlled anticipation, quiet authority, mounting scale, investigative
  curiosity, earned relief*, never *exciting/premium/inspiring*. "A flat emotional curve produces flat motion even
  when every scene moves." [MG:md narrative]
- Scene rhythm model to detect gaps: hook → establish → accelerate → proof → **quiet reset** → build → payoff →
  clean resolve. "The middle commonly fails because every beat has the same density." [MG:md craft]
- Endings: "Resolve. Clear secondary elements. Let the final claim land… The final frame should be simpler than the
  densest middle frame." [MG:md craft][MG:md anti-slop]

### 1.8 Gate checks before you move to the next phase
- **Creative gate:** hook in the first 2 s, the core metaphor/continuous thread locked in the beat sheet, script
  length matched to runtime. **Technical gate:** renderer, fps and resolution chosen, asset manifest with zero
  missing fonts or stems. **Art gate:** bible locked, contact shadows on physical props, zero slop or cheap glow.
  **Audio gate:** foley mapped, loudness verified, 60 ms of silence before the hero hit. **Platform gate:** safe zones
  clean. Verdicts are PASS / WARN / BLOCK, and each needs on-disk evidence. [MG:gate]
- For large scopes, keep a coverage ledger (units covered or not covered) so you never silently skip material. If you
  stop, stop only at the end of a unit. [DA anti-laziness]

### 1.9 Segment hand-off (this project)
- Each segment must keep rendering through `end + TAIL (1.5 s)` so the next author can transition out of it
  [manifest]. Agree with your neighbours on the **shared object** that crosses the boundary (a line, the horizon,
  a light, a colour field). "Carry something across the boundary." [AT:mot][MG:md][digest]
- Put boundaries in breath pauses. Carry room tone or ambience across them as an L-cut (12–24 frames) [IA:beat][digest].

---

## 2. Creative / art direction rules

### 2.1 Write the philosophy before pixels
- Format: **Direction name (1–2 words)**, then 4–6 paragraphs of 40–80 words each (worldview, space and structure,
  colour and material, type voice, motion temperament), then **"Is not:"** with three rejections (at least one
  *tempting*), then **"Signature move:"** in one sentence a viewer could describe tomorrow. [AT:dir]
- Interrogation in under 150 words: purpose (one sentence), audience and their state, **3 adjectives + 3
  anti-adjectives** (the anti-adjectives are the more useful half), constraints, differentiation (picture the
  template version, then deviate in exactly 1–3 places). [AT:dir]
- "Every project gets **one signature move**… If nothing about the design is describable, the direction step
  failed." [AT:dir]
- On revision requests, update the philosophy first and the artifact second. "Drift begins when the artifact
  leads." [AT:dir]

### 2.2 Positioning (four axes) → our film
- Tone: Professional / Conversational / Playful / Provocative. Aesthetic: **Editorial Restrained** / Polished
  Standard / Controlled Maximalist / Expressive Maximalist. Audience: Authority / Peer / **Companion** / Coach.
  Sensory: Functional / Considered / **Resonant**. [CD]
- [digest] The film sits near Professional, Editorial Restrained (with Controlled-Maximalist peaks such as the storm
  and the jump), Companion/Authority and Resonant. Warning: "Resonance that is forced reads as manipulation…
  mistargeted reads as melodrama… vague reads as pretentious." [CD]
- Write a **rejection list** in the bible. "Often the most useful section." "The test of a good brief is whether the
  output would be different if a different brief were used." [CD]

### 2.3 Aesthetic vocabularies & style territories (blend at most two)
- **Editorial / Magazine**: serif display, paper and ink tones, one editorial accent (oxblood, forest), page-turn
  calm. Failure mode: a serif on a template with "none of the layout courage". [AT:dir]
- **Museum label**: the artifact is the hero, tiny precise captions, slow fades only. You still need one large
  element per view. [AT:dir]
- **Industrial / Blueprint**: hairlines, dimension ticks, annotation mono, draw-on lines. Failure mode: "ticks and
  crosshairs that measure nothing". Good for navigation and charts. [AT:dir]
- **Warm terminal / phosphor**: glow on ≤2 elements. **Data-ink (Tufte)**: colour only for data, tabular numerals,
  the key number unmissable. [AT:dir]
- Film territories: *Editorial print* (documentary, history: paper, photo, cutouts, printed diagrams), *Cinematic
  minimal* (darkness, light, few objects, slow camera, precise type), *Technical schematic* (paths, nodes, plans),
  *Tactile collage* (cutouts, tape, torn edges, handwriting). [MG:md creative]
- Choose by the job, not by taste, then "push it one notch further than feels safe — directions fail far more often
  from timidity than from excess." [AT:dir]

### 2.4 Anti-generic countermeasure
- Genericism is the *conjunction* of defaults on every axis. Deviate on 1–3 axes (one structural, one colour, one
  type decision with a 6×+ scale jump) and keep disciplined restraint everywhere else. [AT:dir]
- Litmus tests. **Describability:** can a viewer recall one thing tomorrow? **Swap:** would the frame fit any other
  film? **Screenshot:** can you find it in a folder of 20 within 3 s? **Default audit:** list five decisions and ask
  whether you chose each one or it chose itself. More than 3 self-chosen = redo. [AT:dir]
- "Premium is not a style." A frame feels considered when hierarchy is obvious, every element earns its place,
  materials agree, the accent is controlled, type has contrast and the frame survives as a still. [MG:md creative]

### 2.5 Build the visual system (MOTION.md / motion bible)
Lock **one** choice per row and reuse it everywhere. [IA:dir][MG:bible][MG:md]

| Row | What to lock |
|---|---|
| Easing family | the signature curve for ~90% of moves; "Two eases maximum: one in, one out. A third must justify itself." |
| Base timing unit | e.g. 0.6 s (micro 0.3, hero 1.2); all durations are multiples |
| Transition family | 2–3 families total (e.g. match-cut + shared-object + dip); no wipe or spin sampler |
| Stagger rhythm | one value (e.g. 120 ms calm, 60 ms cascade) |
| Motion intensity | travel ≤16–24 px for UI-like elements, scale 0.96–0.98→1, overshoot 0–2% |
| Hold discipline | ≥0.6 s stillness after each beat (calm-soft); text stationary ≥0.7 s |
| Type roles, colour roles, shadow/elevation system (≤3 levels), texture system, depth levels, camera rules, reduced density, **never-do list** | |

- The calm+soft cell (luxury, editorial, documentary) uses `cubic-bezier(0.4,0,0.2,1)`, long tails, base 0.6 s,
  slow crossfade plus gentle scale, 120 ms stagger, zero overshoot and ≥0.6 s holds. [IA:dir]
- "Consistency reads as confidence; variety reads as noise. When in doubt, reuse, don't invent." [IA:dir]
- Audit every shot against the spec: same easing family, durations on the base unit, only the locked transitions,
  exactly one hero per frame. "Any 'no' is a direction defect, not a craft preference." [IA:dir]

### 2.6 Motifs, recurring devices, concepts
- A motif must **establish → vary → pay off or break**. A repeated prop is only a payoff if its function or meaning
  changed. [DA]
- Concept library (use when the first idea is too literal) [MG:md concept]:
  - *One object, many states* (note → plan → stage). *One line through everything* (route → timeline → chart →
    underline).
  - *Light as narrator* (beam reveals only what matters). *Light becomes time* (a rotating beam becomes a dial).
  - *Freeze the important instant* (everything stops except one signal). *Camera dives into detail, then reveals
    consequence.*
  - *Desk of evidence* (documents accumulate with purpose). *Archive becomes present*. *Data becomes material*
    (dots → people). *Negative-space reveal*.
  - *Foreground handoff* (an object crosses the lens and becomes the next scene). *Before / during / after*.
  - Score candidates 1–5 on message fit, clarity, transition potential, originality, feasibility and readability.
    Use the scores to expose trade-offs, not to pick the highest number.
- Continuity device: a **shared function**, i.e. one element (light thread, line, horizon) drawn by one mathematical
  function across the whole timeline. [MG:cont]
- [digest] Candidate threads for this film: the horizon line, the ship's lights/portholes, the route line on the
  chart, the bioluminescent trail, the sun's disc. Agree on one per segment boundary.

### 2.7 Restraint
- **"Good direction is mostly subtraction: deciding what NOT to move."** Rank elements as hero / support / texture,
  animate down the list and stop early. [IA:dir]
- **One "wow" moment per piece.** "A second one cancels the first." [IA:dir] Use contrast to make it land: fast
  against slow, dense against quiet, stillness against movement. [MG:md]
- Final subtraction: for every visible effect ask whether it improves meaning, hierarchy, continuity, material,
  emotion or identity. If not, remove it. "Technical difficulty is not a reason to keep an effect." [MG:md]

### 2.8 Authenticity rules
- Keep a facts file with a source for every spoken or shown fact. Write "looks like", never "is", when you only have
  a similarity. Write "one reason", not "the reason". [MG:vox]
- Never fabricate proof: records, UI, metrics, stamps, serials, documents. "If evidence is missing, ask." [LJ:mg]
- Generated imagery is a source asset, not a visual system. Remove fake text, match light, perspective and grain,
  and crop decisively. "If the generated image is only decorative, question whether it needs to exist." [MG:md]
- Unify mixed assets with a shared grade, edge, shadow direction, grain or matte. [MG:md creative]

---

## 3. Pacing & editing

### 3.1 Cut criteria (Murch's Rule of Six, ranked)
Emotion > story > rhythm > eye-trace > 2D screen plane > 3D space. "If forced to sacrifice, protect emotion
first." Failure modes: cutting because a line ended, and fast cutting with no eye-trace gain. [DA]

### 3.2 Cut-rhythm numbers
- Average shot length: **documentary 4–6 s/shot**, commercials 2–3 s, music videos 1–2 s. [VE]
- The arc is Establish → Develop → Climax → Resolve. Cut every 8–16 beats → 8→4 → 1–2 → one long hold. Energy is the
  *derivative* of cut frequency: accelerate cuts to build, decelerate to land. [IA:beat]
- Phrase length by motion personality: Premium 8–16 beats with long holds, Corporate 8, Playful 4, Energetic 1–2 at
  the climax. [IA:beat]
- Reels heuristic: "Never >90 frames without a new visual element", plus HIT → hold 15–20 still frames → build →
  HIT. [HR] [digest] For our narrated film, read this as *new information or a changed state every ≤3–6 s*.
  Long holds are fine when something meaningful evolves inside them.
- Social hook: first 3 s decide. The opening must promise the film, and the first surprise lands within 5 s.
  [MG:vox][VE]

### 3.3 Holds
- "A hold is where understanding happens." Pattern: **prepare → move → settle → hold → hand off.** [MG:md craft]
- Holds are a design tool: "fast move → complete stillness → next move. Constant motion reads amateur; contrast
  reads expensive." [HR] Keep ≥3 moments of full stillness per piece. [HR]
- Minimums: ≥0.3–0.6 s stillness after each beat [IA:dir], text stationary ≥0.70 s [MG:bible], a datapoint held
  ≥0.5 s [IA:dir], 100–200 ms of breathing room before new motion [MG:des].
- In a looped or held state, "something small keeps living" (a progress creep, a second wave of light), so the hold
  never looks frozen. [MG:fx] [digest] Use sub-perceptual life (water, light flicker, grain), not floating text.
  The anti-slop list bans "perpetual floating".

### 3.4 Beat-sync math (when music is scored)
- `frames_per_beat = (60 / BPM) × fps`. At 30 fps: 90 BPM = 20 f, 100 = 18, 120 = 15, 128 = 14.06, 140 = 12.86.
  One 4/4 bar = `240/BPM` s (100 BPM = 2.4 s). [IA:beat][MG:beat]
- Round each **cumulative** beat (`Math.round(i·60/bpm·fps)`) rather than each step, or the cuts drift. Capture the
  **beat-1 offset**, because the grid rarely starts at 0:00. [IA:beat]
- Cut on phrases (2/4/8 beats), not every beat. Snap accents to the eighth grid (½ beat). Put the single biggest
  visual on the drop. [IA:beat] "Don't put a cut on every beat — let shots breathe between music hits." [VE]

### 3.5 VO-first timing (our master clock)
- Build a **cue table** from word timestamps and fire each visual cue a fixed `LEAD ≈ 0.1 s` before its word. This
  pattern landed every cue of a 58 s VO without hand timing. [MG:FL testing]
- "ASR gives timings, the approved script gives words." Never put ASR spellings on screen. [MG:FL]
- Do not cut on meaningless syllables. Text must not exit before it can be read or arrive after the VO has moved on.
  [MG:md][MG:rev]
- Keep pauses that are intentional dramatic beats. If unsure, preserve the pause. [MG:jump]

### 3.6 J/L cuts, match cuts, cut on action, speed ramps
- **J-cut** (B's audio leads its picture): dialogue and reveals, audio 4–12 frames early. Pulls the viewer forward.
  **L-cut** (A's audio trails under B): scene changes and ambience, 12–24 frames late. Smooths the change. [IA:beat]
- **Match cut** (graphic, motion, audio, or "invisible wipe"): align size, position and orientation at the cut
  frame. A 1–2 frame mismatch breaks it. An optional 1–3 frame blur bridge helps. [IA:beat]
- **Cut on action** roughly one-third into the motion. Match direction and velocity across the cut. In motion
  graphics, cut on a transform peak, not at rest. [IA:beat]
- **Speed ramp** (30 fps): 100% (f0–20) → ease-out to 25% (f20–28) → IMPACT lands on the beat at the slowest frame →
  ease-in back to 100% (f28–34). Use Bezier remap keys and keep a constant shutter or motion blur, or the slow section
  strobes. [IA:beat]
- Default is the **hard cut (~90% of cuts)**. "Dissolves should be rare." "Crossfades are not a fix for a bad cut —
  fix the timing first." [IA:beat][VE]

### 3.7 Jump-cut / pause rules (talking-head lessons, re-usable for VO edits)
- Keep silences < 0.35 s (natural speech). Trim > 0.45 s (dead air). Pad speech 0.06 s before and 0.08 s after.
  Never apply dynamic normalization at cut assembly, because it pumps. [MG:jump]
- Break automation patterns: "wide → punch → wide → hold → punch" is good, "wide → punch → wide → punch" is bad.
  Punch-in 1.12–1.15×, never > 1.20× on 1080p source. [MG:jump]

### 3.8 Anti-patterns
Uniform pacing ("reads as flat regardless of content"); a cut on every beat; a dissolve on every cut (the midpoint
drifts off-grid); every beat the same duration; no contrast between dense and quiet sections; a pause in narration
with no visual breathing room. [IA:beat][MG:rev]

---

## 4. Shot composition & camera

### 4.1 Grid & power points (1920×1080)
- 12 columns, margin 100, gutter 24 → content 1720, column 121.3, 4-column span 557.3. Formula:
  `col = (W − 2m − (n−1)g)/n`. 8 px baseline, spacing in multiples of 8 (4/8/16/24/32/48/64/96). [IA:comp]
- Thirds: verticals at 640 and 1280, horizontals at 360 and 720. Put the subject on a power point, not dead
  centre, unless you deliberately want symmetry for stillness or formality. [IA:comp]
- Grids only create tension when you span them asymmetrically (7+5, 8+4, 3+9). Equal splits everywhere = template.
  Allowed breaks: bleed, overlap, ±1–3° rotation (organic styles only), oversized numeral interruption, asymmetric
  void. Use one or two break types per design. [AT:type]

### 4.2 Safe zones
- 16:9: ~5% on all sides (96 px left/right, 54 px top/bottom). Broadcast title-safe is 10%. [IA:comp]
- 9:16 cutdowns: top 13% (250 px), bottom 19% (365 px), sides 6%. IG Reels: header 170, bottom 384, right rail 162 px
  from Y 900–1500. **Re-layout, don't crop**: scale the hero 25–40% larger, stack vertically, type +15–25%, no empty
  ceiling or floor > 20%. [IA:comp][MG:safe]
- Keep critical content out of the frame edge. When text is revealed by a polygon (light cone, torn edge), its box
  must sit inside the polygon at its widest reading frame. [MG:FL]

### 4.3 Hierarchy & frame design
- The viewer should know what to look at first within **0.5 s**. Use one primary focal anchor, an optional
  supporting anchor and an atmosphere layer. "Three equal anchors is a failed hierarchy." [MG:md creative]
- Priority order: **size > contrast > colour > position**. Adjacent hierarchy levels differ by ≤2 channels out of
  size, weight, colour, space, position and motion. [IA:comp][AT:type]
- Scale contrast: "Avoid medium-sized everything." Use one huge word against one small label, or one giant number
  against a small source line. [MG:md creative]
- Negative space is active. The hero is the element with the most space around it. An asymmetric void (7 of 12
  columns used) reads as confidence. [AT:type]
- Rotate composition families across a segment: full-frame type, asymmetric editorial, centred hero object, wide
  environment, close detail, depth composition, quiet proof frame, diagram, image-led, negative-space resolve.
  "Do not repeat the same centred card layout." [MG:md creative]
- Tests: blur or squint (2–4 masses in deliberate order), 200 px thumbnail, grayscale, edges and tangencies.
  [AT:type][MG:md]

### 4.4 Depth layers & parallax
| Depth | Role | Parallax speed | Treatment |
|---|---|---|---|
| Background | ambient | 0.1–0.3× | low contrast, desaturated, blurred |
| Midground | secondary/subject | 0.5–0.7× | sharp, supporting |
| Foreground | primary/close props | 1.0–1.5× | may blur as it crosses |

Sources: [IA:comp][MG:des]
- Counter-motion: if the hero enters left, the background shifts right at 20–30% speed. If the hero lifts, the
  shadow spreads and softens. [MG:des]
- Keep to 2–3 layers. More layers or bigger offsets feel seasick. Never parallax text. [AT:mot]
- Speaker or subject depth stack: far plane at −20% scale with 4 px blur, subject sharp at 100%, near plane at +15%
  scale with 8 px edge blur. [MG:glass]
- Depth cues (scale, occlusion, shadow, blur, perspective, parallax, lighting, focus): "Do not use all of them at
  once. Choose a few and keep them consistent." [MG:md creative]

### 4.5 Camera-move vocabulary
| Move | Use when | Numbers / recipe |
|---|---|---|
| Push-in (dolly) | focus, intimacy, tension, detail | scale 1.0→1.10–1.12 over 1600 ms ease-in-out, origin on the subject; optional bg blur 0→3 px [IA:comp] |
| Pull-out | reveal context, scale, recontextualize | 1.15→1.0 over 1800 ms [IA:comp] |
| Pan / move | discovery across space | translateX −300 px over 1500 ms; subject sits ~1/3 from the trailing edge, leading into open space [IA:comp] |
| Follow | moving subject | slightly off-centre, lead space ahead; exponential smoothing `pos = target + (pos−target)·exp(−k·dt)`, k 5–15, plus a dead zone [AT:mot] |
| Orbit | form changes meaning as you circle | true 3D only; 45° over 2 s; **never a full revolution** ("turntable product shot") [IA:comp][AT:gen] |
| Whip pan | high-energy location change | 280 ms ease-in out + 280 ms ease-out in, overlapped, directional blur; "Do not use it repeatedly" [IA:comp][MG:md] |
| Rack focus | transfer attention between depth planes | simulate cautiously in 2.5D with per-layer blur [MG:md atlas] |
| Crane-like | scale | [MG:md craft] |
| Dolly-zoom | unsettling, vertigo | keep subject size constant: `fov = 2·atan(tan(fov0/2)·d0/d)`, d 8→4 over ~2 s [IA:comp] |
| Fly-through / screen dive | continuous transition into a new space | push until an element fills the frame and becomes the next world [MG:cont] |
| Orthographic pivot | 2D map/UI → 3D world | rotate the camera axis ~45° while scaling the viewport [MG:cont] |

- "The camera should move because the story changes depth, scale, or location." Lock the camera until a spatial
  reason appears. "Do not add a camera drift to every still composition." [MG:md]
- **One shot, one intent**: never push + pan + rotate together. Use ease-in-out `(0.65,0,0.35,1)`, never linear.
  "Slower is more cinematic." Hero camera moves run 800–2000 ms. [IA:comp]
- "Motion of the camera and motion of the subject compete; pick one." Prefer a drift along a path with slight noise
  that holds still during interesting moments. [AT:gen]

### 4.6 Continuous-world camera rig (implementation)
- Build one world larger than the viewport (2–2.5× width) and move a shared camera with keyframed
  `focalX/focalY/zoom` arrays on one easing. Draw with
  `translate(W/2 − fx, H/2 − fy)·scale(z)` around `(fx, fy)`. Repeated adjacent keys = hold. Two near-identical
  final keys = stable end hold. Camera travel between holds is often 14–24 frames for short inserts. [LJ:cam]
- Choreography: open tight on something already moving → hold while the primary action completes → reveal the
  larger system → travel to the contrast or payoff → pull out while supporting objects finish → settle. "Camera moves
  to the next action; action completes during the hold." [LJ:cam]
- In a long camera travel, **every label belongs to its station**: it arrives with the station and leaves before the
  station exits frame. Otherwise labels get cut by the frame edge. Check each label at its station's keyframe
  (≥140 px from the edge). [MG:md craft][MG:FL]

### 4.7 Direction of travel = meaning
- With the reading direction (L→R, top→down) = natural progress. Against it = tension, return, "back". New content
  enters from the right or from below. Drilling deeper = push in or scale up. Enter and exit through the nearest
  edge: ease-out in, ease-in out. [IA:comp]
- Path language: angular = tense, curved = friendly, diagonal = purposeful, vertical up = growth, vertical down =
  settling or gravity, horizontal = journey or progress, radial inward = focus, radial outward = release.
  [MG:des emotion]
- **1/3 distance rule:** no element travels more than ~1/3 of the frame without an intermediate key or a scale or
  opacity change. [IA:prin][MG:des]

---

## 5. Motion principles

### 5.1 Every move needs a job
- Motion answers *what happened?* (feedback), *where did it go?* (orientation) or *is this alive?* (character).
  "Animation that answers none of them is decoration on a delay; delete it." [AT:mot]
- Film jobs: reveal, focus, connect, compare, transform, explain, anticipate, confirm, change scale, change
  location, change time, change emotional intensity. [MG:md] Ask what the move changes: attention, identity,
  location, scale, state, time, depth, ownership, cause and effect. [MG:md craft]
- Three pillars before any number: **Emotional intent** (drives easing, duration, amplitude), **Visual narrative**
  (setup → action → resolution), **Motion craft** (physics, arcs, follow-through). [IA:prin][MG:des]
- "You cannot judge motion from source code, and you cannot judge it from a still." Render it and watch it. [AT:mot]

### 5.2 The 12 principles, applied
| Principle | Motion-graphics translation (numbers) |
|---|---|
| Slow in/out | the biggest lever; never linear on anything the eye follows [AT:mot][IA:prin] |
| Timing | duration = weight: a 24 px badge pops in 150 ms, a full-screen panel takes 500 ms [IA:prin] |
| Follow-through / overlap | the hero lands at 400 ms, its shadow at 450, title at 460, subtitle at 500 (40–60 ms cascade); child elements trail 50–150 ms [IA:prin][MG:des] |
| Anticipation | a small counter-move of 60–120 ms (scale 0.95 dip, or y +8 px for 60 ms before rising) [IA:prin] |
| Staging | one motion owns attention: dim the rest to ~40% over 200 ms while the hero brightens or scales 0.9→1 [IA:prin] |
| Arcs | no L-paths; add a 10–20 px arc at the midpoint; Vector2.arcLerp-style curved paths [IA:prin][MG:des][MC] |
| Squash & stretch | keep volume: stretch 1.2/0.85, squash 0.8/1.15 (product ≈ 1); playful contexts only [IA:prin] |
| Exaggeration | push 10–20% past real physics so intent reads [AT:mot] |
| Secondary action | supports, never competes; cut it first when the budget is tight [AT:mot] |
| Straight-ahead vs pose-to-pose | simulation (particles, water) vs interpolation (titles); mixing them on one element reads as a glitch [AT:mot] |
| Solid drawing | one light source; shadows agree; occluders also elevate; scale implies depth consistently [AT:mot] |
| Appeal | one repeated motion trait (everything settles with the same curve) [AT:mot] |

### 5.3 Durations
| Class | Duration |
|---|---|
| Micro feedback | 70–150 ms [LM][AT:mot] |
| Small element / icon | 150–250 ms [AT:mot] |
| Card / panel | 200–400 ms [MG:des] |
| Hero / headline / full screen | 400–800 ms (easeOutExpo) [IA:prin] |
| Dramatic reveal | 600–1200 ms [MG:des] |
| Hero / documentary beat | 600–1600 ms [LM] |
| Cinematic camera | 800–2000 ms [IA:prin] |
| Logo / title reveal | 1200–3000 ms [LM] |
| Count-up | 600–1200 ms (UI) · 0.8–1.2 s (data story) · 1.8 s (canonical) [IA:prin][IA:dir][MG:moves] |
| Ambient loops | 2–20 s; backgrounds 8–30 s; generative 20–60 s cycles [AT:mot][IA:bg][AT:gen] |

- **Exits are faster**: ~20% faster [AT:mot], or 65–75% of the entrance duration [MG:des]. [HR] uses ~10 vs ~20
  frames.
- **Distance scaling**: `dur ≈ base · sqrt(dist/base_dist)` (300 ms at 200 px → 600 ms at 800 px) [IA:prin].
  Lookup: 50 px 0.8×, 100 1.0×, 200 1.3×, 300 1.5×, 400 1.6×, full screen 1.8–2.0× [MG:des].
- Personality duration palettes (quick / standard / slow): **Premium 350 / 500 / 800 ms**, Corporate 200/300/450,
  Playful 150/250/400, Energetic 100/180/300. [MG:des]
- Material scale: rigid ×1.2 (0% overshoot), paper ×1.0 (3–5%), fluid ×1.5 (5%), gas or smoke ×2.0 (0%), glass ×0.9
  (0%), elastic ×0.8 (15–25%). [MG:des] [digest] Water and fog in our film are slow and never overshoot.

### 5.4 Easing table (consolidated)
| Use | cubic-bezier | engine/ease.js |
|---|---|---|
| Enter, dramatic "premium" arrival (easeOutExpo) | 0.16, 1, 0.3, 1 | `out` |
| Hero landing, confident (easeOutQuint) | 0.22, 1, 0.36, 1 | `hero` |
| Standard / on-screen reposition | 0.4, 0, 0.2, 1 | `std` |
| Exit, accelerate away (easeInExpo) | 0.7, 0, 0.84, 0 | `inn` |
| Camera / move A→B (easeInOutCubic) | 0.65, 0, 0.35, 1 | `inOut` |
| Calm data / neutral | 0.25, 0.1, 0.25, 1 | `soft` |
| Overshoot ~10% (playful only) | 0.34, 1.56, 0.64, 1 | `back` |
| Anticipation dip (easeInBack) | 0.36, 0, 0.66, −0.56 | `anticip` |
| Decelerate (Material) | 0, 0, 0.2, 1 · MD3 decel 0, 0, 0, 1 | |
| Accelerate (Material) | 0.4, 0, 1, 1 · MD3 0.3, 0, 1, 1 | |
| MD3 standard / emphasized | 0.2, 0, 0, 1 · 0.05, 0.7, 0.1, 1 | |
| Map/route reveal (Ceaser "easeInOutCubic") | 0.645, 0.045, 0.355, 1 | |
| Sine ease-in-out | looping ambient | `sineInOut` |

Sources: [AT:mot][IA:prin][IA:dir][MG:des][RM:maps]
- Directional rule: entrance = ease-out, exit = ease-in, on-screen = ease-in-out, loop = sine, rotation or machine
  progress = linear. "The eye forgives a slow start far less than a slow end." [IA:prin][MG:des]
- **Linear is honest only for machinery**: progress bars, typewriter `steps(n)`, continuous rotation. [AT:mot]
- "Never ship default `ease` — it's the un-decided curve." [IA:dir]
- Hand-shaped speed curves: outgoing influence 10–25% and incoming 80–90% gives the "snappy premium" glide. A
  symmetric float is 50–65% both sides. [IA:prin graph-editor]
- **Perceptual scale**: linear scale looks like it decelerates at large sizes, so interpolate scale in log space
  (`s = s0·(s1/s0)^e`) [RM:timing][digest].
- **Posterize** (sample every Nth frame) is a valid artistic choice. [RM:timing]

### 5.5 Personality & emotion maps
- Tone matrix: Calm+Soft (luxury, editorial: long eases, holds), Calm+Sharp (premium tech), Kinetic+Soft (playful),
  Kinetic+Sharp (hype). "Pick one cell and commit. Mixing cells within a piece is the most common cause of
  'inconsistent' motion." [IA:dir]
- Emotion map: **Calm** = sine in-out, 500–1000 ms, gentle curves. **Sadness/weight** = slow, downward drooping
  curves, cubic in-out, 600–1200 ms. **Tenderness** = very subtle curves, 600–1000 ms. **Elegance** = (0.4,0,0.2,1),
  400–700 ms, long arcs. **Urgency** = straight lines, ease-out, 100–200 ms. **Surprise** = radial outward, expo-out,
  150–300 ms. **Confidence** = straight horizontal, ease-out. **Curiosity** = exploratory, mixed paths, 300–500 ms.
  [MG:des emotion]
- Never add overshoot to serious, financial or factual content. "It reads as toy-like." [IA:dir] Overshoot budget:
  premium 0%, errors 0%, feedback 2–5%, success 5–10%, celebration 15–25%. [MG:des]

### 5.6 Springs
- Model: `a = −k(x − target) − c·v` (m = 1). Semi-implicit Euler: `v += a·dt; x += v·dt`. Damping ratio
  **ζ = c / (2√(k·m))** is the character knob: <1 overshoots (0.5–0.8 "alive"), ≈0.85 premium default, 1 critically
  damped, >1 sluggish. "Tune ζ first, then k." [AT:mot]
- Recipes (m = 1): snappy k400 c38 (ζ ≈ 0.95, ~250 ms) · playful k300 c20 (ζ ≈ 0.58, one bounce) · gentle or heavy
  k120 c20 (ζ ≈ 0.91, ~450 ms). [AT:mot] Framer: snappy 300/30, bouncy 400/17, gentle 120/20, stiff 500/50. Counter
  spring: stiffness 60, damping 30. [IA:prin][HR]
- Motion-canvas presets (mass, stiffness, damping, v0): Smooth 0.16/15.35/1.88/0 (ζ ≈ 0.6) · Plop 0.2/20/0.68/0 (very
  bouncy) · Swing 0.39/19.85/2.82/0 · Strike 0.03/20/0.9/4.8 · Jump 0.04/10/0.7/8. MC simulates at a **fixed 120 Hz**
  sub-step and ends when `|to−x| < tol && |v| < tol` (default 0.001). [MC]
- Stability: semi-implicit Euler is stable only for `dt < 2/√k`, so sub-step or lower k. [AT:gen]
- [digest] **Seekable spring (closed form)**, for deterministic `seek(t)` with no state. Use ω = √(k/m),
  ζ = c/(2√(km)), A = x0 − target. If ζ < 1: ωd = ω√(1−ζ²), B = (v0 + ζωA)/ωd and
  `x(t) = target + e^(−ζωt)(A·cos ωd t + B·sin ωd t)`. If ζ = 1: `x(t) = target + (A + (v0 + ωA)t)·e^(−ωt)`.
- Use springs for physical or elastic material, and duration + easing for timeline-locked choreography.
  "Not every object needs spring physics." [IA:prin][MG:md atlas]

### 5.7 Stagger & choreography
- Offsets: list 40–80 ms, dense grid 20–40 ms, hero sequence 60–80 ms (calm 120 ms). Words 3 frames, cards 4–5,
  big blocks 6 frames. [IA:prin][AT:mot][HR]
- Total budget: <500 ms [MG:des], ≤450 ms [AT:mot], ≤600–800 ms [IA:prin]. Cap with `delay = min(i, 8)·offset` or
  `offset = window/n`. Formula: `total = (n−1)·offset + item_dur`. [AT:mot][IA:prin]
- Direction follows meaning: reading order, centre-out, or **distance from the cause**
  (`delay = dist·0.5 ms/px`); "the ripple reads as causality." Exits reverse order at half offset, or use a plain
  group fade. [AT:mot]
- **1/3 simultaneity rule:** with 3+ elements, ≤1/3 are in active motion at once. Element 1 settles as element 3
  starts. [IA:prin][MG:des]
- Overlap between sequential moves: 0% = methodical, 25% = brisk (standard), 50% = fluid, 75% = rapid. [MG:des]
- Sequence shares: setup 20–30% / action 30–40% / resolution 30–40%. Micro four-act split (400–800 ms):
  anticipation 15–20%, action 30–40%, reaction 15–20%, resolution 20–25%. [MG:des]
- Lead with the hero. Every element shares one spatial origin ("mixed directions = chaos"). All staggered items use
  the same easing and vary only their start time. [MG:des]
- Semantic stagger: do not give every word equal emphasis. "Do not stagger every list simply because it has
  multiple items." [LM][MG:md craft]

### 5.8 Layers & ambient
- Primary (hero), Secondary (reactions: shadow, label settling late), Ambient (texture). Ambient amplitude is
  10–20% of primary, sub-perceptual, never behind text being read, one ambient system per view. [MG:des][AT:mot]
- Ambient numbers: breathing scale 0.99–1.01 over 4 s (background) to 0.98–1.02 over 3 s; floating ±5–15 px over
  3–5 s using non-synced periods (4.0 / 5.5 / 3.5 s); gradient shift 8–20 s, ±10–20%; slow spin 10–30 s/rev.
  Dust or motes: 5–10 elements, 2–5 px, 20–50% opacity, 10–30 px/s. [MG:des ambient]

### 5.9 Dead-motion diagnostic (run in order, then re-render)
1 Anything linear? → ease. 2 Uniform durations? → weight scale. 3 Everything starts and stops together? → 20–40 ms
stagger plus ~80 ms secondary settle. 4 Overshoot absent (dead) or everywhere (cheap)? → ζ 0.8–0.9, with 1–2 hero
moments at 0.55–0.7. 5 Floaty? → drop one duration class, decisive ease-out, raise k. 6 Wrong property? → combine
transform + opacity (scale 1.02 + lift −2 px beats a fade alone). 7 Missing anticipation or exit? → entrances get an
origin (from 0.96 scale, 8–16 px), exits exist. 8 No causality? → originate at the cause. 9 Breaks on interruption?
10 Jank? → fix frame time first. 11 Should it exist at all? → delete. [AT:mot]
- Quick fixes: robotic → ease + arcs + stagger 50–100 ms. Too slow → ease-out instead of in-out, cut 30%. Cheap or
  flat → add secondary + ambient layers, 3–10% overshoot where allowed. Distracting → 1/3 rule, reduce amplitude,
  add 100–200 ms pauses. [MG:des troubleshooting][IA:prin]

### 5.10 Stepped motion ("on twos")
- For handmade, paper, stop-motion or printed material, quantize with `Math.floor(t·12)/12` (12 fps; `onTwos()` in
  engine/math.js). Keep camera and important spatial motion smooth unless the whole style is stepped. Contrast
  smooth 30 fps camera with 15 fps handmade marks. [MG:paper][MG:md craft]

### 5.11 Canonical moves (translated to our eases)
Rise (y +30–40 → 0, 0.6 s, power3.out ≈ cubicOut) · Pop (scale 0.6→1, 0.45 s, back.out(2.5); playful only) ·
Count-up (1.8 s, power2.out) · Checklist tick (0.35 s stagger) · Typewriter (`steps`, 0.04 s/char) · Slide-in
(0.4 s, power4.out) · **Blur-in** (20 px → 0, 0.5 s, power2.inOut) · Punch-in (whole frame +15%, 0.25 s, expo.out;
climax phrase only) · Reframe (frame shrinks to a card while a new element rises, 0.8 s, power3.inOut) · Bar fill
(1.2 s). Hero = pop or punch, support = rise or slide, background = blur-in or drift. [MG:moves]
- Bible defaults (example): card entrance power3.out 0.6 s / 30 px; accent pop back.out(2.5) 0.45 s; exit power4.in
  0.3 s. [MG:bible]

---

## 6. Transitions catalog

Governing rule: **"carry something across the boundary. A transition where nothing persists is just two screens with
a fade between them."** [AT:mot] Use the smallest transition-family set that can carry the whole film, ideally 2–3
families. [MG:md atlas][IA:dir]
Timeline accounting: a transition *overlaps* two scenes and shortens the total (60 + 60 − 15 = 105 frames). An
*overlay* (light leak, flash) sits on the cut point and does not change duration. [RM:transitions]

| Transition | What it is | Motivated when | Canvas/WebGL sketch |
|---|---|---|---|
| **Hard cut** | instant | default (~90%); tension; time jump | swap scene at frame N; cut on a transform peak or a VO breath [IA:beat] |
| **Hard cut + micro fade** | 2–4 frame soften | cuts that flash harshly | `globalAlpha` ramp over 2–4 frames [LM] |
| **Match cut** | shared shape, position, scale, motion vector or composition | two moments rhyme (porthole → sun disc → pupil) | register both forms at the cut frame (same size and centre, ≤1–2 px error); match velocity; optional 1–3 frame blur [IA:beat][MG:md] |
| **Shared-object handoff** | one element survives and changes role | continuity is the point (route line → horizon) | draw the object in a global layer above both scenes; interpolate its transform from A's terminal state to B's start [MG:md craft] |
| **Container transform** | an element expands into the next state while keeping its identity | detail ↔ context (photo → full scene) | interpolate a rect (x, y, w, h, radius); clip B inside it; fade B's contents in after the container passes 60–70% of its travel; leave a faint ghost at the origin [LM][MG:fx] |
| **Occlusion / foreground wipe** | an object passes the lens and reveals B | physical worlds (wave crest, hull, paper sheet) | draw a large fg object (blurred, 1.2–1.5× parallax) across the frame; switch scenes while coverage is 100% [MG:md craft] |
| **Mask / shaped wipe** | one scene's mask becomes the next reveal | the shape has a reason (water line, light cone, torn edge) | `ctx.save(); ctx.clip(path)` with an animated path, or a shader `step(edge(uv), progress)` with a soft feather [MG:md atlas] |
| **Light handoff** | beam, flash, screen or shadow carries the change | night scenes, revelation | additive light grows to cover, swap, recede; flash 1–2 frames max; `E.post.flash` [MG:md atlas] |
| **Material handoff** | ink, water, smoke, paper becomes the bridge | material is in the story (sea water) | displacement-noise dissolve in shader: `mix(A, B, smoothstep(p−w, p+w, fbm(uv·s) + uv.y·k))` [MG:md atlas][digest] |
| **Camera handoff / fly-through** | camera keeps moving while the world changes | continuous-thought sequences | MC zoomIn: B scales 1/s→1 and A 1→s together with timing `easeInOutCubic(v²)`; A alpha `clampRemap(0.5→0.9, 1→0)`, B alpha `clampRemap(0.1→0.5, 0→1)`, default 0.6 s [MC][MG:cont] |
| **Scale-through / push-through** | A scales to 1.3 and fades as B scales 0.8→1 under it | entering a detail | 8–14 frames [HR] |
| **Whip pan** | fast directional pan blur | energetic location jumps; rarely | A translates −120% in 280 ms ease-in, B +120%→0 ease-out, overlapped; directional blur by sub-frame accumulation; hide the cut mid-whip [IA:comp][HR] |
| **Crossfade / dissolve** | opacity blend | soft mood, no spatial relation | 200–300 ms with 30–50% overlap, never through blank [AT:mot]; **never between two saturated fields** (it makes an off-palette third colour); inspect the midpoint frame [MG:FL] |
| **Fade through** | A out, short gap, B in | unrelated content switches | opacity plus micro scale plus a hold gap [LM] |
| **Dip to black/colour** | full fade to a field | chapter breaks, passage of time | sparingly; `E.post.fade` ("avoid; prefer motivated transitions") [engine/post.js][IA:beat] |
| **Shared axis slide** | both scenes slide on one axis | ordered progression | MC slideTransition: both translate by frame size, default 0.6 s [MC][LM] |
| **Iris / shape reveal** | circle or porthole opens | POV, focus, archival framing | radial clip radius with ease-out; feather 2–6 px [digest] |
| **Shutter slats** | slats narrow toward their centre lines, left→right | reveals of photos and documents | 7 slats, each starting one beat later, last gone at ~1.7 s, faint light edge on each slat [MG:fx] |
| **Pixel / noise dissolve, displacement, heat-haze** | per-pixel transform | when the behaviour *is* per-pixel | fragment shader; avoid "generic glitch, RGB split everywhere" [MG:md atlas] |
| **Light leak overlay** | warm organic flare over the cut | memory, warmth, film-stock feel | seeded noise blobs in screen/add, progress 0→1 = evolve then retract; doesn't shorten the timeline [RM:light-leaks] |
| **Defocus to pinpoint** | blur the world into one point of light | endings, transitions to memory | `E.post.blur` ramp + vignette; end on a solitary light [MG:cont][engine/post.js] |
| **Particle / filament wrap** | energy line wraps an object and becomes its material | continuous-shot style | thread path from one shared function; deposit texture as it passes [MG:cont] |
| **Freeze & isolate** | freeze a moment, isolate the subject, graphics enter | proof, turning point | hold frame + desaturate surround + annotate [MG:md atlas] |
| **J/L audio cut** | sound leads or trails picture | almost any picture cut | B's audio 4–12 frames early, or A's audio 12–24 frames late [IA:beat] |
| **Speed ramp** | retime into an impact | the jump, the reef impact | §3.6 recipe; constant shutter [IA:beat] |

- Do not transition the transition (wipe + spin + fade). "Transition without handoff" is slop. [IA:dir][MG:md anti-slop]
- An outgoing scene must not disappear before the handoff lands, and incoming type must not appear before its
  carrier. A clip ends at or after the end of its last exit tween (frame rate can hide the gap; check the timing
  contract). [MG:rev][MG:FL]

---

## 7. Typography & layout in motion

### 7.1 Pairing & roles
- **One-axis rule**: two faces must contrast decisively on exactly one axis (class, weight, width, construction) and
  agree on the rest. Use at most two families, plus a mono for data. [AT:type]
- The display face is the voice and the text face should be invisible. Inter, Roboto and system-ui as display =
  "a decision not to have a voice". [AT:type]
- Type is architecture. Define roles: **hero display, main statement, question or human voice (quotes), support,
  label, micro detail**. "Do not make every headline Black or ExtraBold." "One expressive type moment is stronger
  than six." [MG:md creative]
- [digest] Fonts in `assets/fonts` that carry **Cyrillic**: Alumni Sans, Caveat, Dela Gothic One, IBM Plex Mono,
  Old Standard TT, PT Mono, Unbounded. **Latin-only**: Big Shoulders Display, Instrument Serif, Special Elite. Any
  Russian text set in a Latin-only face *will fall back*. Check each script separately (§15.5). Suggested roles,
  subject to the bible: Old Standard TT = Soviet print and documents; IBM Plex Mono / PT Mono = coordinates, logs,
  data; Special Elite = typewritten files (Latin only); Instrument Serif italic = quotes; Unbounded / Dela Gothic One
  = constructivist display; Alumni Sans / Big Shoulders = condensed headlines; Caveat = hand annotations.

### 7.2 Scale, tracking, leading
- Ratio 1.5–1.618 for film or poster contexts. The top end goes 4–8× body. "Templates stop at ~3×." [AT:type]
- Landscape hero 100–160 px at 1920 wide, weight 600–800, tracking −0.03 em, leading 1.05 [HR]. Small labels at
  "at least twice the size you think they need". [MG:3d]
- Leading: display ≥48 px 0.95–1.1; headings 1.1–1.25; body 1.4–1.6; labels 1.3–1.4. Tracking: display −1% to −3%;
  small caps and labels +5% to +12%. Weight jumps ≥300 (400 vs 700). [AT:type]
- Measure 45–75 characters. Headlines 8–20 ch. Centred text max 3 lines. "Narrow headline wall" = widen the zone or
  show fewer words. [AT:type][MG:md anti-slop]
- Use real quotes and dashes (“ ” – —) and non-breaking spaces before units. Use `tabular-nums` (or a mono) for any
  number that changes. [AT:type]
- Pixel gaps, not `em`, between large text blocks (em resolves against the parent's font size). [HR]

### 7.3 How much text
- "The voice can carry a sentence while the frame carries one phrase." Ask what the viewer hears and what *one* thing
  they should see. [MG:md creative] "Transcript wallpaper" (most spoken words on screen) is slop. [MG:md anti-slop]
- Never loop-animate text the viewer is still reading. Show a caption *after* a count completes, not during. Do not
  reveal body text the viewer is reading. [IA:dir][AT:mot]
- Text must be readable at full speed without slow motion and stay ≥0.7 s stationary. Elements >40 px for motion,
  >100 px for detail. [MG:bible][MG:des checklist]
- Highlight ONE word per headline (accent colour, a drawn underline, or a pill that scales in 5 frames after the
  word lands). [HR]

### 7.4 Kinetic-type recipes
- Choose the smallest unit that helps meaning: phrase, line, word, glyph or outline. "Per-character animation is not
  automatically more advanced." [MG:md craft]
- **Masked rise**: text rises 100% of its line height inside a clip rect. Ease `hero`, 500–700 ms. Lines stagger
  80–120 ms. [MG:md craft][digest]
- **Word-by-word**: each word y +30 → 0 plus opacity, 3-frame stagger (snappy spring). [HR]
- **Type as matte**: imagery (sea, archive photo) visible only inside the glyphs. A fill edge with a thin accent
  marker rises over ~1.35 s, and the second line reveals from behind a hard cut line. [MG:fx #09][MG:md atlas]
- **Elastic width**: only on real variable `wdth` axes, on a locked baseline, spreading from the middle letter.
  "Do not fake width by stretching glyphs." [MG:fx #10][MG:md atlas]
- **Text → layout**: the headline is the *same text moving* (never retyped). Its halves travel to new places, then
  the kicker, image, body and quote arrive in reading order. [MG:fx #11]
- **Type on path**, baseline travel, crop reveal, scale compression, word handoff (a word from line A becomes part of
  line B). [MG:md craft]
- **Typewriter**: `steps(n)`, ~0.04 s/char. Use only for real typed material (telegraph, log, file). The Vox look
  explicitly bans typewriter. [MG:moves][MG:vox]
- **Text morph**: MC `textLerp` replaces characters left→right while morphing length. Use it for scramble or decode
  of a date or name. [MC]
- **Annotations**: a hand-drawn circle or underline driven by progress 0→1 over ~25 frames. Marker circle draws
  first, then its label. Stamp: 1-frame snap, tilt −3…+5°, imperfect but legible. [RM:text-highlights][MG:vox][MG:paper]

### 7.5 Number counters
- Use easeOutQuint or Expo so the final digits settle slowly and feel exact. 600–1200 ms (data story 0.8–1.2 s).
  **No overshoot on quantities.** Hold the final value ≥0.5 s, then a 0.7 s still hold ("stillness sells
  accuracy"). [IA:dir][AT:mot]
- Use `tabular-nums` or every frame jitters. Add a 120 ms colour pulse in the direction of change. Add soft ticks
  while counting. [AT:mot][HR]
- Never round, inflate, add "+" or swap a target for a result. Sample data carries an "illustrative" label on
  every frame. [MG:mile][MG:chart]

---

## 8. Color

### 8.1 OKLCH foundations
- Design in `oklch(L C H)`; hex is only an export format. Equal L steps look equal. Contrast is mostly ΔL: body text
  ΔL ≥ ~0.55 from its ground, large display ≥ ~0.40. [AT:col]
- Chroma collapses toward L 0 and 1. Ramps need a chroma *curve* that peaks at L 0.55–0.65. Keep C ≤ 0.15 for sRGB
  safety. [AT:col]
- Hue drift ≤15° across a ramp (shadows cool, highlights warm) feels organic. [AT:col]
- Hue registers: trust/calm 230–265; clinical/cold 190–210; growth 140–160; warmth/paper 60–90; urgency 25–45;
  night/mystery 280–320. Rotate 15–30° off the domain default. [AT:col]

### 8.2 Palette construction
- Steps: anchor hue → **tinted neutral ramp** (C 0.005–0.02 at the anchor hue; "pure grey reads dead") → accent ramp
  → semantic or data colours. [AT:col]
- Size: **1 primary + 1 accent + 2–3 neutrals**. Accent 90–180° from the primary (complementary = boldest, analogous
  = calmest). [IA:col]
- Proportion: 60-30-10 (neutral / secondary / accent ≤10% of pixels) [AT:col]. For branded editorial work, 65–85%
  ground and neutrals, 10–25% ink and imagery, 5–15% signal [MG:md creative]. **One loudest colour per view.** [AT:col]
- Name roles before choosing effects: ground, surface, ink, muted ink, signal, secondary signal, proof colour, image
  colour. "A brand accent should usually act like a signal, not a flood." [MG:md creative]
- "Brand colour as event": keep the accent restrained, then let it flood the frame *once* at the most important beat.
  [MG:md concept] (Arrive at it via a shared object, never a crossfade [MG:FL].)

### 8.3 Dark scenes (night sea, storm)
- The ground is dark, not black: L 0.10–0.22 with anchor chroma 0.008–0.03. "`#000` is flat and makes everything on
  it look like clip art." [AT:col][AT:gen]
- Text L 0.90–0.93 (not 1.0), muted ~0.65. Dark-scene accents: L 0.70–0.85, C 0.12–0.18. "Max chroma vibrates on
  dark backgrounds." [AT:col][IA:col]
- In the dark, elevation = lightness (+0.03–0.05 L per level). [AT:col]

### 8.4 Color as narrative state
- Emotion pairings: blue = trust/calm (smooth); green = growth (upward); red = alert (sharp, *flash then settle, don't
  sustain*); orange = warmth/energy; purple = mystery (slow reveal). "Success: transition TO green (don't start with
  it)." [MG:des emotion]
- Colour carries worldview, conflict and character arc across a film. [DA] [digest] Plan a film-level colour arc in
  the bible and keep each segment inside its band. Change state with motivated light (dawn, sun, bioluminescence,
  reef), not with arbitrary grade jumps.
- Generative colour must be **earned**: map it to a real property (velocity = heat, age = cooling, density = glow).
  Keep the hue span to 40–70°. "Rainbow hue… is the loudest possible signal that no decision was made." [AT:gen]
  Emission ramp: `L = 0.06 + v·0.90; C = 0.02 + v·0.13·(1 − v·0.55); H` shifts with v. Chroma rises with lightness,
  then falls at the core. [AT:gen]

### 8.5 Interpolation & gradients
- Interpolate in OKLab/OKLCH, never in raw sRGB (blue→yellow goes grey, blue→red goes muddy). Pick the shorter or
  longer hue arc deliberately. [IA:col][AT:col]
- **Never opacity-crossfade two saturated fields**: the midpoint frames produce a third colour that belongs to
  neither. Cut, use a shaped mask, or carry an object across. [MG:md craft][MG:FL]
- Premium gradients: stacked radials over a base, drift 8–20 s, plus grain at 3–5% to kill banding. "Fast gradient
  motion looks like a screensaver." [IA:col]

### 8.6 Grading (in `engine/post.js` order)
- Order: exposure / white balance → contrast (black and white points) → midtones / saturation → split-tone → unify
  (overall tint or LUT, gentle vignette). "Reordering changes the result." [IA:col]
- Split-tone teal shadows (H ~190) and orange highlights (H ~40), strength **<0.15**. "Over-tinting reads as a cheap
  Instagram filter." [IA:col]
- Gradient map: luminance → 3–4 stop ramp at 70–90% mix. "How most 'cinematic' looks are actually made."
  Lift/gamma/gain: `c = pow(max(c·gain + lift, 0), 1/gamma)`. [AT:gen]
- Levels: black 0.03, white 0.95, gamma 1.1, output 0.02–0.98. Curves: 2–32 strictly increasing points. Run primary
  adjustments before any LUT. [RM:color]
- Grade the whole piece with one chain so cuts match. Neutralize first, then match, then apply one creative grade
  that suits every location ("unity through contrast"). [IA:col][VE]
- Glow is a spotlight, not a material: ≤1–2 glowing elements per view, glow inherits its element's hue, start at
  `0 0 12px` 25–40% and halve it if you can see it as a shape. Animate glow only if the energy is real. [AT:col]

### 8.7 Delivery colour
- Tag BT.709 (primaries, transfer, matrix). H.264 video is usually limited/TV range: milky blacks = full data read as
  limited, crushed blacks = the reverse. Keep range consistent and tag it. Verify with `ffprobe` and a 50% grey patch
  (128 must stay 128). "Never grade or approve to QuickTime" (extra ~1.96 gamma); use Chrome as the reference.
  [IA:col]

---

## 9. Infographics & data animation

### 9.1 Data-motion rules
- Motion shows change, ranking, comparison, accumulation, flow, causality. Avoid decorative bouncing bars, axes that
  change silently, distorted pie slices, and "arbitrary easing that makes one value look more important". "Never
  distort the evidence to create drama." [MG:md craft]
- Title, labels and axis never move. Only the data changes. "Nothing fades out and gets replaced." [MG:chart]
- Transition between data states with a cross-dissolve. "Never wipe a chart." Stagger 80 ms per series or bar.
  [IA:dir]
- Data-ink: no chart junk, hairline axes, **direct labels** instead of legends, small multiples. The key series gets
  chroma and weight, context series are grey hairlines. Title top-left on the reading path. [AT:dir][AT:type]
- Categorical colours: equal L (±0.03) and C (±0.02), hues ≥40° apart, ≤6 series. Sequential: monotonic L
  0.90→0.30 with ≤40° drift. Diverging: two ramps meeting at a neutral midpoint (C ≤ 0.02). Never encode meaning in
  hue alone. [AT:col]

### 9.2 Chart recipes
- **Four states**: start → the one change (~2 s) → hold with the headline value labelled (~4 s) → return (1.5 s,
  loops only). For narration, use *hold mode*: play once and stay. [MG:chart][MG:fx]
- **Chart morph (bars → line)**: bars slim to hairlines left→right one beat apart. From ~0.84 s the line *draws on*
  through the same values, with the fill fading in under it. A dot pops as the line reaches each point, and the last
  point gets the accent plus a value tag at ~1.5 s. "The values never change… so the viewer trusts it." [MG:fx #05]
- **KPI escapes dashboard**: four accent corner brackets snap around the chosen tile (first 0.9 s), the rest dims,
  and the tile scales forward *from its exact position* with dashed guides from corner to corner. [MG:fx #06][MG:md concept]
- **Bar / line growth** for change over time, **rank transition** for order changes, **accumulation** for many units
  → one total, **spatial data** when location matters. [MG:md atlas]
- **Grid**: "They all look the same": many identical tiles, then one breaks the pattern. **Before / after**: same
  card, the date chip flips. **Label call-out**: a marker circle draws itself, then the label. [MG:vox]

### 9.3 Milestone / particles-into-number
- Draw the number in bold on an offscreen canvas, sample its filled pixels as targets and give **most points to the
  glyphs** (~2,700 of 3,200 points, 2.5 px, near-full opacity). Otherwise the digits read grey at small size.
  The rest are dim drifting stars. [MG:mile]
- Timing (12 s): drift 0–2 s → pull into the number with a long, staggered, gravity-like ease (2–6.5 s) → thin accent
  line draws under it (6.5–7.5) → label fades and rises 12 px (7.5–8.5) → hold with shimmer only → return.
  "Premium… not a party. No bounce, overshoot, confetti." [MG:mile]
- Seed every position. Create the canvas context with `willReadFrequently: true`, or Chrome may switch drawing modes
  and produce different pixels on the same frame. [MG:mile]
- Particle-logo variant: dots fly on gentle arcs with short trails, starting at slightly different moments
  (leftmost first, seeded), over ~1.1 s. The finished mark is crisp because the dots sit on a grid inside the real
  shape. [MG:fx #16]

### 9.4 Scale & comparison
- Show quantity with **depth and scale on one readable plane**: a face-on depth stack with ≤3 visible items and
  small alternating offsets and tilts. The nearest item leaves *by moving past the lens, never by turning
  translucent*. A two-wall perspective corridor collides at the vanishing point, which is exactly where the headline
  sits. [MG:FL][MG:md craft]
- "Corridor of proof": use few items, depth implies abundance, one proof item comes forward at a time. [MG:md concept]
- Accumulation arc: one → several → system → scale → one meaning. Data becomes material (dots become people, a line
  becomes a route). "Keep the underlying values truthful." [MG:md narrative/concept]
- "Scale is spatial, not an arbitrary chart/headline": a tight action, then a pull-back reveals the coherent wall of
  results. [LJ:mg approved]

### 9.5 Maps & routes (the swim, the ship's track)
- **Route draw with a hot head**: draw the line by length (`lineSliceAlong(0, L·reveal)`). The last ~3% is drawn as
  a bright head (core + glow layers) that fades out over 0.5 s after completion. Layers from bottom: glow (w11, op
  0.32, blur 6) → core (w3) → head glow (w16, blur 9) → head (w4.5). [RM:maps]
- **Event triggers by arrival**: each place triggers when the line reaches it (`trigger = START + stop·(END−START)`),
  then runs **constant-duration** phases (border draw 2.5 s → fill 1.0 s with opacity overshoot to 1.25× then settle
  → label rise 0.7 s). Driving by time-since-trigger keeps long borders from flashing by. [RM:maps]
- Labels are an overlay projected to screen space every frame, not baked into the map. [RM:maps]
- **Fixed plate camera**: render the map once at the maximum zoom of any waypoint into an oversized canvas (≤4096 px;
  3840×2160 for 1080p) and move it with translate + scale ≤1. Re-rendering the basemap per frame shimmers. Apply the
  same transform to every overlay. Split into two plates if the route does not fit. [RM:maps]
- Path draw via `lineDashOffset` / `setLineDash`: with round or square caps, a dot appears at the start before the
  draw begins. Hide the path until its cue, or use butt caps. [MG:FL]

---

## 10. 2.5D / paper-cut / liquid-glass / 3D-title techniques

### 10.1 2.5D vs true 3D
- 2.5D is enough when the illusion comes from planar layers (bg, mid, hero plane, foreground occluder; parallax,
  shadow, occlusion). "It is often cheaper and clearer than true 3D." [MG:md craft]
- Use true 3D only for geometry, real camera parallax, changing occlusion, materials, lighting, or surfaces revealed
  by rotation. "3D because 3D exists" and "fake 3D" (a flat PNG rotating as if it had hidden sides) are slop.
  [MG:md atlas/anti-slop]

### 10.2 Paper-cut / stop-motion / editorial collage
- Use it only when documents, fragments, evidence or memory are part of the story. "Do not use it merely to make a
  normal promo feel retro." [MG:paper]
- **Evidence hierarchy**: 1 anchor, 3–6 evidence pieces, only the connectors that explain relationships, and 1
  resolution. "Too many pins, strings, and stamps turn evidence into decoration." [MG:paper]
- Physics: step at 12 fps; small rotation differences per piece; directional shadows from one light
  (`2px 4px 8px rgba(0,0,0,.22)`, with a higher offset on one corner for a lifted curl); heavy paper stops quickly;
  replace a sheet by covering or removing it, never by morphing; cutouts drop onto the table in one frame with a tap
  sound. [MG:paper]
- Typography like print: newspaper scale contrast, short label strips, stamped classifications, typed captions, one
  large phrase. Never a paragraph on every scrap. [MG:paper]
- **Vox-style documentary look**: torn paper strips and cards with small drop shadows, halftone dots, paper grain and
  fine film grain, **chromatic fringing at the frame edges only**, soft vignette, bold condensed type set as blocks,
  stepped motion on twos (hold each pose 2 frames at 24 fps). No typewriter, no gradients on text, no glow, no
  bounce. [MG:vox]
- Vox shot types: kinetic statement (3 short lines of condensed type on a torn strip), paper cards (several things at
  once), before/after, label call-out, counter, grid. Write 8–14 shots of one sentence each, and make the last shot a
  takeaway of ≤5 words. [MG:vox]
- "Texture alone does not create materiality. Weight, overlap, timing, and shadow do." Texture sits beneath the
  hierarchy. "Paper grain belongs to paper. Film grain belongs to footage." [MG:paper][MG:md creative]
- Hard-fail cases: digital cards in paper colours, every piece entering with the same move, shadows disagreeing,
  text unreadable under texture. [MG:paper]

### 10.3 Liquid glass / lens / refraction
- Clear glass, not frosted: low fill (white at 5%), a displacement map from fractal noise (baseFrequency
  **0.015–0.025** = smooth lens, 0.05–0.1 = pebbled), scale ~12, saturate 180%. The bevel is asymmetric: top and left
  catch the key light (border 40% / 20%), bottom and right are dark (10% / 5%). [MG:glass]
- WebGL translation: offset the background UV by a normal or noise gradient × strength, plus a Fresnel-like rim
  highlight on the key-light side [digest].
- **Glass focus lens**: only the text inside the lens is sharp, at 1.1× magnification, with two faint tinted copies a
  fraction of a pixel either side (dispersion), a highlight across the top and a double rim. [MG:fx #14]
- [digest] Several sources ban glassmorphism as AI slop [LJ:mg][AT:dir]. In our film, use refraction only for
  physically motivated optics: the water surface seen from below, the porthole glass, a diver's mask, a magnifier
  on a chart.

### 10.4 3D title sequence recipe
- One world that fits the story; low-poly geometry; a wet reflective ground; fine seeded rain. Signs and posters are
  canvas textures on planes with *subtle* bloom ("never blown out"). The camera makes **one slow, steady dolly
  forward and slightly up**, with no shake or spin. The title lands in the last third, lower-left, white with the key
  word in the accent colour. Keep the ground under the title dark so no reflection shows through the letters. A low
  drone and soft rain fade in over 1 s. [MG:3d]
- Check frames at 1 s, the middle and the last second: signs readable at phone size, nothing mirrored behind the
  title, the first second already reads as film. [MG:3d]

### 10.5 Continuous-shot engine
- **Shared function invariant**: the light thread's terminal position *and velocity* in scene N become the origin of
  scene N+1. Colour temperature and glow radius interpolate smoothly. Store control points normalized 0–1, evaluate
  cubic Béziers (De Casteljau), and project through the camera matrix when going 2D → 3D. [MG:cont]
- Hide transitions inside camera moves: push into a lit element, whip around a corner, dive into defocus, swoop from
  aerial to three-quarter view. [MG:cont]
- Physical believability: bevelled edges, soft dents, **contact shadows that grow as an object approaches the
  ground**. [MG:cont][MG:gate]
- Hero lock: music cuts to silence for a 60 ms breath, the hero hit triggers the reveal, a slow ambient glow passes
  beneath. End card: defocus into a solitary pinpoint of light. [MG:cont]

### 10.6 Three.js discipline
- Everything is driven by the frame or time value. No `useFrame`, no clock, no self-animating shaders or models
  ("causes flickering during rendering"). Always add ambient light (0.4) and a directional key light (0.8, from
  5,5,5). [RM:3d]
- Instancing: one `InstancedMesh` with per-instance matrices. Move the simulation to a data texture above ~50k
  instances. Additive particles need `depthWrite: false`. Use size attenuation, exponential fog
  `1 − exp(−t·density)` (linear fog washes out) and a blurred far layer. "A particle system with no depth cues is a
  2D particle system that costs more." [AT:gen 3D]
- Raymarching (ocean or caustics in SDF): cost = pixels × steps. Render at fixed half resolution and upscale for soft
  or foggy scenes. 5-sample AO along the normal; soft shadows via `res = min(res, k·h/t)`. [AT:gen 3D]
- WebGL capture needs `preserveDrawingBuffer: true` (and ANGLE GL in headless Chrome). [RM:maps][RM:light-leaks]

---

## 11. Generative motion, particles, noise fields, post-processing

### 11.1 Art-directing generative work
- Write the intent first: "embers on a thermal", "ink dropped in still water". "A tutorial renders the algorithm. A
  piece renders a decision." [AT:gen]
- One idea (two stacked systems are almost always worse). Use a composition, not a frame: varied density with voids,
  crop in past the safe point, offset the centre. Evolve slower than feels right ("halve it, then halve it again").
  [AT:gen art-direction]
- Tuning order: field scale → speed → trail alpha → population → colour ramp endpoints → evolution rate.
  [AT:gen art-direction]
- Tests: **still** (any paused frame is a good image), **minute** (run 60 s; trails saturate, particles pool, energy
  dies or explodes between 10 and 60 s), **thumbnail** (200 px still shows structure), **description** (one sentence
  that isn't the algorithm's name). [AT:gen]

### 11.2 Noise & fields
- Use one more noise dimension than space (`noise(x·s, y·s, t)`), so the field *evolves* (weather) rather than
  *scrolls* (moving texture). "The single biggest quality tell." [AT:gen noise]
- fbm: 2 octaves for flow fields, 4–6 for textures. Gain 0.5 (above is noisy, below 0.4 loses detail). Lacunarity off
  2.0 (1.93 / 2.07). [AT:gen noise]
- Domain warp: `q = fbm(p), fbm(p + (5.2,1.3))`; `r = fbm(p + 4q + (1.7,9.2)), fbm(p + 4q + (8.3,2.8))`;
  `v = fbm(p + 4r)`. Warp strength 1–2 is subtle, 4 is classic, 8+ is chaos. Animate only the innermost time axis so
  it breathes. [AT:gen noise]
- Angle field: `θ = fbm(x·s, y·s, t·e)·TAU·k` with s 0.001–0.004 (0.001 = long rivers, 0.006 = turbulence), k 1.5–3
  (>3 shreds), e 0.03–0.08. Curl noise (divergence-free, particles never pool): `ε = 0.5/s` *in noise units*, then
  normalize. Curl looks like smoke, angle fields look like currents. [AT:gen noise]
- Mask the field with a slow large shape for negative space. Layer two scales (slow large drift + fast fine detail).
  Spawn where the field is interesting. [AT:gen noise]
- Boids (fish schools): separation r 18 px w1.5, alignment r 40 w1.0, cohesion r 55 w0.9, speed clamped to a band
  (60–140 px/s), 400–2000 agents, spatial hash above ~800, wrap the edges (bouncing reads as a container). [AT:gen systems]
- Interference/moiré (`sin` fields beating) is nearly free. Posterize into 2–4 bands and keep spatial frequency well
  below the pixel grid. [AT:gen systems]

### 11.3 Particles & trails (Canvas 2D)
- Pool, never allocate in the loop. Vary speed, size and lifetime. Alpha `1 − t²` over life, fading *and* shrinking.
  Envelope `min(1, age·5)·min(1, (1−age)·3)`. **Stagger initial ages** or the whole population pulses.
  Frame-rate-independent drag `v *= pow(0.12, dt)`. Emit in a cone along the impact normal. [AT:mot proc][AT:gen rendering]
- Trails: don't clear, fade with the exact ground colour at alpha 0.02 (long smoke) to 0.10 (comet), and draw
  segments, not points. Below ~0.02, 8-bit rounding greys the frame, so use a float target or a periodic hard clear.
  [AT:gen rendering]
- Blend: `lighter` (additive) on dark grounds with per-stroke alpha 0.02–0.15; `screen` is softer; `multiply` for ink
  on paper; `destination-out` to carve. Choose the ground and the blend mode together. [AT:gen rendering]
- Budget: Canvas 2D handles ~3–10k stroked segments per frame. Batch into 8–16 colour buckets with one `stroke()`
  each. Use typed arrays (`Float32Array`, stride x, y, px, py, life, max). Go WebGL above 100k. Particle cost is fill
  rate, not count. Render glow layers at half resolution. [AT:gen][AT:mot]
- Density and tone: accumulation fields are unbounded. Subtract a floor before scaling
  (`v = clamp((log(1+t) − FLOOR)·SCALE)`), or normalize the deposit so the steady-state mean = 1. Curves: log for huge
  range, `pow(t, 1/2.2)` film-like, Reinhard `t/(1+t)` for additive glow, ACES
  `(x(2.51x+.03))/(x(2.43x+.59)+.14)` for photographic. Histogram check: >5% of pixels at 1.0 = clipping, >90% at 0
  = floor too high. [AT:gen density]

### 11.4 Shake & impact (storm, the jump)
- Drive shake from one decaying **trauma** value (add 0.2 light … 0.8 heavy; decay `1.4/s`). Amplitude ∝ trauma².
  Offsets come from *smooth noise* at ~25 Hz (x/y ≤18 px·s, rotation ≤1.6°·s). "Random jitter reads as a rendering
  bug, coherent noise reads as force." Rotation sells more than translation. Shake only the world or camera, never the
  type. [AT:mot proc] Use `E.shake()` / `E.post.shake*` [engine/post.js].
- Hit-stop 40–120 ms (slow to 5%, not 0). Pair it with shake, a 1–2 frame flash and particles at the contact point.
  [AT:mot proc] [digest] Use these sparingly in a documentary, at most once or twice per segment.

### 11.5 Post-processing (order and values)
Order: **scene (HDR) → bloom → chromatic aberration / distortion → tone map → grade → vignette → grain (last)**.
"Getting grain before tone mapping is the most common ordering mistake." [AT:gen post]

| Effect | Recipe | Restraint |
|---|---|---|
| Bloom | bright pass at ½ res with a soft knee `smoothstep(T−.1, T+.1, lum)`, T 0.7–1.0; mip chain ½…1/16, separable blurs; add back × 0.25–0.6 | >0.8 = fog; only real emitters glow [AT:gen] (`E.post.bloom` 0.16, threshold 0.74) |
| Chromatic aberration | radial offset `d·r²·amount`, amount 0.01–0.04 | "detectable only by turning it off"; edges only [AT:gen][MG:vox] (`E.post.ca`) |
| Grain | animated, midtone-weighted `w = 4·lum(1−lum)`, amount 0.02–0.06 | masks banding; static grain = a dirty screen [AT:gen] (`E.post.grain` 0.045) |
| Vignette | `smoothstep(1, R, len((uv−.5)·(aspect,1)))`, R 0.35–0.55, strength 0.15–0.35; aspect-corrected; tint slightly warm | "should not be nameable" [AT:gen] (`E.post.vignette` 0.26) |
| Feedback | sample the previous frame offset by fbm·0.004, `mix(cur, prev·0.96, 0.7)` | decay <1 mandatory [AT:gen] |
| Grade | gradient map 70–90%, or lift/gamma/gain | see §8.6 |

- "If a viewer can name the effect, it is too strong." [AT:gen post] Put grain, vignette, CA and grade in **one
  composite shader**, not separate passes. Budget ≈ 1.5 fullscreen passes at 1080p. If you overrun, cut feedback →
  bloom levels 5→3 → CA → grain, and keep tone map and vignette. [AT:gen post][AT:perf]
- Grain lessons: full-frame grain changing every 2 frames is high-entropy data. One film went 177 MB → 54 MB with
  `-maxrate 14M -bufsize 28M` and → 34 MB after grain dropped from 16% to 7.5% overlay. Keep grain fine, low and
  on twos. Grain must be **time-clamped during end holds**, or the hold frames differ. [MG:FL render]
- Grain via procedural noise: a seeded hash of `(pixel, frameIndex)`, never a texture URL swapped per frame
  (§15.5). [MG:FL][digest]

### 11.6 Light leaks, motion blur, ambient backgrounds
- **Light leak**: a seeded organic warm flare (default yellow→orange, `hueShift` rotates it), with progress 0→1 =
  reveal in the first half, retract in the second. Use it as an overlay on a cut (20–30 frames) or a decorative
  layer. Implement as 2–4 large blurred noise-shaped blobs, additive or screen, drifting across the frame
  [RM:light-leaks][digest]. Reserve it for memory or warmth beats.
- **Motion blur**: render N sub-frames at `t_i = t + ((i+0.5)/N − 0.5)·(shutter/360)/fps` and average them. Shutter
  180°, 8 samples is the default (1–64). Use it on anything moving >30 px/frame and keep the shutter constant
  through speed ramps. Short trails: 4 copies lagging 0.4 frames. [RM:motion-blur][HR][IA:beat]
- **Ambient background**: drive it with `phase = (t % P)/P·TAU` and only `sin`/`cos(phase)` for seamless loops.
  Noise scrolls loop only with an integer number of cells per period. Keep it low contrast against content and add a
  scrim if text loses contrast. [IA:bg]
- Constellation or network dots: O(n²) links are fine to ~120 points, then use a spatial hash. [IA:bg]

### 11.7 GPU or CPU
- Go GPU when per-element work × count > ~5M ops per frame, when the system is per-pixel (fluid, reaction-diffusion,
  domain-warped noise at full resolution, feedback), or when the population *is* the aesthetic. Stay on CPU below
  ~10k elements or for branchy neighbour logic. [AT:gen gpu]
- `precision highp float` everywhere (mediump bands and snaps). Use RGBA16F for accumulation and check
  `FRAMEBUFFER_COMPLETE` and float-blend support. A failed shader compile draws silently, so check
  `COMPILE_STATUS` and `LINK_STATUS`. [AT:gen gpu/diagnostic]
- Debug rule: "separate simulation failures from rendering failures before tuning anything". Render the raw field
  (`vec3(field·0.01)`) at multipliers that differ by orders of magnitude. [AT:gen diagnostic]

---

## 12. Sound design & music

### 12.1 Principles
- Sound is ~50% of perceived quality. "A silent explainer feels unfinished": a low bed, hits on structural moments,
  a lift on the last line. [HR][MG:vox]
- "Audio leads, video follows." Lock picture to the audio and find visual transitions that support the sound. [VE]
- **Silence is a tool.** Clear 60 ms before the hero impact (music and ambience out). The climax hit sits in clean
  acoustic space. [MG:mix][MG:beat][MG:cont]
- "The voice sits on top. If you can't hear the narration over the effects, drop the score until you can." [MG:vox]
- Every sound has a job: identify a source, carry meaning, or texture (Chion). Decide whether it confirms,
  contradicts, precedes or outlasts the image. Music must not tell the audience what to feel because the image has
  not earned it. [DA]

### 12.2 SFX picking rules
- List the moments first: *what moves, when (s), emotional intent (punchy, soft, mechanical, organic)*. Then map each
  to a category and write a cue sheet (`TIME | CATEGORY | FILE | NOTES`). [MG:sfx]
- **Click-and-pop philosophy**: minimal tactile foley (a tiny tick per list item, a soft mechanical roll during
  count-ups, a quiet bell on the final card). **Whoosh prohibition**: no whooshes on card slides, fades or simple
  tweens. Reserve them for full-viewport zooms or whips. [MG:mix]
- ≤3 simultaneous SFX. Crisp transients under 0.5 s for reveals. **One riser per composition** (gate it behind a
  flag). [MG:sfx]
- Transient SFX start **2–3 frames before** the visual lands ("early feels synced; late feels broken"). Transitions:
  riser into the cut, bass hit on the cut (sparingly). [HR]
- Paper or tactile worlds: sound only where contact happens (paper slide, tape pull, pin click, stamp, pencil). "Do
  not add a sound effect to every movement." [MG:paper]
- Anti-slop: SFX wallpaper (whoosh on every transition, hit on every word); "music ducked into lifelessness".
  [MG:md anti-slop]

### 12.3 Levels & mastering targets
| Parameter | Target |
|---|---|
| Master integrated loudness | **−14.0 LUFS ±0.5** (web/social) |
| Master true peak | **−1.25 dBTP** (never above −1.0) |
| VO stem | −16 LUFS ±1 |
| Music under VO | ducked ≥12 dB (bed at roughly −18 dB relative; volume ~0.2–0.3) |
| Foley/SFX stem | −20 to −24 LUFS |
| Ducking | sidechain trigger at VO > −36 dB, attack 20 ms, release 250 ms |

Sources: [MG:mix][MG:bible][HR]
- Final normalize: `ffmpeg -i in.mp4 -af loudnorm=I=-14:TP=-1.25:LRA=7 -c:v copy -c:a aac -b:a 192k out.mp4`.
  [MG:mix]
- Organize three stems: `VOICE.wav`, `MUSIC.wav`, `SFX.wav`. Boost SFX 3–6 dB when the music is dense. Never apply
  dynamic normalization at segment assembly (it pumps between cuts). Keep the VO master at 48 kHz/24-bit and never
  substitute a transcription-grade WAV. [MG:mix][MG:sfx][MG:jump]
- [digest] Each segment author delivers stems or a mix at matching loudness so the assembled film needs no
  per-segment gain riding. Match bed loudness across segment boundaries and crossfade beds inside the TAIL.

### 12.4 Synthesis ideas in raw Web Audio (Tone.js concepts → `OfflineAudioContext`)
- Signal graph: source → effect(s) → destination (`Synth → Reverb → out`). Render with `OfflineAudioContext` for
  determinism, schedule every event at an exact sample time (`t·sampleRate`), and seed all noise buffers. [MG:tone][digest]
- No SFX library is not a reason to ship silent. Synthesize a kit [HR]:
  - **Whoosh**: seeded white noise → bandpass with Q rising and frequency swept 300→3000 Hz (or the reverse) → gain
    envelope (A 0.15 s, R 0.4 s).
  - **Pop**: sine with pitch dropping from 600 to 150 Hz over 60 ms.
  - **Sub thump / kick**: sine 60→40 Hz with exponential decay over 0.3–0.6 s.
  - **Pad**: 2–3 detuned sines or saws (±5–8 cents) → lowpass → long attack.
  - **Drone + rain / sea**: low oscillator plus filtered noise with a slowly modulated lowpass.
- Reverb: a `ConvolverNode` with a generated impulse (seeded noise × exponential decay of 2–3 s), wet ~0.4.
  Feedback delay: an eighth note at 0.3 feedback into the reverb. [MG:tone][digest]
- Transport math: `secondsPerBeat = 60/BPM`, `bar = 240/BPM`. Schedule visual events from the same cue table rather
  than from audio callbacks. Tone's lesson: run visuals on the draw clock (`Draw.schedule`), never in the audio
  thread. [MG:tone][MG:beat]
- Audio-reactive visuals: drive only 1–2 parameters. FFT values need log scaling (`db = 20·log10(v)`, mapped
  −100…−30 dB → 0…1). Bass = mean of the lowest ~25% of bins (scale `1 + bass·0.5`, opacity ≤0.6). Pass the frame
  value down from the parent, not per child. [RM:audioviz][MG:md atlas]
- Browser preview needs `AudioContext.resume()` behind a user gesture. Offline rendering avoids this. [MG:tone]
- In `seek()`-driven previews, preload all audio at init and use **fire-once guards**, because repeated seeks re-fire
  sounds. The final audio is a separate offline mix. [MG:sfx]

### 12.5 Audio QA
- Listen once with your eyes closed. Hard-fail: clipped or distorted narration, a missing word, edit pops, music
  hiding speech, a visual missing an intended audio hit. Warn: SFX on every movement, impact on every word.
  [MG:rev gates]
- Cross-correlate the final file's audio with the master VO to prove a 0 ms offset. Pad audio with `apad`, never
  `-shortest`, when an end hold exists. [MG:FL]

---

## 13. Rejected patterns / failure lessons ("never do", with reasons)

**Structure & direction**
- Default coverage (wide → coverage → close-up → swell → pretty end): no concept. [DA]
- **Scene sampler**: every scene demos a different transition, so there is no motion language. [MG:md anti-slop]
- **Equal-emphasis frame**: three or more equal anchors, or three elements moving at once, means no first stop.
  [MG:md anti-slop]
- **Layout repetition**: every beat centres a headline above an object. **Card soup**: every idea becomes a rounded
  rectangle. [MG:md anti-slop]
- **Busy ending**: new effects or callbacks after the payoff. Resolve, clear, hold. [MG:md anti-slop]
- Mixing tone-matrix cells within a piece reads as inconsistent motion. [IA:dir]
- A second "wow" moment cancels the first. [IA:dir]

**Motion**
- Linear easing on anything the eye follows (robotic); default `ease` (undecided). [AT:mot][IA:dir]
- `all 300ms` uniform durations: no weight information. [AT:mot]
- **Scale-pop loop** (enter at 0.8 → 1, repeated every scene); **bounce everywhere** (rigid objects behaving like
  rubber); **perpetual floating** (nothing settles, no stillness possible). [MG:md anti-slop]
- **Unmotivated camera drift** on every still; slow zoom as the only camera idea; empty travel before action; push +
  pan + rotate combined. [MG:md][LJ:mg][IA:comp]
- Random rotation as a shortcut to "handmade"; random jitter instead of coherent noise. [MG:md][AT:mot]
- Everything fading up with the same duration and delay ("the single most recognisable 'template' motion
  signature"). [AT:mot]
- Opacity-only changes for important state; long slides >1/3 of the frame without a break. [MG:des]
- Smooth interpolation on paper or handmade material erases the handmade character. [MG:paper]
- A static centred object whose only progression is "rows appearing plus zoom". [LJ:mg]

**Type**
- Everything set in Black weight; transcript wallpaper; font-demo behaviour (swashes and axes for their own sake);
  narrow headline walls; accidental crops of descenders or punctuation. [MG:md anti-slop]
- Default tracking at display sizes; display type at body leading; 400 vs 500 weight "hierarchy". [AT:type]
- Emoji as icons (they ignore the palette). [HR]

**Colour & material**
- Pure `#000` grounds, rainbow hue, uniform density, everything at one scale, centred symmetry, too fast, no end state
  (the eight tells of tutorial generative work). [AT:gen]
- Accent flood; too many active colours; muddy neutrals ("paper feels dirty"); texture as dirt over type. [MG:md anti-slop]
- **Fake premium**: glass, glow, gradients, blurred orbs, chrome, 3D by default. "Define what premium means for this
  specific brief." [MG:md] The strict line: zero neon, bloom, luminous edges, coloured shadows, gradient washes,
  cyan-purple, glassmorphism [LJ:mg][LJ:cam]. [digest] For us, only physically real light glows (moon, ship lamps,
  plankton, sun) and nothing glows for decoration.
- Opacity crossfade between saturated fields (an off-palette midpoint colour). [MG:FL]
- Shadow inconsistency (many light directions, random elevations); mixed asset worlds without a unifier. [MG:md]
- Purple/indigo gradients, Inter at 16/48, three-feature-card layouts: the AI-default page skeleton. [AT:dir]

**Truth**
- Invented facts, numbers, documents, stamps, serials, logos, quotes; rounding a figure up; ASR words on screen.
  [MG:md][LJ:mg][MG:mile][MG:FL]
- Decorative generated images with fake text or wrong perspective. [MG:md anti-slop]

**Audio**
- Whoosh on every transition, hit on every word, music ducked to lifelessness, the riser played twice. [MG:md][MG:sfx][MG:mix]
- Shipping silent. [HR][MG:vox]

**Engineering (Failure-lessons)**
- A check that has never been seen failing is untrusted (font check that printed PASS while reading the wrong key).
  [MG:FL]
- Readiness promise returning a GSAP timeline or another *thenable*: it hung forever. Readiness that swallowed
  decode errors: it rendered blank objects. [MG:FL]
- Scenes that fetch assets at build time: a missing logo on frame 0. Frame 0 drawn in a fallback font. [MG:FL][MG:fx]
- Swapping a resource URL (`background-image`, `img.src`) during capture: renders differed under CPU load (48 of
  798 frames). [MG:FL]
- `-shortest` in the mux, no time clamp, render range ending at VO length: the end hold disappeared three separate
  ways. [MG:FL]
- A renderer that ignored ffmpeg's exit code and reported success on a truncated MP4. [MG:FL]
- An element "parked" off-frame by an eyeballed offset, plus a `fromTo` that applied its start state at time 0: it
  peeked into the hook for 0.5 s. [MG:FL]
- A two-wall perspective corridor collided at the vanishing point; the nearest poster faded into a translucent
  ghost. [MG:FL]
- Diagnosing geometry from thumbnails: a 7 px half-second clip was missed by two visual passes and caught by
  measurement. [MG:FL]
- Two changes in one diagnostic render blamed the wrong culprit. [MG:FL]
- An unknown option value with no default crashed the page. [MG:FL]

---

## 14. QA & self-critique checklists

### 14.1 Critique rubric (score 1–5, cite evidence for each)
1 Hierarchy · 2 Colour · 3 Typography · 4 Spacing & alignment · 5 Motion (every move answers a question; weight
scale; consistent curves) · 6 Consistency (one system) · 7 Accessibility/legibility · 8 Distinctiveness (a
signature move you can describe). A 5 requires "the senior tell", not just the absence of problems. **The lowest two
dimensions set the focus.** Iterate until the weakest dimension scores ≥4. [AT:crit]
- Independent-critic variant: scores 0–10 for research fidelity, reference fidelity, concept specificity,
  authenticity, mobile readability, composition, motion causality and material restraint. Pass = every score ≥8 and
  an average ≥8.5 with no hard failures. "The builder cannot grade its own work." [LJ:mg critic]
- Self-review must be labelled *self-audit*, never "independent". [DA]

### 14.2 Change-list format
`N. [dimension] Location: change X from <current> to <new> — <principle>`. Give units: px, ms, cubic-bezier, oklch.
List 3–10 changes, ranked by impact on the lowest scores, legibility first. Anti-pattern: "improve the spacing".
[AT:crit]
- Timecoded note: `time range · severity (blocker / high / medium / polish / keep) · observed problem · why it
  weakens the film · exact direction · what to preserve`. Example: "00:14–00:15 High — the correction mark and
  headline compete. Reduce headline scale… Keep the cue-sheet concept." [MG:md review]
- Review order: concept → hierarchy → type → colour → composition → asset cohesion → motion → timing → audio →
  technical. "Do not start by adjusting tiny easing curves when the art direction is wrong." [MG:md review]

### 14.3 Still-frame gate
- Capture: first frame, 0.5 s, 1 s, the midpoint of every beat, every major transition (the frame before and after),
  the payoff, the final frame, plus a frame every 0.5–1 s for the contact sheet. [MG:md]
- Tests: the one-second hierarchy test, the thumbnail test, grayscale or squint, edges and tangencies.
  "A motion film with weak stills rarely becomes strong because it moves." [MG:md]
- Hard-fail: no clear focal point, muddy palette, hierarchy collisions, too much small text, repeated layouts, weak
  negative space, inconsistent shadows, mixed asset treatment, accidental clipping, generic decorative shapes,
  safe-zone violations. [MG:md]
- "A contact sheet finds candidates. It does not prove geometry." Confirm at full resolution or by measurement
  before changing code. [MG:md][MG:FL]

### 14.4 Motion gate
- Watch the whole segment **twice**: (1) sound on, normal size, judging narrative, timing, emotion and sync;
  (2) sound off at phone size, judging comprehension, hierarchy and text. Then go frame by frame through every
  difficult transition. [MG:md]
- Hard-fail: cuts on meaningless syllables, exits before text is read, repeated transition rhythm, unmotivated camera
  moves, perpetual floating, gratuitous bounce, endless scale pops, a weak middle, an overstuffed ending, a first
  second with no visual promise. [MG:md]
- Video gates: frame integrity (black frames, one-frame flashes, stale frames), typography integrity (clipping,
  fallback, text before its font is ready), composition continuity (focal jumps, shadow direction changes, unsettled
  values), transition mechanics (teleports, a mask revealing the wrong layer), motion curves (accidental linear,
  snapping at key boundaries), temporal readability, asset quality (halos, mask chatter, low-resolution stock exposed
  by scale), audio relationship, ending (the final frame changes during the promised hold). [MG:rev]
- Preview suspicious motion at 0.25× speed: easing flaws invisible at 1× become obvious. [HR]
- "Appropriate on the 100th viewing." [MG:des checklist]

### 14.5 Bounded revision loop
- Do one complete defect scan, fix everything confirmed in one batch, then allow at most one or two confirmation
  passes. "Do not polish forever." Send each fix to the smallest responsible layer: "A typography problem should not
  trigger a concept rewrite." Preserve strong choices and name what to keep. [MG:md][MG:rev]
- A finding is resolved only by a *later rendered artifact*, never by a source change. [MG:rev]
- One change per diagnostic render. Confirm a cause before it goes into code or docs. [MG:FL]

### 14.6 Technical gate (on the final file, not the config)
- Dimensions 1920×1080, 30 fps CFR, exact duration (frame count), H.264 yuv420p, BT.709 tags, AAC, faststart,
  audio starting at 0, no missing final frame, the end hold proven by frame count. [MG:md review]
- Determinism: two renders compared with `framemd5`, the second one **under CPU load**. Every automated gate has
  been seen failing on a reintroduced defect at least once (in a scratch copy, using the *likely partial* failure
  such as a font subset missing one script). [MG:FL]
- "No findings" is read together with *how much was measured*. An audit that found no text in a beat passes
  vacuously. [MG:md review][MG:FL]
- Stills and contact sheets come from the delivered MP4, not from the composition. [MG:FL]

### 14.7 Creative-director test
- Does this look like a specific person directed it? Could this frame belong to ten unrelated films? Is there one
  motion thesis or a collection of tricks? Is any scene proving technical complexity instead of communicating? Is
  the ending cleaner than the middle? Can one element be removed from each crowded frame? [MG:md review]

### 14.8 Pre-delivery checklist (adapted)
- [ ] No linear easing on spatial moves; every interpolation clamped (no element visible before its entrance or
  after its exit). [HR]
- [ ] Entrances combine 2–3 properties, staggered; exits exist and are faster. [HR][MG:des]
- [ ] One hero per frame; ≤1 accent-coloured or glowing element per frame. [HR][IA:dir]
- [ ] Display faces loaded (no fallback, checked per script); tabular numerals on counters. [MG:FL][AT:type]
- [ ] ≥3 moments of full stillness; holds ≥0.7 s on text. [HR][MG:bible]
- [ ] SFX on structural hits only; VO intelligible over everything. [MG:mix]
- [ ] Text inside 5% safe area; nothing touching the frame edges. [IA:comp]
- [ ] Rendered, frames extracted, *every* extracted frame inspected, fixed, re-rendered, re-inspected. [HR]

---

## 15. Deterministic-render engineering notes

### 15.1 One clock
- "Every frame is worked out from the time alone." Expose `seek(t)` (seconds) that draws the exact frame for that
  moment, "in any order, as often as it is called". No `setTimeout`, no `requestAnimationFrame` driving state, no
  CSS animations or transitions, no `Date.now()` or `performance.now()`. [MG:fx][MG:vox][RM:timing]
- Use one time unit (seconds) everywhere; the exporter and the page must agree. `t = frame / fps`. [MG:fx]
- **Backward seeks must reproduce earlier frames.** Frame state never depends on the previous `seek` call.
  [MG:paper]
- Quantize stepped material in `seek` (`onTwos(t, 12)`). [MG:paper]
- Under `?render`, stop any autoplay clock so the exporter drives `seek()`. [MG:fx]
- Derive all timing from `fps`, never magic frame numbers. [HR][RM]

### 15.2 Randomness
- **Never `Math.random()` at render time.** Seed everything with mulberry32 (used by both atelier and motion-canvas):
  ```js
  const mulberry32 = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  ```
  Gaussian values via Box–Muller from the same stream. [AT:gen noise][MC Random]
- Seed per element from *stable data* (element id, index) via `hash()` / `seedOf()` in engine/math.js, never from
  call order, so adding an element doesn't reshuffle the others. [MG:paper][digest]
- Build noise permutation tables from the seeded PRNG ("or the field changes on every reload while the particles
  don't"). [AT:gen noise]
- Per-frame random (grain, flicker) = `hash(frameIndex, pixel)`. During an end hold, clamp the frame index too.
  [MG:FL][digest]

### 15.3 Simulations in a seekable world
- Prefer closed-form motion (tweens, analytic springs §5.6, `sin(phase)` loops, noise evaluated at `(x, y, t)`).
  [digest]
- For true simulations (particles with forces, boids, trails): use a **fixed timestep** (e.g. 1/60 or MC's 1/120),
  stepped from the segment start to `t`. Cache checkpoints every N seconds for fast random access; sequential
  rendering just advances. Never integrate with a variable `dt`. [AT:mot proc][MC spring][digest]
- Accumulation-buffer trails need re-simulation from a known state to be seekable. Either replay the last K steps
  from a checkpoint or keep the trail as an analytic history of positions. [AT:gen rendering][digest]
- Frame-rate-independent decay: `v *= pow(base, dt)` or `pow(0.98, dt·60)`, never `v *= 0.98` per frame.
  [AT:gen diagnostic]
- MC's time model: `waitFor` snaps thread time to the exact target (`thread.time(targetTime)`) after yielding, so
  delays never accumulate frame-rounding drift. Keep cue times in exact seconds and round only when mapping to frames.
  [MC][IA:beat]

### 15.4 Cue / time-event system (re-implementing motion-canvas `waitUntil`)
- MC pattern: `yield* waitUntil('event')` pauses until a named event whose time lives in a metadata file and can be
  edited without touching code. `useDuration('event')` returns its duration for use as a tween length. Moving one
  event shifts all later events by default, so a lengthened VO pause fixes everything after it. Event names must be
  unique. [MC time-events]
- Plain-JS equivalent [digest]: `cues = { jump: wordTime('jumped') − LEAD, ... }` built from `assets/transcript.json`
  word timings (plus manual offsets in a JSON). Scenes read `cue('jump')` and `dur('fallStart', 'splash')`. Validate
  that names are unique and times increase.
- Flow combinators as pure time math [MC]: `all` = same start; `sequence(d, …)` = start_i = start + i·d; `chain` =
  start_i = end_{i−1}; `delay(t, x)`; `loop(n, f)`. Signals and computed values become pure functions of `t`.
- Property tweens default to `easeInOutCubic` in MC. `to()` chains; `save()` / `restore(dur)` return to a stored
  state. `arcLerp` gives curved paths, `textLerp` morphs strings, `Color.lerp` interpolates colour (use OKLab).
  [MC tweening]
- Scene transitions in MC render the *previous* scene with one transform and the *current* with another
  (`useTransition(currentFn, previousFn)`), so both scenes must be renderable at the same `t`. Same contract as our
  TAIL hand-off. [MC transitions][manifest]

### 15.5 Readiness: the first frame waits for everything it paints
- Load fonts explicitly for every family, weight and style (`new FontFace(...).load()` + `document.fonts.add`), then
  `await document.fonts.ready`. An embedded font does not load until something uses it, so frame 0 painted in a
  fallback font. For canvas text, draw each face once offscreen as a warm-up. [MG:fx][MG:FL]
- Verify fonts **per script**: measure a Cyrillic sample and a Latin sample *separately* against both the generic
  family and an undeclared family. A mixed string hides one script falling back. [MG:FL]
- `await img.decode()` on every image and texture before `seek(0)`. Decode failures must *reject* with the asset
  path, never be swallowed. [MG:FL]
- **Scene builders never fetch.** One readiness promise gates the first frame, and every tool awaits it with a
  timeout that reports "readiness never resolved". **Resolve to a plain value**, never a timeline, renderer or any
  object with a `.then`. [MG:FL][MG:md reliability]
- **Nothing changes a resource URL during capture.** Anything that alternates (grain tiles, sprite frames) is
  preloaded and switched by opacity, transform or clip. [MG:FL]
- Canvas readbacks (`getImageData` for text sampling) → create the context with `willReadFrequently: true`.
  WebGL → `preserveDrawingBuffer: true`. [MG:mile][RM:maps]
- Every option has a default path: `(TABLE[key] || fallback)`. [MG:FL]

### 15.6 Timeline contracts
- **Duration has one owner** (the manifest or composition). The render range and the mux derive from it. [MG:FL]
- End hold: `seek` clamps composition time (`min(DUR − 1e-4, t)`) so hold frames repeat the last composed frame
  exactly, grain included. The render range includes the hold. The mux pads audio (`apad=pad_dur=N`) and never uses
  `-shortest`. Verify the hold by frame count on the final file. [MG:FL][MG:md]
- A clip's end ≥ the end of every tween animating its content. Derive it from the last tween, don't type it twice.
  [MG:FL]
- Parked elements are hidden (`alpha = 0`) **and** positioned outside the frame or mask by more than their full
  rotated bounds. No tween applies its start state before its start time. [MG:FL]
- Transitions overlapping scenes shorten the total. Overlays don't. Recompute totals when you add transitions.
  [RM:transitions]
- If supplied audio already breaks a duration cap, report it. Never silently speed up or trim the VO. [MG:FL]

### 15.7 Render pipeline (Puppeteer → ffmpeg)
- Pipe frames to ffmpeg stdin. Handle `stdin` errors, wait for `close`, and **exit non-zero if ffmpeg exits
  non-zero**. Prove it once by pointing the output at an impossible path. [MG:FL]
- Log progress to a file (`2>&1 | tee render.log`) and report frame counts, not file size. [MG:FL]
- Encode masters at CRF 16–17 H.264 (platforms re-compress) with a bitrate cap if grain is heavy
  (`-maxrate 14M -bufsize 28M`). Use `-pix_fmt yuv420p`, tag `-color_primaries bt709 -color_trc bt709 -colorspace bt709`,
  and add `-movflags +faststart`. [HR][MG:FL][IA:col]
- Review copies are sized by bitrate: `total_kbps = limit_MB·8·0.9 / duration_s` (30 MB over 59 s ≈ 3.6 Mbps).
  [MG:md review]
- If Chromium says "Old Headless mode has been removed", use the `headless_shell` binary. Re-render with overwrite
  and never inspect a stale file. [HR]

### 15.8 Performance budgets
- Real-time frame budgets do not apply offline, but cost multiplies: the film is 36,780 frames (1226 s × 30). Keep each frame under
  a few hundred ms [digest].
- A 1080p fullscreen pass ≈ 2M fragments. A sensible post stack (½-res bright pass + 5 small mip blurs + one
  composite) ≈ 1.5 passes. Grade, grain, vignette and CA belong in the same final shader. [AT:gen post]
- Halve the resolution of everything that isn't the final image (sim grids, glow buffers, blur chains). Separate
  blurs into 1D passes past 5 taps. [AT:gen gpu]
- Canvas 2D: batch by state (set `fillStyle` once, draw many). **Avoid `shadowBlur` in loops** (per-draw Gaussian);
  pre-render repeated sprites to offscreen canvases. Size canvases exactly W×H×DPR with a fixed DPR (1 for 1080p
  delivery; capping at 2 is a preview rule). [AT:perf][IA:bg]
- Zero per-frame allocation in hot loops (pools, typed arrays), or GC causes rhythmic hitches. [AT:perf][AT:mot]
- Degradation order when a frame is too slow: particle counts → blur radii and bloom levels → prestige post (DoF,
  grain, CA) → effect resolution → ambient motion → stagger richness → shadow fidelity. **Never cut** primary
  feedback, text legibility, or the core story beat. [AT:perf]
- WebGL canvases above ~4096 px may be silently downsampled. Test `MAX_RENDERBUFFER_SIZE`. [RM:maps]

### 15.9 Verification patterns worth reusing
- Seeded deterministic `seek` makes every other check possible. [MG:FL]
- Stills at chosen times + a frame every 0.5 s contact sheet + before/after pairs at the reviewed moments.
  Remember: stills only show the times you ask for, and defects live *between* samples. [MG:FL]
- Clip audit (measure every text box against the frame and its clipping containers across the timeline at 0.2 s
  steps; mark intentional crops as such). It misses polygon clips and occlusion, so check those by eye. [MG:md][MG:FL]
- Strict temporal scan: one-frame luma flashes and extreme frame-to-frame brightness jumps. [MG:rev]
- Loop seams are measured, not eyeballed (0 pixels differing between frame 0 and frame N). [MG:mile]
- After a rejected or interrupted write, read the real file state. Tool status is not repository state. [MG:FL]
