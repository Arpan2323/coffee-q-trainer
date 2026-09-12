import { z } from 'zod';

/**
 * The wheel is exactly three rings deep, so the schema is written level by level rather than
 * recursively. That is deliberate: a recursive schema would silently accept a four-ring branch,
 * and the scoring engine's tier table assumes three.
 */

const localId = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/, 'ids are lowercase kebab-case so they can be used in URLs and file names');

const defect = z.union([z.literal(true), z.literal('contextual')]).optional();

// .strict() throughout is load-bearing, not tidiness. Zod strips unknown keys by default, so a
// `children` array added to a leaf would be silently discarded and those attributes would vanish
// from the wheel with no error at all. Content loss must fail loudly.
const leafSchema = z
  .object({
    id: localId,
    label: z.string().min(1),
    defect,
  })
  .strict();

const midSchema = z
  .object({
    id: localId,
    label: z.string().min(1),
    defect,
    children: z.array(leafSchema).min(1).optional(),
  })
  .strict();

const categorySchema = z
  .object({
    id: localId,
    label: z.string().min(1),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    children: z.array(midSchema).min(1),
  })
  .strict();

export const wheelSourceSchema = z.object({
  version: z.string(),
  note: z.string().optional(),
  categories: z.array(categorySchema).min(1),
});

export const confusableSourceSchema = z.object({
  version: z.string(),
  note: z.string().optional(),
  reviewStatus: z.string(),
  reviewTarget: z.string().optional(),
  pairs: z
    .array(
      z
        .object({
          a: z.string().min(1),
          b: z.string().min(1),
          weight: z.number().gt(0).lte(1),
          note: z.string().min(1),
        })
        .strict(),
    )
    .min(1),
});

/**
 * One category's direction of travel as roast development continues - Perturbation's whole answer
 * key. `up`/`down` are the coarse, well-established chemistry (Maillard/caramelization building
 * Roasted/Nutty-Cocoa/Spices; chlorogenic-acid degradation and volatile loss emptying
 * Sour-Fermented/Fruity/Floral/Green-Vegetative). `mixed` is the honest answer where the category
 * doesn't move monotonically (Sweet peaks mid-roast then is masked by bitterness) or has no
 * roast-driven mechanism at all (Other's papery/chemical notes trace to green-coffee handling, not
 * the roast) - the same discipline that leaves confusable weights `provisional` rather than invented.
 */
export const roastTrendSchema = z
  .object({
    categoryId: z.string().min(1),
    direction: z.enum(['up', 'down', 'mixed']),
    note: z.string().min(1),
  })
  .strict();

export const roastTrendsSourceSchema = z.object({
  version: z.string(),
  note: z.string().optional(),
  reviewStatus: z.string(),
  reviewTarget: z.string().optional(),
  trends: z.array(roastTrendSchema).min(1),
});

/**
 * Attribute records are the separate content asset that the taxonomy hangs meaning on: what the
 * attribute means, what to buy to smell it, and what causes it in the cup. The schema lands in M1
 * so the content workstream has a target to author against; the records themselves are M2 work and
 * need Q-grader review before they ship (PLAN.md section 5, STRATEGY.md KR3.1).
 *
 * `beginner` and `expert` are both required. Writing one register now and retrofitting the other
 * across 110 records later is the failure mode the audience decision created - so the schema makes
 * a half-written record invalid rather than merely incomplete.
 */
export const attributeRecordSchema = z
  .object({
    nodeId: z.string().min(1),
    definition: z
      .object({
        beginner: z.string().min(1),
        expert: z.string().min(1),
      })
      .strict(),
    /**
     * Optional, and `intensity` optional within it. A calibrated 0-15 anchor is measurement data
     * produced by a panel against a physical kit - it cannot be written from a desk, and inventing
     * one would put a number that looks authoritative next to a guess. Records ship without
     * anchors until the kit and the panel exist.
     */
    references: z
      .array(
        z
          .object({
            name: z.string().min(1),
            prep: z.string().min(1),
            intensity: z.number().min(0).max(15).optional(),
            /** Where this reference is actually buyable - availability is regional. */
            regions: z.array(z.string().min(1)).min(1),
          })
          .strict(),
      )
      .optional(),
    modality: z.array(z.enum(['aroma', 'flavor', 'basic-taste', 'mouthfeel'])).min(1),
    causes: z
      .array(
        z
          .object({
            origin: z.array(z.string()).optional(),
            process: z.array(z.string()).optional(),
            roast: z.array(z.string()).optional(),
            note: z.string().min(1),
          })
          .strict(),
      )
      .default([]),
    reviewedBy: z.array(z.string()).default([]),
  })
  .strict();

export const attributesSourceSchema = z
  .object({
    version: z.string(),
    note: z.string().optional(),
    reviewStatus: z.string(),
    records: z.array(attributeRecordSchema).min(1),
  })
  .strict();

/**
 * A coffee's cause-and-effect shape for Cause & Effect (PLAN.md section 3.2, mode 3): the origin,
 * process and roast that caused a cup, and the descriptors it produced. `synthetic` and `source` are
 * both required and neither is decorative - PLAN.md section 5's content-quality bar is "every
 * profile must trace to a real cupped coffee or a published score sheet; if we can't source it, mark
 * it `synthetic: true`". Making both fields mandatory means a profile author cannot forget the
 * disclosure the way an optional field invites forgetting. `source` carries the citation for a real
 * profile or the fabrication rationale for a synthetic one - either way, a reader can tell why the
 * shape was chosen.
 *
 * No `intensity` requirement on descriptors, for the same reason attribute records leave it out: a
 * calibrated 0-15 anchor is panel measurement, not something invented from a desk.
 */
const coffeeProfileSchema = z
  .object({
    id: localId,
    name: z.string().min(1),
    origin: z.string().min(1),
    variety: z.string().min(1).optional(),
    altitude: z.number().positive().optional(),
    process: z.enum(['washed', 'natural', 'honey', 'anaerobic', 'wet-hulled']),
    roast: z.enum(['light', 'medium', 'medium-dark', 'dark']),
    descriptors: z
      .array(
        z
          .object({
            nodeId: z.string().min(1),
            intensity: z.number().min(0).max(15).optional(),
          })
          .strict(),
      )
      .min(2),
    synthetic: z.boolean(),
    source: z.string().min(1),
  })
  .strict();

export const profilesSourceSchema = z.object({
  version: z.string(),
  note: z.string().optional(),
  profiles: z.array(coffeeProfileSchema).min(1),
});

export type WheelSource = z.infer<typeof wheelSourceSchema>;
export type AttributesSource = z.infer<typeof attributesSourceSchema>;
export type ConfusableSource = z.infer<typeof confusableSourceSchema>;
export type AttributeRecord = z.infer<typeof attributeRecordSchema>;
export type ProfilesSource = z.infer<typeof profilesSourceSchema>;
export type CoffeeProfile = z.infer<typeof coffeeProfileSchema>;
/** Pulled out because Cause & Effect Reverse guesses this specifically, not a whole profile. */
export type Process = CoffeeProfile['process'];
export type RoastTrendsSource = z.infer<typeof roastTrendsSourceSchema>;
export type RoastTrend = z.infer<typeof roastTrendSchema>;
export type TrendDirection = RoastTrend['direction'];
