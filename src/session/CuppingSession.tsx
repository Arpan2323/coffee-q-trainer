import { useCallback, useEffect, useMemo, useState } from 'react';
import { PROTOCOL, doseFor } from '../domain/protocol.js';
import { WHEEL, getNode } from '../domain/wheel.js';
import { FlavorWheel } from '../ui/FlavorWheel.js';
import { mulberry32 } from '../game/round.js';
import { drawCodes } from './codes.js';
import { clockAt, formatClock, stepsReachedAt } from './timer.js';
import { newSessionId } from './log.js';
import { useSessions } from './useSessions.js';
import type { CuppedSample } from './types.js';
import '../game/golf.css';
import './physical.css';

/**
 * The timed cupping session - M4's Track B spine, and the screen this whole milestone is named for
 * ("coffee in hand"). It runs the SCA protocol as a clock, and it logs what was in the bowls.
 *
 * Two deliberate absences:
 *
 * **No scores.** There is no cupping form here, no 6-10 scale, no CVA intensities. Those are M5, and
 * pulling them forward would mean shipping a scoring UI before the thing it scores has been used
 * once. What this screen captures is descriptors and notes.
 *
 * **Descriptors logged here are ungraded, and that is not a gap.** Your own cup has no answer key,
 * so a descriptor committed at a real table is vocabulary used in the wild - worth recording, never
 * evidence of accuracy. It reaches `cupsTasted` and the session log and nothing else: no mastery, no
 * confusion matrix, no wheel score. The graded physical modes are the ones with a target the app knew
 * first, which is homework and the aroma kit.
 */

type Phase = 'prep' | 'running' | 'logging' | 'saved';

const DEFAULT_BOWLS = 3;

