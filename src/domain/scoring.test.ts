import { describe, expect, it } from 'vitest';
import { CONFUSABLES, WHEEL, terminals } from './wheel.js';
import {
  DEFAULT_SCORING,
  scoreAgainstAny,
  scoreAnswer,
  wheelDistance,
  type ScoringConfig,
} from './scoring.js';

const score = (answer: string, target: string, config?: ScoringConfig) =>
  scoreAnswer(WHEEL, CONFUSABLES, answer, target, config);

const BLACKBERRY = 'fruity.berry.blackberry';
const RASPBERRY = 'fruity.berry.raspberry';
const RAISIN = 'fruity.dried-fruit.raisin';
const BERRY = 'fruity.berry';
const FRUITY = 'fruity';
const WINEY = 'sour-fermented.alcohol-fermented.winey';
const RUBBER = 'other.chemical.rubber';

describe('structural tiers', () => {
  it('awards a perfect score for the exact attribute', () => {
    const r = score(BLACKBERRY, BLACKBERRY);
    expect(r.score).toBe(100);
    expect(r.relation).toBe('exact');
    expect(r.wheelDistance).toBe(0);
  });

  it('credits a neighbouring leaf generously', () => {
    const r = score(RASPBERRY, BLACKBERRY);
    expect(r.score).toBe(70);
    expect(r.relation).toBe('sibling');
    expect(r.wheelDistance).toBe(2);
  });

  it('credits the right branch without the right leaf', () => {
    const r = score(BERRY, BLACKBERRY);
    expect(r.score).toBe(60);
    expect(r.relation).toBe('ancestor-ring2');
  });

  it('gives the same category modest credit', () => {
    const r = score(RAISIN, BLACKBERRY);
    expect(r.score).toBe(35);
    expect(r.relation).toBe('same-category');
    expect(r.wheelDistance).toBe(4);
  });

  it('gives an adjacent category a token', () => {
    const r = score(WINEY, BLACKBERRY);
    expect(r.score).toBe(12);
    expect(r.relation).toBe('adjacent-category');
  });

  it('gives a distant category nothing', () => {
    const r = score(RUBBER, BLACKBERRY);
    expect(r.score).toBe(0);
    expect(r.relation).toBe('distant');
  });

  it('accepts an over-specific answer in the right branch', () => {
    const r = score(BLACKBERRY, BERRY);
    expect(r.score).toBe(65);
    expect(r.relation).toBe('descendant');
    expect(r.hedged).toBe(false);
  });

  it('treats two ring-2 attributes under one category as same-category, not siblings', () => {
    // Vanilla and Vanillin branch straight off Sweet. Scoring them as siblings would mean the
    // Berry/Dried Fruit gap is worth 70 at ring 2 and 35 at ring 3 for no perceptual reason.
    const r = score('sweet.overall-sweet', 'sweet.brown-sugar.molasses');
    expect(r.relation).toBe('same-category');
    expect(r.score).toBe(35);
  });
});

describe('the anti-hedging incentive', () => {
  it('scores a committed near miss above a correct but vague answer', () => {
    // The pedagogical core: guessing Raspberry for Blackberry beats retreating to Berry, which
    // beats retreating to Fruity. Without this ordering beginners park at ring 1 forever.
    expect(score(RASPBERRY, BLACKBERRY).score).toBeGreaterThan(score(BERRY, BLACKBERRY).score);
    expect(score(BERRY, BLACKBERRY).score).toBeGreaterThan(score(FRUITY, BLACKBERRY).score);
  });

  it('never scores a correct answer below a wrong one in the same category', () => {
    // Answering Fruity is vague but true. Answering Raisin is specific but false. Vague-and-true
    // must not rank below specific-and-false, or the game feels unjust and players disengage.
    expect(score(FRUITY, BLACKBERRY).score).toBeGreaterThanOrEqual(score(RAISIN, BLACKBERRY).score);
  });

  it('flags hedges so the guardrail metric can be computed', () => {
    expect(score(FRUITY, BLACKBERRY).hedged).toBe(true);
    expect(score(BERRY, BLACKBERRY).hedged).toBe(true);
    expect(score(RASPBERRY, BLACKBERRY).hedged).toBe(false);
    expect(score(BLACKBERRY, BLACKBERRY).hedged).toBe(false);
  });

  it('reports the ring committed to, which averages into the specificity index', () => {
    expect(score(FRUITY, BLACKBERRY).specificity).toBe(1);
    expect(score(BERRY, BLACKBERRY).specificity).toBe(2);
    expect(score(RASPBERRY, BLACKBERRY).specificity).toBe(3);
  });

  it('exposes the tier table so pilot data can retune it without a content change', () => {
    const harsh: ScoringConfig = { ...DEFAULT_SCORING, ancestorRing1: 5 };
    expect(score(FRUITY, BLACKBERRY, harsh).score).toBe(5);
    expect(score(FRUITY, BLACKBERRY).score).toBe(35);
  });
});

