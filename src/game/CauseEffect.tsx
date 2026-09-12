import { useCallback, useMemo, useState } from 'react';
import { WHEEL, getNode } from '../domain/wheel.js';
import { ATTRIBUTES } from '../domain/attributes.js';
import { PROFILES } from '../domain/profiles.js';
import type { CoffeeProfile, Process } from '../domain/schema.js';
import type { Relation } from '../domain/scoring.js';
import { FlavorWheel } from '../ui/FlavorWheel.js';
import {
  answerCauseEffectHole,
  causeEffectSummary,
  createCauseEffectRound,
  type CauseEffectRound,
} from './causeEffectRound.js';
import {
  answerReverseHole,
  createReverseRound,
  reverseSummary,
  type ReverseRound,
} from './causeEffectReverse.js';
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

const PROCESS_LABEL: Record<Process, string> = {
  washed: 'Washed',
  natural: 'Natural',
  honey: 'Honey',
  anaerobic: 'Anaerobic',
  'wet-hulled': 'Wet-hulled',
};

/**
 * Plain-language process definitions, for Reverse's reveal. Generic domain knowledge, not curated
 * tasting data - unlike the profiles, these describe what a process *is*, not what a cup *tastes
 * like*, so they carry no `synthetic` flag and no review debt.
 */
const PROCESS_DEFINITION: Record<Process, string> = {
  washed:
    'Fruit pulp and mucilage are removed before drying, giving a cleaner cup that shows acidity clearly.',
  natural:
    'Whole cherries dry intact, so fruit sugars ferment against the bean - heavier body, more fruit and fermentation character.',
  honey:
    'Skin removed but some or all mucilage left on during drying - between washed and natural, extra sweetness and body without full natural funk.',
  anaerobic:
    'Cherries or pulped coffee ferment in a sealed, oxygen-free tank before drying, pushing fermentation further toward bold, sometimes boozy or tropical notes.',
  'wet-hulled':
    'Parchment is hulled while still wet, shortening drying and lowering acidity - the low-acid, heavy-bodied, earthy signature associated with Indonesian coffees.',
};

const ROAST_LABEL: Record<CoffeeProfile['roast'], string> = {
  light: 'Light',
  medium: 'Medium',
  'medium-dark': 'Medium-dark',
  dark: 'Dark',
};

const PROCESSES = Object.keys(PROCESS_LABEL) as Process[];

/**
 * `source` is safe to show in Forward - it is the fabrication rationale, shown after the answer is
 * already given. In Reverse it is not: every profile's `source` names its process directly (it is
 * literally what the composite is illustrating), so echoing it before a guess would hand over the
 * answer. `showSource` stays false throughout Reverse; the `synthetic` disclosure itself never does.
 */
function SyntheticNote({ profile, showSource }: { profile: CoffeeProfile; showSource: boolean }) {
  if (!profile.synthetic) return null;
  return (
    <p className="ce-synthetic">
      Synthetic — an illustrative composite, not a real cupped lot.{showSource && ` ${profile.source}`}
    </p>
  );
}

/**
 * `revealProcess` is false throughout Reverse: the process is what the player is guessing, and so
 * is `showSource` - see `SyntheticNote` above for why the source text itself is not safe there.
 */
function ProfileCard({
  profile,
  revealProcess,
}: {
  profile: CoffeeProfile;
  revealProcess: boolean;
}) {
  return (
    <div className="ce-profile">
      <h3>{revealProcess ? profile.name : `Coffee from ${profile.origin}`}</h3>
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
        {revealProcess && (
          <div>
            <dt>Process</dt>
            <dd>{PROCESS_LABEL[profile.process]}</dd>
          </div>
        )}
        <div>
          <dt>Roast</dt>
          <dd>{ROAST_LABEL[profile.roast]}</dd>
        </div>
      </dl>
      <SyntheticNote profile={profile} showSource={revealProcess} />
    </div>
  );
}

type Direction = 'forward' | 'reverse';

