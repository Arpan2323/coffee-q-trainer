import { useMemo } from 'react';
import { WHEEL } from '../domain/wheel.js';
import { palateProfile, topConfusions } from './store.js';
import { useProgress } from './useProgress.js';
import './profile.css';

/**
 * The Palate Profile from PLAN.md section 3.4. Four axes are honestly computable from screen play -
 * Breadth, Specificity, Accuracy, Coverage (folded here into a Commitment axis and a Coverage axis
 * so every spoke reads "further out is better"). Precision and Consensus need a re-served sample and
 * a panel; they are named as missing rather than estimated, the same way attribute records leave
 * out an intensity anchor nobody has measured.
 */

const RADAR_SIZE = 240;
const RADAR_R = 96;
const CENTER = RADAR_SIZE / 2;

/** Point on a spoke `i` of `n`, `value` in 0-1, starting at 12 o'clock and going clockwise. */
function spoke(i: number, n: number, value: number, radius = RADAR_R): [number, number] {
  const angle = -Math.PI / 2 + (i / n) * 2 * Math.PI;
  return [CENTER + Math.cos(angle) * radius * value, CENTER + Math.sin(angle) * radius * value];
}

const polygon = (values: number[]): string =>
  values.map((v, i) => spoke(i, values.length, v).join(',')).join(' ');

export function PalateProfile() {
  const { progress } = useProgress();
  const profile = useMemo(() => palateProfile(progress, WHEEL), [progress]);
  const confusions = useMemo(() => topConfusions(progress, 8, WHEEL), [progress]);

  if (profile.answered === 0) {
    return (
      <section className="profile profile-empty">
        <h2>Palate Profile</h2>
        <p>
          Play a round of Descriptor Golf and this fills in: which descriptors you reach for, how
          specific you commit, how close you land, and which of the nine categories you are still
          blind to.
        </p>
      </section>
    );
  }

  const total = WHEEL.nodes.size;
  const covered = Math.round(profile.coverage * profile.perCategory.length);

  // `value` (0-1) drives the radar so every spoke shares a scale; `display` is the axis in its own
  // natural units, because "18" under Breadth when you have used 20 descriptors is just wrong.
  const axes = [
    {
      key: 'breadth',
      label: 'Breadth',
      value: profile.breadthFraction,
      display: `${profile.breadth}`,
      detail: `of ${total} descriptors used`,
    },
    {
      key: 'specificity',
      label: 'Specificity',
      value: profile.specificity / 3,
      display: profile.specificity.toFixed(1),
      detail: 'mean ring committed to, of 3',
    },
    {
      key: 'accuracy',
      label: 'Accuracy',
      value: profile.accuracy / 100,
      display: `${Math.round(profile.accuracy)}`,
      detail: 'mean score, of 100',
    },
    {
      key: 'commitment',
      label: 'Commitment',
      value: profile.commitment,
      display: `${Math.round(profile.commitment * 100)}%`,
      detail: `${Math.round(profile.hedgeRate * 100)}% of answers hedged`,
    },
    {
      key: 'coverage',
      label: 'Coverage',
      value: profile.coverage,
      display: `${covered}/${profile.perCategory.length}`,
      detail: 'categories past the accuracy floor',
    },
  ];

  return (
    <section className="profile">
      <h2>Palate Profile</h2>
      <p className="profile-lede">
        {profile.answered} answers scored. Precision and Consensus stay blank until the physical
        track — a re-served sample proves repeatability, a panel gives consensus.
      </p>

      <div className="profile-radar-row">
        <svg
          className="profile-radar"
          viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
          role="img"
          aria-label={axes.map((a) => `${a.label} ${Math.round(a.value * 100)}%`).join(', ')}
        >
          {[0.25, 0.5, 0.75, 1].map((r) => (
            <polygon
              key={r}
              className="profile-radar-grid"
              points={polygon(axes.map(() => r))}
            />
          ))}
          {axes.map((a, i) => {
            const [x, y] = spoke(i, axes.length, 1);
            return <line key={a.key} className="profile-radar-spoke" x1={CENTER} y1={CENTER} x2={x} y2={y} />;
          })}
          <polygon className="profile-radar-plot" points={polygon(axes.map((a) => Math.max(a.value, 0.01)))} />
          {axes.map((a, i) => {
            const [x, y] = spoke(i, axes.length, 1.28);
            return (
              <text key={a.key} className="profile-radar-label" x={x} y={y} dy="0.32em">
                {a.label}
              </text>
            );
          })}
        </svg>

        <dl className="profile-axes">
          {axes.map((a) => (
            <div key={a.key}>
              <dt>{a.label}</dt>
              <dd>{a.display}</dd>
              <small>{a.detail}</small>
            </div>
          ))}
        </dl>
      </div>

      <h3>Coverage by category</h3>
      {profile.blindSectors.length > 0 && (
        <p className="profile-blind">
          Still blind to <strong>{profile.blindSectors.join(', ')}</strong> — either untouched or
          landing no better than the category.
        </p>
      )}
      <ul className="profile-coverage">
        {profile.perCategory.map((c) => (
          <li key={c.categoryId} className={c.blind ? 'is-blind' : c.weak ? 'is-weak' : ''}>
            <span className="profile-cov-label">{c.label}</span>
            <span className="profile-cov-track">
              <span
                className="profile-cov-fill"
                style={{ width: `${c.accuracy}%`, background: c.color }}
              />
            </span>
            <span className="profile-cov-value">
              {c.blind ? 'unseen' : `${Math.round(c.accuracy)} · ${c.attempts}×`}
            </span>
          </li>
        ))}
      </ul>

      <h3>Confused with</h3>
      {confusions.length === 0 ? (
        <p className="profile-empty-note">No repeated misses yet.</p>
      ) : (
        <ul className="profile-confusions">
          {confusions.map((c) => (
            <li key={`${c.targetId}>${c.answerId}`}>
              <span>
                Said <strong>{c.answerLabel}</strong> for <strong>{c.targetLabel}</strong>
              </span>
              <span className="profile-conf-count">
                {c.count}×
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
