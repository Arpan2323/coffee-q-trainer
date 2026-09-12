import { useCallback, useMemo, useState } from 'react';
import { CONFUSABLES, WHEEL, getNode } from '../domain/wheel.js';
import type { Relation } from '../domain/scoring.js';
import { FlavorWheel } from '../ui/FlavorWheel.js';
import { BELTS, getBelt } from './belts.js';
import { PAR_PER_HOLE, answerHole, nextRound, roundSummary, type Round } from './round.js';
import { useProgress } from '../progress/useProgress.js';
import { masteredIds, progressStats, weightsForRound } from '../progress/store.js';
import './golf.css';

/** Plain-language names for the scoring relations. "ancestor-ring2" means nothing to a beginner. */
const RELATION_LABEL: Record<Relation, string> = {
  exact: 'Exact',
  sibling: 'Next door',
  descendant: 'More specific than asked',
  'ancestor-ring2': 'Right group, no leaf',
  'ancestor-ring1': 'Right category, but vague',
  'same-category': 'Right category, wrong group',
  'adjacent-category': 'Neighbouring category',
  confusable: 'A fair confusion',
  distant: 'Not close',
};

type Phase = 'choosing-belt' | 'answering' | 'revealed' | 'summary';

export function DescriptorGolf() {
  const [phase, setPhase] = useState<Phase>('choosing-belt');
  const [round, setRound] = useState<Round | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [masteredBefore, setMasteredBefore] = useState<readonly string[]>([]);

  const { progress, commitRound } = useProgress();
  const stats = useMemo(() => progressStats(progress), [progress]);

  const start = useCallback(
    (beltId: string) => {
      // Past performance biases the draw: weak attributes come round sooner, mastered ones later.
      setRound(nextRound(beltId, (candidates) => weightsForRound(progress, candidates)));
      setMasteredBefore(masteredIds(progress));
      setSelectedId(null);
      setFocusId(null);
      setPhase('answering');
    },
    [progress],
  );

  // Once revealed, the hole we are looking at is the one just played, not the one now current.
  const holeIndex = round === null ? 0 : phase === 'revealed' ? round.current - 1 : round.current;
  const hole = round?.holes[holeIndex] ?? null;
  const summary = useMemo(() => (round === null ? null : roundSummary(round)), [round]);

  const commit = useCallback(() => {
    if (round === null || selectedId === null) return;
    const played = answerHole(round, selectedId);
    setRound(played);
    // Written through the moment the round finishes, not when the player navigates on - closing
    // the tab on the results screen must not cost them the round they just played.
    if (played.complete) commitRound(played);
    setPhase('revealed');
  }, [round, selectedId, commitRound]);

  const next = useCallback(() => {
    if (round === null) return;
    setSelectedId(null);
    // Reset the zoom between holes: leaving it where the last answer was would hand the player a
    // hint about where to look next.
    setFocusId(null);
    setPhase(round.complete ? 'summary' : 'answering');
  }, [round]);

  const newlyMastered = useMemo(() => {
    const before = new Set(masteredBefore);
    return masteredIds(progress).filter((id) => !before.has(id));
  }, [progress, masteredBefore]);

  if (phase === 'choosing-belt' || round === null) {
    return (
      <section className="golf golf-belts">
        <h2>Descriptor Golf</h2>
        <p className="golf-lede">
          Nine holes. Read the description, then commit to a point on the wheel. Landing next door
          scores more than retreating to the category — the game rewards committing.
        </p>

        {stats.roundsPlayed > 0 && (
          <dl className="golf-progress-bar">
            <div>
              <dt>Mastered</dt>
              <dd>{stats.mastered}</dd>
              <small>of 110 descriptors</small>
            </div>
            <div>
              <dt>Streak</dt>
              <dd>
                {stats.streak}
                <span className="golf-unit">
                  {' '}
                  day{stats.streak === 1 ? '' : 's'}
                </span>
              </dd>
              <small>best {stats.longestStreak}</small>
            </div>
            <div>
              <dt>Seen</dt>
              <dd>{stats.attributesSeen}</dd>
              <small>over {stats.roundsPlayed} rounds</small>
            </div>
            {stats.decayRate > 0 && (
              <div>
                <dt>Decay</dt>
                <dd>{Math.round(stats.decayRate * 100)}%</dd>
                <small>mastered, then lost</small>
              </div>
            )}
          </dl>
        )}
        <ul>
          {BELTS.map((belt) => (
            <li key={belt.id}>
              <button type="button" onClick={() => start(belt.id)}>
                <strong>{belt.label}</strong>
                <span>{belt.blurb}</span>
                <small>
                  {belt.holes} holes · answer at ring {belt.targetRing}
                </small>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (phase === 'summary' && summary !== null) {
    const belt = getBelt(round.beltId);
    return (
      <section className="golf golf-summary">
        <h2>{belt.label} — round complete</h2>
        <div className="golf-headline">
          <span className="golf-total">{summary.totalScore}</span>
          <span className="golf-outof">/ {summary.maxScore}</span>
          <span className={`golf-vspar ${summary.vsPar >= 0 ? 'is-good' : 'is-bad'}`}>
            {summary.vsPar >= 0 ? '+' : ''}
            {summary.vsPar} vs par
          </span>
        </div>

        <dl className="golf-metrics">
          <div>
            <dt>Specificity index</dt>
            <dd>{summary.specificityIndex.toFixed(2)}</dd>
            <small>mean ring committed to, out of 3</small>
          </div>
          <div>
            <dt>Hedge rate</dt>
            <dd>{Math.round(summary.hedgeRate * 100)}%</dd>
            <small>answers that stopped short</small>
          </div>
          <div>
            <dt>Exact</dt>
            <dd>
              {summary.exactCount} / {summary.answered}
            </dd>
            <small>landed on the attribute itself</small>
          </div>
        </dl>

        {newlyMastered.length > 0 && (
          <p className="golf-mastered">
            <strong>
              Mastered: {newlyMastered.map((id) => getNode(WHEEL, id).label).join(', ')}
            </strong>
            <span>
              Three exact answers, each at least two days apart. That spacing is why it counts.
            </span>
          </p>
        )}

        <p className="golf-streak-line">
          {stats.streak} day streak · {stats.mastered} of 110 mastered
        </p>

        <ol className="golf-scorecard">
          {round.holes.map((h, i) => (
            <li key={h.clueNodeId}>
              <span className="golf-hole-no">{i + 1}</span>
              <span className="golf-hole-target">{getNode(WHEEL, h.targetId).label}</span>
              <span className="golf-hole-answer">
                {h.answerId === null ? '—' : getNode(WHEEL, h.answerId).label}
              </span>
              <span className="golf-hole-score">{h.result?.score ?? 0}</span>
            </li>
          ))}
        </ol>

        <div className="golf-actions">
          <button type="button" onClick={() => start(round.beltId)}>
            Play {belt.label} again
          </button>
          <button type="button" className="is-quiet" onClick={() => setPhase('choosing-belt')}>
            Change belt
          </button>
        </div>
      </section>
    );
  }

  const revealed = phase === 'revealed';
  const result = revealed ? hole?.result ?? null : null;

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
            Hole {holeIndex + 1} of {round.holes.length}
          </span>
          <span>{getBelt(round.beltId).label}</span>
        </header>

        <blockquote className="golf-clue">{hole?.clue}</blockquote>

        {!revealed && (
          <>
            <p className="golf-hint">
              Click to select, double-click to zoom in, the hub to zoom out. You may commit at any
              depth — but a specific miss beats a vague hit.
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
              You said <strong>{getNode(WHEEL, result.answerId).label}</strong>; the answer was{' '}
              <strong>{getNode(WHEEL, hole.targetId).label}</strong>.
              {hole.clueNodeId !== hole.targetId && (
                <> The clue was written for {getNode(WHEEL, hole.clueNodeId).label}.</>
              )}
            </p>

            {result.confusable !== null && (
              <p className="golf-result-note">{result.confusable.note}</p>
            )}

            {result.hedged && (
              <p className="golf-result-note">
                You stopped short of the target's depth. Committing to a specific attribute and
                missing by one would have scored {PAR_PER_HOLE}.
              </p>
            )}

            <button type="button" onClick={next}>
              {round.complete ? 'See results' : 'Next hole'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
