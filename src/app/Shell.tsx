import { useCallback, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { ATTRIBUTES } from '../domain/attributes.js';
import { WHEEL, getNode } from '../domain/wheel.js';
import { BELTS } from '../game/belts.js';
import { bestVsPar, currentBelt, earnedBeltIds, unlockedBeltIds } from '../game/beltProgress.js';
import { clueCandidates } from '../game/round.js';
import { DefectLab } from '../game/DefectLab.js';
import { CauseEffect } from '../game/CauseEffect.js';
import { PhysicalTrack } from '../session/PhysicalTrack.js';
import { PalateProfile } from '../progress/PalateProfile.js';
import { dayKey } from '../progress/store.js';
import type { Progress } from '../progress/types.js';
import { useProgress } from '../progress/useProgress.js';
import { FlavorWheel } from '../ui/FlavorWheel.js';
import { GolfGame, fmtVsPar } from './GolfGame.js';
import { CloseIcon, FlagIcon, PersonIcon, WheelIcon } from './icons.js';
import './organic.css';
import './shell.css';

type Tab = 'wheel' | 'play' | 'profile';

type Screen =
  | { readonly kind: 'tab'; readonly tab: Tab }
  | { readonly kind: 'game'; readonly beltId: string; readonly key: number }
  | { readonly kind: 'drill'; readonly drill: number };

interface Drill {
  readonly name: string;
  readonly short: string;
  readonly desc: string;
  /** Category whose hue marks the tile. */
  readonly categoryId: string;
  /** Null for a drill that is designed but not built; its tile opens a sheet that says so. */
  readonly render: (() => ReactElement) | null;
}

const DRILLS: readonly Drill[] = [
  {
    name: 'Defect Lab',
    short: 'Flag taints and faults',
    desc: 'The taints and faults a Q Grader has to catch and name on the form.',
    categoryId: 'other',
    render: () => <DefectLab />,
  },
  {
    name: 'Cause & Effect',
    short: 'Process and roast to flavour',
    desc: 'Link processing, roast degree and extraction to where a cup tends to land on the wheel.',
    categoryId: 'roasted',
    render: () => <CauseEffect />,
  },
  {
    name: 'Coffee in hand',
    short: 'Cup, smell and log',
    desc: 'The physical track: cupping sessions, triangulation, aroma kit and reference homework.',
    categoryId: 'nutty-cocoa',
    render: () => <PhysicalTrack />,
  },
  {
    name: 'Aroma flashcards',
    short: 'Spaced repetition',
    desc: 'Short daily card sets for the descriptors, spaced by how often you miss each one in Descriptor Golf.',
    categoryId: 'floral',
    render: null,
  },
];

const catVar = (categoryId: string): CSSProperties =>
  ({ '--cat': getNode(WHEEL, categoryId).color }) as CSSProperties;

/**
 * The stored streak only moves when a round is recorded, so on a day with no play it still shows
 * the old run. A streak whose last day is before yesterday is already broken; show it as zero.
 */
function liveStreak(progress: Progress, now = Date.now()): number {
  const { lastDay, current } = progress.streak;
  if (lastDay === null) return 0;
  return lastDay === dayKey(now) || lastDay === dayKey(now - 86_400_000) ? current : 0;
}

/** A clue for the day, stable across reloads: the same date always draws the same attribute. */
function dailyClue(beltId: string, now = Date.now()): string {
  const pool = clueCandidates(BELTS.find((b) => b.id === beltId)!).sort();
  const [y, m, d] = dayKey(now).split('-').map(Number);
  const dayNumber = Math.floor(Date.UTC(y!, m! - 1, d!) / 86_400_000);
  return ATTRIBUTES.byNode.get(pool[dayNumber % pool.length]!)!.definition.beginner;
}

export function Shell() {
  const [screen, setScreen] = useState<Screen>({ kind: 'tab', tab: 'wheel' });
  const [sheet, setSheet] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { progress, commitRound } = useProgress();

  const unlocked = useMemo(() => unlockedBeltIds(progress.rounds), [progress.rounds]);
  const belt = useMemo(() => currentBelt(progress.rounds), [progress.rounds]);
  const beltNo = BELTS.indexOf(belt) + 1;
  const streak = liveStreak(progress);

  const go = useCallback((next: Screen) => {
    setScreen(next);
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);
  const play = useCallback(
    (beltId: string) => go({ kind: 'game', beltId, key: Date.now() }),
    [go],
  );

  const activeTab: Tab | null =
    screen.kind === 'tab' ? screen.tab : screen.kind === 'game' ? 'play' : null;

  return (
    <div className="cq-page">
      <div className={screen.kind === 'drill' ? 'cq is-wide' : 'cq'}>
        <div className="cq-scroll" ref={scrollRef}>
          {screen.kind === 'tab' && screen.tab === 'wheel' && (
            <WheelTab
              streak={streak}
              beltNo={beltNo}
              beltLabel={belt.label}
              clue={dailyClue(belt.id)}
              onPlay={() => play(belt.id)}
            />
          )}
          {screen.kind === 'tab' && screen.tab === 'play' && (
            <PlayTab
              progress={progress}
              unlocked={unlocked}
              currentId={belt.id}
              onPlay={play}
              onDrill={(i) => (DRILLS[i]!.render ? go({ kind: 'drill', drill: i }) : setSheet(i))}
            />
          )}
          {screen.kind === 'tab' && screen.tab === 'profile' && (
            <ProfileTab progress={progress} streak={streak} />
          )}
          {screen.kind === 'game' && (
            <GolfGame
              key={screen.key}
              beltId={screen.beltId}
              progress={progress}
              commitRound={commitRound}
              unlocked={unlocked}
              onQuit={() => go({ kind: 'tab', tab: 'play' })}
              onPlay={play}
            />
          )}
          {screen.kind === 'drill' && (
            <div className="cq-drill-screen">
              <div className="cq-game-head">
                <button
                  type="button"
                  className="cq-icon-btn"
                  onClick={() => go({ kind: 'tab', tab: 'play' })}
                  aria-label="Back to Play"
                >
                  <CloseIcon />
                </button>
                <div className="cq-game-title">
                  <div className="cq-kicker">More drills</div>
                  <div className="cq-game-big">{DRILLS[screen.drill]!.name}</div>
                </div>
              </div>
              <div className="cq-drill-body">{DRILLS[screen.drill]!.render?.()}</div>
            </div>
          )}
        </div>

        {screen.kind !== 'game' && (
          <nav className="cq-tabs" aria-label="Main">
            <TabButton label="Wheel" icon={<WheelIcon />} on={activeTab === 'wheel'} onClick={() => go({ kind: 'tab', tab: 'wheel' })} />
            <TabButton label="Play" icon={<FlagIcon />} on={activeTab === 'play'} onClick={() => go({ kind: 'tab', tab: 'play' })} />
            <TabButton label="Profile" icon={<PersonIcon />} on={activeTab === 'profile'} onClick={() => go({ kind: 'tab', tab: 'profile' })} />
          </nav>
        )}

        {sheet !== null && (
          <>
            <div className="cq-scrim" onClick={() => setSheet(null)} />
            <div className="cq-sheet" role="dialog" aria-modal="true" aria-label={DRILLS[sheet]!.name}>
              <div className="cq-sheet-grip" />
              <div className="cq-drill-dot" style={catVar(DRILLS[sheet]!.categoryId)} />
              <div className="cq-sheet-title">{DRILLS[sheet]!.name}</div>
              <p className="cq-lede" style={{ margin: 0 }}>{DRILLS[sheet]!.desc}</p>
              <div className="cq-chip is-accent-2">Not built yet</div>
              <button type="button" className="cq-btn cq-btn-secondary" onClick={() => setSheet(null)}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TabButton(props: { label: string; icon: ReactElement; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="cq-tab"
      aria-current={props.on ? 'page' : undefined}
      onClick={props.onClick}
    >
      {props.icon}
      {props.label}
    </button>
  );
}

/* ─── Wheel ─────────────────────────────────────────────────────────────────── */

function WheelTab(props: {
  streak: number;
  beltNo: number;
  beltLabel: string;
  clue: string;
  onPlay: () => void;
}) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The wheel is the navigation: tapping a category zooms into it, the hub zooms back out.
  const select = (id: string | null) => {
    setSelectedId(id);
    if (id !== null && focusId === null && getNode(WHEEL, id).ring === 1) setFocusId(id);
  };
  const changeFocus = (id: string | null) => {
    // The panel below lists a category's groups, so zoom stops at ring 1 here; the game goes deeper.
    if (id !== null && getNode(WHEEL, id).ring !== 1) return;
    setFocusId(id);
    setSelectedId(id);
  };

  const focus = focusId === null ? null : getNode(WHEEL, focusId);
  const selected = selectedId === null ? null : getNode(WHEEL, selectedId);
  const record = selectedId === null ? undefined : ATTRIBUTES.byNode.get(selectedId);
  const toggle = (id: string) => setSelectedId(selectedId === id ? focusId : id);

  return (
    <div className="cq-screen" style={{ gap: 18 }}>
      <div className="cq-topbar">
        <div className="cq-brand">Coffee Q Trainer</div>
        <div className="cq-chips">
          <div className="cq-chip is-accent">{props.streak}-day streak</div>
          <div className="cq-chip is-accent-2">Belt {props.beltNo}</div>
        </div>
      </div>

      <div className="cq-wheel">
        <FlavorWheel
          wheel={WHEEL}
          focusId={focusId}
          onFocusChange={changeFocus}
          selectedId={selectedId}
          onSelect={select}
        />
      </div>

      {focus === null ? (
        <div className="cq-section" style={{ gap: 14 }}>
          <p className="cq-muted">Tap a category to zoom in. Tap the centre to come back out.</p>
          <div className="cq-daily">
            <div className="cq-daily-head">
              <div className="cq-kicker">Today's clue</div>
              <div className="cq-daily-meta">
                Belt {props.beltNo} · {props.beltLabel}
              </div>
            </div>
            <p className="cq-quote">“{props.clue}”</p>
            <button type="button" className="cq-btn cq-btn-primary cq-btn-sm" onClick={props.onPlay}>
              Play today's nine
            </button>
          </div>
        </div>
      ) : (
        <div className="cq-section cq-fade" key={`panel-${focus.id}`} style={{ gap: 12 }}>
          <div className="cq-cat-head">
            <div className="cq-cat-name">{focus.label}</div>
            <div className="cq-muted" style={{ fontSize: 13 }}>
              {focus.childIds.length} groups · {focus.leafCount} descriptors
            </div>
          </div>
          <div className="cq-groups" style={catVar(focus.categoryId)}>
            {focus.childIds.map((gid) => {
              const group = getNode(WHEEL, gid);
              const on = selectedId === gid;
              return (
                <div key={gid} className={on ? 'cq-group is-on' : 'cq-group'}>
                  <button type="button" className="cq-group-head" onClick={() => toggle(gid)} aria-pressed={on}>
                    <span className="cq-dot" />
                    <span className="cq-group-name">{group.label}</span>
                    <span className="cq-group-meta">
                      {group.childIds.length > 0 ? group.childIds.length : 'Group only'}
                    </span>
                  </button>
                  {group.childIds.length > 0 && (
                    <div className="cq-desc-chips">
                      {group.childIds.map((did) => (
                        <button
                          type="button"
                          key={did}
                          className={selectedId === did ? 'cq-desc-chip is-on' : 'cq-desc-chip'}
                          onClick={() => toggle(did)}
                          aria-pressed={selectedId === did}
                        >
                          {getNode(WHEEL, did).label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected !== null && record !== undefined && (
        <div className="cq-card cq-detail cq-fade" key={`detail-${selected.id}`}>
          <div className="cq-detail-name">{selected.label}</div>
          <p>{record.definition.beginner}</p>
          <p className="cq-provisional">
            {record.reviewedBy.length > 0
              ? `Reviewed by ${record.reviewedBy.join(', ')}.`
              : 'Provisional — not yet reviewed by a Q grader.'}
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Play ──────────────────────────────────────────────────────────────────── */

function PlayTab(props: {
  progress: Progress;
  unlocked: ReadonlySet<string>;
  currentId: string;
  onPlay: (beltId: string) => void;
  onDrill: (index: number) => void;
}) {
  const best = bestVsPar(props.progress.rounds);
  const earned = earnedBeltIds(props.progress.rounds);

  return (
    <div className="cq-screen">
      <div>
        <h1 className="cq-h1">Descriptor Golf</h1>
        <p className="cq-lede">
          Nine holes. Read the description, then commit to a point on the wheel. Landing next door
          scores more than retreating to the category — the game rewards committing.
        </p>
      </div>

      <div className="cq-belts">
        {BELTS.map((b, i) => {
          const open = props.unlocked.has(b.id);
          const score = best.get(b.id);
          const status = !open
            ? 'Locked'
            : earned.has(b.id) && score !== undefined
              ? `Best ${fmtVsPar(score)} · Earned`
              : score !== undefined
                ? `Best ${fmtVsPar(score)}`
                : 'New';
          return (
            <button
              type="button"
              key={b.id}
              className={[
                'cq-belt',
                b.id === props.currentId ? 'is-current' : '',
                earned.has(b.id) ? 'is-earned' : '',
                open ? '' : 'is-locked',
              ].join(' ')}
              onClick={open ? () => props.onPlay(b.id) : undefined}
              aria-disabled={!open}
            >
              <div className="cq-belt-badge">{i + 1}</div>
              <div className="cq-belt-body">
                <div className="cq-belt-top">
                  <div className="cq-belt-name">{b.label}</div>
                  <div className="cq-belt-status">{status}</div>
                </div>
                <div className="cq-belt-desc">
                  {open ? b.blurb : `Finish ${BELTS[i - 1]!.label} at par or better to unlock.`}
                </div>
                <div className="cq-belt-meta">
                  {b.holes} holes · answer at ring {b.targetRing}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="cq-section">
        <h2 className="cq-h2">More drills</h2>
        <div className="cq-drills">
          {DRILLS.map((d, i) => (
            <button type="button" key={d.name} className="cq-drill" onClick={() => props.onDrill(i)}>
              <div className="cq-drill-dot" style={catVar(d.categoryId)} />
              <div className="cq-drill-name">{d.name}</div>
              <div className="cq-drill-short">{d.short}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Profile ───────────────────────────────────────────────────────────────── */

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function ProfileTab({ progress, streak }: { progress: Progress; streak: number }) {
  const week = useMemo(() => {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const played = new Set(progress.rounds.map((r) => dayKey(r.at)));
    if (progress.streak.lastDay) played.add(progress.streak.lastDay);
    const today = dayKey(now.getTime());
    return WEEKDAYS.map((d, i) => {
      const key = dayKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i).getTime());
      return { d, key, played: played.has(key), today: key === today };
    });
  }, [progress.rounds, progress.streak.lastDay]);

  return (
    <div className="cq-screen">
      <div>
        <h1 className="cq-h1">Palate Profile</h1>
        <p className="cq-muted" style={{ marginTop: 4 }}>
          Average score by category, all rounds
        </p>
      </div>

      <div className="cq-card cq-bars">
        {WHEEL.categoryOrder.map((id) => {
          const stat = progress.categories[id];
          const pct = stat && stat.attempts > 0 ? Math.round(stat.scoreSum / stat.attempts) : null;
          return (
            <div key={id} className="cq-bar-row" style={catVar(id)}>
              <div className="cq-bar-name">
                <i className="cq-dot" />
                <span>{getNode(WHEEL, id).label}</span>
              </div>
              <div className="cq-bar-track">
                <div className="cq-bar-fill" style={{ width: `${pct ?? 0}%` }} />
              </div>
              <div className="cq-bar-pct">{pct === null ? '—' : `${pct}%`}</div>
            </div>
          );
        })}
      </div>

      <div className="cq-section">
        <div className="cq-section-head">
          <h2 className="cq-h2">This week</h2>
          <div className="cq-muted" style={{ fontSize: 13 }}>
            {streak}-day streak
          </div>
        </div>
        <div className="cq-week">
          {week.map((w) => (
            <div
              key={w.key}
              className={['cq-day', w.played ? 'is-played' : '', w.today ? 'is-today' : ''].join(' ')}
              aria-label={`${w.key}${w.played ? ', played' : ''}`}
            >
              <i />
              {w.d}
            </div>
          ))}
        </div>
      </div>

      <div className="cq-card cq-embedded">
        <PalateProfile />
      </div>
    </div>
  );
}
