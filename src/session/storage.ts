import { EMPTY_SESSION_LOG, type SessionLog } from './types.js';
import { reviveSessionLog } from './log.js';

/**
 * Its own key, not a field inside the progress record. Two reasons, both about blast radius: the
 * physical log is the record most likely to change shape next (M5's scoring forms land inside a
 * cupping session), and `reviveProgress` drops the whole payload on a version mismatch - sharing a
 * key would mean a cupping-log change costing a player their streak and their mastered count.
 */
export const SESSION_STORAGE_KEY = 'coffee-q-trainer.sessions.v1';

export interface SessionStorage {
  load(): SessionLog;
  save(log: SessionLog): void;
  clear(): void;
}

/**
 * Still localStorage, and PLAN.md said IndexedDB would arrive with M4's session logs. It has not,
 * and the reason is arithmetic rather than laziness: a cupping session record is a few hundred bytes,
 * the history is capped at 200 sessions, and the whole log therefore lands under 100 kB against a
 * 5 MB quota. IndexedDB would buy headroom nobody needs and cost async plumbing through every screen
 * plus an await in every reducer test. It becomes the right call when sessions carry photos of the
 * cupping table or full CVA forms per bowl - the seam is this file, exactly as the progress adapter
 * promised, so that swap stays a one-file change.
 */
export function createLocalSessionStorage(backing: Storage): SessionStorage {
  return {
    load() {
      try {
        const raw = backing.getItem(SESSION_STORAGE_KEY);
        return raw === null ? EMPTY_SESSION_LOG : reviveSessionLog(JSON.parse(raw));
      } catch {
        // Same call as the progress adapter: carrying on unrecorded beats a blank screen at a
        // cupping table with three bowls going cold.
        return EMPTY_SESSION_LOG;
      }
    },
    save(log) {
      try {
        backing.setItem(SESSION_STORAGE_KEY, JSON.stringify(log));
      } catch {
        // Private browsing and full quotas both throw here.
      }
    },
    clear() {
      try {
        backing.removeItem(SESSION_STORAGE_KEY);
      } catch {
        /* nothing useful to do */
      }
    },
  };
}

/** For tests and for environments with no storage at all. */
export function createMemorySessionStorage(initial: SessionLog = EMPTY_SESSION_LOG): SessionStorage {
  let held: SessionLog = initial;
  return {
    load: () => held,
    save: (log) => {
      held = log;
    },
    clear: () => {
      held = EMPTY_SESSION_LOG;
    },
  };
}

export function defaultSessionStorage(): SessionStorage {
  if (typeof localStorage === 'undefined') return createMemorySessionStorage();
  return createLocalSessionStorage(localStorage);
}
