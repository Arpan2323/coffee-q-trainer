# Coffee Q Trainer

A learning game that teaches coffee tasting through the flavor wheel.
See [PLAN.md](PLAN.md) for product design and [STRATEGY.md](STRATEGY.md) for goals and metrics.

**Live:** https://arpan2323.github.io/coffee-q-trainer/ — deployed from `main` via
[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) (tests + typecheck gate
the build; see that file before assuming a push always ships). This is the dev harness described
below, not a finished product screen — content is provisional and unreviewed (next section), and
IP clearance (STRATEGY.md O4) hasn't happened, so treat this link as a working demo, not a launch.

## Status — M1 and M2 complete, M3 nearly done (Perturbation only gap)

| Deliverable | State |
|---|---|
| M1 · Wheel taxonomy data file | done — 110 attributes, 3 rings, 9 categories |
| M1 · Curated confusable table | done — 47 pairs, **provisional, unreviewed** |
| M1 · Scoring engine | done |
| M1 · SVG sunburst | done — zoom, keyboard nav, light/dark |
| M2 · Descriptor Golf | done — 9 holes, clue → commit → reveal → scorecard |
| M2 · Belts 1–3 | done — Nine Doors, Branching, Leaves |
| M2 · Attribute records | done — **110 of 110**, dual-register, **provisional** |
| M2 · Streaks and local persistence | done — localStorage, survives reload |
| M2 · Spaced repetition | live — weak attributes are drawn more often |
| M3 · Wheel Walk detail | done — browse panel shows each node's record: both definition registers, modality, causes, curated confusions |
| M3 · Confusion matrix + Palate Profile | done — per-answer aggregates persisted; radar (Breadth, Specificity, Accuracy, Commitment, Coverage), per-category coverage, blind sectors, top confusions |
| M3 · Defect Lab | done — 6-fault round over the fault-flagged attributes; reveal teaches fault vs context-dependent |
| M3 · Cause & Effect — Forward | done — 8 coffee profiles, **all synthetic**; predict a descriptor from origin/process/roast |
| M3 · Cause & Effect — Reverse | done — given the cup's descriptors, name the process; binary scoring, no wheel involved |
| M3 · Cause & Effect — Perturbation | not built — "roast 30s longer, which wedges move?" needs a small roast-delta model this project doesn't have yet |

166 tests passing. Belts now narrow as they deepen: all nine categories at ring 1, five at ring 2,
three at ring 3.

**Nothing in the content set has been reviewed by a Q grader.** 110 definitions and 47 confusable
weights are one practitioner's judgement. That review is Q1 KR3.1 and KR3.2 in STRATEGY.md and it
gates v1, not M3.

```bash
npm install
npm run dev      # http://localhost:5173 - Descriptor Golf, Defect Lab, Cause & Effect, Palate Profile, Wheel Walk
npm test
npm run typecheck
```

## Layout

```
src/data/wheel.json          taxonomy - the only place attributes are defined
src/data/confusables.json    curated cross-branch confusions and their weights
src/domain/schema.ts         Zod validation for all content files
src/domain/wheel.ts          tree builder, navigation helpers, wedge geometry
src/domain/scoring.ts        the scoring engine (pure, no UI dependency)
src/data/attributes.json     definitions per attribute; the beginner one is the golf clue
src/domain/attributes.ts     loader, plus the clue-must-not-leak-its-label check
src/ui/geometry.ts           wedge paths, label fitting, zoom layout (pure, tested)
src/ui/FlavorWheel.tsx       the sunburst component
src/game/belts.ts            belts and the category unlock order
src/game/round.ts            the round engine (pure, seeded, no UI dependency)
src/game/DescriptorGolf.tsx  the game screen
src/game/defects.ts          Defect Lab round builder over the fault-flagged attributes (pure)
src/game/DefectLab.tsx       the Defect Lab screen
src/data/profiles.json       coffee profiles for Cause & Effect - all synthetic, see below
src/domain/profiles.ts       loader, validates descriptors resolve to terminal wheel nodes
src/game/causeEffectRound.ts Cause & Effect Forward round builder, scored against every descriptor (pure)
src/game/causeEffectReverse.ts  Cause & Effect Reverse round builder, binary process guess (pure)
src/game/CauseEffect.tsx     the Cause & Effect screen - direction picker, then Forward or Reverse
src/progress/store.ts        streaks, mastery, decay, sampling weights, the Palate Profile (pure)
src/progress/storage.ts      the persistence adapter - swap this for IndexedDB at M4
src/progress/PalateProfile.tsx  the radar, coverage bars and confusion list
src/dev/                     harness: play a round, browse the wheel, or read the Palate Profile
```

