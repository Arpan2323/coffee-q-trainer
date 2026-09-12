import { useCallback, useMemo, useState } from 'react';
import { WHEEL, getNode } from '../domain/wheel.js';
import { ATTRIBUTES } from '../domain/attributes.js';
import { PROFILES } from '../domain/profiles.js';
import type { CoffeeProfile } from '../domain/schema.js';
import type { Relation } from '../domain/scoring.js';
import { FlavorWheel } from '../ui/FlavorWheel.js';
import {
  answerCauseEffectHole,
  causeEffectSummary,
  createCauseEffectRound,
  type CauseEffectRound,
} from './causeEffectRound.js';
import { useProgress } from '../progress/useProgress.js';
import './golf.css';
import './causeEffect.css';

const RELATION_LABEL: Record<Relation, string> = {
  exact: 'Nailed it',
  sibling: 'Next door',
  descendant: 'More specific than needed',
  'ancestor-ring2': 'Right group, no leaf',
  'ancestor-ring1': 'Right category, but vague',
  'same-category': 'Right category, wrong note',
  'adjacent-category': 'Neighbouring category',
  confusable: 'A fair confusion',
  distant: 'Not close',
};

const PROCESS_LABEL: Record<CoffeeProfile['process'], string> = {
  washed: 'Washed',
  natural: 'Natural',
  honey: 'Honey',
  anaerobic: 'Anaerobic',
  'wet-hulled': 'Wet-hulled',
};

const ROAST_LABEL: Record<CoffeeProfile['roast'], string> = {
  light: 'Light',
  medium: 'Medium',
  'medium-dark': 'Medium-dark',
  dark: 'Dark',
};

type Phase = 'intro' | 'answering' | 'revealed' | 'summary';

function ProfileCard({ profile }: { profile: CoffeeProfile }) {
  return (
    <div className="ce-profile">
      <h3>{profile.name}</h3>
      <dl className="ce-facts">
        <div>
          <dt>Origin</dt>
          <dd>{profile.origin}</dd>
        </div>
        {profile.variety && (
          <div>
            <dt>Variety</dt>
            <dd>{profile.variety}</dd>
          </div>
        )}
        <div>
          <dt>Process</dt>
          <dd>{PROCESS_LABEL[profile.process]}</dd>
        </div>
        <div>
          <dt>Roast</dt>
          <dd>{ROAST_LABEL[profile.roast]}</dd>
        </div>
      </dl>
      {profile.synthetic && (
        <p className="ce-synthetic">
          Synthetic — an illustrative composite, not a real cupped lot. {profile.source}
        </p>
      )}
    </div>
  );
}

