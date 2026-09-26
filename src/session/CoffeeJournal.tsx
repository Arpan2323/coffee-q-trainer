import { useCallback, useMemo, useState } from 'react';
import { radarLayout, radarPolygon, spokePoint } from '../ui/radar.js';
import { newSessionId } from './log.js';
import { useSessions } from './useSessions.js';
import {
  BREW_METHODS,
  BREW_METHOD_LABEL,
  EMPTY_JOURNAL_RADAR,
  JOURNAL_AXES,
  JOURNAL_AXIS_LABEL,
  JOURNAL_INTENSITY_MAX,
  JOURNAL_RATING_MAX,
  clampRating,
  radarValues,
  setAxis,
  type BrewMethod,
  type JournalRadar,
} from './journal.js';
import './journal.css';
import '../game/golf.css';
import '../progress/profile.css';

/**
 * Coffee Journal - a quick, non-blind note for a coffee you're actually drinking. The design
 * reasoning (why it is a separate mode, why there is no "sampled date" field) lives in
 * session/journal.ts; this file is the form and the live radar preview.
 */

const RADAR_SIZE = 220;
const RADAR = radarLayout(RADAR_SIZE, 84);

type Phase = 'editing' | 'saved';

interface JournalDraft {
  readonly name: string;
  readonly roaster: string;
  readonly producer: string;
  readonly roastDate: string;
  readonly brewMethod: BrewMethod;
  readonly brewMethodOther: string;
  readonly price: string;
  readonly rating: number;
  readonly radar: JournalRadar;
  readonly notes: string;
}

const BLANK_DRAFT: JournalDraft = {
  name: '',
  roaster: '',
  producer: '',
  roastDate: '',
  brewMethod: 'pour-over',
  brewMethodOther: '',
  price: '',
  rating: 0,
  radar: EMPTY_JOURNAL_RADAR,
  notes: '',
};

function RadarChart({ radar, size = RADAR_SIZE }: { radar: JournalRadar; size?: number }) {
  const layout = size === RADAR_SIZE ? RADAR : radarLayout(size, size * (84 / RADAR_SIZE));
  const values = radarValues(radar);

  return (
    <svg className="jr-radar" viewBox={`0 0 ${layout.size} ${layout.size}`} role="img" aria-hidden="true">
      {[0.2, 0.4, 0.6, 0.8, 1].map((r) => (
        <polygon key={r} className="jr-radar-grid" points={radarPolygon(layout, values.map(() => r))} />
      ))}
      {JOURNAL_AXES.map((axis, i) => {
        const [x, y] = spokePoint(layout, i, JOURNAL_AXES.length, 1);
        return (
          <line
            key={axis}
            className="jr-radar-spoke"
            x1={layout.center}
            y1={layout.center}
            x2={x}
            y2={y}
          />
        );
      })}
      <polygon className="jr-radar-plot" points={radarPolygon(layout, values)} />
    </svg>
  );
}

function StarRating({
  rating,
  onChange,
  readOnly = false,
}: {
  rating: number;
  onChange: (value: number) => void;
  readOnly?: boolean;
}) {
  if (readOnly) {
    return (
      <div className="jr-stars jr-stars-readonly" aria-label={`Rated ${rating} of 5`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className={star <= rating ? 'is-filled' : ''} aria-hidden="true">
            {star <= rating ? '★' : '☆'}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="jr-stars" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={star <= rating ? 'is-filled' : ''}
          onClick={() => onChange(star === rating ? 0 : star)}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          aria-pressed={star <= rating}
        >
          {star <= rating ? '★' : '☆'}
        </button>
      ))}
    </div>
  );
}