Content lives in JSON so it can be edited without touching code — content is ~45% of this project's
effort, and the people best placed to write it are not the people writing TypeScript.

## The scoring engine

Answers are graded by distance to the target, never right/wrong. Saying "raspberry" for blackberry
is a near miss; saying "burnt rubber" is not.

| Relation | Score | Example (target: Blackberry) |
|---|---|---|
| exact | 100 | Blackberry |
| sibling — shares a ring-2 parent | 70 | Raspberry |
| descendant — over-specified, right branch | 65 | Blackberry when target was Berry |
| ancestor at ring 2 — right branch, no leaf | 60 | Berry |
| same category / ancestor at ring 1 | 35 | Raisin, or Fruity |
| adjacent category on the wheel | 12 | Winey |
| distant category | 0 | Rubber |
| curated confusable | `weight × 100` | Apple for Malic Acid → 65 |

Three properties are deliberate and should survive refactors:

1. **`sibling` (70) beats `ancestorRing2` (60).** Committing to a leaf and landing next door beats
   stopping at the branch and being technically right. This is the anti-hedging incentive — without
   it beginners answer "Fruity" forever and the game teaches nothing.
2. **`ancestorRing1` equals `sameCategory` (35).** A correct-but-vague answer never scores below a
   wrong-but-specific one. Punishing a true answer reads as unjust and costs more trust than the
   extra incentive buys.
3. **Ring-2 nodes under one category are `same-category`, not siblings.** Vanilla and Vanillin
   branch straight off Sweet. Treating them as siblings would price the Berry/Dried-Fruit gap at 70
   in ring 2 and 35 in ring 3 for no perceptual reason. Ring-2 pairs that genuinely are close get
   their credit from the confusable table instead.

`ScoreResult` also returns `hedged` and `specificity`, which feed the hedge-rate guardrail and the
specificity index in STRATEGY.md. `DEFAULT_SCORING` is injectable: if pilot hedge rate stays above
20% by session 5, retune the tiers before touching content.

## Descriptor Golf

Nine holes. Each shows a description written for one attribute; you commit to a point on the wheel
and are scored by distance. `src/game/round.ts` is pure and seeded — a seed reproduces a round
exactly, which is what makes the engine testable and bug reports reproducible.

**The clue is the game.** If the clue named the attribute, the hole would be a word search against
a wheel that already shows every label. So a beginner definition may not contain any word from its
own label, and that is enforced at load time — `buildAttributes` throws on a clue that leaks.

**Belts ask at different depths using the same clues.** Nine Doors quotes a clue written for a leaf
and asks only for the category, which makes it a classification drill rather than nine identical
questions. Branching asks for the group, Leaves for the attribute itself.

**Answers are accepted at any ring.** Nothing stops you answering "Sweet" on a leaf hole. Blocking
the hedge would produce no data about hedging, and hedge rate is a strategy guardrail — so the
engine scores it, flags it, and tells you what committing would have been worth.

The round summary reports total against par, plus the two metrics STRATEGY.md hangs on:
specificity index (mean ring committed to) and hedge rate.

## Progress, streaks and mastery

`src/progress/` holds pure reducers over a `Progress` record, persisted through a swappable
storage adapter. Nothing here is async, and none of it knows about React.

**Mastery is the headline number, not the streak.** A descriptor counts as mastered after three
exact answers **spaced at least 48 hours apart**. The spacing is the whole design: ten correct
answers in one afternoon count once, so the number cannot be crammed. That makes it a learning
measure rather than an engagement measure — the North Star from STRATEGY.md, made computable.

**A streak day is a completed round, never an app open.** Rewarding the open would make the streak
measure attendance, and the product already has one number that measures learning. It's shown
second, under Mastered, for the same reason.

**Decay is tracked, and it is meant to hurt.** A mastered descriptor that later fails is lost and
must be re-earned from scratch; the decay rate surfaces once it is non-zero. Anything softer would
let the mastered count drift up while real recall drifted down, which is exactly the failure the
guardrail exists to catch.

**Spaced repetition is live.** `weightsForRound` biases the next draw toward weak attributes and
damps mastered ones to 0.4 — damped, never silenced, because a descriptor that never reappears can
never be shown to have decayed. `nextRound` is the seam, and it lives in the game layer rather than
the component so the policy is testable without playing dozens of rounds and squinting.