export function CauseEffect() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState<CauseEffectRound | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const { commitCauseEffectRound } = useProgress();

  const start = useCallback(() => {
    setRound(createCauseEffectRound());
    setSelectedId(null);
    setFocusId(null);
    setPhase('answering');
  }, []);

  const holeIndex = round === null ? 0 : phase === 'revealed' ? round.current - 1 : round.current;
  const hole = round?.holes[holeIndex] ?? null;
  const profile = hole === null ? null : PROFILES.byId.get(hole.profileId) ?? null;
  const summary = useMemo(() => (round === null ? null : causeEffectSummary(round)), [round]);

  const commit = useCallback(() => {
    if (round === null || selectedId === null) return;
    const played = answerCauseEffectHole(round, selectedId);
    setRound(played);
    if (played.complete) commitCauseEffectRound(played);
    setPhase('revealed');
  }, [round, selectedId, commitCauseEffectRound]);

  const next = useCallback(() => {
    if (round === null) return;
    setSelectedId(null);
    setFocusId(null);
    setPhase(round.complete ? 'summary' : 'answering');
  }, [round]);

  if (phase === 'intro' || round === null) {
    return (
      <section className="golf golf-belts">
        <h2>Cause &amp; Effect</h2>
        <p className="golf-lede">
          Origin, process and roast are the cause; the cup is the effect. Read what made this
          coffee, then click the wheel for a descriptor you would expect it to carry. A real cup
          carries several defensible answers at once, so you are scored against the best match, not
          one fixed target.
        </p>
        <p className="golf-lede ce-synthetic">
          Every profile here is synthetic — an illustrative composite, not a real cupped lot or a
          published score sheet. That will not change until roaster-sourced score sheets replace
          them; see PLAN.md section 5.
        </p>
        <ul>
          <li>
            <button type="button" onClick={start}>
              <strong>Start a round</strong>
              <span>Five coffees, forward direction: cause given, effect to find.</span>
              <small>scored against every descriptor the cup carries</small>
            </button>
          </li>
        </ul>
      </section>
    );
  }

  if (phase === 'summary' && summary !== null) {
    return (
      <section className="golf golf-summary">
        <h2>Cause &amp; Effect — round complete</h2>
        <div className="golf-headline">
          <span className="golf-total">{summary.totalScore}</span>
          <span className="golf-outof">/ {summary.maxScore}</span>
        </div>

        <ol className="golf-scorecard">
          {round.holes.map((h) => {
            const p = PROFILES.byId.get(h.profileId)!;
            return (
              <li key={h.profileId}>
                <span className="golf-hole-no">{p.roast[0]!.toUpperCase()}</span>
                <span className="golf-hole-target">{p.name}</span>
                <span className="golf-hole-answer">
                  {h.answerId === null ? '—' : getNode(WHEEL, h.answerId).label}
                </span>
                <span className="golf-hole-score">{h.result?.score ?? 0}</span>
              </li>
            );
          })}
        </ol>

        <p className="ce-synthetic">
          Every coffee above is a synthetic composite, illustrative of the region/process/roast
          shape rather than a real cupping.
        </p>

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

  const matchedRecord = result === null ? undefined : ATTRIBUTES.byNode.get(result.targetId);
  const matchedCause =
    matchedRecord === undefined || profile === null
      ? undefined
      : (matchedRecord.causes.find(
          (c) => c.process?.includes(profile.process) || c.roast?.includes(profile.roast),
        ) ?? matchedRecord.causes[0]);

  return (
    <section className="golf golf-play">
      <div className="golf-board">
        <FlavorWheel
          wheel={WHEEL}
          focusId={focusId}
          onFocusChange={setFocusId}
          selectedId={revealed ? hole?.answerId ?? null : selectedId}
          onSelect={revealed ? () => undefined : setSelectedId}
          revealId={revealed ? result?.targetId ?? null : null}
        />
      </div>

      <div className="golf-panel">
        <header className="golf-progress">
          <span>
            Coffee {holeIndex + 1} of {round.holes.length}
          </span>
          <span>Cause &amp; Effect</span>
        </header>

        {profile && <ProfileCard profile={profile} />}

        {!revealed && (
          <>
            <p className="golf-hint">
              Given this cause, what would you expect in the cup? Click to select, double-click to
              zoom.
            </p>
            <div className="golf-commit">
              <span>
                {selectedId === null ? (
                  <em>Nothing selected</em>
                ) : (
                  <>
                    Expecting <strong>{getNode(WHEEL, selectedId).label}</strong>
                  </>
                )}
              </span>
              <button type="button" onClick={commit} disabled={selectedId === null}>
                Commit
              </button>
            </div>
          </>
        )}

        {revealed && result !== null && profile !== null && (
          <div className="golf-result">
            <div className="golf-result-head">
              <span className="golf-result-score">{result.score}</span>
              <span className="golf-result-relation">{RELATION_LABEL[result.relation]}</span>
            </div>

            <p className="golf-result-detail">
              You said <strong>{getNode(WHEEL, result.answerId).label}</strong>; the closest match
              was <strong>{getNode(WHEEL, result.targetId).label}</strong>.
            </p>

            <p className="ce-descriptors">
              This cup: {profile.descriptors.map((d, i) => (
                <span key={d.nodeId}>
                  {i > 0 && ', '}
                  <span className={d.nodeId === result.targetId ? 'ce-matched' : ''}>
                    {getNode(WHEEL, d.nodeId).label}
                  </span>
                </span>
              ))}
              .
            </p>

            {matchedCause && <p className="golf-result-note">{matchedCause.note}</p>}
            {result.confusable !== null && (
              <p className="golf-result-note">{result.confusable.note}</p>
            )}
            {result.hedged && (
              <p className="golf-result-note">
                You stopped short of a specific descriptor. Committing to one and missing by one
                neighbour would have scored more.
              </p>
            )}

            <button type="button" onClick={next}>
              {round.complete ? 'See results' : 'Next coffee'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