export function CauseEffect() {
  const [direction, setDirection] = useState<Direction | null>(null);

  if (direction === 'forward') return <ForwardRound onBack={() => setDirection(null)} />;
  if (direction === 'reverse') return <ReverseRound onBack={() => setDirection(null)} />;

  return (
    <section className="golf golf-belts">
      <h2>Cause &amp; Effect</h2>
      <p className="golf-lede">
        Origin, process and roast are the cause; the cup is the effect. Two directions through the
        same idea: predict the cup from what made it, or work backward from the cup to how it was
        made.
      </p>
      <p className="golf-lede ce-synthetic">
        Every profile is synthetic — an illustrative composite, not a real cupped lot or a published
        score sheet. That will not change until roaster-sourced score sheets replace them; see
        PLAN.md section 5.
      </p>
      <ul>
        <li>
          <button type="button" onClick={() => setDirection('forward')}>
            <strong>Forward</strong>
            <span>Given the cause, predict a descriptor the cup would carry. Click the wheel.</span>
            <small>five coffees, scored against every descriptor the cup carries</small>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => setDirection('reverse')}>
            <strong>Reverse</strong>
            <span>Given the cup&rsquo;s descriptors, name the process that produced it.</span>
            <small>five coffees, right or wrong — processes have no partial credit</small>
          </button>
        </li>
      </ul>
    </section>
  );
}

type ForwardPhase = 'answering' | 'revealed' | 'summary';

