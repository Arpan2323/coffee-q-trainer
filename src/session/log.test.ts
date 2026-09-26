import { describe, expect, it } from 'vitest';
import {
  TRIANGULATION_CHANCE,
  binomialTailAtLeast,
  newSessionId,
  palateStats,
  recordSession,
  reviveSessionLog,
  setAssignment,
  setKitEntry,
  setRegion,
} from './log.js';
import {
  EMPTY_SESSION_LOG,
  SESSION_HISTORY_LIMIT,
  SESSION_LOG_VERSION,
  type Identification,
  type PhysicalSession,
  type SessionDetail,
  type SessionLog,
} from './types.js';
import { EMPTY_JOURNAL_RADAR } from './journal.js';

const session = (detail: SessionDetail, at = 1_000): PhysicalSession => ({
  id: newSessionId(detail.kind, at),
  at,
  durationSec: 900,
  note: '',
  detail,
});

const ident = (targetId: string, exact: boolean, score: number): Identification => ({
  targetId,
  answerId: exact ? targetId : 'other.chemical.rubber',
  score,
  exact,
});

const triangulation = (sets: number, correct: number, blinding: 'self' | 'helper' = 'self') =>
  session({
    kind: 'triangulation',
    blinding,
    coffeeA: 'A',
    coffeeB: 'B',
    sets,
    correct,
  });

describe('recording a physical session', () => {
  it('counts cups from a cupping', () => {
    const log = recordSession(
      EMPTY_SESSION_LOG,
      session({
        kind: 'cupping',
        samples: [
          { code: '417', name: 'Huila', descriptorIds: ['fruity.citrus-fruit.orange'], note: '' },
          { code: '820', name: 'Guji', descriptorIds: [], note: 'muddled' },
        ],
        stepsReached: ['pour', 'steep', 'break'],
        protocolVersion: '0.1.0',
      }),
    );
    expect(log.sessionsLogged).toBe(1);
    expect(log.cupsTasted).toBe(2);
    // A cupping has no answer key, so nothing it logs may reach the graded totals.
    expect(log.identification.attempts).toBe(0);
    expect(log.named).toEqual({});
  });

  it('keeps self-poured and helper-poured discrimination apart', () => {
    let log = recordSession(EMPTY_SESSION_LOG, triangulation(3, 2, 'self'));
    log = recordSession(log, triangulation(6, 6, 'helper'));

    expect(log.discrimination.self).toEqual({ sets: 3, correct: 2 });
    expect(log.discrimination.helper).toEqual({ sets: 6, correct: 6 });
    // Three bowls a set, and they were really tasted.
    expect(log.cupsTasted).toBe(27);
  });

  it('folds graded identifications into the lifetime totals', () => {
    const log = recordSession(
      EMPTY_SESSION_LOG,
      session({
        kind: 'homework',
        region: 'IN',
        blinding: 'self',
        items: [
          ident('spices.brown-spice.clove', true, 100),
          ident('floral.floral.jasmine', false, 70),
        ],
      }),
    );
    expect(log.identification).toEqual({ attempts: 2, exact: 1, scoreSum: 170 });
    // Only an exact answer counts as having named the thing.
    expect(log.named).toEqual({ 'spices.brown-spice.clove': 1 });
  });

  it('treats an aroma-kit drill as the same kind of evidence as homework', () => {
    const log = recordSession(
      EMPTY_SESSION_LOG,
      session({
        kind: 'aroma-kit',
        vials: [12, 30],
        items: [ident('floral.floral.rose', true, 100), ident('spices.pepper', true, 100)],
      }),
    );
    expect(log.identification.attempts).toBe(2);
    expect(Object.keys(log.named)).toHaveLength(2);
  });

  // A journal entry is one known cup, ungraded like a cupping bowl - its sixteen-term wheel is not
  // the app's own flavour wheel, so it must never be able to touch identification or `named`.
  it('counts a journal entry as one cup and nothing graded', () => {
    const log = recordSession(
      EMPTY_SESSION_LOG,
      session({
        kind: 'journal',
        name: 'Yirgacheffe',
        roaster: 'Blue Tokai',
        producer: '',
        roastDate: '',
        brewMethod: 'pour-over',
        brewMethodOther: '',
        price: '',
        rating: 4,
        radar: EMPTY_JOURNAL_RADAR,
        notes: 'bright, floral',
      }),
    );
    expect(log.sessionsLogged).toBe(1);
    expect(log.cupsTasted).toBe(1);
    expect(log.identification.attempts).toBe(0);
    expect(log.named).toEqual({});
  });

  // The same discipline the round history and the confusion matrix use: trimming the history must
  // never move a lifetime number, or "sessions logged" starts going down.
  it('trims the history without touching the lifetime totals', () => {
    let log: SessionLog = EMPTY_SESSION_LOG;
    for (let i = 0; i < SESSION_HISTORY_LIMIT + 5; i++) {
      log = recordSession(log, triangulation(1, 1));
    }
    expect(log.sessions).toHaveLength(SESSION_HISTORY_LIMIT);
    expect(log.sessionsLogged).toBe(SESSION_HISTORY_LIMIT + 5);
    expect(log.discrimination.self.sets).toBe(SESSION_HISTORY_LIMIT + 5);
    expect(palateStats(log).sessionsLogged).toBe(SESSION_HISTORY_LIMIT + 5);
  });
});