Progress credits **the attribute the clue was written for**, not the belt's shallower target. On
Nine Doors the target is a category, but what the player is learning to recognise is the leaf.

Storage is `localStorage`, not the IndexedDB the plan named: the record is a few kilobytes and
staying synchronous keeps the store trivially testable. IndexedDB earns its place at M4 when
cupping session logs arrive — swapping it means replacing `storage.ts` and nothing else. Corrupt
data, full quotas and private browsing are all handled by carrying on unrecorded; a lost streak is
a smaller harm than a blank screen.

The record schema is versioned; `reviveProgress` discards a payload from a different version rather
than guessing a migration. Adding the Palate Profile aggregates took it to `v2`, so a pilot tester's
`v1` progress is dropped on upgrade — acceptable pre-launch, and the alternative (a migration for
every schema change before there are users) is not worth the weight.

## The Palate Profile

`palateProfile` and `topConfusions` in `store.ts` turn lifetime play into the profile from PLAN.md
section 3.4. Four of its six axes are honestly computable from screen play:

- **Breadth** — distinct descriptors the player has committed to, out of 110.
- **Specificity** — mean ring committed to. The same number the round summary reports, kept for life.
- **Accuracy** — mean score. Not mean *wheel distance*: the score already folds in the confusable
  table, so it is the fairer measure of "how close".
- **Coverage** — how many of the nine categories the player has attempted at least four times *and*
  is scoring above 35 in. Below 35 is the same-category tier — landing in the right ring-1 wedge at
  best — so a low-coverage category is one the player cannot yet tell apart from its neighbours.

The radar shows a fifth spoke, **Commitment** (`1 − hedge rate`), so every axis reads "further out
is better". **Precision** (repeatability on a re-served sample) and **Consensus** (agreement with a
panel) need the physical track and are named as absent rather than estimated — the same discipline
the attribute records apply to intensity anchors.

**The blind-sector line is the point.** "Still blind to Green/Vegetative, Other" is the insight
STRATEGY.md calls slightly addictive, and it falls straight out of the coverage rule: a category
never attempted, or attempted enough and still under the accuracy floor.

**The confusion matrix is capped, not complete.** Each genuine miss bumps a `(target, answer)` cell;
past 80 pairs the least-frequent is evicted. A progress record tracks patterns, not every mistake —
the same reason the round history is capped at 100.

Aggregates are running sums (`answers.scoreSum / answers.count`, and so on), not a replay of every
attempt, so the record stays small and every axis is one division. The reducer that maintains them,
`recordAnswerOutcome`, is kept separate from `recordAttempt` (which owns mastery and decay) so each
stays small and independently testable.

## Defect Lab

A round drawn from the 19 fault-flagged attributes instead of a belt's category. `defects.ts` is a
thin layer over the round engine: `round.ts` grew a `buildRound(id, pool, targetRing, holes)` seam
that `createRound` now also uses, and Defect Lab calls it with `defectPool()`. Rounds carry the id
`defect-lab` and feed the same streak, mastery and Palate Profile machinery — they are real practice.

Every defect sits at ring 3, so the target is the fault itself and identification is the whole task.
**The teaching is in the reveal.** Each fault is classified:

- **A fault wherever it appears** (`defect: true`) — rubber, phenolic, mouldy, papery. No style
  redeems it.
- **Context-dependent** (`defect: "contextual"`) — fermented, overripe, smoky, woody, animalic,
  meaty. A fault in a washed lot or past an intensity, and a sought-after feature in the right
  coffee. Naming it is not the same as condemning the cup.

That distinction is the reason the mode exists. `DefectFlag` in `types.ts` has carried the warning
since M1 — *Defect Lab must not teach beginners that every ferment note is a flaw* — and this is
where it pays off. The round summary counts how many of the six were context-dependent.

The reveal also shows the expert-register definition and the first cause note, so a miss teaches the
fault rather than just scoring it.

## Cause & Effect

PLAN.md section 3.2 mode 3: origin, process and roast are the cause; the cup is the effect. Two of
its three directions are built. Perturbation ("roast 30s longer, which wedges move?") is not — it
needs a small model of how a roast delta shifts the wheel, which this project doesn't have and
won't guess at.

### Forward

Given a coffee's origin, process and roast, predict a descriptor the cup would carry. This is what
the existing wheel-click UI and `scoreAgainstAny` already fit, and building it puts the profiles to
work rather than leaving them inert content.

