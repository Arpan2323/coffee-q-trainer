import { useCallback, useMemo, useState } from 'react';
import { ATTRIBUTES } from '../domain/attributes.js';
import { WHEEL, getNode } from '../domain/wheel.js';
import { FlavorWheel } from '../ui/FlavorWheel.js';
import { newSessionId } from '../session/log.js';
import { useSessions } from '../session/useSessions.js';
import {
  AROMA_DRILL_VIALS,
  DEFAULT_KIT_SIZE,
  aromaIdentifications,
  aromaSummary,
  commitAnswer,
  createAromaDrill,
  drawnVials,
  enterVial,
  kitCoverage,
  usedVials,
  type AromaDrill,
} from './aromaKit.js';
import './golf.css';
import '../session/physical.css';

/**
 * Aroma-kit mode. The blinding, and why the app ships no vial mapping of its own, are documented at
 * the top of aromaKit.ts.
 *
 * The screen enforces the order the engine insists on: the wheel is shown first and the vial-number
 * field does not exist until an answer is committed. That sequencing is the entire reason this is the
 * one mode whose blinding nobody has to take on trust.
 */

type Phase = 'kit' | 'smelling' | 'numbering' | 'revealed' | 'summary';

/** Attribute options grouped by category, so a 110-entry select is navigable. */
function useAttributeOptions() {
  return useMemo(() => {
    const byCategory = new Map<string, { id: string; label: string }[]>();
    for (const nodeId of ATTRIBUTES.byNode.keys()) {
      const node = getNode(WHEEL, nodeId);
      const list = byCategory.get(node.categoryId) ?? [];
      list.push({ id: nodeId, label: node.label });
      byCategory.set(node.categoryId, list);
    }
    return [...byCategory.entries()].map(([categoryId, options]) => ({
      label: getNode(WHEEL, categoryId).label,
      options,
    }));
  }, []);
}

