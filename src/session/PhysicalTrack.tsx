import { useMemo, useState } from 'react';
import { WHEEL, getNode } from '../domain/wheel.js';
import { REGION_LABEL } from '../domain/references.js';
import { AromaKitDrill } from '../game/AromaKitDrill.js';
import { ReferenceHomework } from '../game/ReferenceHomework.js';
import { TriangulationSession } from '../game/TriangulationSession.js';
import { CuppingSession } from './CuppingSession.js';
import { palateStats } from './log.js';
import { formatClock } from './timer.js';
import { useSessions } from './useSessions.js';
import type { PhysicalSession, SessionKind } from './types.js';
import '../game/golf.css';
import './physical.css';

/**
 * The physical track (PLAN.md's Track B) behind one nav entry, because the four modes share a ledger
 * and a set of rules that are easier to state once than four times.
 *
 * The rule worth restating here, because it is the product's only hard design rule: screen play earns
 * knowledge progress, logged physical sessions earn palate progress, and the app never adds them
 * together. The palate summary at the top of this screen is the second meter.
 */

type Mode = 'menu' | 'cupping' | 'triangulation' | 'homework' | 'aroma-kit' | 'log';

const KIND_LABEL: Record<SessionKind, string> = {
  cupping: 'Cupping',
  triangulation: 'Triangulation',
  homework: 'Homework',
  'aroma-kit': 'Aroma kit',
};

const dateOf = (at: number): string =>
  new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** One line saying what a logged session actually consisted of. */
function headline(session: PhysicalSession): string {
  const detail = session.detail;
  switch (detail.kind) {
    case 'cupping': {
      const named = detail.samples.filter((s) => s.name.trim() !== '').length;
      return `${detail.samples.length} bowl${detail.samples.length === 1 ? '' : 's'}${named > 0 ? `, ${named} identified` : ''}`;
    }
    case 'triangulation':
      return `${detail.correct} of ${detail.sets} sets · ${detail.coffeeA} vs ${detail.coffeeB} · ${detail.blinding === 'helper' ? 'helper-poured' : 'self-poured'}`;
    case 'homework': {
      const exact = detail.items.filter((i) => i.exact).length;
      return `${exact} of ${detail.items.length} named · ${REGION_LABEL[detail.region]}`;
    }
    case 'aroma-kit': {
      const exact = detail.items.filter((i) => i.exact).length;
      return `${exact} of ${detail.items.length} vials named · ${detail.vials.join(', ')}`;
    }
  }
}

function PalateMeter() {
  const { log } = useSessions();
  const stats = useMemo(() => palateStats(log), [log]);

  if (stats.empty) {
    return (
      <p className="ph-meter-empty">
        Nothing logged yet. Every number here comes from coffee you actually tasted — screen play
        cannot move it, by design.
      </p>
    );
  }

  const discrimination = stats.discriminationAll;
  return (
    <dl className="golf-progress-bar ph-meter">
      <div>
        <dt>Sessions</dt>
        <dd>{stats.sessionsLogged}</dd>
        <small>{stats.cupsTasted} cups tasted</small>
      </div>
      <div>
        <dt>Discrimination</dt>
        <dd>
          {discrimination.correct}
          <span className="golf-unit"> / {discrimination.sets}</span>
        </dd>
        <small>
          {discrimination.pValue === null
            ? 'no sets yet'
            : discrimination.pValue < 0.05
              ? `beating chance (p = ${discrimination.pValue.toFixed(3)})`
              : `not yet past chance (p = ${discrimination.pValue.toFixed(2)})`}
        </small>
      </div>
      <div>
        <dt>Named blind</dt>
        <dd>{stats.namedBreadth}</dd>
        <small>{stats.identifications} identifications</small>
      </div>
      {stats.identifications > 0 && (
        <div>
          <dt>Nose accuracy</dt>
          <dd>{Math.round(stats.identificationAccuracy)}</dd>
          <small>mean score on a real smell</small>
        </div>
      )}
    </dl>
  );
}

function SessionLogView({ onBack }: { onBack: () => void }) {
  const { log } = useSessions();
  const sessions = [...log.sessions].reverse();

  return (
    <section className="golf ph-setup">
      <h2>Session log</h2>
      {sessions.length === 0 ? (
        <p className="golf-lede">No physical sessions logged yet.</p>
      ) : (
        <>
          <p className="golf-lede">
            {log.sessionsLogged} session{log.sessionsLogged === 1 ? '' : 's'} logged
            {log.sessionsLogged > sessions.length && (
              <> · showing the most recent {sessions.length}</>
            )}
            .
          </p>
          <ul className="ph-sessions">
            {sessions.map((session) => (
              <li key={session.id}>
                <div className="ph-session-head">
                  <strong>{KIND_LABEL[session.detail.kind]}</strong>
                  <span>{dateOf(session.at)}</span>
                </div>
                <p className="ph-session-line">{headline(session)}</p>
                {session.detail.kind === 'cupping' && (
                  <ul className="ph-session-bowls">
                    {session.detail.samples.map((sample) => (
                      <li key={sample.code}>
                        <span className="ph-code">{sample.code}</span>
                        <span>{sample.name.trim() === '' ? 'unnamed' : sample.name}</span>
                        <span className="ph-descriptors">
                          {sample.descriptorIds.map((id) => getNode(WHEEL, id).label).join(', ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {session.durationSec > 0 && (
                  <small className="ph-session-time">{formatClock(session.durationSec)}</small>
                )}
                {session.note.trim() !== '' && <p className="ph-session-note">{session.note}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="golf-actions">
        <button type="button" className="is-quiet" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}

export function PhysicalTrack() {
  const [mode, setMode] = useState<Mode>('menu');
  const back = () => setMode('menu');

  if (mode === 'cupping') return <CuppingSession onBack={back} />;
  if (mode === 'triangulation') return <TriangulationSession onBack={back} />;
  if (mode === 'homework') return <ReferenceHomework onBack={back} />;
  if (mode === 'aroma-kit') return <AromaKitDrill onBack={back} />;
  if (mode === 'log') return <SessionLogView onBack={back} />;

  return (
    <section className="golf ph-menu">
      <h2>Coffee in hand</h2>
      <p className="golf-lede">
        An app cannot taste for you. What it can do is structure the session, time it, blind it, and
        log it — and keep the record of what your nose did separate from the record of what you know.
      </p>

      <PalateMeter />

      <ul className="ph-modes">
        <li>
          <button type="button" onClick={() => setMode('cupping')}>
            <strong>Cupping session</strong>
            <span>
              The SCA protocol on a clock: 4:00 crust break, skim, three cooling passes. Logs the
              bowls. No scores — the cupping form is M5.
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => setMode('triangulation')}>
            <strong>Triangulation</strong>
            <span>
              Three bowls, one different. Coded bases, shuffled positions. Right one time in three by
              luck, and measured against exactly that.
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => setMode('homework')}>
            <strong>Reference Homework</strong>
            <span>
              Five real things to go and smell, drawn from what you keep missing on screen. The quiz
              comes three days later.
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => setMode('aroma-kit')}>
            <strong>Aroma kit</strong>
            <span>
              Draw a vial without looking, name it, then read the number. The only drill here whose
              blinding needs no trust.
            </span>
          </button>
        </li>
        <li>
          <button type="button" onClick={() => setMode('log')}>
            <strong>Session log</strong>
            <span>Every session, what was in the bowls, and what your nose got right.</span>
          </button>
        </li>
      </ul>
    </section>
  );
}
