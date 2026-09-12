import { useMemo, useState } from 'react';
import { CONFUSABLES, WHEEL, ancestorsOf, getNode } from '../domain/wheel.js';
import { scoreAnswer } from '../domain/scoring.js';
import { ATTRIBUTES } from '../domain/attributes.js';
import type { AttributeRecord } from '../domain/schema.js';
import { FlavorWheel } from '../ui/FlavorWheel.js';
import { DescriptorGolf } from '../game/DescriptorGolf.js';
import { DefectLab } from '../game/DefectLab.js';
import { CauseEffect } from '../game/CauseEffect.js';
import { PalateProfile } from '../progress/PalateProfile.js';
import './app.css';

const MODALITY_LABEL: Record<AttributeRecord['modality'][number], string> = {
  aroma: 'Aroma',
  flavor: 'Flavour',
  'basic-taste': 'Basic taste',
  mouthfeel: 'Mouthfeel',
};

/**
 * Wheel Walk detail: the attribute record hung on a taxonomy node - definition in both registers,
 * how it reaches you, and what in the chain from farm to cup produces it. References carry an
 * intensity anchor only once a panel has measured one against a physical kit, so they are usually
 * absent (schema note in schema.ts). Everything here is `provisional` until a Q grader signs the
 * record - STRATEGY.md KR3.1 - and the panel says so rather than hiding it.
 */