**Every profile is `synthetic: true`, and the UI never hides it.** `src/data/profiles.json` holds 8
composites — Ethiopia Yirgacheffe washed, Ethiopia Guji natural, Colombia Huila washed, Brazil
Cerrado natural, Costa Rica Tarrazú honey, Sumatra Mandheling wet-hulled, Kenya Nyeri washed, Panama
Boquete anaerobic natural — spanning all five processes and all four roast levels. None trace to a
real cupping form; PLAN.md section 5's content bar is explicit about the alternative: *"if we can't
source it, we mark it `synthetic: true`."* The schema makes both `synthetic` and `source` mandatory
(`.strict()`, no default) so the disclosure can't be dropped by a future content edit the way an
optional field invites, and `syntheticShare()` in `domain/profiles.ts` implements the STRATEGY.md
guardrail directly — it currently reads 1.0, the honest number until roaster-sourced score sheets
(STRATEGY.md section 5, the bag-QR loop) replace some of these.

**A real coffee is legitimately several descriptors at once.** Cause & Effect scores each answer with
`scoreAgainstAny` against the whole profile, not one fixed target — the function's own docstring
already argued this for coffee profiles specifically, before Cause & Effect existed to use it. The
reveal shows every descriptor the cup carries and bolds whichever one the answer matched.

**Progress is credited to the matched descriptor, not an arbitrary one.** `recordCauseEffectRound` in
`store.ts` mirrors `recordRound`, crediting `result.targetId` — the node `scoreAgainstAny` decided was
closest — to mastery, the confusion matrix and the Palate Profile's category coverage. A correct
"Jasmine" for a washed Yirgacheffe is real evidence the player knows Jasmine, so it counts.

**No spaced repetition yet, in either direction.** `nextCauseEffectRound` and `nextReverseRound` both
accept per-profile weights and are tested, but neither screen calls them: `weightsForRound` is keyed
by attribute node ids from `progress.attributes`, and profile ids are not attribute ids, so wiring it
today would silently be a no-op. Profile-level weak-spot tracking is future work, not a broken
feature — at 8 profiles it matters less than it will once the set grows.

### Reverse

Given the cup's descriptors (plus origin, variety and roast — the parts of the cause that don't give
away the answer), name the process. Scoped down from PLAN's narrative example, which also infers
origin and a specific drying story from descriptors alone: the one well-posed, closed-answer question
in it is process, a fixed five-value enum. An open-ended origin guess needs free text and a fuzzy
grading model this project isn't going to invent.

**Scoring is binary, not wheel-distance.** Processes have no tree position and no curated confusable
table between them. Inventing a partial-credit distance between "honey" and "natural" would be
guessing at a perceptual model exactly the way uniform category gaps already are (see the Maillard
cluster note below) — the rule here is not to invent numbers the project can't defend, so right or
wrong is what it is.

**`profile.source` would leak the answer, so Reverse never shows it before the guess.** Every
profile's `source` names its process directly, because that is literally what the composite is
justifying (see the profiles.json excerpts above). `SyntheticNote` in `CauseEffect.tsx` takes a
`showSource` flag that stays false throughout Reverse's answering phase — the mandatory `synthetic`
disclosure itself is never hidden, only the sentence that would spoil the puzzle. Caught by playing
the feature, not by a test: worth remembering that a `synthetic` flag's *supporting text* can carry
content of its own that a different game mode needs to treat as a spoiler.

