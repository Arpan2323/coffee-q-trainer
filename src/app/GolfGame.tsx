import { useCallback, useMemo, useState } from 'react';
import { WHEEL, ancestorsOf, getNode } from '../domain/wheel.js';
import type { Round as RoundT } from '../game/round.js';
import { PAR_PER_HOLE, answerHole, nextRound, roundSummary } from '../game/round.js';
import { BELTS, getBelt } from '../game/belts.js';
import { RELATION_LABEL } from '../game/DescriptorGolf.js';
import { masteredIds, weightsForRound } from '../progress/store.js';
import type { Progress } from '../progress/types.js';
import { FlavorWheel } from '../ui/FlavorWheel.js';
import { CloseIcon } from './icons.js';

const RING_NAME: Record<number, string> = {
  1: 'Ring 1 · Category',
  2: 'Ring 2 · Group',
  3: 'Ring 3 · Descriptor',
};
const ASK: Record<number, string> = {
  1: 'Which category?',
  2: 'Which group?',
  3: 'Which descriptor?',
};

/**
 * Colour for a hole, read against par. Only colour borrows golf's language: the numbers stay on
 * the engine's 0-100 points scale (see PAR_PER_HOLE in round.ts for why they are not strokes).
 */
export type Tone = 'good' | 'par' | 'bad';
export const toneOf = (score: number): Tone =>
  score > PAR_PER_HOLE ? 'good' : score === PAR_PER_HOLE ? 'par' : 'bad';

export const fmtVsPar = (v: number): string => (v === 0 ? 'E' : v > 0 ? `+${v}` : `−${-v}`);

export const pathOf = (id: string): string =>
  [...ancestorsOf(WHEEL, id), getNode(WHEEL, id)].map((n) => n.label).join(' › ');

interface GolfGameProps {
  readonly beltId: string;
  readonly progress: Progress;
  readonly commitRound: (round: RoundT) => Progress;
  readonly unlocked: ReadonlySet<string>;
  readonly onQuit: () => void;
  readonly onPlay: (beltId: string) => void;
}

type Phase = 'answering' | 'revealed' | 'summary';

