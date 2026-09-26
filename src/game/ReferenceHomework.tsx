import { useCallback, useMemo, useState } from 'react';
import { REGION_LABEL, coverageEverywhere, getReference, homeworkPool } from '../domain/references.js';
import type { Region } from '../domain/schema.js';
import { WHEEL, getNode } from '../domain/wheel.js';
import { FlavorWheel } from '../ui/FlavorWheel.js';
import { useProgress } from '../progress/useProgress.js';
import { weightsForRound } from '../progress/store.js';
import { newSessionId } from '../session/log.js';
import { useSessions } from '../session/useSessions.js';
import {
  HOMEWORK_ITEMS,
  answerHomeworkHole,
  createAssignment,
  createHomeworkRound,
  daysUntilDue,
  homeworkIdentifications,
  homeworkSummary,
  isDue,
  type HomeworkRound,
} from './homework.js';
import './golf.css';
import '../session/physical.css';

/**
 * Reference Homework: the app sends you to buy and smell real things, then quizzes you days later.
 * The engine, the delay rule and the limits of its blinding are documented in homework.ts.
 *
 * The region picker is the first thing this screen does, and it shows the coverage numbers for all
 * three regions while asking. PLAN.md's open decision is which region to author references for first;
 * that decision wants evidence, and the honest place to surface the evidence is in front of the person
 * choosing. No region is preselected - a default would answer the open question by accident.
 */

type Phase = 'region' | 'assignment' | 'quiz' | 'revealed' | 'summary';

