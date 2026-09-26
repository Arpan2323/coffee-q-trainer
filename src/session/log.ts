import type { Region } from '../domain/schema.js';
import {
  EMPTY_DISCRIMINATION,
  EMPTY_IDENTIFICATION_TOTALS,
  EMPTY_SESSION_LOG,
  SESSION_HISTORY_LIMIT,
  SESSION_LOG_VERSION,
  type Blinding,
  type DiscriminationTotals,
  type HomeworkAssignment,
  type Identification,
  type PhysicalSession,
  type SessionKind,
  type SessionLog,
} from './types.js';

/** A triangulation guess is right one time in three by luck. Every claim here is against that. */
export const TRIANGULATION_CHANCE = 1 / 3;

/** Ids are readable on purpose: this log is the thing a player scrolls back through. */
export function newSessionId(kind: SessionKind, at: number): string {
  return `${kind}-${at}`;
}

function bumpNamed(
  named: Readonly<Record<string, number>>,
  items: readonly Identification[],
): Record<string, number> {
  const next = { ...named };
  for (const item of items) {
    // Only an exact answer counts as "named". A near miss on a physical reference is worth scoring -
    // it is in `identification` - but "you have named Jasmine from the vial" has to mean Jasmine.
    if (item.exact) next[item.targetId] = (next[item.targetId] ?? 0) + 1;
  }
  return next;
}

function addIdentifications(
  totals: SessionLog['identification'],
  items: readonly Identification[],
): SessionLog['identification'] {
  return {
    attempts: totals.attempts + items.length,
    exact: totals.exact + items.filter((i) => i.exact).length,
    scoreSum: totals.scoreSum + items.reduce((sum, i) => sum + i.score, 0),
  };
}

/**
 * Append a completed physical session and fold it into the lifetime totals. The totals are kept
 * rather than derived because the session array is capped: deriving "sessions logged" from a capped
 * array would make the number go *down* on the 201st session, which is the silent-drift failure the
 * confusion matrix and the round history already avoid the same way.
 */
export function recordSession(log: SessionLog, session: PhysicalSession): SessionLog {
  const detail = session.detail;

  let cupsTasted = log.cupsTasted;
  let discrimination = log.discrimination;
  let identification = log.identification;
  let named = log.named;

  switch (detail.kind) {
    case 'cupping':
      cupsTasted += detail.samples.length;
      break;
    case 'triangulation': {
      const previous = log.discrimination[detail.blinding];
      discrimination = {
        ...log.discrimination,
        [detail.blinding]: {
          sets: previous.sets + detail.sets,
          correct: previous.correct + detail.correct,
        },
      };
      // Three bowls a set, and they are real cups that were really tasted.
      cupsTasted += detail.sets * 3;
      break;
    }
    case 'homework':
    case 'aroma-kit':
      identification = addIdentifications(identification, detail.items);
      named = bumpNamed(named, detail.items);
      break;
  }

  return {
    ...log,
    sessions: [...log.sessions, session].slice(-SESSION_HISTORY_LIMIT),
    sessionsLogged: log.sessionsLogged + 1,
    cupsTasted,
    discrimination,
    identification,
    named,
  };
}

export function setRegion(log: SessionLog, region: Region): SessionLog {
  return { ...log, region };
}

/** An empty `nodeId` removes the mapping, which is how a mistyped vial is undone. */
export function setKitEntry(log: SessionLog, vial: number, nodeId: string): SessionLog {
  const kit = { ...log.kit };
  if (nodeId === '') delete kit[String(vial)];
  else kit[String(vial)] = nodeId;
  return { ...log, kit };
}

export function setAssignment(log: SessionLog, assignment: HomeworkAssignment | null): SessionLog {
  return { ...log, assignment };
}

export interface DiscriminationRate {
  readonly sets: number;
  readonly correct: number;
  /** 0-1. Meaningless on its own, which is why `chance` and `pValue` travel with it. */
  readonly rate: number;
  readonly chance: number;
  /**
   * Probability of scoring this well or better by guessing. `null` until a set has been logged.
   * This is the honest form of "your palate is improving": 4 of 6 correct looks impressive and
   * carries a p-value around 0.1, which is to say it is not yet evidence of anything.
   */
  readonly pValue: number | null;
}

