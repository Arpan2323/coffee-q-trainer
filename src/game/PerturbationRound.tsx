import { useCallback, useMemo, useState } from 'react';
import { WHEEL, getNode } from '../domain/wheel.js';
import { ROAST_TRENDS } from '../domain/roastTrends.js';
import { PROFILES } from '../domain/profiles.js';
import type { CoffeeProfile, TrendDirection } from '../domain/schema.js';
import {
  createPerturbationRound,
  furtherRoast,
  guessCategory,
  isHoleReady,
  perturbationSummary,
  submitHole,
  type PerturbationRound as PerturbationRoundState,
} from './perturbation.js';
import { useProgress } from '../progress/useProgress.js';
import './golf.css';
import './causeEffect.css';
import './perturbation.css';

const DIRECTION_LABEL: Record<TrendDirection, string> = { up: 'Up', down: 'Down', mixed: 'Same' };

const ROAST_LABEL: Record<CoffeeProfile['roast'], string> = {
  light: 'Light',
  medium: 'Medium',
  'medium-dark': 'Medium-dark',
  dark: 'Dark',
};

const DIRECTIONS: TrendDirection[] = ['up', 'down', 'mixed'];

type Phase = 'answering' | 'revealed' | 'summary';

export function PerturbationRound({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>('answering');
  const [round, setRound] = useState<PerturbationRoundState>(() => createPerturbationRound());

  const { commitPerturbationRound } = useProgress();

  const start = useCallback(() => {
    setRound(createPerturbationRound());
    setPhase('answering');
  }, []);

  const holeIndex = phase === 'revealed' ? round.current - 1 : round.current;
  const hole = round.holes[holeIndex] ?? null;
  const profile = hole === null ? null : PROFILES.byId.get(hole.profileId) ?? null;
  const summary = useMemo(() => perturbationSummary(round), [round]);
  const target = profile ? furtherRoast(profile.roast) : null;

  const setGuess = useCallback(
    (categoryId: string, direction: TrendDirection) => {
      setRound((r) => guessCategory(r, categoryId, direction));
    },
    [],
  );

  const submit = useCallback(() => {
    const played = submitHole(round);
    setRound(played);
    if (played.complete) commitPerturbationRound(played);
    setPhase('revealed');
  }, [round, commitPerturbationRound]);

  const next = useCallback(() => {
    setPhase(round.complete ? 'summary' : 'answering');
  }, [round]);

  if (phase === 'summary') {
    return (
      <section className="golf golf-summary">
        <h2>Cause &amp; Effect — Perturbation — round complete</h2>
        <div className="golf-headline">
          <span className="golf-total">{summary.correct}</span>
          <span className="golf-outof">/ {summary.total} correct</span>
        </div>

        <ol className="golf-scorecard">
          {round.holes.map((h) => {
            const p = PROFILES.byId.get(h.profileId)!;
            const holeCorrect = h.guesses.filter((g) => g.correct === true).length;
            return (
              <li key={h.profileId}>
                <span className="golf-hole-no">{p.roast[0]!.toUpperCase()}</span>
                <span className="golf-hole-target">{p.name}</span>
                <span className="golf-hole-answer" />
                <span className="golf-hole-score">
                  {holeCorrect} / {h.guesses.length}
                </span>
              </li>
            );
          })}
        </ol>

        <p className="ce-synthetic">
          The coffees are synthetic composites; the roast-trend table they were scored against is
          categorical, provisional domain knowledge, not calibrated data — see README.md.
        </p>

        <div className="golf-actions">
          <button type="button" onClick={start}>
            Another round
          </button>
          <button type="button" className="is-quiet" onClick={onBack}>
            Back
          </button>
        </div>
      </section>
    );
  }

  const revealed = phase === 'revealed';

  return (
    <section className="golf pt-round">
      <header className="golf-progress">
        <span>
          Coffee {holeIndex + 1} of {round.holes.length}
        </span>
        <span>Cause &amp; Effect · Perturbation</span>
      </header>

      {profile && (
        <div className="ce-profile">
          <h3>{profile.name}</h3>
          <p className="pt-premise">
            Baseline roast <strong>{ROAST_LABEL[profile.roast]}</strong>, roasted further into
            development
            {target ? (
              <>
                , toward <strong>{ROAST_LABEL[target]}</strong>
              </>
            ) : (
              <> — already at the dark end, imagine development pushed further still</>
            )}
            . Which categories move, and which way?
          </p>
        </div>
      )}

      <div className="pt-grid">
        {WHEEL.categoryOrder.map((categoryId) => {
          const node = getNode(WHEEL, categoryId);
          const g = hole?.guesses.find((x) => x.categoryId === categoryId);
          const trend = ROAST_TRENDS.byCategory.get(categoryId)!;
          return (
            <div key={categoryId} className="pt-row">
              <span className="pt-cat" style={{ borderLeftColor: node.color }}>
                {node.label}
              </span>
              <div className="pt-choices">
                {DIRECTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    disabled={revealed}
                    className={g?.guess === d ? 'is-active' : ''}
                    onClick={() => setGuess(categoryId, d)}
                  >
                    {DIRECTION_LABEL[d]}
                  </button>
                ))}
              </div>
              {revealed && g && (
                <div className={`pt-verdict ${g.correct ? 'is-correct' : 'is-wrong'}`}>
                  <span>
                    {g.correct ? '✓' : '✗'} {DIRECTION_LABEL[trend.direction]}
                  </span>
                  <p>{trend.note}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!revealed && (
        <div className="golf-commit">
          <span>
            {hole && isHoleReady(hole) ? (
              <em>Ready to submit</em>
            ) : (
              <em>{hole?.guesses.filter((g) => g.guess !== null).length ?? 0} of 9 guessed</em>
            )}
          </span>
          <button type="button" onClick={submit} disabled={!hole || !isHoleReady(hole)}>
            Submit
          </button>
        </div>
      )}

      {revealed && (
        <button type="button" onClick={next}>
          {round.complete ? 'See results' : 'Next coffee'}
        </button>
      )}
    </section>
  );
}
