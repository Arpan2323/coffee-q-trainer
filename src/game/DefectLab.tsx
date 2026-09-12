import { useCallback, useMemo, useState } from 'react';
import { WHEEL, getNode } from '../domain/wheel.js';
import { ATTRIBUTES } from '../domain/attributes.js';
import type { Relation } from '../domain/scoring.js';
import { FlavorWheel } from '../ui/FlavorWheel.js';
import { PAR_PER_HOLE, answerHole, roundSummary, type Round } from './round.js';
import { createDefectRound, defectKind, nextDefectRound } from './defects.js';
import { useProgress } from '../progress/useProgress.js';
import { weightsForRound } from '../progress/store.js';
import './golf.css';
import './defect.css';

const RELATION_LABEL: Record<Relation, string> = {
  exact: 'Named it',
  sibling: 'Next door',
  descendant: 'More specific than the fault',
  'ancestor-ring2': 'Right group, no leaf',
  'ancestor-ring1': 'Right category, but vague',
  'same-category': 'Right category, wrong fault',
  'adjacent-category': 'Neighbouring category',
  confusable: 'A fair confusion',
  distant: 'Not close',
};

type Phase = 'intro' | 'answering' | 'revealed' | 'summary';

export function DefectLab() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState<Round | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const { progress, commitRound } = useProgress();

  const start = useCallback(() => {
    setRound(nextDefectRound((candidates) => weightsForRound(progress, candidates)));
    setSelectedId(null);
    setFocusId(null);
    setPhase('answering');
  }, [progress]);

  const holeIndex = round === null ? 0 : phase === 'revealed' ? round.current - 1 : round.current;
  const hole = round?.holes[holeIndex] ?? null;
  const summary = useMemo(() => (round === null ? null : roundSummary(round)), [round]);

  const commit = useCallback(() => {
    if (round === null || selectedId === null) return;
    const played = answerHole(round, selectedId);
    setRound(played);
    if (played.complete) commitRound(played);
    setPhase('revealed');
  }, [round, selectedId, commitRound]);

  const next = useCallback(() => {
    if (round === null) return;
    setSelectedId(null);
    setFocusId(null);
    setPhase(round.complete ? 'summary' : 'answering');
  }, [round]);

  if (phase === 'intro' || round === null) {
    return (
      <section className="golf golf-belts">
        <h2>Defect Lab</h2>
        <p className="golf-lede">
          Six faults, described but not named. Place each one on the wheel. The score is the same
          wheel-distance grade as Golf — but the lesson is in the reveal: some of these are always
          faults, and some are only faults in the wrong place.
        </p>
        <p className="golf-lede">
          A washed lot has no business tasting of ferment or wet cardboard. A natural can be
          intentionally boozy, and a touch of smoke can be a roaster's signature. Knowing which is
          which is the skill.
        </p>
        <ul>
          <li>
            <button type="button" onClick={start}>
              <strong>Start a round</strong>
              <span>Six faults drawn from the whole wheel, weighted toward the ones you miss.</span>
              <small>identify at ring 3</small>
            </button>
          </li>
        </ul>
      </section>
    );
  }

  if (phase === 'summary' && summary !== null) {
    const contextual = round.holes.filter((h) => defectKind(WHEEL, h.targetId) === 'contextual').length;
    return (
      <section className="golf golf-summary">
        <h2>Defect Lab — round complete</h2>
        <div className="golf-headline">
          <span className="golf-total">{summary.totalScore}</span>
          <span className="golf-outof">/ {summary.maxScore}</span>
          <span className={`golf-vspar ${summary.vsPar >= 0 ? 'is-good' : 'is-bad'}`}>
            {summary.vsPar >= 0 ? '+' : ''}
            {summary.vsPar} vs par
          </span>
        </div>

        <p className="defect-context-line">
          {contextual} of {round.holes.length} were <strong>context-dependent</strong> — a fault in
          the wrong coffee, a feature in the right one. The rest are faults wherever they appear.
        </p>

        <ol className="golf-scorecard">
          {round.holes.map((h, i) => (
            <li key={h.clueNodeId}>
              <span className="golf-hole-no">{i + 1}</span>
              <span className="golf-hole-target">
                {getNode(WHEEL, h.targetId).label}
                {defectKind(WHEEL, h.targetId) === 'contextual' && (
                  <span className="defect-tag" title="Context-dependent">
                    {' '}
                    ·
                  </span>
                )}
              </span>
              <span className="golf-hole-answer">
                {h.answerId === null ? '—' : getNode(WHEEL, h.answerId).label}
              </span>
              <span className="golf-hole-score">{h.result?.score ?? 0}</span>
            </li>
          ))}
        </ol>

        <div className="golf-actions">
          <button type="button" onClick={start}>
            Another round
          </button>
          <button type="button" className="is-quiet" onClick={() => setPhase('intro')}>
            Back
          </button>
        </div>
      </section>
    );
  }

  const revealed = phase === 'revealed';
  const result = revealed ? hole?.result ?? null : null;
  const kind = hole === null ? null : defectKind(WHEEL, hole.targetId);
  const record = hole === null ? undefined : ATTRIBUTES.byNode.get(hole.targetId);

  return (
    <section className="golf golf-play">
      <div className="golf-board">
        <FlavorWheel
          wheel={WHEEL}
          focusId={focusId}
          onFocusChange={setFocusId}
          selectedId={revealed ? hole?.answerId ?? null : selectedId}
          onSelect={revealed ? () => undefined : setSelectedId}
          revealId={revealed ? hole?.targetId ?? null : null}
        />
      </div>

      <div className="golf-panel">
        <header className="golf-progress">
          <span>
            Fault {holeIndex + 1} of {round.holes.length}
          </span>
          <span>Defect Lab</span>
        </header>

        <blockquote className="golf-clue">{hole?.clue}</blockquote>

        {!revealed && (
          <>
            <p className="golf-hint">
              Click to select, double-click to zoom. Commit to where this fault sits on the wheel.
            </p>
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

        {revealed && result !== null && hole !== null && (
          <div className="golf-result">
            <div className="golf-result-head">
              <span className="golf-result-score">{result.score}</span>
              <span className="golf-result-relation">{RELATION_LABEL[result.relation]}</span>
            </div>

            <p className="golf-result-detail">
              You said <strong>{getNode(WHEEL, result.answerId).label}</strong>; it was{' '}
              <strong>{getNode(WHEEL, hole.targetId).label}</strong>.
            </p>

            <p className={`defect-verdict ${kind === 'contextual' ? 'is-contextual' : 'is-fault'}`}>
              {kind === 'contextual' ? (
                <>
                  <strong>Context-dependent.</strong> A fault past a certain intensity or in a
                  process style that should not carry it — but sought after in some coffees, so
                  naming it is not the same as condemning the cup.
                </>
              ) : (
                <>
                  <strong>A fault wherever it appears.</strong> There is no style in which this note
                  belongs.
                </>
              )}
            </p>

            {record && <p className="defect-explain">{record.definition.expert}</p>}
            {record?.causes[0] && <p className="defect-cause">{record.causes[0].note}</p>}

            {result.confusable !== null && (
              <p className="golf-result-note">{result.confusable.note}</p>
            )}
            {result.hedged && (
              <p className="golf-result-note">
                You stopped short of the fault itself. Committing and missing by one would have
                scored {PAR_PER_HOLE}.
              </p>
            )}

            <button type="button" onClick={next}>
              {round.complete ? 'See results' : 'Next fault'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