/**
 * Exact upper binomial tail, P(X >= k) for n trials at probability p. Iterative pmf rather than
 * factorials so it cannot overflow, and exact rather than a normal approximation because the
 * interesting case here is a tiny n - six triangulation sets is where a taster first wants to know
 * whether they are beating a guess, and that is exactly where the approximation lies.
 */
export function binomialTailAtLeast(k: number, n: number, p: number): number {
  if (k <= 0) return 1;
  if (k > n) return 0;
  if (p <= 0) return 0;
  if (p >= 1) return 1;

  let pmf = (1 - p) ** n;
  let tail = 0;
  for (let i = 0; i <= n; i++) {
    if (i >= k) tail += pmf;
    pmf = (pmf * (n - i) * p) / ((i + 1) * (1 - p));
  }
  return Math.min(tail, 1);
}

function rateOf(totals: DiscriminationTotals, chance = TRIANGULATION_CHANCE): DiscriminationRate {
  return {
    sets: totals.sets,
    correct: totals.correct,
    rate: totals.sets === 0 ? 0 : totals.correct / totals.sets,
    chance,
    pValue: totals.sets === 0 ? null : binomialTailAtLeast(totals.correct, totals.sets, chance),
  };
}

export interface PalateStats {
  readonly sessionsLogged: number;
  readonly cupsTasted: number;
  readonly lastSessionAt: number | null;
  /** Self-poured and helper-poured kept apart - see the `Blinding` note in types.ts. */
  readonly discrimination: Readonly<Record<Blinding, DiscriminationRate>>;
  /** Every set, both blindings, for the headline. The split is the one to trust. */
  readonly discriminationAll: DiscriminationRate;
  readonly identifications: number;
  /** Share of physical identifications that were exact, 0-1. */
  readonly identificationExactRate: number;
  /** Mean wheel-distance score on physical identifications, 0-100. */
  readonly identificationAccuracy: number;
  /** Distinct attributes named exactly from a real smell at least once. */
  readonly namedBreadth: number;
  /** Nothing physical logged yet, so every number above is zero rather than low. */
  readonly empty: boolean;
}

/**
 * The palate meter. Deliberately not folded into `palateProfile` in progress/store.ts: that function
 * reads screen play, this one reads logged sessions, and the product's one hard design rule is that
 * the two never add up into a single score. The Palate Profile screen shows both, side by side and
 * labelled, which is the honest version of "how good is my palate".
 */
export function palateStats(log: SessionLog): PalateStats {
  const self = rateOf(log.discrimination.self);
  const helper = rateOf(log.discrimination.helper);
  const combined = rateOf({
    sets: log.discrimination.self.sets + log.discrimination.helper.sets,
    correct: log.discrimination.self.correct + log.discrimination.helper.correct,
  });
  const ident = log.identification;

  return {
    sessionsLogged: log.sessionsLogged,
    cupsTasted: log.cupsTasted,
    lastSessionAt: log.sessions.at(-1)?.at ?? null,
    discrimination: { self, helper },
    discriminationAll: combined,
    identifications: ident.attempts,
    identificationExactRate: ident.attempts === 0 ? 0 : ident.exact / ident.attempts,
    identificationAccuracy: ident.attempts === 0 ? 0 : ident.scoreSum / ident.attempts,
    namedBreadth: Object.keys(log.named).length,
    empty: log.sessionsLogged === 0,
  };
}

/** Same discipline as `reviveProgress`: a payload from another version is dropped, not guessed at. */
export function reviveSessionLog(raw: unknown): SessionLog {
  if (typeof raw !== 'object' || raw === null) return EMPTY_SESSION_LOG;
  const candidate = raw as Partial<SessionLog>;
  if (candidate.version !== SESSION_LOG_VERSION) return EMPTY_SESSION_LOG;
  return {
    ...EMPTY_SESSION_LOG,
    ...candidate,
    sessions: candidate.sessions ?? [],
    discrimination: {
      self: { ...EMPTY_DISCRIMINATION, ...candidate.discrimination?.self },
      helper: { ...EMPTY_DISCRIMINATION, ...candidate.discrimination?.helper },
    },
    identification: { ...EMPTY_IDENTIFICATION_TOTALS, ...candidate.identification },
    named: candidate.named ?? {},
    kit: candidate.kit ?? {},
    assignment: candidate.assignment ?? null,
  };
}