export function GolfGame({ beltId, progress, commitRound, unlocked, onQuit, onPlay }: GolfGameProps) {
  const belt = getBelt(beltId);
  // Past performance biases the draw: weak attributes come round sooner, mastered ones later. The
  // parent remounts this component per round, so both are read once, at the tee.
  const [round, setRound] = useState<RoundT>(() =>
    nextRound(beltId, (candidates) => weightsForRound(progress, candidates)),
  );
  const [masteredBefore] = useState(() => new Set(masteredIds(progress)));
  const [phase, setPhase] = useState<Phase>('answering');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const holeIndex = phase === 'answering' ? round.current : round.current - 1;
  const hole = round.holes[holeIndex] ?? null;
  const summary = useMemo(() => roundSummary(round), [round]);

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (id === null) return;
      // Deeper belts zoom into a category on tap, so groups and descriptors become big enough to
      // hit on a phone. Nine Doors answers at the category, so there is nothing to zoom for.
      const node = getNode(WHEEL, id);
      if (belt.targetRing > 1 && node.ring === 1 && focusId === null) setFocusId(id);
    },
    [belt.targetRing, focusId],
  );

  const commit = useCallback(() => {
    if (selectedId === null || phase !== 'answering' || hole === null) return;
    const played = answerHole(round, selectedId);
    setRound(played);
    // Written through the moment the round finishes, not when the player navigates on - closing
    // the tab on the results screen must not cost them the round they just played.
    if (played.complete) commitRound(played);
    // Frame the reveal so both the answer and the pin are on screen.
    const answerCat = getNode(WHEEL, selectedId).categoryId;
    const targetCat = getNode(WHEEL, hole.targetId).categoryId;
    setFocusId(belt.targetRing > 1 && answerCat === targetCat ? targetCat : null);
    setPhase('revealed');
  }, [selectedId, phase, hole, round, commitRound, belt.targetRing]);

  const next = useCallback(() => {
    setSelectedId(null);
    // Reset the zoom between holes: leaving it where the last answer was would hand the player a
    // hint about where to look next.
    setFocusId(null);
    setPhase(round.complete ? 'summary' : 'answering');
  }, [round.complete]);

  const played = round.holes.filter((h) => h.result !== null);
  const vsPar = played.reduce((sum, h) => sum + h.result!.score - PAR_PER_HOLE, 0);
  const beltNo = BELTS.findIndex((b) => b.id === beltId) + 1;

  if (phase === 'summary') {
    return (
      <Results
        round={round}
        progress={progress}
        masteredBefore={masteredBefore}
        unlocked={unlocked}
        onPlay={onPlay}
        onQuit={onQuit}
      />
    );
  }

  const revealed = phase === 'revealed';
  const result = revealed ? hole?.result ?? null : null;

  return (
    <div className="cq-screen is-tight">
      <div className="cq-game-head">
        <button type="button" className="cq-icon-btn" onClick={onQuit} aria-label="Quit round">
          <CloseIcon />
        </button>
        <div className="cq-game-title">
          <div className="cq-kicker">
            Belt {beltNo} · {belt.label}
          </div>
          <div className="cq-game-big">
            Hole {holeIndex + 1} <span>of {round.holes.length}</span>
          </div>
        </div>
        <div className="cq-game-score">
          <div className="cq-kicker">vs par</div>
          <div className="cq-game-big">{fmtVsPar(vsPar)}</div>
        </div>
      </div>

      <ol
        className="cq-card-row"
        style={{ gridTemplateColumns: `repeat(${round.holes.length}, minmax(0, 1fr))`, margin: 0, padding: 0, listStyle: 'none' }}
        aria-label="Scorecard"
      >
        {round.holes.map((h, i) => (
          <li
            key={h.clueNodeId}
            className={[
              'cq-hole',
              h.result ? `cq-tone-${toneOf(h.result.score)}` : '',
              i === holeIndex && !h.result ? 'is-now' : '',
            ].join(' ')}
          >
            {h.result ? h.result.score : i + 1}
          </li>
        ))}
      </ol>

      <div className="cq-clue">
        <div className="cq-clue-ask">{ASK[belt.targetRing]}</div>
        <p className="cq-quote">“{hole?.clue}”</p>
      </div>

      <div className="cq-wheel">
        <FlavorWheel
          wheel={WHEEL}
          focusId={focusId}
          onFocusChange={setFocusId}
          selectedId={revealed ? hole?.answerId ?? null : selectedId}
          onSelect={revealed ? () => undefined : select}
          revealId={revealed ? hole?.targetId ?? null : null}
        />
      </div>

      {!revealed && (
        <div className="cq-commit">
          <div className="cq-commit-text">
            <div className="cq-kicker">
              {selectedId ? RING_NAME[getNode(WHEEL, selectedId).ring] : 'Your point'}
            </div>
            <div className="cq-commit-path">
              {selectedId ? pathOf(selectedId) : 'Tap the wheel to choose'}
            </div>
          </div>
          <button
            type="button"
            className="cq-btn cq-btn-primary cq-btn-sm"
            onClick={commit}
            disabled={selectedId === null}
          >
            Commit
          </button>
        </div>
      )}

      {revealed && result !== null && hole !== null && (
        <div className="cq-feedback" role="status">
          <div className="cq-feedback-head">
            <div className={`cq-feedback-score cq-tone-${toneOf(result.score)}`}>{result.score}</div>
            <div>
              <div className="cq-feedback-term">{RELATION_LABEL[result.relation]}</div>
              <div className="cq-feedback-reason">
                {result.score - PAR_PER_HOLE === 0
                  ? 'Par for the hole'
                  : `${fmtVsPar(result.score - PAR_PER_HOLE)} against par`}
              </div>
            </div>
          </div>
          <dl className="cq-feedback-grid" style={{ margin: 0 }}>
            <dt>Pin</dt>
            <dd className="is-pin">{pathOf(hole.targetId)}</dd>
            <dt>You</dt>
            <dd className="is-you">{pathOf(result.answerId)}</dd>
          </dl>
          {hole.clueNodeId !== hole.targetId && (
            <p className="cq-feedback-note">
              The clue was written for {getNode(WHEEL, hole.clueNodeId).label}.
            </p>
          )}
          {result.confusable !== null && (
            <p className="cq-feedback-note">{result.confusable.note}</p>
          )}
          {result.hedged && (
            <p className="cq-feedback-note">
              You stopped short of the target's depth. Committing to a specific attribute and
              missing by one would have scored {PAR_PER_HOLE}.
            </p>
          )}
          <button type="button" className="cq-btn cq-btn-primary" onClick={next}>
            {round.complete ? 'See your card' : 'Next hole'}
          </button>
        </div>
      )}
    </div>
  );
}

