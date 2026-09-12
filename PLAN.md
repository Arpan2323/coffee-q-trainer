# Q Trainer — Flavor Wheel Coffee Sensory Game

A learning game that teaches coffee tasting through the lens of the Coffee Taster's Flavor Wheel.
Planning document. No code yet.

---

## 1. The core product insight

**An app cannot taste for you.** Any honest sensory trainer has two tracks, and the product's value
comes from the bridge between them:

| Track | What it can genuinely teach | Delivery |
|---|---|---|
| **A. Map** (screen-only) | Vocabulary, taxonomy, perceptual adjacency, the causal chain (variety → terroir → process → roast → cup), scoring discipline, defect theory | 100% digital, playable on a commute |
| **B. Territory** (coffee-in-hand) | Actual discrimination, threshold sensitivity, calibration against a panel | App structures the session, times it, blinds it, logs it, and scores you |

Most "coffee flavor apps" build only Track A and quietly become trivia quizzes. Most cupping apps
build only Track B and become spreadsheets. **The product is the loop between them:** you learn a
descriptor on screen, the app assigns you a physical reference to smell that week, then a blind
drill proves whether it stuck.

Design rule enforced everywhere: *never claim a screen taught a palate.* Screen play earns
"knowledge" progress; only logged physical sessions earn "palate" progress. Two separate meters.

---

## 2. Domain foundation (what we're actually modelling)

### 2.1 The wheel is a tree with meaningful geometry
The SCA / World Coffee Research **Coffee Taster's Flavor Wheel (2016)** is a 3-ring sunburst:

- **Ring 1 (9 categories):** Fruity, Sour/Fermented, Green/Vegetative, Other, Roasted, Spices,
  Nutty/Cocoa, Sweet, Floral
- **Ring 2:** sub-groups (e.g. Fruity → Berry, Dried Fruit, Other Fruit, Citrus Fruit)
- **Ring 3:** ~85–110 leaf attributes (e.g. Berry → Blackberry, Raspberry, Blueberry, Strawberry)

Two properties the game must exploit, because they're the reason the wheel is more than a word list:

1. **Radial position encodes perceptual similarity.** The wheel was ordered from a sorting study —
   neighbours taste more alike than distant wedges. So "raspberry" when the answer is "blackberry"
   is a *near miss*; "burnt rubber" is a *catastrophe*. Grading must reflect that.
2. **The gaps between wedges encode perceptual distance.** Wide gap = the categories are genuinely
   far apart in tasters' minds. Free the scoring engine to read those gaps as a cost function.

### 2.2 The lexicon underneath it
The **WCR Sensory Lexicon** gives each attribute a definition, a *physical reference standard*
(a real, buyable product), an intensity anchor on a 0–15 scale, and preparation instructions.
This is the single most important content asset — it's what converts a word into a smell.

Example shape (paraphrased, not verbatim): `Blackberry` — the sweet, dark, slightly floral-fruity
aroma of blackberries; reference: a specific commercial blackberry preserve; intensity anchor ≈ 7.5.

### 2.3 Two scoring systems, both must be taught
- **Legacy SCA Cupping Form:** Fragrance/Aroma, Flavor, Aftertaste, Acidity, Body, Balance,
  Uniformity, Clean Cup, Sweetness, Overall, minus Defects. 6.00–10.00 in 0.25 steps, 80+ = specialty.
- **CVA (Coffee Value Assessment, 2023+):** splits **Descriptive** (CATA descriptor selection +
  1–9 intensity on aroma/flavour/aftertaste/acidity/sweetness/mouthfeel) from **Affective**
  (1–9 impression of quality). This split — *describe first, judge second* — is a pedagogical gift.
  It's the discipline beginners lack most: they leap to "good/bad" before they've described anything.

**Teach descriptive before affective. Lock affective play behind descriptive competence.**

### 2.4 Q-grader exam structure (source of the "boss levels")
The Q exam's 22 modules give us proven drill formats: olfactory identification (36-aroma kit),
organic acid identification, basic-taste solutions at varying concentrations, sensory skills
(ranking intensities), **triangulation** (3 cups, one different), sample roast identification,
green grading, and cupping calibration against a certified panel. We mirror these as game modes —
not as exam prep, but because they are the best-tested sensory drills that exist.