function AttributeDetail({ record }: { record: AttributeRecord }) {
  const reviewed = record.reviewedBy.length > 0;
  return (
    <>
      <p className={reviewed ? 'app-review is-reviewed' : 'app-review'}>
        {reviewed
          ? `Reviewed by ${record.reviewedBy.join(', ')}.`
          : 'Provisional — not yet reviewed by a Q grader.'}
      </p>

      <h3>Definition</h3>
      <p className="app-def">{record.definition.beginner}</p>
      <details className="app-expert">
        <summary>Q-candidate register</summary>
        <p>{record.definition.expert}</p>
      </details>

      <h3>How you sense it</h3>
      <ul className="app-tags">
        {record.modality.map((m) => (
          <li key={m}>{MODALITY_LABEL[m]}</li>
        ))}
      </ul>

      {record.references && record.references.length > 0 && (
        <>
          <h3>Reference standards</h3>
          <ul className="app-refs">
            {record.references.map((ref) => (
              <li key={ref.name}>
                <strong>{ref.name}</strong>
                {ref.intensity !== undefined && (
                  <span className="app-ref-anchor"> · intensity {ref.intensity} / 15</span>
                )}
                <p>{ref.prep}</p>
                <small>{ref.regions.join(', ')}</small>
              </li>
            ))}
          </ul>
        </>
      )}

      {record.causes.length > 0 && (
        <>
          <h3>What produces it</h3>
          <ul className="app-causes">
            {record.causes.map((cause, i) => {
              const chips = [
                ...(cause.origin ?? []),
                ...(cause.process ?? []),
                ...(cause.roast ?? []),
              ];
              return (
                <li key={i}>
                  <p>{cause.note}</p>
                  {chips.length > 0 && (
                    <ul className="app-tags">
                      {chips.map((chip) => (
                        <li key={chip}>{chip}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}

/**
 * A harness for looking at the wheel and reviewing content, not a product screen. The browse panel
 * is an early Wheel Walk: it shows each node's attribute record - both definition registers,
 * modality, causes, and the curated confusions - so the content set can be read and checked without
 * playing a round.
 */
export function App() {
  const [mode, setMode] = useState<'golf' | 'defects' | 'cause-effect' | 'browse' | 'profile'>('golf');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = selectedId === null ? null : getNode(WHEEL, selectedId);
  const record = selectedId === null ? undefined : ATTRIBUTES.byNode.get(selectedId);
  const trail = selectedId === null ? [] : [...ancestorsOf(WHEEL, selectedId), getNode(WHEEL, selectedId)];

  const confusions = useMemo(() => {
    if (selectedId === null) return [];
    const entries = CONFUSABLES.byNode.get(selectedId);
    if (!entries) return [];
    return [...entries.entries()]
      .map(([partnerId, pair]) => ({
        partner: getNode(WHEEL, partnerId),
        note: pair.note,
        result: scoreAnswer(WHEEL, CONFUSABLES, partnerId, selectedId),
      }))
      .sort((a, b) => b.result.score - a.result.score);
  }, [selectedId]);

  return (
    <main className="app">
      <header className="app-header">
        <h1>Coffee Q Trainer</h1>
        <nav className="app-modes">
          <button
            type="button"
            className={mode === 'golf' ? 'is-active' : ''}
            onClick={() => setMode('golf')}
          >
            Descriptor Golf
          </button>
          <button
            type="button"
            className={mode === 'defects' ? 'is-active' : ''}
            onClick={() => setMode('defects')}
          >
            Defect Lab
          </button>
          <button
            type="button"
            className={mode === 'cause-effect' ? 'is-active' : ''}
            onClick={() => setMode('cause-effect')}
          >
            Cause &amp; Effect
          </button>
          <button
            type="button"
            className={mode === 'browse' ? 'is-active' : ''}
            onClick={() => setMode('browse')}
          >
            Browse the wheel
          </button>
          <button
            type="button"
            className={mode === 'profile' ? 'is-active' : ''}
            onClick={() => setMode('profile')}
          >
            Palate Profile
          </button>
        </nav>
        {mode === 'browse' && (
          <p>
            Click a wedge to inspect it, double-click or press Enter to zoom in, click the hub or
            press Escape to go back. Arrow keys walk the tree.
          </p>
        )}
      </header>

      {mode === 'golf' && <DescriptorGolf />}

      {mode === 'defects' && <DefectLab />}

      {mode === 'cause-effect' && <CauseEffect />}

      {mode === 'profile' && <PalateProfile />}

      {mode === 'browse' && (
      <div className="app-body">
        <div className="app-wheel">
          <FlavorWheel
            wheel={WHEEL}
            focusId={focusId}
            onFocusChange={setFocusId}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        <aside className="app-panel">
          {selected === null ? (
            <p className="app-empty">
              Nothing selected. {WHEEL.nodes.size} attributes across {WHEEL.categoryOrder.length}{' '}
              categories.
            </p>
          ) : (
            <>
              <nav className="app-trail" aria-label="Path through the wheel">
                {trail.map((node, i) => (
                  <span key={node.id}>
                    {i > 0 && <span aria-hidden="true"> › </span>}
                    <button type="button" onClick={() => setSelectedId(node.id)}>
                      {node.label}
                    </button>
                  </span>
                ))}
              </nav>

              <h2>{selected.label}</h2>
              <dl className="app-facts">
                <div>
                  <dt>Ring</dt>
                  <dd>{selected.ring}</dd>
                </div>
                <div>
                  <dt>Attributes below</dt>
                  <dd>{selected.childIds.length === 0 ? 'terminal' : selected.leafCount}</dd>
                </div>
                <div>
                  <dt>Fault</dt>
                  <dd>
                    {selected.defect === true
                      ? 'yes'
                      : selected.defect === 'contextual'
                        ? 'context-dependent'
                        : 'no'}
                  </dd>
                </div>
                <div>
                  <dt>Id</dt>
                  <dd>
                    <code>{selected.id}</code>
                  </dd>
                </div>
              </dl>

              {record === undefined ? (
                <p className="app-todo">No attribute record for this node.</p>
              ) : (
                <AttributeDetail record={record} />
              )}

              <h3>Confused with</h3>
              {confusions.length === 0 ? (
                <p className="app-empty">
                  No curated confusions. The tree alone decides partial credit here.
                </p>
              ) : (
                <ul className="app-confusions">
                  {confusions.map(({ partner, note, result }) => (
                    <li key={partner.id}>
                      <div className="app-confusion-head">
                        <strong>{partner.label}</strong>
                        <span className="app-score" title="Score if a player answers this instead">
                          {result.score}
                          <small> / {result.baseScore} from the tree alone</small>
                        </span>
                      </div>
                      <p>{note}</p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </aside>
      </div>
      )}
    </main>
  );
}