describe('the physical-track settings', () => {
  it('starts with no region, because the region decision is still open', () => {
    expect(EMPTY_SESSION_LOG.region).toBeNull();
    expect(setRegion(EMPTY_SESSION_LOG, 'EU').region).toBe('EU');
  });

  it('maps and unmaps kit vials', () => {
    const mapped = setKitEntry(EMPTY_SESSION_LOG, 12, 'floral.floral.rose');
    expect(mapped.kit['12']).toBe('floral.floral.rose');
    expect(setKitEntry(mapped, 12, '').kit).toEqual({});
  });

  it('holds one assignment at a time', () => {
    const assignment = { region: 'IN' as const, assignedAt: 1, dueAt: 2, items: [] };
    const held = setAssignment(EMPTY_SESSION_LOG, assignment);
    expect(held.assignment).toBe(assignment);
    expect(setAssignment(held, null).assignment).toBeNull();
  });
});

describe('the binomial tail', () => {
  it('is 1 at or below zero successes and 0 above n', () => {
    expect(binomialTailAtLeast(0, 6, 1 / 3)).toBe(1);
    expect(binomialTailAtLeast(7, 6, 1 / 3)).toBe(0);
  });

  it('matches hand-computed values for a triangulation run', () => {
    // P(X >= 6) at n=6, p=1/3 is (1/3)^6.
    expect(binomialTailAtLeast(6, 6, 1 / 3)).toBeCloseTo((1 / 3) ** 6, 12);
    // P(X >= 1) is 1 - (2/3)^6.
    expect(binomialTailAtLeast(1, 6, 1 / 3)).toBeCloseTo(1 - (2 / 3) ** 6, 12);
  });

  it('falls monotonically as the bar rises', () => {
    const tails = [1, 2, 3, 4, 5, 6].map((k) => binomialTailAtLeast(k, 6, 1 / 3));
    for (let i = 1; i < tails.length; i++) {
      expect(tails[i]!).toBeLessThan(tails[i - 1]!);
    }
    expect(tails[0]!).toBeLessThanOrEqual(1);
  });
});

describe('the palate meter', () => {
  it('is empty rather than low before anything is logged', () => {
    const stats = palateStats(EMPTY_SESSION_LOG);
    expect(stats.empty).toBe(true);
    expect(stats.discriminationAll.pValue).toBeNull();
    expect(stats.lastSessionAt).toBeNull();
  });

  // The honest form of "your palate is improving". Four of six looks impressive and proves nothing.
  it('measures discrimination against chance, not against zero', () => {
    const log = recordSession(EMPTY_SESSION_LOG, triangulation(6, 4));
    const rate = palateStats(log).discriminationAll;

    expect(rate.rate).toBeCloseTo(4 / 6);
    expect(rate.chance).toBe(TRIANGULATION_CHANCE);
    expect(rate.pValue).toBeGreaterThan(0.05);
  });

  it('reaches significance once the run is long enough', () => {
    const log = recordSession(EMPTY_SESSION_LOG, triangulation(18, 12));
    expect(palateStats(log).discriminationAll.pValue!).toBeLessThan(0.01);
  });

  it('combines both blindings for the headline and keeps the split', () => {
    let log = recordSession(EMPTY_SESSION_LOG, triangulation(3, 3, 'self'));
    log = recordSession(log, triangulation(3, 1, 'helper'));
    const stats = palateStats(log);

    expect(stats.discriminationAll.sets).toBe(6);
    expect(stats.discriminationAll.correct).toBe(4);
    expect(stats.discrimination.self.rate).toBe(1);
    expect(stats.discrimination.helper.rate).toBeCloseTo(1 / 3);
  });

  it('reports identification accuracy and named breadth', () => {
    const log = recordSession(
      EMPTY_SESSION_LOG,
      session({
        kind: 'homework',
        region: 'US',
        blinding: 'helper',
        items: [ident('spices.pepper', true, 100), ident('spices.brown-spice.clove', false, 50)],
      }),
    );
    const stats = palateStats(log);

    expect(stats.identifications).toBe(2);
    expect(stats.identificationExactRate).toBe(0.5);
    expect(stats.identificationAccuracy).toBe(75);
    expect(stats.namedBreadth).toBe(1);
  });
});

describe('reviving a stored log', () => {
  it('round-trips through JSON', () => {
    const log = recordSession(setRegion(EMPTY_SESSION_LOG, 'EU'), triangulation(3, 2));
    expect(reviveSessionLog(JSON.parse(JSON.stringify(log)))).toEqual(log);
  });

  it('drops a payload from another version rather than guessing a migration', () => {
    expect(reviveSessionLog({ version: SESSION_LOG_VERSION + 1, sessionsLogged: 40 })).toEqual(
      EMPTY_SESSION_LOG,
    );
    expect(reviveSessionLog(null)).toEqual(EMPTY_SESSION_LOG);
  });

  it('fills in fields a partial payload is missing', () => {
    const revived = reviveSessionLog({ version: SESSION_LOG_VERSION, sessionsLogged: 2 });
    expect(revived.discrimination.helper).toEqual({ sets: 0, correct: 0 });
    expect(revived.kit).toEqual({});
    expect(revived.assignment).toBeNull();
  });
});