export function CoffeeJournal({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>('editing');
  const [draft, setDraft] = useState<JournalDraft>(BLANK_DRAFT);
  const [startedAt, setStartedAt] = useState(0);

  const { commitSession } = useSessions();

  const set = useCallback(<K extends keyof JournalDraft>(key: K, value: JournalDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  const setIntensity = useCallback((axis: (typeof JOURNAL_AXES)[number], value: number) => {
    setDraft((d) => ({ ...d, radar: setAxis(d.radar, axis, value) }));
  }, []);

  const save = useCallback(() => {
    const at = startedAt || Date.now();
    commitSession({
      id: newSessionId('journal', at),
      at,
      durationSec: 0,
      note: '',
      detail: {
        kind: 'journal',
        name: draft.name.trim(),
        roaster: draft.roaster.trim(),
        producer: draft.producer.trim(),
        roastDate: draft.roastDate.trim(),
        brewMethod: draft.brewMethod,
        brewMethodOther: draft.brewMethodOther.trim(),
        price: draft.price.trim(),
        rating: draft.rating,
        radar: draft.radar,
        notes: draft.notes.trim(),
      },
    });
    setPhase('saved');
  }, [commitSession, draft, startedAt]);

  const anotherEntry = useCallback(() => {
    setDraft(BLANK_DRAFT);
    setStartedAt(Date.now());
    setPhase('editing');
  }, []);

  useMemo(() => {
    if (startedAt === 0) setStartedAt(Date.now());
  }, [startedAt]);

  if (phase === 'saved') {
    return (
      <section className="golf golf-summary">
        <h2>Entry logged</h2>
        <div className="golf-headline">
          <span className="golf-total">{draft.name || 'Unnamed coffee'}</span>
        </div>
        {draft.rating > 0 && (
          <StarRating rating={draft.rating} onChange={() => undefined} readOnly />
        )}
        <p className="ph-caveat">
          Ungraded, like a cupping bowl — your own cup has no answer key. This adds one to cups
          tasted and nothing else: no mastery, no identification score.
        </p>
        <div className="golf-actions">
          <button type="button" onClick={anotherEntry}>
            Another entry
          </button>
          <button type="button" className="is-quiet" onClick={onBack}>
            Back
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="golf ph-setup jr-form">
      <h2>Coffee Journal</h2>
      <p className="golf-lede">
        A note for a coffee you already know — not blind, not timed. Screen play and the other
        physical modes never touch this: it's your own cup, your own impression.
      </p>

      <div className="jr-grid">
        <label className="ph-field">
          <span>Coffee origin/name</span>
          <input value={draft.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="ph-field">
          <span>Roaster</span>
          <input value={draft.roaster} onChange={(e) => set('roaster', e.target.value)} />
        </label>
        <label className="ph-field">
          <span>Producer</span>
          <input value={draft.producer} onChange={(e) => set('producer', e.target.value)} />
        </label>
        <label className="ph-field">
          <span>Roast date</span>
          <input
            value={draft.roastDate}
            onChange={(e) => set('roastDate', e.target.value)}
            placeholder="whatever's printed on the bag"
          />
        </label>
        <label className="ph-field">
          <span>Price</span>
          <input value={draft.price} onChange={(e) => set('price', e.target.value)} />
        </label>
      </div>

      <fieldset className="ph-fieldset">
        <legend>Brew method</legend>
        {BREW_METHODS.map((method) => (
          <label key={method}>
            <input
              type="radio"
              checked={draft.brewMethod === method}
              onChange={() => set('brewMethod', method)}
            />
            {BREW_METHOD_LABEL[method]}
          </label>
        ))}
        {draft.brewMethod === 'other' && (
          <input
            className="jr-brew-other"
            value={draft.brewMethodOther}
            onChange={(e) => set('brewMethodOther', e.target.value)}
            placeholder="describe it"
          />
        )}
      </fieldset>

      <div className="jr-field-block">
        <span className="ph-field-label">Rating</span>
        <StarRating rating={draft.rating} onChange={(v) => set('rating', clampRating(v))} />
      </div>

      <h3>Tasting wheel</h3>
      <p className="golf-hint">
        Rate each term 0–5. This is a fixed 16-term impression scale, not the app's own flavour
        wheel — it isn't scored and doesn't feed mastery.
      </p>

      <div className="jr-wheel-row">
        <RadarChart radar={draft.radar} />
        <div className="jr-axes">
          {JOURNAL_AXES.map((axis) => (
            <div key={axis} className="jr-axis-row">
              <span className="jr-axis-label">{JOURNAL_AXIS_LABEL[axis]}</span>
              <div className="jr-axis-choices">
                {Array.from({ length: JOURNAL_INTENSITY_MAX + 1 }, (_, n) => n).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={draft.radar[axis] === n ? 'is-active' : ''}
                    onClick={() => setIntensity(axis, n)}
                    aria-label={`${JOURNAL_AXIS_LABEL[axis]} ${n}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <label className="ph-field ph-field-wide">
        <span>Notes</span>
        <textarea
          rows={4}
          value={draft.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </label>

      <div className="golf-actions">
        <button type="button" onClick={save}>
          Save entry
        </button>
        <button type="button" className="is-quiet" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}
