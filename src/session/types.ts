import type { Region } from '../domain/schema.js';
import type { BrewMethod, JournalRadar } from './journal.js';

/**
 * The physical track's ledger. Kept apart from `Progress` on purpose, and the reason is PLAN.md
 * section 1's design rule: *never claim a screen taught a palate*. Screen play earns knowledge
 * progress, only logged physical sessions earn palate progress, and two meters that must not be
 * added together are two records - merging them would make the North Star (mastered descriptors,
 * spaced 48 hours apart, from screen play) quietly unreadable the first time a vial drill bumped it.
 *
 * The separation is also why this has its own version and its own storage key: cupping logs will
 * change shape as M5's scoring forms land, and a shape change there must not discard a player's
 * screen progress.
 */
export const SESSION_LOG_VERSION = 1;

/** Sessions kept in full. Past this the oldest is dropped - the lifetime totals below do not move. */
export const SESSION_HISTORY_LIMIT = 200;

export type SessionKind = 'cupping' | 'triangulation' | 'homework' | 'aroma-kit' | 'journal';

/**
 * Who poured. The app cannot verify either, but it can refuse to conflate them: a set poured by
 * someone else is properly blind, while a self-poured set is blind only as far as the taster's own
 * discipline in shuffling the bowls and not reading a base. Helper-blinded discrimination is the
 * stronger number and is reported as its own number.
 */
export type Blinding = 'self' | 'helper';

/**
 * A descriptor the taster committed to on a real cup. Ungraded, and that is not an omission: your
 * own cup has no answer key. It is vocabulary used in the wild, which is worth logging, and it is
 * not evidence of accuracy, which is why it never reaches the scoring engine.
 */
export interface CuppedSample {
  /** The code written on the bowl's base. */
  readonly code: string;
  /** What the bowl turned out to hold, filled in after the blind passes. May be left blank. */
  readonly name: string;
  readonly descriptorIds: readonly string[];
  readonly note: string;
}

/**
 * One graded physical identification: a reference or a vial was smelled, and a point on the wheel
 * was committed to. Shared by Reference Homework and the aroma kit because the two differ only in
 * where the smell came from - both are scored by the same engine as screen play, against a target
 * the app knew before the answer.
 */
export interface Identification {
  readonly targetId: string;
  readonly answerId: string;
  readonly score: number;
  readonly exact: boolean;
}

export interface CuppingSessionRecord {
  readonly kind: 'cupping';
  readonly samples: readonly CuppedSample[];
  /** Protocol step ids actually reached. A session abandoned at the skim was not a cupping. */
  readonly stepsReached: readonly string[];
  readonly protocolVersion: string;
}

export interface TriangulationSessionRecord {
  readonly kind: 'triangulation';
  readonly blinding: Blinding;
  readonly coffeeA: string;
  readonly coffeeB: string;
  readonly sets: number;
  readonly correct: number;
}

export interface HomeworkSessionRecord {
  readonly kind: 'homework';
  readonly region: Region;
  /**
   * Homework is the weakest-blinded of the three graded modes and records that rather than glossing
   * it: you can usually see that the coded saucer holds grated zest. Its value is the days-later
   * recall test, not the blinding - see the note at the top of game/homework.ts.
   */
  readonly blinding: Blinding;
  readonly items: readonly Identification[];
}

export interface AromaKitSessionRecord {
  readonly kind: 'aroma-kit';
  /** Vial numbers drawn, parallel to `items`, so the log can show which vial fooled you. */
  readonly vials: readonly number[];
  readonly items: readonly Identification[];
}

/**
 * A single, known cup - see the note at the top of session/journal.ts for why this is a separate
 * mode rather than an extra field on `CuppingSessionRecord`. `sampledDate` is deliberately absent:
 * the session's own `at` timestamp already is the moment this cup was tasted, so asking for it a
 * second time would just be transcribing the clock. `roastDate` has no such stand-in - it comes off
 * the bag, and the app has no other way to know it.
 */
export interface JournalSessionRecord {
  readonly kind: 'journal';
  readonly name: string;
  readonly roaster: string;
  readonly producer: string;
  readonly roastDate: string;
  readonly brewMethod: BrewMethod;
  /** Only meaningful when `brewMethod` is `'other'`. */
  readonly brewMethodOther: string;
  readonly price: string;
  /** 0 means not rated, 1-5 is the star rating. */
  readonly rating: number;
  readonly radar: JournalRadar;
  readonly notes: string;
}

export type SessionDetail =
  | CuppingSessionRecord
  | TriangulationSessionRecord
  | HomeworkSessionRecord
  | AromaKitSessionRecord
  | JournalSessionRecord;

export interface PhysicalSession {
  readonly id: string;
  readonly at: number;
  readonly durationSec: number;
  readonly note: string;
  readonly detail: SessionDetail;
}

/** Lifetime running totals, kept so the numbers do not shrink when the history is trimmed. */
export interface IdentificationTotals {
  readonly attempts: number;
  readonly exact: number;
  readonly scoreSum: number;
}

export interface DiscriminationTotals {
  readonly sets: number;
  readonly correct: number;
}

/**
 * One reference the player has been told to go and smell, plus when they were told. `dueAt` is the
 * point of the mode: the quiz is days after the assignment, because a reference smelled and named
 * in the same minute tests nothing but short-term memory.
 */
export interface HomeworkItem {
  readonly nodeId: string;
  /** Index into that attribute's `references` array - a record may offer more than one product. */
  readonly referenceIndex: number;
  /** Blinding code to write on the sample once it is prepared. */
  readonly code: string;
}

export interface HomeworkAssignment {
  readonly region: Region;
  readonly assignedAt: number;
  readonly dueAt: number;
  readonly items: readonly HomeworkItem[];
}

export interface SessionLog {
  readonly version: number;
  /** Newest last, capped at `SESSION_HISTORY_LIMIT`. */
  readonly sessions: readonly PhysicalSession[];
  /** Lifetime counts, never evicted. */
  readonly sessionsLogged: number;
  readonly cupsTasted: number;
  /** Split by who poured, because self-blinding and helper-blinding are not the same evidence. */
  readonly discrimination: Readonly<Record<Blinding, DiscriminationTotals>>;
  readonly identification: IdentificationTotals;
  /** Per-attribute count of times it was smelled and named exactly. The palate ledger's detail. */
  readonly named: Readonly<Record<string, number>>;
  /**
   * The region the homework list is drawn from. `null` until the player says, because PLAN.md's
   * decision 2 - which region to author references for first - is still open, and a default here
   * would answer it by accident.
   */
  readonly region: Region | null;
  /** The player's own vial -> node id mapping. Keyed by vial number as a string. See aromaKit.ts. */
  readonly kit: Readonly<Record<string, string>>;
  readonly assignment: HomeworkAssignment | null;
}

export const EMPTY_IDENTIFICATION_TOTALS: IdentificationTotals = {
  attempts: 0,
  exact: 0,
  scoreSum: 0,
};

export const EMPTY_DISCRIMINATION: DiscriminationTotals = { sets: 0, correct: 0 };

export const EMPTY_SESSION_LOG: SessionLog = {
  version: SESSION_LOG_VERSION,
  sessions: [],
  sessionsLogged: 0,
  cupsTasted: 0,
  discrimination: { self: EMPTY_DISCRIMINATION, helper: EMPTY_DISCRIMINATION },
  identification: EMPTY_IDENTIFICATION_TOTALS,
  named: {},
  region: null,
  kit: {},
  assignment: null,
};
