import {
  protocolSourceSchema,
  type ProtocolPrep,
  type ProtocolSource,
  type ProtocolStep,
} from './schema.js';
import protocolJson from '../data/protocol.json' with { type: 'json' };

export interface CuppingProtocol {
  readonly version: string;
  readonly reviewStatus: string;
  readonly ratio: ProtocolSource['ratio'];
  readonly prep: readonly ProtocolPrep[];
  /** Ascending by `at`, asserted at load. */
  readonly steps: readonly ProtocolStep[];
  readonly byId: ReadonlyMap<string, ProtocolStep>;
  /** `at` of the last step. The session clock runs past it; nothing else does. */
  readonly durationSec: number;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/**
 * Built the same way the other content loaders are: the invariants the timer depends on are asserted
 * here, at load, rather than defended at every call site.
 *
 * Ascending offsets are the load-bearing one. `stepAt` in session/timer.ts finds the current step by
 * walking the list and keeping the last one whose offset has passed - an out-of-order step would
 * make the clock skip backwards mid-session, which is a bug you would only find standing at a
 * cupping table with a bowl going cold.
 */
export function buildProtocol(source: ProtocolSource): CuppingProtocol {
  const byId = new Map<string, ProtocolStep>();
  let previous = -1;

  for (const step of source.steps) {
    assert(!byId.has(step.id), `duplicate protocol step "${step.id}"`);
    assert(
      step.at > previous,
      `protocol step "${step.id}" is at ${step.at}s, not after the step before it`,
    );
    previous = step.at;
    byId.set(step.id, step);
  }

  const prepIds = new Set<string>();
  for (const prep of source.prep) {
    assert(!prepIds.has(prep.id), `duplicate protocol prep step "${prep.id}"`);
    prepIds.add(prep.id);
  }

  assert(source.steps[0]!.at === 0, 'the first protocol step must be at 0s - the clock starts on the pour');

  return {
    version: source.version,
    reviewStatus: source.reviewStatus,
    ratio: source.ratio,
    prep: source.prep,
    steps: source.steps,
    byId,
    durationSec: previous,
  };
}

export const PROTOCOL: CuppingProtocol = buildProtocol(protocolSourceSchema.parse(protocolJson));

/** Grams of coffee and millilitres of water for a given bowl count, at the protocol's ratio. */
export function doseFor(bowls: number, protocol: CuppingProtocol = PROTOCOL): {
  coffeeG: number;
  waterMl: number;
} {
  return {
    // One decimal place: 8.25 g is the ratio, but no cupping scale resolves a hundredth of a gram.
    coffeeG: Math.round(bowls * protocol.ratio.coffeeG * 10) / 10,
    waterMl: bowls * protocol.ratio.waterMl,
  };
}
