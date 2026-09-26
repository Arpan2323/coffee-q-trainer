import { ATTRIBUTES, type AttributeSet } from './attributes.js';
import { REGIONS, type Region, type ReferenceStandard } from './schema.js';
import type { Wheel } from './types.js';
import { WHEEL, getNode } from './wheel.js';

/**
 * The physical reference standards hung on attribute records, queried by region.
 *
 * This is the Track A / Track B bridge from PLAN.md section 1 made concrete: a reference is a real
 * product a learner can buy and smell, and Reference Homework is the mode that assigns one. PLAN.md
 * section 5 calls the regional availability "a real localisation problem", and it is: blackberry
 * preserve is a supermarket item in the EU and a specialist import in India, maple syrup is a
 * pantry staple in the US and neither elsewhere, and rose water is everywhere in India and a baking
 * aisle curiosity in the US. A homework list that ignores that is a list of things you cannot do.
 *
 * PLAN.md decision 2 - which single region to author first - is still open. The content set does not
 * dodge it by tagging everything everywhere: each reference names the regions where that specific
 * product is an ordinary purchase, so `coverageByRegion` reports honestly what a player in each
 * region can actually be asked, and the decision can be made from that rather than from intuition.
 */

export const REGION_LABEL: Record<Region, string> = {
  IN: 'India',
  EU: 'Europe',
  US: 'United States',
};

export interface ReferenceEntry {
  readonly nodeId: string;
  /** Index into the attribute record's `references` array - a record may offer more than one. */
  readonly referenceIndex: number;
  readonly reference: ReferenceStandard;
}

export function allReferences(attributes: AttributeSet = ATTRIBUTES): ReferenceEntry[] {
  const entries: ReferenceEntry[] = [];
  for (const [nodeId, record] of attributes.byNode) {
    record.references?.forEach((reference, referenceIndex) => {
      entries.push({ nodeId, referenceIndex, reference });
    });
  }
  return entries;
}

/** Every reference buyable in one region, as homework candidates. */
export function referencesIn(
  region: Region,
  attributes: AttributeSet = ATTRIBUTES,
): ReferenceEntry[] {
  return allReferences(attributes).filter((e) => e.reference.regions.includes(region));
}

/**
 * Node ids with at least one reference in this region. This is the homework pool, and it is keyed by
 * attribute node id - which matters, because it means `weightsForRound` from the progress store
 * applies here unchanged. Screen play and homework draw on the same spaced-repetition state: a
 * descriptor you keep missing on the wheel is a descriptor the app should send you to go and smell.
 */
export function homeworkPool(region: Region, attributes: AttributeSet = ATTRIBUTES): string[] {
  return [...new Set(referencesIn(region, attributes).map((e) => e.nodeId))];
}

export function getReference(
  nodeId: string,
  referenceIndex: number,
  attributes: AttributeSet = ATTRIBUTES,
): ReferenceStandard {
  const reference = attributes.byNode.get(nodeId)?.references?.[referenceIndex];
  if (!reference) {
    throw new Error(`no reference ${referenceIndex} for "${nodeId}"`);
  }
  return reference;
}

/** Indexes into an attribute's `references` array that are buyable in this region. */
export function referenceIndexesIn(
  nodeId: string,
  region: Region,
  attributes: AttributeSet = ATTRIBUTES,
): number[] {
  const references = attributes.byNode.get(nodeId)?.references ?? [];
  return references.flatMap((reference, index) => (reference.regions.includes(region) ? [index] : []));
}

export interface CategoryReferenceCoverage {
  readonly categoryId: string;
  readonly label: string;
  /** Attributes in this category with a reference available in the region. */
  readonly withReference: number;
  /** Attributes in this category that have an attribute record at all. */
  readonly candidates: number;
}

export interface RegionCoverage {
  readonly region: Region;
  readonly references: number;
  readonly attributes: number;
  readonly perCategory: readonly CategoryReferenceCoverage[];
  /** Categories with no reference at all in this region - homework simply cannot ask about them. */
  readonly unreachable: readonly string[];
}

/**
 * What a player in one region can actually be sent to smell. Surfaced in the UI rather than kept as
 * an internal detail: "no reference available here for Floral" is a content gap the player should be
 * told about, the same way an unreviewed definition says so.
 */
export function coverageByRegion(
  region: Region,
  attributes: AttributeSet = ATTRIBUTES,
  wheel: Wheel = WHEEL,
): RegionCoverage {
  const entries = referencesIn(region, attributes);
  const nodesWithReference = new Set(entries.map((e) => e.nodeId));

  const perCategory = wheel.categoryOrder.map((categoryId): CategoryReferenceCoverage => {
    const inCategory = [...attributes.byNode.keys()].filter(
      (nodeId) => getNode(wheel, nodeId).categoryId === categoryId,
    );
    return {
      categoryId,
      label: getNode(wheel, categoryId).label,
      withReference: inCategory.filter((nodeId) => nodesWithReference.has(nodeId)).length,
      candidates: inCategory.length,
    };
  });

  return {
    region,
    references: entries.length,
    attributes: nodesWithReference.size,
    perCategory,
    unreachable: perCategory.filter((c) => c.withReference === 0).map((c) => c.label),
  };
}

/** Every region's coverage, for the region picker - so the choice is made with the numbers visible. */
export function coverageEverywhere(
  attributes: AttributeSet = ATTRIBUTES,
  wheel: Wheel = WHEEL,
): RegionCoverage[] {
  return REGIONS.map((region) => coverageByRegion(region, attributes, wheel));
}