describe('curated confusables', () => {
  it('rescues a legitimate confusion the tree scores as adjacent-only', () => {
    // Malic acid is the acid in apples. The tree puts them in different categories; a taster
    // calling "apple" has perceived the right thing and named it from the fruit side.
    const r = score('sour-fermented.sour.malic-acid', 'fruity.other-fruit.apple');
    expect(r.baseScore).toBe(12);
    expect(r.score).toBe(65);
    expect(r.relation).toBe('confusable');
    expect(r.confusable?.note).toMatch(/apples/i);
  });

  it('rescues a pair the tree treats as unrelated across categories', () => {
    const r = score('roasted.cereal.grain', 'other.papery-musty.papery');
    expect(r.baseScore).toBe(12);
    expect(r.score).toBe(35);
  });

  it('lifts near-identical ring-2 attributes above the generic category floor', () => {
    const r = score('sweet.vanilla', 'sweet.vanillin');
    expect(r.baseScore).toBe(35);
    expect(r.score).toBe(70);
  });

  it('is symmetric in both directions', () => {
    const a = score('other.chemical.medicinal', 'other.papery-musty.phenolic');
    const b = score('other.papery-musty.phenolic', 'other.chemical.medicinal');
    expect(a.score).toBe(b.score);
    expect(a.score).toBe(60);
  });

  it('rescues the Maillard cluster, which the wheel geometry cannot express', () => {
    // Roasted, Nutty/Cocoa and Sweet are one perceptual family produced by the same browning
    // reactions, but the wheel's ring order separates them by two and three positions, scoring
    // them as unrelated. Found by playing belt 1, where all three are the only categories in
    // play - every wrong answer scored zero, which is both wrong and demoralising.
    expect(score('roasted', 'nutty-cocoa').baseScore).toBe(0);
    expect(score('roasted', 'nutty-cocoa').score).toBe(35);
    expect(score('roasted', 'sweet').score).toBe(30);
    expect(score('nutty-cocoa', 'sweet').score).toBe(30);
  });

  it('never lowers a score below the structural base', () => {
    for (const pair of CONFUSABLES.pairs) {
      const r = score(pair.a, pair.b);
      expect(r.score).toBeGreaterThanOrEqual(r.baseScore);
    }
  });
});

describe('wheel distance', () => {
  it('grows monotonically as answers get perceptually further away', () => {
    const distances = [
      wheelDistance(WHEEL, BLACKBERRY, BLACKBERRY),
      wheelDistance(WHEEL, RASPBERRY, BLACKBERRY),
      wheelDistance(WHEEL, RAISIN, BLACKBERRY),
      wheelDistance(WHEEL, WINEY, BLACKBERRY),
      wheelDistance(WHEEL, RUBBER, BLACKBERRY),
    ];
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    expect(new Set(distances).size).toBe(distances.length);
  });

  it('is symmetric for every pair of terminals', () => {
    const sample = terminals(WHEEL).slice(0, 30);
    for (const a of sample) {
      for (const b of sample) {
        expect(wheelDistance(WHEEL, a.id, b.id)).toBe(wheelDistance(WHEEL, b.id, a.id));
      }
    }
  });
});

describe('scoring against several valid targets', () => {
  it('takes the best match, so a cup with two true descriptors punishes neither', () => {
    const targets = [BLACKBERRY, 'fruity.berry.blueberry'];
    expect(scoreAgainstAny(WHEEL, CONFUSABLES, 'fruity.berry.blueberry', targets).score).toBe(100);
    expect(scoreAgainstAny(WHEEL, CONFUSABLES, BLACKBERRY, targets).score).toBe(100);
  });

  it('breaks score ties by picking the perceptually closer target', () => {
    const result = scoreAgainstAny(WHEEL, CONFUSABLES, RASPBERRY, [
      'fruity.berry.strawberry',
      BLACKBERRY,
    ]);
    expect(result.score).toBe(70);
    expect(result.wheelDistance).toBe(2);
  });

  it('refuses an empty target list rather than inventing a score', () => {
    expect(() => scoreAgainstAny(WHEEL, CONFUSABLES, BLACKBERRY, [])).toThrow(/at least one/);
  });
});

describe('engine invariants across the whole wheel', () => {
  it('keeps every score inside the configured range', () => {
    const all = terminals(WHEEL);
    for (const a of all) {
      for (const b of all) {
        const r = score(a.id, b.id);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(DEFAULT_SCORING.exact);
        expect(r.score === DEFAULT_SCORING.exact).toBe(a.id === b.id);
      }
    }
  });

  it('is symmetric between terminals, since neither side is privileged', () => {
    const sample = terminals(WHEEL).slice(0, 40);
    for (const a of sample) {
      for (const b of sample) {
        expect(score(a.id, b.id).score).toBe(score(b.id, a.id).score);
      }
    }
  });
});
