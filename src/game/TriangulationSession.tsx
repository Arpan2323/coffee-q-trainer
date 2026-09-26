import { useCallback, useMemo, useState } from 'react';
import { PROTOCOL, doseFor } from '../domain/protocol.js';
import { newSessionId } from '../session/log.js';
import { useSessions } from '../session/useSessions.js';
import type { Blinding } from '../session/types.js';
import {
  CUPS_PER_SET,
  TRIANGULATION_SETS,
  createTriangulationRound,
  isCodeInSet,
  pickOddCup,
  pourSheet,
  triangulationSummary,
  type TriangulationRound as RoundState,
} from './triangulation.js';
import './golf.css';
import '../session/physical.css';

/**
 * Physical triangulation. The engine and the honesty limits are documented in triangulation.ts; this
 * screen's job is the one thing the module cannot do, which is to keep the pour sheet out of sight.
 *
 * Hence the phases: the sheet is shown once, during `pour`, and never again. There is no way back to
 * it from the tasting screen - not because peeking is impossible (the taster can look under a bowl any
 * time) but because an app that offers the answer on a back button is inviting it.
 */

type Phase = 'setup' | 'pour' | 'tasting' | 'revealed' | 'summary';

export function TriangulationSession({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [coffeeA, setCoffeeA] = useState('');
  const [coffeeB, setCoffeeB] = useState('');
  const [sets, setSets] = useState(TRIANGULATION_SETS);
  const [blinding, setBlinding] = useState<Blinding>('self');
  const [round, setRound] = useState<RoundState | null>(null);
  const [entry, setEntry] = useState('');
  const [startedAt, setStartedAt] = useState(0);

  const { commitSession } = useSessions();

  const summary = useMemo(() => (round === null ? null : triangulationSummary(round)), [round]);
  const setIndex = phase === 'revealed' ? (round?.current ?? 1) - 1 : round?.current ?? 0;
  const set = round?.sets[setIndex] ?? null;
  const dose = useMemo(() => doseFor(sets * CUPS_PER_SET), [sets]);

  const start = useCallback(() => {
    setRound(createTriangulationRound({ sets, coffeeA, coffeeB, blinding }));
    setStartedAt(Date.now());
    setEntry('');
    setPhase('pour');
  }, [blinding, coffeeA, coffeeB, sets]);

  const commit = useCallback(() => {
    if (round === null) return;
    const played = pickOddCup(round, entry);
    setRound(played);
    setEntry('');

    if (played.complete) {
      const result = triangulationSummary(played);
      commitSession({
        id: newSessionId('triangulation', startedAt),
        at: startedAt,
        durationSec: Math.floor((Date.now() - startedAt) / 1000),
        note: '',
        detail: {
          kind: 'triangulation',
          blinding: played.blinding,
          coffeeA: played.coffeeA,
          coffeeB: played.coffeeB,
          sets: result.total,
          correct: result.correct,
        },
      });
    }
    setPhase('revealed');
  }, [commitSession, entry, round, startedAt]);

  const next = useCallback(() => {
    if (round === null) return;
    setPhase(round.complete ? 'summary' : 'pour');
  }, [round]);

  if (phase === 'setup') {
    return (
      <section className="golf ph-setup">
        <h2>Triangulation</h2>
        <p className="golf-lede">
          Three bowls, two of one coffee and one of another. Find the odd one. No vocabulary, no
          scale — the cleanest discrimination test there is, and right one time in three by luck,
          which is what your results get measured against.
        </p>

        <label className="ph-field">
          <span>Coffee A</span>
          <input value={coffeeA} onChange={(e) => setCoffeeA(e.target.value)} placeholder="Coffee A" />
        </label>
        <label className="ph-field">
          <span>Coffee B</span>
          <input value={coffeeB} onChange={(e) => setCoffeeB(e.target.value)} placeholder="Coffee B" />
        </label>
        <label className="ph-field">
          <span>Sets</span>
          <input
            type="number"
            min={1}
            max={8}
            value={sets}
            onChange={(e) => setSets(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
          />
        </label>

        <fieldset className="ph-fieldset">
          <legend>Who is pouring?</legend>
          <label>
            <input
              type="radio"
              checked={blinding === 'self'}
              onChange={() => setBlinding('self')}
            />
            I am — I will shuffle the bowls and not look at a base
          </label>
          <label>
            <input
              type="radio"
              checked={blinding === 'helper'}
              onChange={() => setBlinding('helper')}
            />
            Someone else is — they take the pour sheet, I never see it
          </label>
        </fieldset>

        <p className="ph-caveat">
          The app cannot verify either, so it records which you chose and never adds the two together.
          Helper-poured is the number worth trusting; self-poured is evidence for you alone.
        </p>

        <p className="ph-dose">
          <small>
            {sets * CUPS_PER_SET} bowls: {dose.coffeeG} g total, {dose.waterMl} ml water at{' '}
            {PROTOCOL.ratio.waterTempC} °C. Brew both coffees to the same protocol or you are
            triangulating your kettle.
          </small>
        </p>

        <div className="golf-actions">
          <button type="button" onClick={start}>
            Draw the codes
          </button>
          <button type="button" className="is-quiet" onClick={onBack}>
            Back
          </button>
        </div>
      </section>
    );
  }

  if (phase === 'summary' && round !== null && summary !== null) {
    return (
      <section className="golf golf-summary">
        <h2>Triangulation — complete</h2>
        <div className="golf-headline">
          <span className="golf-total">{summary.correct}</span>
          <span className="golf-outof">/ {summary.total} sets</span>
        </div>

        <ol className="golf-scorecard">
          {round.sets.map((s, i) => (
            <li key={s.oddCode}>
              <span className="golf-hole-no">{i + 1}</span>
              <span className="golf-hole-target">odd bowl {s.oddCode}</span>
              <span className="golf-hole-answer">you said {s.pickedCode}</span>
              <span className="golf-hole-score">{s.correct ? '✓' : '✗'}</span>
            </li>
          ))}
        </ol>

        <p className="ph-caveat">
          {summary.total} sets is a start, not a verdict: guessing scores {(summary.total / 3).toFixed(1)} of{' '}
          {summary.total} on average. The Palate Profile keeps the running total and says when it has
          become evidence.
        </p>

        <div className="golf-actions">
          <button type="button" onClick={() => setPhase('setup')}>
            Another round
          </button>
          <button type="button" className="is-quiet" onClick={onBack}>
            Back
          </button>
        </div>
      </section>
    );
  }

  if (round === null || set === null) return null;

  if (phase === 'pour') {
    const sheet = pourSheet(set);
    return (
      <section className="golf ph-pour">
        <header className="golf-progress">
          <span>
            Set {setIndex + 1} of {round.sets.length}
          </span>
          <span>{round.blinding === 'helper' ? 'Helper pours' : 'Self-poured'}</span>
        </header>

        <h2>Pour sheet</h2>
        <p className="ph-warning">
          {round.blinding === 'helper'
            ? 'Hand the phone to whoever is pouring. Look away.'
            : 'Write the codes on the bases, pour, then shuffle the bowls without tracking them. Once you tap below this sheet is gone for good.'}
        </p>

        <dl className="ph-sheet">
          <div>
            <dt>{round.coffeeA}</dt>
            <dd>{sheet.A.join(' · ')}</dd>
          </div>
          <div>
            <dt>{round.coffeeB}</dt>
            <dd>{sheet.B.join(' · ')}</dd>
          </div>
        </dl>

        <div className="golf-actions">
          <button type="button" onClick={() => setPhase('tasting')}>
            Poured and shuffled — hide the sheet
          </button>
        </div>
      </section>
    );
  }

  if (phase === 'tasting') {
    const valid = isCodeInSet(set, entry);
    return (
      <section className="golf ph-taste">
        <header className="golf-progress">
          <span>
            Set {setIndex + 1} of {round.sets.length}
          </span>
          <span>Triangulation</span>
        </header>

        <h2>Find the odd bowl</h2>
        <p className="golf-hint">
          Taste left to right, then right to left. Compare one attribute at a time — acidity across
          all three, then body across all three. Comparing whole cups holistically is what Q
          candidates fail on.
        </p>

        <p className="ph-instruction">
          Decide which bowl is different, <strong>then</strong> lift it and read the code off its base.
        </p>

        <div className="golf-commit">
          <label className="ph-field">
            <span>Code on the base</span>
            <input
              inputMode="numeric"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              placeholder="000"
            />
          </label>
          <button type="button" onClick={commit} disabled={!valid}>
            Commit
          </button>
        </div>
        {entry.trim() !== '' && !valid && (
          <p className="ph-error">That is not one of this set&rsquo;s three codes.</p>
        )}
      </section>
    );
  }

  const odd = set.cups.find((c) => c.code === set.oddCode)!;
  return (
    <section className="golf ph-taste">
      <header className="golf-progress">
        <span>
          Set {setIndex + 1} of {round.sets.length}
        </span>
        <span>Triangulation</span>
      </header>

      <div className={set.correct ? 'ph-verdict is-correct' : 'ph-verdict is-wrong'}>
        <strong>{set.correct ? 'Correct' : 'Not that one'}</strong>
        <p>
          The odd bowl was <strong>{set.oddCode}</strong> — the single{' '}
          {odd.coffee === 'A' ? round.coffeeA : round.coffeeB} among two{' '}
          {odd.coffee === 'A' ? round.coffeeB : round.coffeeA}. You said {set.pickedCode}.
        </p>
      </div>

      <button type="button" onClick={next}>
        {round.complete ? 'See results' : 'Next set'}
      </button>
    </section>
  );
}
