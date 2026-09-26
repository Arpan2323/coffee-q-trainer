import { PROTOCOL, type CuppingProtocol } from '../domain/protocol.js';
import type { ProtocolStep } from '../domain/schema.js';

/**
 * The protocol clock, as a pure function of elapsed seconds.
 *
 * Written this way rather than as a chain of setTimeouts for a reason that matters at a cupping
 * table: a phone that sleeps, a tab that is backgrounded, or a taster who starts the timer and then
 * goes to fetch a spoon all break a timeline built from timers firing on schedule. Deriving the whole
 * state from one elapsed number means a backgrounded tab catches up the instant it is looked at, and
 * it means every offset in the protocol is testable without waiting eighteen minutes.
 */

export interface ClockState {
  readonly elapsedSec: number;
  /** Index into `protocol.steps`. The pour is 0, so this is never -1 once the clock is running. */
  readonly stepIndex: number;
  readonly step: ProtocolStep;
  readonly next: ProtocolStep | null;
  /** Seconds until `next` is due, or `null` on the last step. */
  readonly secondsToNext: number | null;
  /** Past the last step's offset. The protocol has nothing further to say; the cup might. */
  readonly done: boolean;
}

export function clockAt(elapsedSec: number, protocol: CuppingProtocol = PROTOCOL): ClockState {
  const elapsed = Math.max(0, Math.floor(elapsedSec));

  // Walk forward keeping the last step whose offset has passed. Ascending offsets are asserted in
  // buildProtocol, which is what makes one pass enough.
  let stepIndex = 0;
  for (let i = 0; i < protocol.steps.length; i++) {
    if (protocol.steps[i]!.at <= elapsed) stepIndex = i;
    else break;
  }

  const step = protocol.steps[stepIndex]!;
  const next = protocol.steps[stepIndex + 1] ?? null;

  return {
    elapsedSec: elapsed,
    stepIndex,
    step,
    next,
    secondsToNext: next === null ? null : next.at - elapsed,
    done: next === null,
  };
}

/**
 * Step ids whose offset has passed. Logged with the session so an abandoned cupping is visible as
 * one: a session that stopped at the skim reached three steps, and calling that a cupping would put
 * a cup count in the palate meter that nobody tasted.
 */
export function stepsReachedAt(elapsedSec: number, protocol: CuppingProtocol = PROTOCOL): string[] {
  return protocol.steps.filter((s) => s.at <= Math.max(0, elapsedSec)).map((s) => s.id);
}

/** M:SS, and MM:SS past ten minutes. Wall-clock formatting, not a duration library. */
export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const minutes = Math.floor(sec / 60);
  const seconds = `${sec % 60}`.padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/** True once every step has been reached - the condition for calling a cupping complete. */
export function isProtocolComplete(
  elapsedSec: number,
  protocol: CuppingProtocol = PROTOCOL,
): boolean {
  return elapsedSec >= protocol.durationSec;
}
