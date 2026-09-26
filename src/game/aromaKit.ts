import { scoreAnswer, type ScoreResult } from '../domain/scoring.js';
import type { ConfusableSet, Wheel } from '../domain/types.js';
import { CONFUSABLES, WHEEL } from '../domain/wheel.js';
import type { Identification, SessionLog } from '../session/types.js';

/**
 * Aroma-kit mode (PLAN.md section 3.2, mode 8): self-blinded olfactory drills against a physical
 * 36-vial kit, with vial-number entry. This is the closest thing in the app to the Q exam's olfactory
 * identification module, and it is the only mode where the blinding is beyond argument.
 *
 * ## The order of operations is the blinding
 *
 * Every other round builder in this codebase draws its questions from a seeded PRNG. This one draws
 * nothing, and has no seed at all, because the randomisation is physical: the taster reaches into the
 * box without looking, smells the vial, commits an answer on the wheel, and only *then* reads the
 * number off the vial and enters it. The app learns which vial it was after the answer is locked,
 * which is why `enterVial` refuses to run before `commitAnswer` - reversing the two would turn a
 * genuine blind identification into a lookup.
 *
 * That also means no vial may be entered twice in one drill: you cannot have drawn the same vial
 * twice, so a repeat is a typo, and accepting it would let one lucky vial be scored five times.
 *
 * ## The kit mapping is the player's, not ours
 *
 * The app ships no vial-number-to-aroma table. Partly that is IP hygiene - PLAN.md section 2.5 flags
 * the lexicon and the wheel artwork as licensed works, and a commercial kit's numbered contents list
 * is the same kind of asset - but mostly it is that kits differ. Le Nez du Cafe numbers 36 vials one
 * way, a lab-assembled kit of standards numbers them another, and a taster who has decanted their own
 * set has a mapping nobody could have shipped. So the mapping lives in the session log, entered once
 * by the person holding the box, and `kitCoverage` reports how much of it is filled in.
 */

export const AROMA_KIT_ID = 'aroma-kit';

/** The common commercial kit size. Only a UI default - the mapping itself is sparse and unbounded. */
export const DEFAULT_KIT_SIZE = 36;

/** Six vials is a drill; the whole box is an afternoon and nobody's nose survives it. */
export const AROMA_DRILL_VIALS = 6;

export interface AromaHole {
  /** Committed first, from the smell alone. */
  readonly answerId: string | null;
  /** Read off the vial and entered second. */
  readonly vial: number | null;
  /** Looked up from the player's kit mapping once the vial is known. */
  readonly targetId: string | null;
  readonly result: ScoreResult | null;
}

export interface AromaDrill {
  readonly id: typeof AROMA_KIT_ID;
  readonly holes: readonly AromaHole[];
  readonly current: number;
  readonly complete: boolean;
}

const EMPTY_HOLE: AromaHole = { answerId: null, vial: null, targetId: null, result: null };

export function createAromaDrill(count: number = AROMA_DRILL_VIALS): AromaDrill {
  const holes = Array.from({ length: Math.max(1, Math.floor(count)) }, () => EMPTY_HOLE);
  return { id: AROMA_KIT_ID, holes, current: 0, complete: false };
}

export interface KitCoverage {
  readonly mapped: number;
  /** Vial numbers with a mapping, ascending. */
  readonly vials: readonly number[];
  /** Distinct attributes the kit can test. Two vials may legitimately map to one attribute. */
  readonly attributes: number;
}

export function kitCoverage(kit: SessionLog['kit']): KitCoverage {
  const vials = Object.keys(kit)
    .map(Number)
    .filter((v) => Number.isInteger(v))
    .sort((a, b) => a - b);
  return {
    mapped: vials.length,
    vials,
    attributes: new Set(Object.values(kit)).size,
  };
}

/** Commit the answer for the current vial, from the smell alone, before the number is read. */
export function commitAnswer(drill: AromaDrill, answerId: string): AromaDrill {
  if (drill.complete) throw new Error('drill is already complete');
  const hole = drill.holes[drill.current];
  if (!hole) throw new Error('no vial at the current index');
  if (hole.answerId !== null) throw new Error('this vial has already been answered');

  const holes = drill.holes.map((h, i) => (i === drill.current ? { ...h, answerId } : h));
  return { ...drill, holes };
}

/** Vial numbers already entered in this drill - a vial cannot have been drawn twice. */
export function usedVials(drill: AromaDrill): number[] {
  return drill.holes.flatMap((h) => (h.vial === null ? [] : [h.vial]));
}

export interface AromaDeps {
  readonly wheel: Wheel;
  readonly confusables: ConfusableSet;
}

const DEFAULT_DEPS: AromaDeps = { wheel: WHEEL, confusables: CONFUSABLES };

/**
 * Enter the number read off the vial, which scores the answer already committed and moves on. Every
 * refusal here is a real mistake rather than defensive noise: answering after the number is known is
 * not a blind identification, an unmapped vial has no answer key, and a repeated vial is a typo.
 */
export function enterVial(
  drill: AromaDrill,
  vial: number,
  kit: SessionLog['kit'],
  deps: AromaDeps = DEFAULT_DEPS,
): AromaDrill {
  if (drill.complete) throw new Error('drill is already complete');
  const hole = drill.holes[drill.current];
  if (!hole) throw new Error('no vial at the current index');
  if (hole.answerId === null) {
    throw new Error('commit an answer from the smell before reading the vial number');
  }
  if (usedVials(drill).includes(vial)) {
    throw new Error(`vial ${vial} has already been used in this drill`);
  }

  const targetId = kit[String(vial)];
  if (targetId === undefined) {
    throw new Error(`vial ${vial} is not mapped to an attribute in your kit`);
  }

  const result = scoreAnswer(deps.wheel, deps.confusables, hole.answerId, targetId);
  const holes = drill.holes.map((h, i) => (i === drill.current ? { ...h, vial, targetId, result } : h));
  const current = drill.current + 1;

  return { ...drill, holes, current, complete: current >= holes.length };
}

export interface AromaSummary {
  readonly answered: number;
  readonly total: number;
  readonly exactCount: number;
  readonly totalScore: number;
  readonly accuracy: number;
}

export function aromaSummary(drill: AromaDrill): AromaSummary {
  const answered = drill.holes.filter((h) => h.result !== null);
  const totalScore = answered.reduce((sum, h) => sum + h.result!.score, 0);
  return {
    answered: answered.length,
    total: drill.holes.length,
    exactCount: answered.filter((h) => h.result!.relation === 'exact').length,
    totalScore,
    accuracy: answered.length === 0 ? 0 : totalScore / answered.length,
  };
}

export function aromaIdentifications(drill: AromaDrill): Identification[] {
  return drill.holes
    .filter((h) => h.result !== null)
    .map((h) => ({
      targetId: h.targetId!,
      answerId: h.result!.answerId,
      score: h.result!.score,
      exact: h.result!.relation === 'exact',
    }));
}

/** Vial numbers drawn, in play order, stored alongside the identifications in the session log. */
export function drawnVials(drill: AromaDrill): number[] {
  return drill.holes.filter((h) => h.result !== null).map((h) => h.vial!);
}