export function AromaKitDrill({ onBack }: { onBack: () => void }) {
  const { log, mapVial, commitSession } = useSessions();
  const [phase, setPhase] = useState<Phase>('kit');
  const [drill, setDrill] = useState<AromaDrill | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [vialEntry, setVialEntry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [draftVial, setDraftVial] = useState('');
  const [draftNode, setDraftNode] = useState('');

  const groups = useAttributeOptions();
  const coverage = useMemo(() => kitCoverage(log.kit), [log.kit]);
  const summary = useMemo(() => (drill === null ? null : aromaSummary(drill)), [drill]);

  const start = useCallback(() => {
    setDrill(createAromaDrill(Math.min(AROMA_DRILL_VIALS, coverage.mapped)));
    setSelectedId(null);
    setFocusId(null);
    setVialEntry('');
    setError(null);
    setStartedAt(Date.now());
    setPhase('smelling');
  }, [coverage.mapped]);

  const draftReady = draftNode !== '' && Number.isInteger(Number(draftVial)) && draftVial.trim() !== '';

  const addMapping = useCallback(() => {
    if (!draftReady) return;
    mapVial(Number(draftVial), draftNode);
    setDraftVial('');
    setDraftNode('');
  }, [draftNode, draftReady, draftVial, mapVial]);

  const commit = useCallback(() => {
    if (drill === null || selectedId === null) return;
    setDrill(commitAnswer(drill, selectedId));
    setPhase('numbering');
  }, [drill, selectedId]);

  const submitVial = useCallback(() => {
    if (drill === null) return;
    const vial = Number(vialEntry);
    if (!Number.isInteger(vial)) {
      setError('Enter the number printed on the vial.');
      return;
    }
    let played: AromaDrill;
    try {
      // Every refusal in `enterVial` is a real mistake - an unmapped vial, or one already drawn -
      // so the message is shown as written rather than swallowed.
      played = enterVial(drill, vial, log.kit);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That vial could not be scored.');
      return;
    }

    setError(null);
    setVialEntry('');
    setDrill(played);

    if (played.complete) {
      commitSession({
        id: newSessionId('aroma-kit', startedAt),
        at: startedAt,
        durationSec: Math.floor((Date.now() - startedAt) / 1000),
        note: '',
        detail: {
          kind: 'aroma-kit',
          vials: drawnVials(played),
          items: aromaIdentifications(played),
        },
      });
    }
    setPhase('revealed');
  }, [commitSession, drill, log.kit, startedAt, vialEntry]);

  const next = useCallback(() => {
    if (drill === null) return;
    setSelectedId(null);
    setFocusId(null);
    setPhase(drill.complete ? 'summary' : 'smelling');
  }, [drill]);

  if (phase === 'kit') {
    return (
      <section className="golf ph-setup">
        <h2>Aroma kit</h2>
        <p className="golf-lede">
          Self-blinded olfactory drills against a physical kit. Draw a vial without looking at the
          number, smell it, commit on the wheel — and only then read the number. This is the one drill
          in the app whose blinding nobody has to take your word for.
        </p>

        <p>
          The app ships no vial list. Kits number their vials differently, and a commercial kit&rsquo;s
          contents list is a licensed asset like the wheel artwork. So the mapping is yours: enter it
          once, from the booklet in the box.
        </p>

        <p className="ph-dose">
          <strong>
            {coverage.mapped} vial{coverage.mapped === 1 ? '' : 's'} mapped
          </strong>
          {coverage.mapped > 0 && <> · {coverage.attributes} distinct attributes</>}
          <br />
          <small>
            A {DEFAULT_KIT_SIZE}-vial kit is the common commercial size, but nothing here assumes a
            size — map as many as you own, in any order.
          </small>
        </p>

        <div className="ph-add-vial">
          <label className="ph-field">
            <span>Vial</span>
            <input
              inputMode="numeric"
              value={draftVial}
              onChange={(e) => setDraftVial(e.target.value)}
              placeholder="0"
            />
          </label>
          <label className="ph-field ph-field-wide">
            <span>Is</span>
            <select value={draftNode} onChange={(e) => setDraftNode(e.target.value)}>
              <option value="">— pick an attribute —</option>
              {groups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button type="button" onClick={addMapping} disabled={!draftReady}>
            Map it
          </button>
        </div>

        {coverage.mapped > 0 && (
          <ul className="ph-kit">
            {coverage.vials.map((vial) => (
              <li key={vial}>
                <span className="ph-vial">{vial}</span>
                <span>{getNode(WHEEL, log.kit[String(vial)]!).label}</span>
                <button type="button" onClick={() => mapVial(vial, '')} aria-label={`Unmap vial ${vial}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="golf-actions">
          <button type="button" onClick={start} disabled={coverage.mapped === 0}>
            Start a drill
          </button>
          <button type="button" className="is-quiet" onClick={onBack}>
            Back
          </button>
        </div>
        {coverage.mapped === 0 && (
          <p className="ph-caveat">Map at least one vial and the drill can begin.</p>
        )}
      </section>
    );
  }

  if (phase === 'summary' && drill !== null && summary !== null) {
    return (
      <section className="golf golf-summary">
        <h2>Aroma drill — complete</h2>
        <div className="golf-headline">
          <span className="golf-total">{summary.exactCount}</span>
          <span className="golf-outof">/ {summary.total} named exactly</span>
        </div>

        <ol className="golf-scorecard">
          {drill.holes.map((hole, i) => (
            <li key={i}>
              <span className="golf-hole-no">{hole.vial}</span>
              <span className="golf-hole-target">
                {hole.targetId === null ? '—' : getNode(WHEEL, hole.targetId).label}
              </span>
              <span className="golf-hole-answer">
                {hole.result === null ? '—' : getNode(WHEEL, hole.result.answerId).label}
              </span>
              <span className="golf-hole-score">{hole.result?.score ?? '—'}</span>
            </li>
          ))}
        </ol>

        <div className="golf-actions">
          <button type="button" onClick={start}>
            Another drill
          </button>
          <button type="button" className="is-quiet" onClick={() => setPhase('kit')}>
            Edit the kit mapping
          </button>
          <button type="button" className="is-quiet" onClick={onBack}>
            Back
          </button>
        </div>
      </section>
    );
  }

  if (drill === null) return null;

  const holeIndex = phase === 'revealed' ? drill.current - 1 : drill.current;
  const hole = drill.holes[holeIndex] ?? null;
  if (hole === null) return null;
  const used = usedVials(drill);

  return (
    <section className="golf golf-play">
      <div className="golf-board">
        <FlavorWheel
          wheel={WHEEL}
          focusId={focusId}
          onFocusChange={setFocusId}
          selectedId={phase === 'smelling' ? selectedId : hole.answerId}
          onSelect={phase === 'smelling' ? setSelectedId : () => undefined}
          revealId={phase === 'revealed' ? hole.targetId : null}
        />
      </div>

      <div className="golf-panel">
        <header className="golf-progress">
          <span>
            Vial {holeIndex + 1} of {drill.holes.length}
          </span>
          <span>Aroma kit</span>
        </header>

        {phase === 'smelling' && (
          <>
            <p className="ph-instruction">
              Reach in without looking. Smell it. Do not turn the vial over yet.
            </p>
            {used.length > 0 && (
              <p className="golf-hint">Already drawn: {used.join(', ')}. Put those aside.</p>
            )}
            <div className="golf-commit">
              <span>
                {selectedId === null ? (
                  <em>Nothing selected</em>
                ) : (
                  <>
                    Committing to <strong>{getNode(WHEEL, selectedId).label}</strong>
                  </>
                )}
              </span>
              <button type="button" onClick={commit} disabled={selectedId === null}>
                Commit
              </button>
            </div>
          </>
        )}

        {phase === 'numbering' && (
          <>
            <p className="ph-instruction">
              Answer locked in: <strong>{getNode(WHEEL, hole.answerId!).label}</strong>. Now read the
              number off the vial.
            </p>
            <div className="golf-commit">
              <label className="ph-field">
                <span>Vial number</span>
                <input
                  inputMode="numeric"
                  value={vialEntry}
                  onChange={(e) => setVialEntry(e.target.value)}
                  placeholder="0"
                />
              </label>
              <button type="button" onClick={submitVial} disabled={vialEntry.trim() === ''}>
                Score it
              </button>
            </div>
            {error !== null && <p className="ph-error">{error}</p>}
          </>
        )}

        {phase === 'revealed' && hole.result !== null && hole.targetId !== null && (
          <div className="golf-result">
            <div className="golf-result-head">
              <span className="golf-result-score">{hole.result.score}</span>
              <span className="golf-result-relation">
                {hole.result.relation === 'exact' ? 'Named it' : 'Not quite'}
              </span>
            </div>
            <p className="golf-result-detail">
              Vial {hole.vial} is <strong>{getNode(WHEEL, hole.targetId).label}</strong>; you said{' '}
              <strong>{getNode(WHEEL, hole.result.answerId).label}</strong>.
            </p>
            <button type="button" onClick={next}>
              {drill.complete ? 'See results' : 'Next vial'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
