import { useCallback, useMemo, useRef, useState } from 'react';
import type { Region } from '../domain/schema.js';
import { recordSession, setAssignment, setKitEntry, setRegion } from './log.js';
import { defaultSessionStorage, type SessionStorage } from './storage.js';
import type { HomeworkAssignment, PhysicalSession, SessionLog } from './types.js';

export interface UseSessions {
  readonly log: SessionLog;
  readonly commitSession: (session: PhysicalSession) => SessionLog;
  readonly chooseRegion: (region: Region) => void;
  readonly mapVial: (vial: number, nodeId: string) => void;
  readonly saveAssignment: (assignment: HomeworkAssignment | null) => void;
  readonly reset: () => void;
}

/**
 * The physical-track counterpart to `useProgress`, and deliberately a separate hook over a separate
 * storage key rather than an extra field on that one - see the note at the top of session/types.ts.
 *
 * Every mutation re-reads before it writes, for the same reason `useProgress` does: two screens can
 * be mounted at once (the palate panel and a drill), and a stale copy in one of them must not roll
 * back a session the other just logged.
 */
export function useSessions(storage: SessionStorage = defaultSessionStorage()): UseSessions {
  const storageRef = useRef(storage);
  const [log, setLog] = useState<SessionLog>(() => storageRef.current.load());

  const write = useCallback((next: SessionLog): SessionLog => {
    storageRef.current.save(next);
    setLog(next);
    return next;
  }, []);

  const commitSession = useCallback(
    (session: PhysicalSession) => write(recordSession(storageRef.current.load(), session)),
    [write],
  );

  const chooseRegion = useCallback(
    (region: Region) => {
      write(setRegion(storageRef.current.load(), region));
    },
    [write],
  );

  const mapVial = useCallback(
    (vial: number, nodeId: string) => {
      write(setKitEntry(storageRef.current.load(), vial, nodeId));
    },
    [write],
  );

  const saveAssignment = useCallback(
    (assignment: HomeworkAssignment | null) => {
      write(setAssignment(storageRef.current.load(), assignment));
    },
    [write],
  );

  const reset = useCallback(() => {
    storageRef.current.clear();
    setLog(storageRef.current.load());
  }, []);

  return useMemo(
    () => ({ log, commitSession, chooseRegion, mapVial, saveAssignment, reset }),
    [log, commitSession, chooseRegion, mapVial, saveAssignment, reset],
  );
}