### 2.5 Licensing — flag now, not at launch
The Flavor Wheel artwork is an SCA/WCR copyrighted work licensed through the SCA; the WCR Sensory
Lexicon is separately published with its own terms. **The taxonomy structure is fine to teach; the
official graphic and verbatim lexicon definitions are not automatically ours to ship.** Plan:
build our own SVG wheel from our own data file with our own written definitions, and check terms
before any commercial release. Cheap now, expensive later.

---

## 3. Game design

### 3.1 The signature mechanic — **Wheel Distance scoring**

Every descriptor answer is graded by tree/geometric distance to the target, not right/wrong.

| Your answer relative to target | Score | What it teaches |
|---|---|---|
| Exact leaf | 100 | precision |
| Sibling leaf (same ring-2 parent) | 70 | "you're in the right neighbourhood" |
| Same ring-2, different sibling group | 50 | |
| Same ring-1 category | 30 | |
| Adjacent ring-1 category on the wheel | 12 | |
| Known confusable pair (curated cross-links) | 12–25 | honours *legitimate* confusion |
| Distant category | 0 | |

Plus modifiers: **specificity bonus** for committing to ring 3 instead of hedging at ring 1, and a
**hedge penalty** for always answering "Fruity" and never going deeper. Beginners hide in ring 1;
the scoring must make that unprofitable.

Curated confusable cross-links are the expert touch — e.g. the fruity ↔ fermented boundary
(is that "winey" or "overripe"?), citric vs. malic acidity, nutty vs. cereal vs. papery. These
confusions are *correct* confusions. Rewarding them partially is what makes the game feel like it
was built by someone who has actually sat at a cupping table.

### 3.2 Modes

**1. Wheel Walk (free explore)** — the wheel as the app's home screen. Tap a wedge → zoom → read
definition, physical reference, intensity anchor, typical origins/processes/roast levels that
produce it, and how it's distinguished from its two nearest confusables. No scoring. This is the
reference book, and it must be beautiful enough to browse for fun.

**2. Descriptor Golf** — a tasting note or coffee profile is presented; navigate ring 1 → 2 → 3 to
the target. Scored by Wheel Distance, "par" per hole, 9 holes a round. The core daily loop, ~3 min.

**3. Cause & Effect** — the mode that builds *deep* understanding rather than vocabulary.
   - *Forward:* given Ethiopia Yirgacheffe / washed / light roast → predict the profile.
   - *Reverse:* given a profile heavy in blueberry, fermented, boozy, heavy body → deduce
     natural process, likely Ethiopian, likely lower altitude drying issue or intentional extended ferment.
   - *Perturbation:* "same coffee, roasted 30 s longer into development — which wheel wedges move?"
     (Sugar-browning up, floral/acidic down.) This teaches the physics behind the wheel.

**4. Triangulation (mental)** — three coffee profiles rendered as wheel signatures; find the odd
one. Trains the *comparison strategy* Q candidates fail on: compare attribute-by-attribute, not
holistically.

**5. Triangulation (physical)** — app blinds and randomises cup positions, times the protocol
(4:00 crust break, skim, taste at ~70 °C / 60 °C / 50 °C), you log the odd cup. Needs two coffees
and 15 minutes. This is where real skill is earned.

**6. Calibration Room (multiplayer)** — the most fun mode, and it's exactly how real calibration
works. Everyone at the table scores the same sample independently and blind; the app reveals the
panel median and each person's deviation. Not "who's right" — **who's furthest from consensus, and
in which direction.** Persistent per-user bias report: "you over-score acidity by +0.4 and compress
your range into 82–85; you rarely use the word 'papery' when the panel does."

**7. Defect Lab** — taints vs. faults, root cause, and where each sits on the wheel: phenolic,
potato (Great Lakes region, antestia), ferment/overripe, mold/musty, baggy/papery, rioy/iodine,
quakers. Play: given a symptom + processing history, name the defect and its cause.

**8. Reference Homework** — the Track A ↔ B bridge. The app assigns physical references from the
lexicon ("this week: cardamom whole vs. ground, black tea, malic acid in water at 2 concentrations"),
then quizzes you blind days later. Aroma-kit mode supports vial-number entry (36-vial kits) for
self-blinded olfactory drills.

**9. Boss Levels** — Q-style module simulations at the end of each belt.

### 3.3 Progression: the palate ladder

