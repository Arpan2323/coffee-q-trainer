import { describe, expect, it } from 'vitest';
import {
  AROMA_DRILL_VIALS,
  AROMA_KIT_ID,
  aromaIdentifications,
  aromaSummary,
  commitAnswer,
  createAromaDrill,
  drawnVials,
  enterVial,
  kitCoverage,
  usedVials,
  type AromaDrill,
} from './aromaKit.js';

const KIT: Record<string, string> = {
  '1': 'floral.floral.jasmine',
  '2': 'spices.brown-spice.clove',
  '3': 'fruity.berry.blackberry',
  '7': 'nutty-cocoa.cocoa.chocolate',
  '12': 'floral.floral.rose',
  '30': 'spices.pepper',
  '36': 'other.chemical.rubber',
};

const play = (drill: AromaDrill, vial: number, answerId: string): AromaDrill =>
  enterVial(commitAnswer(drill, answerId), vial, KIT);

describe('the kit mapping', () => {
  it('reports what the player has filled in', () => {
    const coverage = kitCoverage(KIT);
    expect(coverage.mapped).toBe(7);
    expect(coverage.vials).toEqual([1, 2, 3, 7, 12, 30, 36]);
    expect(coverage.attributes).toBe(7);
  });

  it('counts two vials of the same attribute as one attribute', () => {
    expect(kitCoverage({ ...KIT, '20': 'spices.pepper' }).attributes).toBe(7);
  });

  it('is empty before anything is entered', () => {
    expect(kitCoverage({})).toEqual({ mapped: 0, vials: [], attributes: 0 });
  });
});

describe('an aroma-kit drill', () => {
  it('is built with no seed, because the app draws nothing', () => {
    const drill = createAromaDrill();
    expect(drill.id).toBe(AROMA_KIT_ID);
    expect(drill.holes).toHaveLength(AROMA_DRILL_VIALS);
    // The randomisation is physical: the taster reaches into the box. Every hole starts blank.
    for (const hole of drill.holes) {
      expect(hole.vial).toBeNull();
      expect(hole.targetId).toBeNull();
      expect(hole.answerId).toBeNull();
    }
  });

  it('asks for at least one vial however small a count it is given', () => {
    expect(createAromaDrill(0).holes).toHaveLength(1);
    expect(createAromaDrill(-4).holes).toHaveLength(1);
  });
});

describe('the order of operations', () => {
  // This is the whole blinding. Reading the number before committing turns a blind identification
  // into a lookup, so the reducer refuses it outright rather than trusting the UI to sequence it.
  it('refuses a vial number before an answer is committed', () => {
    expect(() => enterVial(createAromaDrill(2), 1, KIT)).toThrow(/commit an answer/);
  });

  it('scores the committed answer once the vial is known', () => {
    const played = play(createAromaDrill(2), 1, 'floral.floral.jasmine');
    expect(played.holes[0]!.targetId).toBe('floral.floral.jasmine');
    expect(played.holes[0]!.result!.score).toBe(100);
    expect(played.current).toBe(1);
  });

  it('gives wheel-distance credit for a near miss', () => {
    const played = play(createAromaDrill(2), 12, 'floral.floral.jasmine');
    const result = played.holes[0]!.result!;
    expect(result.relation).toBe('sibling');
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
  });

  it('refuses a second answer for the same vial', () => {
    const drill = commitAnswer(createAromaDrill(2), 'spices.pepper');
    expect(() => commitAnswer(drill, 'spices.brown-spice.clove')).toThrow(/already been answered/);
  });

  // You cannot have drawn the same vial twice, so a repeat is a typo - and accepting it would let
  // one lucky vial be scored again and again.
  it('refuses a vial that has already been used in this drill', () => {
    const drill = play(createAromaDrill(3), 7, 'nutty-cocoa.cocoa.chocolate');
    expect(() => play(drill, 7, 'spices.pepper')).toThrow(/already been used/);
  });

  it('refuses an unmapped vial rather than guessing what is in it', () => {
    expect(() => play(createAromaDrill(2), 99, 'spices.pepper')).toThrow(/not mapped/);
  });

  it('keeps the committed answer when the vial entry is refused', () => {
    const drill = commitAnswer(createAromaDrill(2), 'spices.pepper');
    expect(() => enterVial(drill, 99, KIT)).toThrow(/not mapped/);
    // The taster smelled it and committed; a mistyped number must not cost them that.
    expect(drill.holes[0]!.answerId).toBe('spices.pepper');
  });

  it('tracks which vials have been used', () => {
    let drill = createAromaDrill(3);
    expect(usedVials(drill)).toEqual([]);
    drill = play(drill, 2, 'spices.brown-spice.clove');
    drill = play(drill, 30, 'spices.pepper');
    expect(usedVials(drill)).toEqual([2, 30]);
  });

  it('completes after the last vial and refuses anything further', () => {
    let drill = play(createAromaDrill(2), 1, 'floral.floral.jasmine');
    drill = play(drill, 2, 'spices.brown-spice.clove');

    expect(drill.complete).toBe(true);
    expect(() => commitAnswer(drill, 'spices.pepper')).toThrow(/already complete/);
    expect(() => enterVial(drill, 3, KIT)).toThrow(/already complete/);
  });
});

describe('the drill summary', () => {
  it('counts only the vials actually judged', () => {
    let drill = createAromaDrill(3);
    expect(aromaSummary(drill)).toEqual({
      answered: 0,
      total: 3,
      exactCount: 0,
      totalScore: 0,
      accuracy: 0,
    });

    drill = play(drill, 1, 'floral.floral.jasmine');
    drill = play(drill, 12, 'floral.floral.jasmine');

    const summary = aromaSummary(drill);
    expect(summary.answered).toBe(2);
    expect(summary.exactCount).toBe(1);
    expect(summary.accuracy).toBe(summary.totalScore / 2);
  });

  it('hands the session log its identifications and the vials they came from', () => {
    let drill = play(createAromaDrill(2), 3, 'fruity.berry.blackberry');
    drill = play(drill, 36, 'other.chemical.rubber');

    expect(drawnVials(drill)).toEqual([3, 36]);
    expect(aromaIdentifications(drill)).toEqual([
      {
        targetId: 'fruity.berry.blackberry',
        answerId: 'fruity.berry.blackberry',
        score: 100,
        exact: true,
      },
      {
        targetId: 'other.chemical.rubber',
        answerId: 'other.chemical.rubber',
        score: 100,
        exact: true,
      },
    ]);
  });
});
