# Coffee Q Trainer

A learning game that teaches coffee tasting through the flavor wheel.
See [PLAN.md](PLAN.md) for product design and [STRATEGY.md](STRATEGY.md) for goals and metrics.

**Live:** https://arpan2323.github.io/coffee-q-trainer/ — deployed from `main` via
[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) (tests + typecheck gate
the build; see that file before assuming a push always ships). This is the dev harness described
below, not a finished product screen — content is provisional and unreviewed (next section), and
IP clearance (STRATEGY.md O4) hasn't happened, so treat this link as a working demo, not a launch.

## Status — M1, M2, M3 and M4 complete

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
| M3 · Cause & Effect — Perturbation | done — categorical roast-trend table (9 categories, up/down/mixed), scored per-category across 3 coffees |
| M4 · Cupping session timer/protocol | done — SCA protocol as a clock, coded bowls, descriptor and note logging; **no cupping form, that is M5** |
| M4 · Physical triangulation | done — coded bases, seeded odd-cup assignment, self/helper blinding recorded separately |
| M4 · Session log | done — separate versioned record and storage key, capped at 200 sessions with lifetime totals kept |
| M4 · Reference Homework | done — 66 region-tagged references across all nine categories, **provisional**; three-day delay before the quiz |
| M4 · Aroma-kit mode | done — answer-then-vial ordering, player's own kit mapping; **no vial list shipped** |
| M4 · Palate meter | done — discrimination against 1-in-3 chance with an exact binomial p-value, kept apart from screen mastery |

288 tests passing. Belts now narrow as they deepen: all nine categories at ring 1, five at ring 2,
three at ring 3.

**Nothing in the content set has been reviewed by a Q grader.** 110 definitions, 47 confusable
weights and now 66 reference standards are one practitioner's judgement. That review is Q1 KR3.1 and
KR3.2 in STRATEGY.md and it gates v1.

**M4 was built out of the order PLAN.md sets.** The plan defers the physical track past v1 and is
explicit about why: *"build it once the screen loop is proven, not before"*, with the proving step
being M2 in front of ~10 real beginners. That pilot has not happened, so M4 is code and content
ahead of the evidence that was supposed to justify it. Two consequences worth holding on to. First,
the screen-loop question the pilot was meant to answer — do beginners hedge at ring 1 forever? — is
still open, and it is a scoring-engine question that the physical track cannot answer. Second, every
design decision in `src/session/` is now a guess about how people cup that no one has watched them
make; the reference list in particular wants a pilot before it wants more entries.