| Belt | Unlocks | Mastery gate |
|---|---|---|
| **1. Nine Doors** | Ring 1 only, 9 categories | 85% at ring-1 over 50 items |
| **2. Branching** | Ring 2, two categories at a time | ring-2 accuracy + no hedging |
| **3. Leaves** | Ring 3 for unlocked branches | specificity index > 2.4 avg depth |
| **4. Intensity** | 0–15 anchors, CVA 1–9 intensity | intensity error < 1.5 |
| **5. Judgement** | Affective scoring, full SCA form / CVA | calibration σ vs. panel < 1.0 |
| **6. Panel** | Host calibration rooms, author content | sustained consensus agreement |

Categories unlock in pedagogical order, not wheel order: **Roasted / Nutty-Cocoa / Sweet first**
(the familiar, high-frequency ones), then Fruity and Sour/Fermented (high-value, hard),
then Floral, Spices, Green/Vegetative, Other (the ones beginners genuinely can't yet perceive).

### 3.4 Spaced repetition + confusion matrix
Every answer updates a per-user **confusion matrix** over descriptors. The scheduler resurfaces
your specific confusions (SM-2-ish interval, weighted by wheel distance of the error). The user-facing
artifact is a **Palate Profile radar**: Breadth (vocabulary used), Specificity (avg wheel depth),
Accuracy (avg wheel distance), Precision (repeatability on a re-served sample), Consensus (panel
agreement), Coverage (which wheel sectors you're blind to — most people have a blind sector).

"You are blind to the Green/Vegetative sector" is a genuinely useful, slightly addictive insight.

---

## 4. Technical plan

### 4.1 Stack
- **React 18 + TypeScript + Vite**, installable **PWA**, offline-first. Phone-first layout —
  it will be used standing at a cupping table with wet hands.
- **SVG sunburst wheel** built with `d3-hierarchy` partition layout, rendered as React components
  (d3 for math only, React for DOM). Custom-drawn — see §2.5.
- **Zustand** for state, **Dexie/IndexedDB** for offline progress and session logs.
- Content as versioned **JSON**, validated by **Zod** at build time.
- No backend for MVP. Multiplayer (Calibration Room) later via a small
  Node/Hono + Postgres service, or Supabase if speed matters more than control.
- Mobile store builds later via Capacitor over the same PWA. Do not start with React Native.

### 4.2 Data model (sketch)

```ts
type WheelNode = {
  id: string;                 // "fruity.berry.blackberry"
  label: string;
  ring: 1 | 2 | 3;
  parentId: string | null;
  color: string;              // inherited family hue, ring-scaled lightness
  angle: { start: number; end: number };  // authored, preserves perceptual ordering
};

type Attribute = {
  nodeId: string;
  definition: string;         // our own words
  reference: { name: string; prep: string; intensity: number }[];  // 0-15 anchors
  modality: ('aroma' | 'flavor' | 'basic-taste' | 'mouthfeel')[];
  confusables: { nodeId: string; note: string; partialCredit: number }[];
  causes: { origin?: string[]; process?: string[]; roast?: string[]; note: string }[];
  isDefect?: boolean;
};

type CoffeeProfile = {
  id: string; name: string;
  origin: string; variety?: string; altitude?: number;
  process: 'washed' | 'natural' | 'honey' | 'anaerobic' | 'wet-hulled';
  roast: 'light' | 'medium' | 'medium-dark' | 'dark';
  descriptors: { nodeId: string; intensity: number }[];  // 0-15
  cva?: CvaScores; sca?: ScaScores;
  panelMedian?: ScaScores;    // for calibration modes
};

type Attempt = {
  userId: string; mode: GameMode; targetNodeId: string;
  answerNodeId: string; wheelDistance: number; score: number;
  latencyMs: number; at: number;
};
```

The **scoring engine is a pure function** `score(answer, target, wheel, confusables) → Score`.
Isolated, exhaustively unit-tested, no UI. It is the heart of the product; everything else is chrome.

### 4.3 Screens
Home (live wheel + daily streak) · Wheel Walk / attribute detail · Game round · Round results with
wheel-overlay of your error path · Palate Profile · Cupping session (physical, timed) · Session log ·
Homework · Calibration Room (v2) · Settings.

---

## 5. Content is the real work

Engineering is maybe 35% of this project. The content set is the moat:

- ~110 attribute records (definition, reference, prep, anchors, confusables, causes) — **author these
  first**, they gate every mode.
- ~60 curated confusable pairs with partial-credit weights.
- ~80 coffee profiles spanning origin × process × roast, with descriptor vectors — ideally sourced
  from real cupping forms, not invented. Invented profiles teach fiction.
- ~40 defect records.
- Homework reference list mapped to products actually buyable in the user's region (start with one
  region; India/EU/US grocery availability differs enormously — this is a real localisation problem).

**Content quality bar:** every profile must trace to a real cupped coffee or a published score sheet.
If we can't source it, we mark it `synthetic: true` and never use it in calibration modes.

---

## 6. Milestones

**M1 — Wheel + engine (2 wks).** Data file for all 3 rings; SVG sunburst with zoom; scoring engine
with tests. Deliverable: you can browse the wheel and the engine grades an answer correctly.

**M2 — Playable MVP (3 wks).** Descriptor Golf, Belts 1–3, streaks, local persistence, results screen
with error-path overlay. Deliverable: 3-minute daily loop that a beginner enjoys.

**M3 — Depth (3 wks). ← v1 ships here.** Wheel Walk detail pages, Cause & Effect (elevated: this
mode carries the whole "deep understanding" promise in a screen-only build), Defect Lab, confusion
matrix + spaced repetition, Palate Profile radar.

**M4 — Coffee in hand (3 wks). Deferred past v1.** Cupping session timer/protocol, physical
triangulation, session log, Reference Homework, aroma-kit mode. This is where the app stops being a
quiz — build it once the screen loop is proven, not before. Keep the data model open to it.

**M5 — Judgement (3 wks).** SCA form + CVA trainers, panel-median comparison, bias report.

**M6 — Calibration Room.** Backend, accounts, multiplayer scoring reveal.

Ship M2 to ~10 real beginners before building M3. The specific thing to watch: **do they hedge at
ring 1 forever?** If yes, the specificity incentives are wrong and that's a scoring-engine fix,
not a content fix.

---

## 7. Decisions

### Locked
- **Audience: both, beginner-first.** Belts 1–3 are written for curious home brewers and cafe staff —
  forgiving gates, explanation-heavy, playable with no equipment. Q-track depth (exam-mirroring boss
  levels, organic acid ID, green grading, full CVA rigor) layers in behind Belts 4–6 rather than
  living in a separate app. Consequence for content: every attribute record needs **two registers** —
  a plain-language line for beginners and a precise line for Q candidates. Author both from the start;
  retrofitting tone across 110 records later is miserable.
- **Scope: screen-only MVP.** M1–M3 ship first. The physical track (M4) stays in the plan and the
  data model must not close doors on it — `Attempt` and session records are designed now to accept
  physical sessions later — but no session tooling in v1.
- **Platform:** PWA-first, phone-first layout, Capacitor wrapper only if store presence is needed.

### Still open
1. **Content sourcing:** author coffee profiles in-house, or partner with a roaster/lab for real
   score sheets. Blocks M2 content, not M1 code.
2. **Region for the homework reference list.** Deferred with M4, but the region choice affects which
   physical references we cite in attribute records — which is M1 content. Needs an answer soon.
3. **Streak/monetisation model.** Deliberately untouched until the loop is proven fun.

### Consequences of the locked decisions
- Ship M2 to beginners, but recruit **two or three Q-certified tasters as content reviewers** early.
  Beginner-first tone with expert-verified content is the combination; expert-verified content is not
  something we can produce alone.
- Because the physical track is deferred, **Cause & Effect (M3) carries the entire "deep understanding"
  promise in v1.** It is no longer a nice-to-have — if the screen-only build is going to teach anything
  beyond vocabulary, it teaches it there. Budget content effort accordingly.

---

## 8. What would make this fail

- Becoming flashcards with a nice wheel. Mitigation: Cause & Effect and the physical track are
  not optional extras — they are the product.
- Fabricated coffee profiles that teach wrong associations. Mitigation: `synthetic` flag, sourcing bar.
- Grading "wrong" what is genuinely hard. Mitigation: wheel-distance + curated confusables.
- Beautiful wheel, hollow content. Mitigation: author the ~110 attribute records *before* M2 polish.
