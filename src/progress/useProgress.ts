import { useCallback, useMemo, useRef, useState } from 'react';
import type { Round } from '../game/round.js';
import type { CauseEffectRound } from '../game/causeEffectRound.js';
import { defaultStorage, type ProgressStorage } from './storage.js';
import { recordCauseEffectRound, recordRound } from './store.js';
import type { Progress } from './types.js';

export interface UseProgress {
  readonly progress: Progress;
  readonly commitRound: (round: Round) => Progress;
  readonly commitCauseEffectRound: (round: CauseEffectRound) => Progress;
  readonly reset: () => void;
}

/**
 * Load once, write through on every change. The record is small enough that a synchronous write
 * per completed round is not worth debouncing, and a debounce would risk losing the round that
 * matters most - the one the player just finished before closing the tab.
 */
export function useProgress(storage: ProgressStorage = defaultStorage()): UseProgress {
  const storageRef = useRef(storage);
  const [progress, setProgress] = useState<Progress>(() => storageRef.current.load());

  const commitRound = useCallback((round: Round): Progress => {
    const next = recordRound(storageRef.current.load(), round);
    storageRef.current.save(next);
    setProgress(next);
    return next;
  }, []);

  const commitCauseEffectRound = useCallback((round: CauseEffectRound): Progress => {
    const next = recordCauseEffectRound(storageRef.current.load(), round);
    storageRef.current.save(next);
    setProgress(next);
    return next;
  }, []);

  const reset = useCallback(() => {
    storageRef.current.clear();
    setProgress(storageRef.current.load());
  }, []);

  return useMemo(
    () => ({ progress, commitRound, commitCauseEffectRound, reset }),
    [progress, commitRound, commitCauseEffectRound, reset],
  );
}