interface ResultsProps {
  readonly round: RoundT;
  readonly progress: Progress;
  readonly masteredBefore: ReadonlySet<string>;
  readonly unlocked: ReadonlySet<string>;
  readonly onPlay: (beltId: string) => void;
  readonly onQuit: () => void;
}

function Results({ round, progress, masteredBefore, unlocked, onPlay, onQuit }: ResultsProps) {
  const summary = roundSummary(round);
  const belt = getBelt(round.beltId);
  const index = BELTS.findIndex((b) => b.id === belt.id);
  const nextBelt = BELTS[index + 1];
  const earned = summary.vsPar >= 0;
  const newlyMastered = masteredIds(progress).filter((id) => !masteredBefore.has(id));
  const advance = earned && nextBelt !== undefined && unlocked.has(nextBelt.id);

  return (
    <div className="cq-screen">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div className="cq-kicker" style={{ fontSize: 12 }}>
          Belt {index + 1} · {belt.label} · card
        </div>
        <div className="cq-result-big">
          <div className="cq-result-vs">{fmtVsPar(summary.vsPar)}</div>
          <div className="cq-result-sub">
            {summary.totalScore} of {summary.maxScore} · par {summary.par}
          </div>
        </div>
        <div className={earned ? 'cq-result-belt is-earned' : 'cq-result-belt'}>
          {earned
            ? nextBelt
              ? `Belt ${index + 1} earned. ${nextBelt.label} is unlocked.`
              : `Belt ${index + 1} earned. Full wheel, committed.`
            : `Finish at par or better to earn Belt ${index + 1}.`}
        </div>
      </div>

      <div className="cq-card cq-result-wheel">
        <div className="cq-wheel">
          <FlavorWheel
            wheel={WHEEL}
            focusId={null}
            onFocusChange={() => undefined}
            selectedId={null}
            onSelect={() => undefined}
            pins={round.holes.map((h, i) => ({
              targetId: h.targetId,
              answerId: h.answerId,
              label: String(i + 1),
            }))}
          />
        </div>
        <div className="cq-legend">
          <span>
            <i style={{ background: 'var(--color-accent-2-700)' }} />
            Pin
          </span>
          <span>
            <i style={{ background: 'var(--color-accent)' }} />
            Your point
          </span>
          <span>
            <i className="is-path" />
            Error path
          </span>
        </div>
      </div>

      <div className="cq-stats">
        <div className="cq-stat">
          <strong>{summary.specificityIndex.toFixed(2)}</strong>
          <span>Specificity · mean ring, of 3</span>
        </div>
        <div className="cq-stat">
          <strong>{Math.round(summary.hedgeRate * 100)}%</strong>
          <span>Hedge rate · stopped short</span>
        </div>
        <div className="cq-stat">
          <strong>
            {summary.exactCount}/{summary.answered}
          </strong>
          <span>Exact · on the pin</span>
        </div>
      </div>

      {newlyMastered.length > 0 && (
        <p className="cq-mastered">
          <strong>Mastered: {newlyMastered.map((id) => getNode(WHEEL, id).label).join(', ')}.</strong>{' '}
          Three exact answers, each at least two days apart. That spacing is why it counts.
        </p>
      )}

      <ol className="cq-card cq-list">
        {round.holes.map((h, i) => {
          const score = h.result?.score ?? 0;
          const exact = h.result?.relation === 'exact';
          return (
            <li key={h.clueNodeId} className="cq-row">
              <div className="cq-row-n">{i + 1}</div>
              <div className="cq-row-body">
                <div className="cq-row-title">{pathOf(h.targetId)}</div>
                <div className="cq-row-sub">
                  {exact ? 'On the pin' : h.answerId ? `You: ${pathOf(h.answerId)}` : '—'}
                </div>
              </div>
              <div className={`cq-pill cq-tone-${toneOf(score)}`}>{score}</div>
            </li>
          );
        })}
      </ol>

      <div className="cq-actions">
        <button
          type="button"
          className="cq-btn cq-btn-primary"
          onClick={() => onPlay(advance ? nextBelt!.id : belt.id)}
        >
          {advance ? `Play Belt ${index + 2} · ${nextBelt!.label}` : 'Play again'}
        </button>
        <button type="button" className="cq-btn cq-btn-secondary" onClick={onQuit}>
          All courses
        </button>
      </div>
    </div>
  );
}
