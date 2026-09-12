import { describe, expect, it } from 'vitest';
import { WHEEL, getNode } from './wheel.js';
import { profilesSourceSchema } from './schema.js';
import { PROFILES, buildProfiles, syntheticShare } from './profiles.js';
import profilesJson from '../data/profiles.json' with { type: 'json' };

describe('coffee profiles', () => {
  it('loads without throwing and covers a handful of profiles', () => {
    expect(PROFILES.byId.size).toBeGreaterThanOrEqual(6);
  });

  it('every descriptor resolves to a terminal wheel node', () => {
    for (const profile of PROFILES.byId.values()) {
      expect(profile.descriptors.length).toBeGreaterThanOrEqual(2);
      for (const { nodeId } of profile.descriptors) {
        expect(WHEEL.nodes.has(nodeId)).toBe(true);
        expect(getNode(WHEEL, nodeId).childIds).toHaveLength(0);
      }
    }
  });

  it('is marked synthetic and cites a reason, honestly', () => {
    // The whole point of the flag: every v1 profile is synthetic, and the schema requires a
    // `source` explaining why, so the disclosure cannot be silently dropped from a content edit.
    for (const profile of PROFILES.byId.values()) {
      expect(profile.synthetic).toBe(true);
      expect(profile.source.length).toBeGreaterThan(0);
    }
    expect(syntheticShare()).toBe(1);
  });

  it('covers more than one process and roast, so a round is not repetitive', () => {
    const processes = new Set([...PROFILES.byId.values()].map((p) => p.process));
    const roasts = new Set([...PROFILES.byId.values()].map((p) => p.roast));
    expect(processes.size).toBeGreaterThanOrEqual(4);
    expect(roasts.size).toBeGreaterThanOrEqual(3);
  });

  it('rejects a descriptor that points at a non-terminal node', () => {
    const bad = {
      version: '0.0.1',
      profiles: [
        {
          id: 'bad-profile',
          name: 'Bad',
          origin: 'Nowhere',
          process: 'washed',
          roast: 'light',
          descriptors: [{ nodeId: 'fruity' }, { nodeId: 'fruity.berry' }],
          synthetic: true,
          source: 'test fixture',
        },
      ],
    };
    expect(() => buildProfiles(profilesSourceSchema.parse(bad), WHEEL)).toThrow(/terminal/);
  });

  it('rejects a duplicate profile id', () => {
    const source = profilesSourceSchema.parse(profilesJson);
    const dup = { ...source, profiles: [...source.profiles, source.profiles[0]!] };
    expect(() => buildProfiles(dup, WHEEL)).toThrow(/duplicate/);
  });

  it('the .strict() schema rejects a profile missing the synthetic disclosure', () => {
    const withoutFlag = {
      version: '0.0.1',
      profiles: [
        {
          id: 'x',
          name: 'x',
          origin: 'x',
          process: 'washed',
          roast: 'light',
          descriptors: [{ nodeId: 'fruity.berry.blackberry' }, { nodeId: 'fruity.berry.raspberry' }],
          source: 'test fixture',
        },
      ],
    };
    expect(() => profilesSourceSchema.parse(withoutFlag)).toThrow();
  });
});
