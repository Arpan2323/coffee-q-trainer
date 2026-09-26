import { describe, expect, it } from 'vitest';
import { ATTRIBUTES } from './attributes.js';
import {
  REGION_LABEL,
  allReferences,
  coverageByRegion,
  coverageEverywhere,
  getReference,
  homeworkPool,
  referenceIndexesIn,
  referencesIn,
} from './references.js';
import { REGIONS } from './schema.js';
import { WHEEL, getNode } from './wheel.js';

describe('the reference standards', () => {
  it('exist for a usable share of the attribute set', () => {
    // Not all 110: a reference has to be a real product somebody can buy, and plenty of attributes
    // (brown-roast, isovaleric acid) have no honest kitchen equivalent. Homework needs enough to
    // draw a varied week from, not full coverage.
    expect(allReferences().length).toBeGreaterThanOrEqual(60);
  });

  it('hangs every reference on a real wheel node', () => {
    for (const entry of allReferences()) {
      expect(WHEEL.nodes.has(entry.nodeId)).toBe(true);
    }
  });

  // Anchors are panel measurement against a physical kit. Writing one from a desk would put a
  // number that looks authoritative next to a guess - the same rule the attribute records follow.
  it('claims no intensity anchors, because no panel has measured any', () => {
    for (const entry of allReferences()) {
      expect(entry.reference.intensity).toBeUndefined();
    }
  });

  it('names at least one region for every reference', () => {
    for (const entry of allReferences()) {
      expect(entry.reference.regions.length).toBeGreaterThan(0);
      for (const region of entry.reference.regions) {
        expect(REGIONS).toContain(region);
      }
    }
  });

  // The content set must not dodge PLAN.md's open region decision by tagging everything everywhere.
  // If every reference were global the region filter would be decoration.
  it('distinguishes the regions rather than tagging everything global', () => {
    const coverage = coverageEverywhere();
    const counts = coverage.map((c) => c.references);
    expect(new Set(counts).size).toBeGreaterThan(1);
  });

  it('has a label for every region', () => {
    for (const region of REGIONS) expect(REGION_LABEL[region]).toBeTruthy();
  });
});

describe('querying references by region', () => {
  it('returns only what is buyable there', () => {
    for (const region of REGIONS) {
      for (const entry of referencesIn(region)) {
        expect(entry.reference.regions).toContain(region);
      }
    }
  });

  it('builds a homework pool of distinct attribute node ids', () => {
    const pool = homeworkPool('EU');
    expect(new Set(pool).size).toBe(pool.length);
    expect(pool.length).toBeGreaterThan(0);
  });

  // The pool being keyed by attribute node id is what lets the progress store's sampling weights
  // apply to homework unchanged - unlike the profile-keyed Cause & Effect modes.
  it('draws its pool from the same key space the progress store uses', () => {
    for (const nodeId of homeworkPool('IN')) {
      expect(ATTRIBUTES.byNode.has(nodeId)).toBe(true);
    }
  });

  it('lists only the region-eligible indexes for one attribute', () => {
    // Smoky carries two references: lapsang everywhere, smoked paprika only in the EU and US.
    expect(referenceIndexesIn('roasted.burnt.smoky', 'IN')).toEqual([0]);
    expect(referenceIndexesIn('roasted.burnt.smoky', 'EU')).toEqual([0, 1]);
    expect(referenceIndexesIn('sweet.brown-sugar.maple-syrup', 'IN')).toEqual([]);
  });

  it('throws on a reference that does not exist rather than returning a blank one', () => {
    expect(() => getReference('roasted.burnt.smoky', 99)).toThrow(/no reference/);
    expect(() => getReference('roasted.cereal.malt', 4)).toThrow(/no reference/);
  });
});

describe('region coverage', () => {
  it('counts references and the attributes they cover', () => {
    const coverage = coverageByRegion('EU');
    expect(coverage.references).toBeGreaterThanOrEqual(coverage.attributes);
    expect(coverage.perCategory).toHaveLength(WHEEL.categoryOrder.length);
  });

  // "No reference available here for Floral" is a content gap the player should be told about, the
  // same way an unreviewed definition says so - so the gap has to be computed, not assumed absent.
  it('names the categories a region cannot reach', () => {
    for (const coverage of coverageEverywhere()) {
      const zero = coverage.perCategory.filter((c) => c.withReference === 0).map((c) => c.label);
      expect(coverage.unreachable).toEqual(zero);
    }
  });

  it('reaches every category in at least one region', () => {
    const reachable = new Set(
      allReferences().map((e) => getNode(WHEEL, e.nodeId).categoryId),
    );
    expect(reachable.size).toBe(WHEEL.categoryOrder.length);
  });

  it('never counts more attributes with a reference than exist in a category', () => {
    for (const coverage of coverageEverywhere()) {
      for (const category of coverage.perCategory) {
        expect(category.withReference).toBeLessThanOrEqual(category.candidates);
      }
    }
  });
});