export function ReferenceHomework({ onBack }: { onBack: () => void }) {
  const { progress } = useProgress();
  const { log, chooseRegion, saveAssignment, commitSession } = useSessions();

  const [phase, setPhase] = useState<Phase>(log.region === null ? 'region' : 'assignment');
  const [round, setRound] = useState<HomeworkRound | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);

  const coverage = useMemo(() => coverageEverywhere(), []);
  const now = Date.now();
  const assignment = log.assignment;
  const summary = useMemo(() => (round === null ? null : homeworkSummary(round)), [round]);

  const pickRegion = useCallback(
    (region: Region) => {
      chooseRegion(region);
      setPhase('assignment');
    },
    [chooseRegion],
  );

  const assign = useCallback(() => {
    if (log.region === null) return;
    const pool = homeworkPool(log.region);
    // The one mode where the spaced-repetition weights genuinely apply: the pool is attribute node
    // ids, the same keys `weightsForRound` returns. What you keep missing on screen is what you get
    // sent to go and smell.
    saveAssignment(
      createAssignment(log.region, Date.now(), { weights: weightsForRound(progress, pool) }),
    );
  }, [log.region, progress, saveAssignment]);

  const startQuiz = useCallback(() => {
    if (assignment === null) return;
    setRound(createHomeworkRound(assignment));
    setSelectedId(null);
    setFocusId(null);
    setStartedAt(Date.now());
    setPhase('quiz');
  }, [assignment]);

  const commit = useCallback(() => {
    if (round === null || selectedId === null) return;
    const played = answerHomeworkHole(round, selectedId);
    setRound(played);

    if (played.complete) {
      commitSession({
        id: newSessionId('homework', startedAt),
        at: startedAt,
        durationSec: Math.floor((Date.now() - startedAt) / 1000),
        note: '',
        detail: {
          kind: 'homework',
          region: played.region,
          blinding: 'self',
          items: homeworkIdentifications(played),
        },
      });
      // The assignment is spent. Clearing it is what lets the next one be drawn against fresh
      // weights rather than re-quizzing the same five references forever.
      saveAssignment(null);
    }
    setPhase('revealed');
  }, [commitSession, round, saveAssignment, selectedId, startedAt]);

  const next = useCallback(() => {
    if (round === null) return;
    setSelectedId(null);
    setFocusId(null);
    setPhase(round.complete ? 'summary' : 'quiz');
  }, [round]);

  if (phase === 'region') {
    return (
      <section className="golf ph-setup">
        <h2>Where do you shop?</h2>
        <p className="golf-lede">
          Homework sends you to buy real things, so it has to send you to things you can actually buy.
          Blackberry preserve is a supermarket item in Europe and an import in India; rose water is the
          other way round. Pick where you shop — the counts below are what each region can ask you.
        </p>

        <ul className="ph-regions">
          {coverage.map((c) => (
            <li key={c.region}>
              <button type="button" onClick={() => pickRegion(c.region)}>
                <strong>{REGION_LABEL[c.region]}</strong>
                <span>
                  {c.attributes} attributes · {c.references} references
                </span>
                <small>
                  {c.unreachable.length === 0
                    ? 'all nine categories reachable'
                    : `no reference here for ${c.unreachable.join(', ')}`}
                </small>
              </button>
            </li>
          ))}
        </ul>

        <div className="golf-actions">
          <button type="button" className="is-quiet" onClick={onBack}>
            Back
          </button>
        </div>
      </section>
    );
  }

  if (phase === 'assignment' && log.region !== null) {
    const region = log.region;
    const due = assignment !== null && isDue(assignment, now);
    const regionCoverage = coverage.find((c) => c.region === region)!;

    return (
      <section className="golf ph-setup">
        <h2>Reference Homework</h2>
        <p className="golf-lede">
          {REGION_LABEL[region]} · {regionCoverage.attributes} attributes have a reference you can buy
          here.{' '}
          <button type="button" className="ph-link" onClick={() => setPhase('region')}>
            change region
          </button>
        </p>

        {assignment === null ? (
          <>
            <p>
              An assignment is {HOMEWORK_ITEMS} things to go and smell. The quiz comes three days
              later, on purpose: smelled and named in the same minute, a reference tests nothing but
              short-term memory.
            </p>
            <div className="golf-actions">
              <button type="button" onClick={assign}>
                Assign this week&rsquo;s references
              </button>
              <button type="button" className="is-quiet" onClick={onBack}>
                Back
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={due ? 'ph-due is-ready' : 'ph-due'}>
              {due
                ? 'Due now. Prepare the samples, code them, and start the quiz.'
                : `Quiz opens in ${daysUntilDue(assignment, now)} day${daysUntilDue(assignment, now) === 1 ? '' : 's'}. Go and smell these first.`}
            </p>

            <ol className="ph-assignment">
              {assignment.items.map((item) => {
                const reference = getReference(item.nodeId, item.referenceIndex);
                return (
                  <li key={item.code}>
                    <div className="ph-assignment-head">
                      <strong>{getNode(WHEEL, item.nodeId).label}</strong>
                      <span className="ph-code">{item.code}</span>
                    </div>
                    <p className="ph-product">{reference.name}</p>
                    <p className="ph-ref-prep">{reference.prep}</p>
                  </li>
                );
              })}
            </ol>

            <p className="ph-caveat">
              Write each code on the base of its saucer or jar. Homework is the weakest-blinded drill
              in the app — you can usually see what a sample is — so its value is the recall, not the
              blinding. The aroma kit is the properly blind one.
            </p>

            <div className="golf-actions">
              <button type="button" onClick={startQuiz} disabled={!due}>
                Start the blind quiz
              </button>
              <button type="button" className="is-quiet" onClick={() => saveAssignment(null)}>
                Discard this assignment
              </button>
              <button type="button" className="is-quiet" onClick={onBack}>
                Back
              </button>
            </div>
          </>
        )}
      </section>
    );
  }

  if (phase === 'summary' && round !== null && summary !== null) {
    return (
      <section className="golf golf-summary">
        <h2>Homework — complete</h2>
        <div className="golf-headline">
          <span className="golf-total">{summary.exactCount}</span>
          <span className="golf-outof">/ {summary.total} named exactly</span>
        </div>

        <ol className="golf-scorecard">
          {round.holes.map((hole) => (
            <li key={hole.code}>
              <span className="golf-hole-no">{hole.code}</span>
              <span className="golf-hole-target">{getNode(WHEEL, hole.targetId).label}</span>
              <span className="golf-hole-answer">
                {hole.result === null ? '—' : getNode(WHEEL, hole.result.answerId).label}
              </span>
              <span className="golf-hole-score">{hole.result?.score ?? '—'}</span>
            </li>
          ))}
        </ol>

        <p className="ph-caveat">
          Logged as physical identification, not as screen mastery. Two meters: what you know and what
          your nose can do.
        </p>

        <div className="golf-actions">
          <button type="button" onClick={() => setPhase('assignment')}>
            Assign the next set
          </button>
          <button type="button" className="is-quiet" onClick={onBack}>
            Back
          </button>
        </div>
      </section>
    );
  }

  if (round === null) return null;

  const holeIndex = phase === 'revealed' ? round.current - 1 : round.current;
  const hole = round.holes[holeIndex] ?? null;
  if (hole === null) return null;
  const revealed = phase === 'revealed';
  const reference = revealed ? getReference(hole.targetId, hole.referenceIndex) : null;

  return (
    <section className="golf golf-play">
      <div className="golf-board">
        <FlavorWheel
          wheel={WHEEL}
          focusId={focusId}
          onFocusChange={setFocusId}
          selectedId={revealed ? hole.answerId : selectedId}
          onSelect={revealed ? () => undefined : setSelectedId}
          revealId={revealed ? hole.targetId : null}
        />
      </div>

      <div className="golf-panel">
        <header className="golf-progress">
          <span>
            Sample {holeIndex + 1} of {round.holes.length}
          </span>
          <span>Homework · {REGION_LABEL[round.region]}</span>
        </header>

        <p className="ph-sample-code">
          Sample <strong>{hole.code}</strong>
        </p>

        {!revealed && (
          <>
            <p className="golf-hint">
              Smell it. Commit where it sits on the wheel — the same scoring as screen play, so a near
              miss still scores.
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

        {revealed && hole.result !== null && reference !== null && (
          <div className="golf-result">
            <div className="golf-result-head">
              <span className="golf-result-score">{hole.result.score}</span>
              <span className="golf-result-relation">
                {hole.result.relation === 'exact' ? 'Named it' : 'Not quite'}
              </span>
            </div>
            <p className="golf-result-detail">
              Sample {hole.code} was <strong>{getNode(WHEEL, hole.targetId).label}</strong> —{' '}
              {reference.name}.
            </p>
            <button type="button" onClick={next}>
              {round.complete ? 'See results' : 'Next sample'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