export function CuppingSession({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>('prep');
  const [bowls, setBowls] = useState(DEFAULT_BOWLS);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [samples, setSamples] = useState<readonly CuppedSample[]>([]);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const { commitSession } = useSessions();

  // One interval, and every displayed value derives from `now` - see the note in timer.ts about why
  // the clock is a function of elapsed time rather than a chain of scheduled callbacks.
  useEffect(() => {
    if (phase !== 'running') return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const elapsedSec = startedAt === null ? 0 : Math.floor((now - startedAt) / 1000);
  const clock = useMemo(() => clockAt(elapsedSec), [elapsedSec]);
  const reached = useMemo(() => stepsReachedAt(elapsedSec), [elapsedSec]);
  const dose = useMemo(() => doseFor(bowls), [bowls]);

  const start = useCallback(() => {
    const at = Date.now();
    const drawn = drawCodes(bowls, mulberry32(at >>> 0));
    setSamples(drawn.map((code) => ({ code, name: '', descriptorIds: [], note: '' })));
    setStartedAt(at);
    setNow(at);
    setActiveCode(drawn[0] ?? null);
    setPhase('running');
  }, [bowls]);

  const editSample = useCallback((code: string, change: Partial<CuppedSample>) => {
    setSamples((current) => current.map((s) => (s.code === code ? { ...s, ...change } : s)));
  }, []);

  const toggleDescriptor = useCallback(
    (nodeId: string | null) => {
      if (activeCode === null || nodeId === null) return;
      setSamples((current) =>
        current.map((s) => {
          if (s.code !== activeCode) return s;
          const has = s.descriptorIds.includes(nodeId);
          return {
            ...s,
            descriptorIds: has
              ? s.descriptorIds.filter((id) => id !== nodeId)
              : [...s.descriptorIds, nodeId],
          };
        }),
      );
    },
    [activeCode],
  );

  const save = useCallback(() => {
    if (startedAt === null) return;
    commitSession({
      id: newSessionId('cupping', startedAt),
      at: startedAt,
      durationSec: elapsedSec,
      note,
      detail: {
        kind: 'cupping',
        samples,
        // Which steps were actually reached, so an abandoned session is visible as one.
        stepsReached: reached,
        protocolVersion: PROTOCOL.version,
      },
    });
    setPhase('saved');
  }, [commitSession, elapsedSec, note, reached, samples, startedAt]);

  if (phase === 'prep') {
    return (
      <section className="golf ph-setup">
        <h2>Cupping session</h2>
        <p className="golf-lede">
          The SCA protocol on a clock. It times the steep, calls the crust break at 4:00, and prompts
          each cooling pass — then logs what was in the bowls. No scores: the cupping form is M5.
        </p>

        <label className="ph-field">
          <span>Bowls</span>
          <input
            type="number"
            min={1}
            max={12}
            value={bowls}
            onChange={(e) => setBowls(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
          />
        </label>

        <p className="ph-dose">
          <strong>
            {dose.coffeeG} g coffee, {dose.waterMl} ml water at {PROTOCOL.ratio.waterTempC} °C
          </strong>
          <br />
          <small>{PROTOCOL.ratio.note}</small>
        </p>

        <h3>Before the clock starts</h3>
        <ol className="ph-prep">
          {PROTOCOL.prep.map((step) => (
            <li key={step.id}>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </li>
          ))}
        </ol>

        <div className="golf-actions">
          <button type="button" onClick={start}>
            Start the clock — pour now
          </button>
          <button type="button" className="is-quiet" onClick={onBack}>
            Back
          </button>
        </div>
      </section>
    );
  }

  if (phase === 'saved') {
    return (
      <section className="golf golf-summary">
        <h2>Session logged</h2>
        <div className="golf-headline">
          <span className="golf-total">{samples.length}</span>
          <span className="golf-outof">bowls, {formatClock(elapsedSec)} at the table</span>
        </div>
        <p className="ph-caveat">
          Descriptors from a real cup are logged unscored — your own cup has no answer key. They count
          toward cups tasted and nothing else. Homework and the aroma kit are the graded modes.
        </p>
        <div className="golf-actions">
          <button type="button" onClick={onBack}>
            Back to the physical track
          </button>
        </div>
      </section>
    );
  }

  const logging = phase === 'logging';
  const active = samples.find((s) => s.code === activeCode) ?? null;

  return (
    <section className="golf ph-session">
      <header className="ph-clock">
        <span className="ph-elapsed">{formatClock(elapsedSec)}</span>
        <div className="ph-step">
          <strong>{clock.step.title}</strong>
          <p>{clock.step.detail}</p>
          {clock.step.approxTempC !== undefined && (
            <small className="ph-temp">
              around {clock.step.approxTempC} °C — an estimate, not a measurement: bowl mass and room
              temperature decide when the cup is actually ready
            </small>
          )}
        </div>
        {clock.next !== null && (
          <span className="ph-next">
            next: {clock.next.title} in {formatClock(Math.max(0, clock.secondsToNext!))}
          </span>
        )}
      </header>

      <ol className="ph-steps">
        {PROTOCOL.steps.map((step) => (
          <li
            key={step.id}
            className={
              step.id === clock.step.id
                ? 'is-current'
                : reached.includes(step.id)
                  ? 'is-done'
                  : ''
            }
          >
            <span className="ph-at">{formatClock(step.at)}</span>
            <span>{step.title}</span>
          </li>
        ))}
      </ol>

      {!logging && (
        <div className="golf-actions">
          <button type="button" onClick={() => setPhase('logging')}>
            Log the bowls
          </button>
        </div>
      )}

      {logging && (
        <div className="ph-log">
          <h3>What was in the bowls</h3>
          <p className="golf-hint">
            Pick a bowl, then click wedges to record what you found in it. Fill in the names once the
            blind passes are done.
          </p>

          <ul className="ph-bowls">
            {samples.map((sample) => (
              <li key={sample.code} className={sample.code === activeCode ? 'is-active' : ''}>
                <button type="button" onClick={() => setActiveCode(sample.code)}>
                  {sample.code}
                </button>
                <input
                  type="text"
                  placeholder="what it turned out to be"
                  value={sample.name}
                  onChange={(e) => editSample(sample.code, { name: e.target.value })}
                />
                <span className="ph-descriptors">
                  {sample.descriptorIds.length === 0
                    ? '—'
                    : sample.descriptorIds.map((id) => getNode(WHEEL, id).label).join(', ')}
                </span>
              </li>
            ))}
          </ul>

          {active !== null && (
            <>
              <div className="golf-board">
                <FlavorWheel
                  wheel={WHEEL}
                  focusId={focusId}
                  onFocusChange={setFocusId}
                  selectedId={active.descriptorIds.at(-1) ?? null}
                  onSelect={toggleDescriptor}
                />
              </div>
              <label className="ph-field ph-field-wide">
                <span>Note on bowl {active.code}</span>
                <textarea
                  rows={2}
                  value={active.note}
                  onChange={(e) => editSample(active.code, { note: e.target.value })}
                />
              </label>
            </>
          )}

          <label className="ph-field ph-field-wide">
            <span>Session note</span>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          <div className="golf-actions">
            <button type="button" onClick={save}>
              Save session
            </button>
            <button type="button" className="is-quiet" onClick={() => setPhase('running')}>
              Back to the clock
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
