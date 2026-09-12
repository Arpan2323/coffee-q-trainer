import { profilesSourceSchema, type CoffeeProfile, type ProfilesSource } from './schema.js';
import type { Wheel } from './types.js';
import { WHEEL, getNode } from './wheel.js';
import profilesJson from '../data/profiles.json' with { type: 'json' };

export interface ProfileSet {
  readonly version: string;
  readonly byId: ReadonlyMap<string, CoffeeProfile>;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/**
 * Coffee profiles for Cause & Effect. Built the same way `buildAttributes` and `buildWheel` are:
 * validate against the tree at load time so a bad content edit fails loudly instead of shipping a
 * profile that can never be scored.
 */
export function buildProfiles(source: ProfilesSource, wheel: Wheel): ProfileSet {
  const byId = new Map<string, CoffeeProfile>();

  for (const profile of source.profiles) {
    assert(!byId.has(profile.id), `duplicate profile id "${profile.id}"`);

    const seen = new Set<string>();
    for (const { nodeId } of profile.descriptors) {
      assert(wheel.nodes.has(nodeId), `profile "${profile.id}" cites unknown node "${nodeId}"`);
      // A leaf, or a terminal ring-2 node (Tobacco, Vanilla, Black Tea) - anything with no children
      // is as specific as the wheel gets there. A profile pointing at "Fruity" would teach nothing.
      assert(
        getNode(wheel, nodeId).childIds.length === 0,
        `profile "${profile.id}" descriptor "${nodeId}" is not a terminal attribute`,
      );
      assert(!seen.has(nodeId), `profile "${profile.id}" repeats descriptor "${nodeId}"`);
      seen.add(nodeId);
    }

    byId.set(profile.id, profile);
  }

  return { version: source.version, byId };
}

export const PROFILES: ProfileSet = buildProfiles(profilesSourceSchema.parse(profilesJson), WHEEL);

/**
 * The STRATEGY.md guardrail this content set is built to be honest about: "synthetic content
 * exposure <20%" of served profiles. Every v1 profile is synthetic, so this reads 100% until real,
 * roaster-sourced score sheets arrive - Cause & Effect surfaces that on every profile rather than
 * waiting for the number to look better.
 */
export function syntheticShare(profiles: ProfileSet = PROFILES): number {
  const all = [...profiles.byId.values()];
  if (all.length === 0) return 0;
  return all.filter((p) => p.synthetic).length / all.length;
}
