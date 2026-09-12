import { EMPTY_PROGRESS, type Progress } from './types.js';
import { reviveProgress } from './store.js';

export const STORAGE_KEY = 'coffee-q-trainer.progress.v2';

export interface ProgressStorage {
  load(): Progress;
  save(progress: Progress): void;
  clear(): void;
}

/**
 * localStorage rather than the IndexedDB the plan called for. The whole record is a few kilobytes -
 * a streak, a capped round history and one row per 110 attributes - and staying synchronous keeps
 * the store trivially testable with no async plumbing through the UI. IndexedDB earns its place at
 * M4, when cupping session logs arrive with timestamps, notes and multiple samples per session;
 * swapping it in means replacing this file and nothing else.
 */
export function createLocalStorage(backing: Storage): ProgressStorage {
  return {
    load() {
      try {
        const raw = backing.getItem(STORAGE_KEY);
        return raw === null ? EMPTY_PROGRESS : reviveProgress(JSON.parse(raw));
      } catch {
        // Corrupt or unreadable data must not take the app down with it - a lost streak is a
        // smaller harm than a blank screen.
        return EMPTY_PROGRESS;
      }
    },
    save(progress) {
      try {
        backing.setItem(STORAGE_KEY, JSON.stringify(progress));
      } catch {
        // Private browsing and full quotas both throw here. Play continues unrecorded.
      }
    },
    clear() {
      try {
        backing.removeItem(STORAGE_KEY);
      } catch {
        /* nothing useful to do */
      }
    },
  };
}

/** For tests and for environments with no storage at all. */
export function createMemoryStorage(initial: Progress = EMPTY_PROGRESS): ProgressStorage {
  let held: Progress = initial;
  return {
    load: () => held,
    save: (progress) => {
      held = progress;
    },
    clear: () => {
      held = EMPTY_PROGRESS;
    },
  };
}

export function defaultStorage(): ProgressStorage {
  if (typeof localStorage === 'undefined') return createMemoryStorage();
  return createLocalStorage(localStorage);
}
