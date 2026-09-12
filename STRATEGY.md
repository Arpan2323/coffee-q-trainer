# Q Trainer — Product Strategy

Companion to [PLAN.md](PLAN.md). Written 10 Aug 2026. Horizon: three quarters.

> **Note on method.** The `product-strategist` OKR cascade generator was run and its output discarded.
> Its templates emit generic SaaS boilerplate (ARR, patents, churn) with a single metric substituted
> into every slot, and its team cascade only fires on seven hardcoded team names. The OKRs below are
> hand-authored. The skill's *discipline* — one North Star, explicit guardrails, vertical alignment,
> 3–5 objectives per level — is applied throughout.

---

## 1. Stage-honest framing

Pre-code, pre-user, one builder. Company = product = team, so a three-level OKR cascade would be
theater. What actually governs this stage:

**Pre-PMF, goals are stated as evidence, not scale.** "Reach 10,000 users" is a wish. "Prove
beginners' specificity index rises over ten sessions" is a falsifiable claim that tells us whether
to keep building. Every Q1 key result below is falsifiable.

Teams map to **workstreams**, and the honest allocation for this product is content-heavy:

| Workstream | Share of effort | Why |
|---|---|---|
| Content | 45% | 110 attribute records + 60 confusable pairs + 80 profiles gate every mode |
| Engine | 20% | Scoring engine, SRS, wheel geometry |
| Experience | 20% | Wheel UI, round flow, results |
| Research | 15% | Pilot recruitment, interviews, expert review |

---

## 2. North Star Metric

### **Weekly Descriptors Mastered (WDM)**

A descriptor counts as *mastered* when the user answers it correctly at **ring 3** across **≥3
attempts spaced ≥48 h apart**.

Why this and not DAU, sessions, or streaks:

- It is a **learning-outcome** metric. Engagement metrics reward the product for being sticky; this
  one only moves when the user actually gets better. A trainer optimized for streaks breeds
  streak-farmers, not tasters.
- The spacing requirement makes it **un-inflatable by grinding** — you cannot cram it in one sitting.
- It is exactly what the user is buying, in money or in time.

### Metric tree

```
WDM = Active Learners × Rounds/Learner × Descriptors/Round × Mastery Conversion Rate
```

| Input lever | Owner workstream | Q1 target |
|---|---|---|
| Activation — first full 9-hole round within 24 h of install | Experience | 60% |
| Day-2 return (the SRS *needs* them back within 48 h) | Experience | 45% |
| Specificity index — avg ring depth reached | Engine + Content | ≥2.2 by session 10 |
| Mastery conversion — attempts → mastered | Content | measure, don't target yet |

### Guardrails (the part most OKR sets omit)

| Guardrail | Threshold | What it catches |
|---|---|---|
| **Mastery decay** — % of "mastered" descriptors failing a surprise re-test at day 30 | <25% | **The honesty check on the North Star.** If WDM rises while decay rises, we made the game easier, not the learner better. Watch these two together or the NSM lies to us. |
| **Hedge rate** — % of answers stopping at ring 1 | <20% by session 5 | Beginners hiding in "Fruity" while the score still climbs |
| **Synthetic content exposure** — % of served profiles flagged `synthetic` | <20% | Teaching fiction |
| **Session length** | <8 min median | Drifting into a time-sink; this is a trainer, not a slot machine |

---

## 3. Quarterly arc

| Quarter | Focus | Question it answers |
|---|---|---|
| **Q1 · Aug–Oct 2026 · Evidence** | Build M1–M3, pilot with 30 beginners | Does the loop teach, and will anyone come back? |
| **Q2 · Nov 2026–Jan 2027 · Distribution** | Roaster/cafe channel, public launch | Can we reach beginners without paying for them? |
| **Q3 · Feb–Apr 2027 · Efficacy & retention** | Physical track (M4), calibration reports | Does mastery hold, and will people pay? |

**Retention is not a Q3 lifecycle stage — it is this product's efficacy signal, so it gets measured
from the first pilot week.** People quit a trainer when it stops teaching them. Cohort retention
curves are the cheapest available proxy for "is this working," long before we can measure real
palates. Q3 is when it becomes the *focus*, not when it starts being watched.

---

## 4. Q1 OKRs — Evidence (Aug–Oct 2026)

### O1 · Prove the scoring engine teaches rather than merely tests
- **KR1.1** Wheel-distance engine passes 100% of a **120-case expert-labelled fixture set**,
  weighted toward cases where partial credit *must* be awarded (fruity↔fermented, citric↔malic,
  nutty↔cereal↔papery). Labelled by ≥2 Q-graders independently.