**The reveal reuses attribute causes as evidence, the same way Forward reuses them.** For each
descriptor the cup carries, if its attribute record has a `causes` entry tagged with the true
process, that note is shown as supporting evidence ("Fermented: extended pulp contact, wet weather
during drying, or deliberate tank fermentation"). Coverage is uneven — only `anaerobic`, `honey` and
`natural` appear as cause tags anywhere in `attributes.json` today, so `washed` and `wet-hulled`
rounds currently show no evidence bullets. That is a content gap, not a bug: the UI shows nothing
rather than inventing a reason.

**Progress doesn't touch attribute mastery.** A process guess has no wheel node to credit -
`recordReverseRound` only advances the streak and a small lifetime `reverse: {attempts, correct}`
tally on `Progress`, deliberately kept out of `rounds` (a history of attribute-practice rounds the
belts, Defect Lab and Forward share) and out of `attributes`/`categories`/`confusions`/`vocab`.
Crediting a wheel node for a correct process guess would invent a link - "you said washed, so you
must know Jasmine" - that isn't there.

### The Maillard cluster problem

Playing belt 1 surfaced a genuine flaw in the adjacency model. Roasted, Nutty/Cocoa and Sweet are
one perceptual family — all products of the same browning reactions, and among the most confusable
categories in coffee — but the wheel's ring order separates them by two and three positions, so
cyclic adjacency scored them as *unrelated*. Since those three are the first unlocked categories,
every wrong answer in a beginner's first belt scored zero.

Fixed with three category-level confusable pairs. The deeper lesson stands: **binary adjacency is
too crude a model.** The published wheel varies its gap widths precisely because perceptual distance
is continuous, and we do not have that data.

Now that Nine Doors spans all nine categories, every distant pair is reachable in belt 1 and the
category-level table needs a proper pass. Candidates already visible: Fruity↔Sweet (gap 2, yet
dried fruit and molasses converge), Green/Vegetative↔Floral (gap 3, yet chamomile sits on the hay
boundary), Other↔Spices (gap 2, the clove/phenol axis). Each is covered at leaf level but not at
category level. Deliberately left for the Q-grader review rather than guessed at — three more
provisional weights would dilute the table faster than they would improve it.

## The confusable table

Cross-branch pairs the tree under-credits — the fruity/fermented boundary, citric vs. lemon,
nutty vs. cereal vs. papery. These are *correct* confusions and partial credit is the honest grade.

Two tests enforce quality: no entry may score at or below its own structural base (a dead entry
hides the fact that the table is doing nothing), and no entry may restate a ring-3 sibling
relationship the tree already credits.

**The 44 weights are one practitioner's judgement, not consensus.** They need inter-rater agreement
≥0.7 across three Q-graders before v1 — `reviewStatus` stays `provisional` until then.

## The sunburst

All geometry — wedge paths, zoom layout, label fitting — lives in `src/ui/geometry.ts` as pure
functions, so it is unit-tested without a DOM. The component is a thin renderer over it. That split
is why the layout bugs below were caught by tests rather than by squinting at the screen.

- **Zoom** remaps a node's angular span to the full circle and moves its descendants inward, so
  focusing Fruity puts Berry in ring 1 using the whole canvas rather than a thin slice of it.
  Double-click or Enter to zoom in, hub or Escape to go back.
- **Labels shrink, then stack, then truncate — in that order.** Ring 1 always reads along the arc;
  narrow categories split at the slash (`Nutty/` over `Cocoa`), which is what the published wheel
  does and what keeps the whole name. All 110 attributes render without losing a character.
- **The hub is large** because ring 1 has the least arc to write on. Floral, the narrowest wedge,
  could not hold a legible curved label until the ring was pushed outward.
- **Rings widen outward** (0.27 / 0.35 / 0.38) because ring 3 holds the longest names.
- **Faults are hatched, not recoloured.** Category hue is the thing learners navigate by, and the
  scoring model depends on it staying readable at a glance.
- **ARIA**: `role="tree"` with `treeitem` wedges, `aria-level` from the taxonomy ring, and a roving
  tabindex. Arrow keys walk siblings, parent and child.
- Both themes come from `prefers-color-scheme` plus `data-theme` overrides. Ring separation is
  opacity over one hue per category, so a single palette serves both.

**Seen on a screen at desktop width — all 110 labels legible, zoom and selection work — but not on a
phone, which is the target form factor.** Rendering was also checked programmatically: wedge counts,
path validity, label truncation, overflow, ARIA, and the zoom transform. The palette has had no
accessibility pass: contrast and colour-blind simulation are outstanding, and Roasted, Spices and
Nutty/Cocoa are close in hue by inheritance from the published wheel.

## Content invariants worth knowing

- Node ids are dot-delimited paths (`fruity.berry.blackberry`) generated from short author-facing
  ids. A test asserts every id matches its ancestry.
- All schemas are `.strict()`. Zod strips unknown keys by default, which would silently discard a
  `children` array added to a leaf — the attributes would vanish from the wheel with no error.
- Category order is clockwise and **is** the adjacency model. Reordering the array changes scoring.
  Floral and Fruity are neighbours across the array seam because the gap is cyclic.
- Wedge angles are computed from descendant counts, not authored. Gap widths are uniform: the
  published wheel varies them to encode perceptual distance, and we don't have that data.
- `defect: "contextual"` marks attributes that are faults only past an intensity or outside a
  process style. Fermented and overripe are sought after in some naturals — Defect Lab must not
  teach that every ferment note is a flaw.