function ForwardRound({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<ForwardPhase>('answering');
  const [round, setRound] = useState<CauseEffectRound>(() => createCauseEffectRound());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const { commitCauseEffectRound } = useProgress();

  const start = useCallback(() => {
    setRound(createCauseEffectRound());
    setSelectedId(null);
    setFocusId(null);
    setPhase('answering');
  }, []);

  const holeIndex = phase === 'revealed' ? round.current - 1 : round.current;
  const hole = round.holes[holeIndex] ?? null;
  const profile = hole === null ? null : PROFILES.byId.get(hole.profileId) ?? null;
  const summary = useMemo(() => causeEffectSummary(round), [round]);

  const commit = useCallback(() => {
    if (selectedId === null) return;
    const played = answerCauseEffectHole(round, selectedId);
    setRound(played);
    if (played.complete) commitCauseEffectRound(played);
    setPhase('revealed');
  }, [round, selectedId, commitCauseEffectRound]);

  const next = useCallback(() => {
    setSelectedId(null);
    setFocusId(null);
    setPhase(round.complete ? 'summary' : 'answering');
  }, [round]);

  if (phase === 'summary') {
    return (
      <section className="golf golf-summary">
        <h2>Cause &amp; Effect — Forward — round complete</h2>
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
          <button type="button" className="is-quiet" onClick={onBack}>
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
          <span>Cause &amp; Effect · Forward</span>
        </header>

        {profile && <ProfileCard profile={profile} revealProcess />}

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
              This cup:{' '}
              {profile.descriptors.map((d, i) => (
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

type ReversePhase = 'answering' | 'revealed' | 'summary';

function ReverseRound({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<ReversePhase>('answering');
  const [round, setRound] = useState<ReverseRound>(() => createReverseRound());
  const [guess, setGuess] = useState<Process | null>(null);

  const { commitReverseRound } = useProgress();

  const start = useCallback(() => {
    setRound(createReverseRound());
    setGuess(null);
    setPhase('answering');
  }, []);

  const holeIndex = phase === 'revealed' ? round.current - 1 : round.current;
  const hole = round.holes[holeIndex] ?? null;
  const profile = hole === null ? null : PROFILES.byId.get(hole.profileId) ?? null;
  const summary = useMemo(() => reverseSummary(round), [round]);

  const commit = useCallback(() => {
    if (guess === null) return;
    const played = answerReverseHole(round, guess);
    setRound(played);
    if (played.complete) commitReverseRound(played);
    setPhase('revealed');
  }, [round, guess, commitReverseRound]);

  const next = useCallback(() => {
    setGuess(null);
    setPhase(round.complete ? 'summary' : 'answering');
  }, [round]);

  if (phase === 'summary') {
    return (
      <section className="golf golf-summary">
        <h2>Cause &amp; Effect — Reverse — round complete</h2>
        <div className="golf-headline">
          <span className="golf-total">{summary.correct}</span>
          <span className="golf-outof">/ {summary.total} correct</span>
        </div>

        <ol className="golf-scorecard">
          {round.holes.map((h) => {
            const p = PROFILES.byId.get(h.profileId)!;
            return (
              <li key={h.profileId}>
                <span className="golf-hole-no">{h.correct ? '✓' : '✗'}</span>
                <span className="golf-hole-target">{p.origin}</span>
                <span className="golf-hole-answer">
                  {h.answer === null ? '—' : PROCESS_LABEL[h.answer]}
                </span>
                <span className="golf-hole-score">{PROCESS_LABEL[p.process]}</span>
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
          <button type="button" className="is-quiet" onClick={onBack}>
            Back
          </button>
        </div>
      </section>
    );
  }

  const revealed = phase === 'revealed';
  const evidence =
    revealed && profile !== null
      ? profile.descriptors
          .map((d) => ({ node: getNode(WHEEL, d.nodeId), record: ATTRIBUTES.byNode.get(d.nodeId) }))
          .map(({ node, record }) => ({
            label: node.label,
            note: record?.causes.find((c) => c.process?.includes(profile.process))?.note,
          }))
          .filter((e): e is { label: string; note: string } => e.note !== undefined)
      : [];

  return (
    <section className="golf ce-reverse">
      <header className="golf-progress">
        <span>
          Coffee {holeIndex + 1} of {round.holes.length}
        </span>
        <span>Cause &amp; Effect · Reverse</span>
      </header>

      {profile && <ProfileCard profile={profile} revealProcess={false} />}

      {profile && (
        <p className="ce-descriptors">
          This cup: {profile.descriptors.map((d) => getNode(WHEEL, d.nodeId).label).join(', ')}.
        </p>
      )}

      {!revealed && (
        <>
          <p className="golf-hint">Which process do you think produced this cup?</p>
          <div className="ce-process-choices">
            {PROCESSES.map((p) => (
              <button
                key={p}
                type="button"
                className={guess === p ? 'is-active' : ''}
                onClick={() => setGuess(p)}
              >
                {PROCESS_LABEL[p]}
              </button>
            ))}
          </div>
          <div className="golf-commit">
            <span>
              {guess === null ? (
                <em>Nothing selected</em>
              ) : (
                <>
                  Guessing <strong>{PROCESS_LABEL[guess]}</strong>
                </>
              )}
            </span>
            <button type="button" onClick={commit} disabled={guess === null}>
              Commit
            </button>
          </div>
        </>
      )}

      {revealed && hole !== null && profile !== null && (
        <div className="golf-result">
          <div className="golf-result-head">
            <span className="golf-result-score">{hole.correct ? 'Correct' : 'Wrong'}</span>
            <span className="golf-result-relation">
              You said {hole.answer && PROCESS_LABEL[hole.answer]}
            </span>
          </div>

          <p className="golf-result-detail">
            This was <strong>{PROCESS_LABEL[profile.process]}</strong>.{' '}
            {PROCESS_DEFINITION[profile.process]}
          </p>

          {evidence.length > 0 && (
            <ul className="ce-evidence">
              {evidence.map((e) => (
                <li key={e.label}>
                  <strong>{e.label}:</strong> {e.note}
                </li>
              ))}
            </ul>
          )}

          {/* Safe now: the process is already given above, so the source text can't leak it. */}
          <SyntheticNote profile={profile} showSource />

          <button type="button" onClick={next}>
            {round.complete ? 'See results' : 'Next coffee'}
          </button>
        </div>
      )}
    </section>
  );
}