- **KR1.2** Pilot median **specificity index rises from ≤1.4 to ≥2.2** across 10 sessions.
- **KR1.3** **Hedge rate below 20% by session 5.**
- *Kill signal:* specificity flat after 10 sessions → the incentive design is wrong. That's an
  engine fix, not a content fix, and it invalidates the core mechanic until repaired.

### O2 · Prove the loop is worth returning to
- **KR2.1** **D7 retention ≥35%** among 30 recruited beginners. Below 20% = redesign, not iterate.
- **KR2.2** Median **≥4 sessions in the first 7 days**.
- **KR2.3** **≥8 of 15** exit-interviewed users correctly name and define 3 ring-3 descriptors
  unprompted — the qualitative check that the quantitative metrics aren't fooling us.

### O3 · Build a content set experts will vouch for
- **KR3.1** **110 attribute records** complete, dual-register (beginner + Q-candidate), 100%
  reviewed by ≥1 Q-grader.
- **KR3.2** **60 confusable pairs** weighted, with **inter-rater agreement ≥0.7** across 3 reviewers.
  Low agreement means the partial-credit weights are opinion, not perception — worth knowing early.
- **KR3.3** **≥80% of the 80 coffee profiles traceable to a real cupping form.**

### O4 · Clear the IP question before it becomes expensive
- **KR4.1** Written clearance or documented clean-room provenance for wheel geometry, colour system,
  and all 110 definitions, before any public build.

*Four objectives, three to four KRs each. Vertical alignment is trivially 100% at this org size;
the meaningful discipline here is that every KR is falsifiable and each objective has a kill signal.*

---

## 5. The strategic suggestion I'd actually push: the bag QR loop

**A roaster prints a QR on the bag. The customer scans it. The app loads that exact coffee's profile
and walks them through cupping it against the roaster's own tasting notes.**

This one move resolves three separate open problems at once:

1. **Content sourcing** (open problem #1 in PLAN.md) — roasters *have* real cupping forms and will
   share them, because it makes their notes credible instead of decorative.
2. **Distribution** — reaching beginners at the exact moment they're holding coffee and reading
   flavour notes they don't understand. That confusion is the product's entire wedge, and the bag is
   where it happens.
3. **Supply for the physical track (M4)** — the deferred track's blocker is "user must own good
   coffee." The bag solves it.

It also reframes the business. Roasters and cafes pay for staff training and for customers who can
taste what they paid for; **B2B2C is likely the revenue, with consumer freemium as the funnel.**
Cafe staff training is an existing budget line. Consumer sensory-education subscriptions mostly
are not.

Cost to test: one roaster, one coffee, one QR, one week.

---

## 6. Positioning

| Who exists | What they serve | The gap |
|---|---|---|
| Cropster, Tastify | Professionals *logging* cuppings | Assumes you already know how to taste |
| SCA courses, Q programme | Certification | Expensive, scheduled, intimidating |
| Le Nez du Café & aroma kits | Physical references | No feedback loop, no progression |
| Angel's Cup and similar | Blind coffee subscription + app | Delivery-led; teaching is thin |
| Generic flavour quizzes | Trivia | No perceptual model |

**Nobody serves the path between "I like coffee" and "I can describe it."** Pros get tools,
certification candidates get courses, beginners get a poster of the wheel and no way in.

Positioning line: *the wheel, taught as a map you learn to navigate — not a poster you stare at.*

---

## 7. Riskiest assumption

**That beginners want to get *better* at tasting, rather than simply wanting to *enjoy* coffee.**

Every objective above assumes a latent desire for skill. If that desire is rare — if most people are
content to enjoy the cup without describing it — then the addressable audience is far smaller than
"coffee drinkers" and the product is a niche tool for aspiring professionals, which changes pricing,
positioning, and content depth entirely.

**Test it before M2, not after:** 20 interviews with people who buy specialty coffee but have never
cupped, plus a paper prototype of Descriptor Golf. Cost: days. The question to ask is not "would you
use this" (everyone says yes) but "tell me about the last time you couldn't describe a coffee you
liked — what did you do next?" If the answer is consistently "nothing, I just drank it," that is the
finding, and it should reshape the plan before we author 110 content records.

---

## 8. What I'd deliberately not do yet

- **Monetisation design.** Not until D7 retention clears 35%. Pricing a product nobody returns to is
  wasted work.
- **Multiplayer (Calibration Room).** Highest build cost, needs a user base to be fun, and it's the
  easiest thing to be seduced into building early because it demos well.
- **Native apps.** PWA until store presence is an actual constraint.
- **Broadening beyond coffee** (wine, whisky, tea). The wheel-distance engine generalises, and that
  is precisely the temptation to resist until one domain is proven.