```bash
npm install
npm run dev      # http://localhost:5173 - Descriptor Golf, Defect Lab, Cause & Effect, Coffee in hand, Palate Profile, Wheel Walk
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
src/data/roastTrends.json    per-category roast-trend answer key for Perturbation - provisional
src/domain/roastTrends.ts    loader, asserts every ring-1 category has exactly one trend
src/game/causeEffectRound.ts Cause & Effect Forward round builder, scored against every descriptor (pure)
src/game/causeEffectReverse.ts  Cause & Effect Reverse round builder, binary process guess (pure)
src/game/perturbation.ts     Cause & Effect Perturbation round builder, one guess per category (pure)
src/game/CauseEffect.tsx     the Cause & Effect screen - direction picker, then Forward or Reverse
src/game/PerturbationRound.tsx  the Perturbation screen
src/progress/store.ts        streaks, mastery, decay, sampling weights, the Palate Profile (pure)
src/progress/storage.ts      the persistence adapter - still localStorage, see below
src/progress/PalateProfile.tsx  the radar, coverage bars, confusion list, and the physical block
src/data/protocol.json       the SCA cupping protocol as a timed sequence
src/domain/protocol.ts       loader, asserts ascending offsets - the clock depends on them
src/domain/references.ts     region-filtered queries over the reference standards in attributes.json
src/session/types.ts         the physical-track ledger - separate record, separate version
src/session/log.ts           session reducers, the palate meter, the exact binomial tail (pure)
src/session/storage.ts       the physical log's own adapter and its own storage key
src/session/codes.ts         three-digit blinding codes, shared by every physical mode
src/session/timer.ts         the protocol clock as a pure function of elapsed seconds
src/session/CuppingSession.tsx  the timed protocol screen and bowl logging
src/session/PhysicalTrack.tsx   the physical-track shell, palate meter and session log
src/game/triangulation.ts    physical triangulation round builder, seeded coded cups (pure)
src/game/homework.ts         Reference Homework assignment and blind quiz (pure)
src/game/aromaKit.ts         aroma-kit drill - answer first, vial number second (pure)
src/game/TriangulationSession.tsx / ReferenceHomework.tsx / AromaKitDrill.tsx   the three screens
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
staying synchronous keeps the store trivially testable. Corrupt data, full quotas and private
browsing are all handled by carrying on unrecorded; a lost streak is a smaller harm than a blank
screen.

**M4 arrived and IndexedDB still has not, deliberately.** The note here used to say cupping session
logs would earn it. They did not: a session record is a few hundred bytes, the history is capped at
200, and the whole physical log lands under 100 kB against a 5 MB quota. IndexedDB would buy headroom
nobody needs and cost async plumbing through every screen plus an `await` in every reducer test. What
the session log did earn is its **own** adapter and its own storage key (`session/storage.ts`), and
that is a different argument: `reviveProgress` discards the whole payload on a version mismatch, so
sharing a key would mean an M5 change to the cupping record costing a player their streak and their
mastered count. The IndexedDB seam is still one file, and it becomes the right call when a session
carries photographs of the table or a full CVA form per bowl.

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
panel) are named as absent rather than estimated — the same discipline the attribute records apply
to intensity anchors.

**M4 did not fill those two in, and it would have been easy to pretend otherwise.** Triangulation
produces a real number about a real nose, and it is tempting to file it under Precision. It is not:
precision is one sample scored twice and agreeing with itself, and triangulation is discrimination
between two different coffees. The cupping screen could serve a blind duplicate and measure precision
honestly — a small, well-defined piece of future work, and better than approximating it now.
Consensus still needs a panel, which is M6.

What M4 did add is a second block on this screen, `PhysicalEvidence`, reading the session log rather
than screen play. The two are shown as peers and never summed. One blended "palate score" would be
the most flattering number this app could print and the least true one.

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

PLAN.md section 3.2 mode 3: origin, process and roast are the cause; the cup is the effect. All
three directions are built.

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

**No spaced repetition yet, in any direction.** `nextCauseEffectRound`, `nextReverseRound` and
`nextPerturbationRound` all accept per-profile weights and are tested, but no screen calls them:
`weightsForRound` is keyed by attribute node ids from `progress.attributes`, and profile ids are not
attribute ids, so wiring it today would silently be a no-op. Profile-level weak-spot tracking is
future work, not a broken feature — at 8 profiles it matters less than it will once the set grows.

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

### Perturbation

"Same coffee, roasted further into development — which wedges move, and which way?" One coffee
profile grounds each hole, but the question - and its answer key - is the same nine-category
roast-trend table every time, on purpose: the lesson is that the physics is coffee-invariant, not a
fact about any one cup. Every hole asks about all nine ring-1 categories; there are only nine facts
to learn, so unlike Forward/Reverse there's no meaningful subset to sample.

**The answer key is categorical, not a numeric model.** `src/data/roastTrends.json` gives each
category a direction - `up`, `down`, or `mixed` - with a one- or two-sentence justification in
standard roasting chemistry: Maillard browning and caramelization push Roasted, Nutty/Cocoa and
Spices up; chlorogenic-acid degradation and the loss of the most volatile aromatics pull
Sour/Fermented, Fruity, Green/Vegetative and Floral down. `mixed` is the honest answer where a
category doesn't move monotonically (Sweet peaks mid-roast, then is masked by bitterness in dark
roasts) or has no roast-driven mechanism at all (Other's papery/chemical notes trace to green-coffee
handling, not the roast). This is exactly the discipline that leaves confusable weights
`provisional` rather than invented - `roastTrends.json` carries the same `reviewStatus` and the same
open `reviewTarget` (a Q-grader pass this project doesn't have yet).

**Scoring is per-category, independent, binary** - the same reasoning as Reverse: no invented
distance between "up" and "down." A hole is complete only once all nine categories have a guess
(`isHoleReady`); submitting scores every category against `ROAST_TRENDS` at once and reveals all nine
verdicts together, each with its justification, rather than one at a time.

**Reuses the coffee profiles rather than inventing a fourth content shape.** `furtherRoast` in
`perturbation.ts` is a small light→medium→medium-dark→dark ladder; a profile already at `dark` has
nowhere further to go, and the screen says so rather than pretending there's a next step.

**Progress mirrors Reverse exactly.** `recordPerturbationRound` advances the streak and a lifetime
`perturbation: {attempts, correct}` tally - `GuessStats`, the same shape `reverse` uses, since both
are binary-guess tallies with no wheel node to credit. Neither touches `attributes`, `categories`,
`confusions`, `vocab`, or `rounds`.

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

## The physical track

PLAN.md section 1 splits the product in two: Track A is the map, Track B is the territory, and the
value is the bridge. M1–M3 built Track A. M4 is Track B, behind one nav entry (**Coffee in hand**)
because the four modes share a ledger and a set of rules worth stating once.

**The rule everything here obeys:** *never claim a screen taught a palate.* Screen play earns
knowledge progress, logged physical sessions earn palate progress, and the app never adds them
together. That is why `src/session/` is a second record with its own version and its own storage key
rather than four more fields on `Progress`, and why the Palate Profile shows two blocks instead of
one number.

### The app cannot blind anything, so it says how each mode is blinded

This is the honest centre of the whole milestone. An app with no access to the cups cannot verify
that a taster did not peek. What it can do is make peeking visible as a choice, and refuse to
conflate evidence of different strengths.

| Mode | How it is blinded | Strength |
|---|---|---|
| **Aroma kit** | The wheel answer is committed *before* the vial number is entered — `enterVial` throws if it is called first | Beyond argument. The app learns what the sample was only after the answer is locked |
| **Triangulation, helper-poured** | The pour sheet goes to someone else; the taster never sees it | Strong |
| **Triangulation, self-poured** | Coded bases, then the bowls are shuffled without tracking. Knowing 417 is odd is harmless once you have lost track of which bowl 417 is | Depends on the taster's own discipline |
| **Reference Homework** | Coded samples, quizzed three days later | Weakest — you can usually see that the saucer holds grated zest. Its value is the recall, not the blinding |
| **Cupping session** | Coded bowls, named after the blind passes | Descriptors logged here are **ungraded** — your own cup has no answer key |

`Blinding` is stored per triangulation session and the two are never summed: `palateStats` reports
self-poured and helper-poured separately as well as combined. A taster who peeks has lied to their own
log, and the consequence is worth naming — these numbers are evidence *for the taster*, never data
about the product. Efficacy measurement (STRATEGY.md) needs helper-poured sets or an observer.

### Discrimination is measured against chance, not against zero

A triangulation guess is right one time in three by luck, so "67% correct" means nothing on its own.
`binomialTailAtLeast` computes the exact upper binomial tail, and the UI reports it: 4 of 6 looks
impressive and carries p ≈ 0.1, which is to say it is not yet evidence of anything. 12 of 18 is.

Exact rather than a normal approximation, because the interesting case here is a tiny n — six sets is
where a taster first wants to know whether they are beating a guess, and that is exactly where the
approximation lies.

### The cupping clock is a function of elapsed time, not a chain of timers

`session/timer.ts` derives the whole protocol state from one number. A phone that slept through the
crust break, a backgrounded tab, or a taster who started the clock and went to fetch a spoon all break
a timeline built from callbacks firing on schedule; deriving from elapsed seconds means the screen
catches up the instant it is looked at, and every offset is testable without waiting eighteen minutes.

`buildProtocol` asserts the step offsets ascend, which is what lets the clock find the current step in
one forward pass. Out of order, it would jump backwards mid-session — a bug you would only meet
standing at a table with a bowl going cold.

**The dose and the 4:00 crust break are the published protocol; the cooling offsets are estimates.**
How fast a bowl reaches 70 °C depends on bowl mass, ambient temperature and airflow, so the steps that
carry `approxTempC` carry it as a prompt the taster overrides, and the UI says so. A timer that
certifies a temperature it cannot measure would be the same failure as an invented intensity anchor.

### Reference standards, and the region decision

66 references across 65 attributes, covering all nine categories, authored into `attributes.json`
under the `references` field the M1 schema already defined. No intensity anchors: those are panel
measurement, and the rule has not changed. `reviewStatus` stays `provisional`.

`regions` is now an **enum** (`IN` / `EU` / `US`), not free strings. A typo'd region is the worst kind
of content bug here — the reference stays valid, loads without complaint, and is silently absent from
every homework list the filter builds.

PLAN.md decision 2 — which region to author first — **is still open, and this content set does not
dodge it by tagging everything global**. Each reference names the regions where that specific product
is an ordinary purchase, which is why the counts differ: India reaches 56 attributes, Europe 65, the
US 64. Maple syrup is EU/US, Dettol is IN/EU, rose water is everywhere because gulab jal is. The
region picker shows those counts while asking, so the decision can be made from evidence rather than
intuition, and no region is preselected — a default would answer the open question by accident.

### Homework is where spaced repetition finally reaches the physical world

The homework pool is keyed by attribute node id, which is exactly what `weightsForRound` returns. So
unlike the Cause & Effect modes — whose pools are profile ids, and whose weighting is a documented
no-op — passing weights into `createAssignment` genuinely biases the draw. **A descriptor you keep
missing on the wheel is a descriptor the app sends you to go and smell.** That connection is the
single most useful thing in the physical track, and it is the reason the reference list lives on the
attribute records rather than in a content file of its own.

The three-day delay is enforced, not decorative: `isDue` refuses the quiz until it has passed, for the
same reason mastery refuses a third exact answer inside 48 hours. A learning metric that can be
crammed is an engagement metric wearing a lab coat.

### The aroma kit ships no vial list

Kits number their vials differently, a commercial kit's contents list is a licensed asset like the
wheel artwork (PLAN.md section 2.5), and a taster who decanted their own standards has a mapping
nobody could have shipped. So the mapping is entered once by the person holding the box and lives in
the session log.

This is also the only round builder in the codebase with **no seed**, because it draws nothing: the
randomisation is physical. `enterVial` refuses a vial already used in the drill — you cannot have drawn
the same vial twice, so a repeat is a typo, and accepting it would let one lucky vial be scored again
and again.

### What the session log keeps, and why the totals are stored

`sessions` is capped at 200 and the lifetime totals live beside it rather than being derived from it.
Deriving "sessions logged" from a capped array would make the number go *down* on the 201st session —
the same silent-drift failure the round history and the confusion matrix already avoid the same way.

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
- A reference's `regions` is an enum, not free text, and it is the homework filter's only input. A
  reference tagged with a region where its product is not an ordinary purchase sends a learner
  shopping for something they cannot buy, which is the one failure that makes the whole bridge
  useless. Tag what is true, not what is convenient.
- Reference standards carry no `intensity`, for the same reason attribute records do not: a
  calibrated 0–15 anchor is panel measurement against a physical kit.
