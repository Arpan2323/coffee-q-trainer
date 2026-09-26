import { describe, expect, it } from 'vitest';
import {
  BREW_METHODS,
  BREW_METHOD_LABEL,
  EMPTY_JOURNAL_RADAR,
  JOURNAL_AXES,
  JOURNAL_AXIS_LABEL,
  JOURNAL_INTENSITY_MAX,
  JOURNAL_RATING_MAX,
  clampIntensity,
  clampRating,
  radarValues,
  setAxis,
} from './journal.js';

describe('the journal tasting wheel', () => {
  it('has sixteen axes, each with a label', () => {
    expect(JOURNAL_AXES).toHaveLength(16);
    for (const axis of JOURNAL_AXES) {
      expect(JOURNAL_AXIS_LABEL[axis]).toBeTruthy();
    }
  });

  it('starts every axis at zero', () => {
    for (const axis of JOURNAL_AXES) {
      expect(EMPTY_JOURNAL_RADAR[axis]).toBe(0);
    }
    expect(Object.keys(EMPTY_JOURNAL_RADAR)).toHaveLength(JOURNAL_AXES.length);
  });

  it('clamps intensity to the five printed rings', () => {
    expect(clampIntensity(3)).toBe(3);
    expect(clampIntensity(-2)).toBe(0);
    expect(clampIntensity(9)).toBe(JOURNAL_INTENSITY_MAX);
    expect(clampIntensity(2.6)).toBe(3);
    expect(clampIntensity(NaN)).toBe(0);
  });

  it('sets one axis without disturbing the others', () => {
    const radar = setAxis(EMPTY_JOURNAL_RADAR, 'floral', 4);
    expect(radar.floral).toBe(4);
    expect(radar.sweet).toBe(0);
    // The clamp applies here too, not just when reading the value back later.
    expect(setAxis(radar, 'sweet', 99).sweet).toBe(JOURNAL_INTENSITY_MAX);
  });

  it('produces one 0-1 value per axis, in JOURNAL_AXES order, for the radar chart', () => {
    const radar = setAxis(setAxis(EMPTY_JOURNAL_RADAR, 'sweet', 5), 'bitter', 2);
    const values = radarValues(radar);
    expect(values).toHaveLength(16);
    expect(values[JOURNAL_AXES.indexOf('sweet')]).toBe(1);
    expect(values[JOURNAL_AXES.indexOf('bitter')]).toBeCloseTo(0.4);
    expect(values[JOURNAL_AXES.indexOf('clean')]).toBe(0);
  });
});

describe('the star rating', () => {
  it('clamps to 0-5', () => {
    expect(clampRating(3)).toBe(3);
    expect(clampRating(-1)).toBe(0);
    expect(clampRating(7)).toBe(JOURNAL_RATING_MAX);
    expect(clampRating(NaN)).toBe(0);
  });
});

describe('brew method', () => {
  it('is single-select: one entry per method, each labelled', () => {
    expect(new Set(BREW_METHODS).size).toBe(BREW_METHODS.length);
    for (const method of BREW_METHODS) {
      expect(BREW_METHOD_LABEL[method]).toBeTruthy();
    }
  });

  it('includes the printed card\'s seven options', () => {
    expect([...BREW_METHODS].sort()).toEqual(
      ['cupping', 'drip', 'espresso', 'other', 'pour-over', 'press', 'siphon'].sort(),
    );
  });
});
