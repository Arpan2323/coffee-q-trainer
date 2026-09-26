import { describe, expect, it } from 'vitest';
import { PROTOCOL, buildProtocol, doseFor } from './protocol.js';
import { protocolSourceSchema, type ProtocolSource } from './schema.js';

const source = (over: Partial<ProtocolSource> = {}): ProtocolSource => ({
  version: 'test',
  reviewStatus: 'provisional',
  ratio: { coffeeG: 8.25, waterMl: 150, waterTempC: 93, note: 'n' },
  prep: [{ id: 'dose', title: 'Dose', detail: 'd' }],
  steps: [
    { id: 'pour', at: 0, title: 'Pour', detail: 'd', sensory: [] },
    { id: 'break', at: 240, title: 'Break', detail: 'd', sensory: ['aroma'] },
  ],
  ...over,
});

describe('the cupping protocol', () => {
  it('loads and keeps the published anchors', () => {
    expect(PROTOCOL.ratio.coffeeG).toBe(8.25);
    expect(PROTOCOL.ratio.waterMl).toBe(150);
    // The 4:00 crust break is the protocol, not a preference.
    expect(PROTOCOL.byId.get('break')!.at).toBe(240);
  });

  it('starts on the pour', () => {
    expect(PROTOCOL.steps[0]!.at).toBe(0);
  });

  it('is the source of the timer duration', () => {
    expect(PROTOCOL.durationSec).toBe(PROTOCOL.steps.at(-1)!.at);
  });

  // Ascending offsets are what let the clock find the current step in one forward pass. Out of
  // order, the clock would jump backwards mid-session - a bug you would only meet at a real table.
  it('rejects steps that are not in ascending order', () => {
    expect(() =>
      buildProtocol(
        source({
          steps: [
            { id: 'pour', at: 0, title: 'Pour', detail: 'd', sensory: [] },
            { id: 'skim', at: 300, title: 'Skim', detail: 'd', sensory: [] },
            { id: 'break', at: 240, title: 'Break', detail: 'd', sensory: [] },
          ],
        }),
      ),
    ).toThrow(/not after the step before/);
  });

  it('rejects a protocol that does not start at zero', () => {
    expect(() =>
      buildProtocol(
        source({ steps: [{ id: 'pour', at: 30, title: 'Pour', detail: 'd', sensory: [] }] }),
      ),
    ).toThrow(/must be at 0s/);
  });

  it('rejects duplicate step ids', () => {
    expect(() =>
      buildProtocol(
        source({
          steps: [
            { id: 'pour', at: 0, title: 'Pour', detail: 'd', sensory: [] },
            { id: 'pour', at: 10, title: 'Pour again', detail: 'd', sensory: [] },
          ],
        }),
      ),
    ).toThrow(/duplicate protocol step/);
  });

  it('rejects unknown keys, so a renamed field cannot be silently dropped', () => {
    expect(() =>
      protocolSourceSchema.parse({ ...source(), tempC: 93 }),
    ).toThrow();
  });

  // Every cooling step is an estimate, and an estimate with no temperature attached is honest about
  // being one. The mechanical steps must not claim a temperature at all.
  it('attaches a temperature only to the cooling passes', () => {
    expect(PROTOCOL.byId.get('pour')!.approxTempC).toBeUndefined();
    expect(PROTOCOL.byId.get('skim')!.approxTempC).toBeUndefined();
    expect(PROTOCOL.byId.get('first-pass')!.approxTempC).toBe(70);
  });

  it('scales the dose without inventing precision no scale can read', () => {
    expect(doseFor(5)).toEqual({ coffeeG: 41.3, waterMl: 750 });
    expect(doseFor(1)).toEqual({ coffeeG: 8.3, waterMl: 150 });
  });
});
