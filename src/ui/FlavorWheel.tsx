import { useCallback, useMemo, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { Wheel } from '../domain/types.js';
import { getNode } from '../domain/wheel.js';
import {
  HUB_RADIUS,
  OUTER_RADIUS,
  LABEL_PADDING,
  annularSectorPath,
  arcPath,
  fitLabel,
  fitText,
  layoutWheel,
  occupiedRings,
  radialLabel,
  ringRadii,
  type WedgeLayout,
} from './geometry.js';
import './wheel.css';

const VIEW = OUTER_RADIUS + 20;
const FONT_SIZE: Record<number, number> = { 1: 13, 2: 10, 3: 8.5 };
/**
 * Floors, not preferences. A long ring-2 name like "Sweet Aromatics" in a single-attribute wedge
 * has nowhere to stack, so it shrinks to 7px rather than losing its ending - and zooming into the
 * category redraws it at full size, which is what zoom is for.
 */
const FONT_MIN: Record<number, number> = { 1: 8, 2: 7, 3: 7 };
/** Ring fills share one hue per category and separate by opacity, so both themes work unmodified. */
const FILL_OPACITY: Record<number, number> = { 1: 0.95, 2: 0.68, 3: 0.42 };

export interface FlavorWheelProps {
  readonly wheel: Wheel;
  /** Node whose subtree fills the circle. Null shows all nine categories. */
  readonly focusId: string | null;
  readonly onFocusChange: (id: string | null) => void;
  readonly selectedId: string | null;
  readonly onSelect: (id: string | null) => void;
  /** Marks the correct answer once a hole is revealed, so the error path is visible on the wheel. */
  readonly revealId?: string | null;
}

interface Placed extends WedgeLayout {
  readonly rInner: number;
  readonly rOuter: number;
  readonly d: string;
}

export function FlavorWheel({
  wheel,
  focusId,
  onFocusChange,
  selectedId,
  onSelect,
  revealId = null,
}: FlavorWheelProps) {
  const groupRefs = useRef(new Map<string, SVGGElement | null>());

  const placed = useMemo<Placed[]>(() => {
    const layout = layoutWheel(wheel, focusId);
    const radii = ringRadii(occupiedRings(layout));
    return layout.flatMap((wedge) => {
      const ring = radii[wedge.displayRing - 1];
      if (!ring) return [];
      return [
        {
          ...wedge,
          rInner: ring.rInner,
          rOuter: ring.rOuter,
          d: annularSectorPath(0, 0, ring.rInner, ring.rOuter, wedge.start, wedge.end),
        },
      ];
    });
  }, [wheel, focusId]);

  // Both the answer and the revealed target stay lit, so a wrong answer shows how far off it was
  // rather than simply vanishing.
  const litPath = useMemo(() => {
    const ids = new Set<string>();
    for (const start of [selectedId, revealId]) {
      let current = start;
      while (current) {
        ids.add(current);
        current = getNode(wheel, current).parentId;
      }
    }
    return ids;
  }, [wheel, selectedId, revealId]);

  /** The node the roving tabindex currently sits on. */
  const activeId = useMemo(() => {
    if (selectedId && placed.some((p) => p.node.id === selectedId)) return selectedId;
    return placed.find((p) => p.displayRing === 1)?.node.id ?? null;
  }, [placed, selectedId]);

  const moveTo = useCallback(
    (id: string | undefined) => {
      if (!id) return;
      onSelect(id);
      // The DOM node exists already; focus after paint so the roving tabindex has settled.
      requestAnimationFrame(() => groupRefs.current.get(id)?.focus());
    },
    [onSelect],
  );

  const zoomOut = useCallback(() => {
    if (focusId === null) return;
    onFocusChange(getNode(wheel, focusId).parentId);
  }, [focusId, onFocusChange, wheel]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<SVGSVGElement>) => {
      if (!activeId) return;
      const current = placed.find((p) => p.node.id === activeId);
      if (!current) return;

      const sameRing = placed
        .filter((p) => p.displayRing === current.displayRing)
        .sort((a, b) => a.start - b.start);
      const index = sameRing.findIndex((p) => p.node.id === activeId);

      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault();
          moveTo(sameRing[(index + 1) % sameRing.length]?.node.id);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          moveTo(sameRing[(index - 1 + sameRing.length) % sameRing.length]?.node.id);
          break;
        case 'ArrowDown': {
          event.preventDefault();
          const child = current.node.childIds.find((id) => placed.some((p) => p.node.id === id));
          moveTo(child);
          break;
        }
        case 'ArrowUp': {
          event.preventDefault();
          const parentId = current.node.parentId;
          if (parentId && placed.some((p) => p.node.id === parentId)) moveTo(parentId);
          break;
        }
        case 'Enter':
          event.preventDefault();
          if (current.node.childIds.length > 0) onFocusChange(current.node.id);
          break;
        case 'Escape':
        case 'Backspace':
          event.preventDefault();
          zoomOut();
          break;
        default:
          break;
      }
    },
    [activeId, placed, moveTo, onFocusChange, zoomOut],
  );

  const focusNode = focusId === null ? null : getNode(wheel, focusId);

  return (
    <svg
      className="flavor-wheel"
      viewBox={`${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`}
      role="tree"
      aria-label="Coffee flavour wheel"
      onKeyDown={handleKeyDown}
    >
      <g
        className="wheel-hub"
        role="button"
        tabIndex={0}
        aria-label={focusNode ? `Zoom out of ${focusNode.label}` : 'Whole wheel'}
        aria-disabled={focusNode === null}
        onClick={zoomOut}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            zoomOut();
          }
        }}
      >
        <circle r={HUB_RADIUS - 4} />
        <text className="wheel-hub-label" y={focusNode ? -4 : 4}>
          {focusNode ? fitText(focusNode.label, HUB_RADIUS * 1.7, 13) : 'Flavour'}
        </text>
        {focusNode ? (
          <text className="wheel-hub-hint" y={14}>
            back
          </text>
        ) : (
          <text className="wheel-hub-label" y={20}>
            Wheel
          </text>
        )}
      </g>

      {placed.map((wedge) => {
        const { node, displayRing } = wedge;
        const baseFont = FONT_SIZE[displayRing] ?? 9;
        const isSelected = node.id === selectedId;
        const onPath = litPath.has(node.id);
        const sweep = wedge.end - wedge.start;
        const midRadius = (wedge.rInner + wedge.rOuter) / 2;
        const arcLength = (sweep / 360) * 2 * Math.PI * midRadius;
        const idBase = node.id.replace(/\./g, '-');

        // Ring 1 always reads along the arc; the rest read radially. Both shrink before they
        // stack and stack before they truncate, so the inner ring never looks like two designs.
        const curved = displayRing === 1;
        // Stacked lines sit either side of the mid radius, so measure against the inner one.
        const refRadius = node.label.includes('/') ? midRadius - 7 : midRadius;
        const available = curved
          ? (sweep / 360) * 2 * Math.PI * refRadius - LABEL_PADDING
          : wedge.rOuter - wedge.rInner - LABEL_PADDING * 2;

        const fit = fitLabel(node.label, available, baseFont, FONT_MIN[displayRing] ?? 7);
        const lineRadii =
          fit.lines.length === 1
            ? [midRadius]
            : [midRadius - fit.fontSize * 0.58, midRadius + fit.fontSize * 0.58];
        const label = radialLabel(0, 0, wedge.rInner, wedge.rOuter, wedge.start, wedge.end);

        return (
          <g
            key={node.id}
            ref={(el) => {
              groupRefs.current.set(node.id, el);
            }}
            className={[
              'wedge',
              `ring-${displayRing}`,
              isSelected ? 'is-selected' : '',
              node.id === revealId ? 'is-revealed' : '',
              (selectedId || revealId) && !onPath ? 'is-dimmed' : '',
              node.defect === true ? 'is-defect' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            role="treeitem"
            aria-level={node.ring}
            aria-selected={isSelected}
            aria-label={node.label}
            {...(node.childIds.length > 0 ? { 'aria-expanded': node.id === focusId } : {})}
            tabIndex={node.id === activeId ? 0 : -1}
            onClick={() => onSelect(node.id)}
            onDoubleClick={() => node.childIds.length > 0 && onFocusChange(node.id)}
          >
            <path d={wedge.d} fill={node.color} fillOpacity={FILL_OPACITY[displayRing] ?? 0.5} />
            {curved ? (
              <>
                <defs>
                  {lineRadii.map((r, i) => (
                    <path key={i} id={`${idBase}-${i}`} d={arcPath(0, 0, r, wedge.start, wedge.end)} />
                  ))}
                </defs>
                {fit.lines.map((line, i) => (
                  <text key={line} className="wedge-label" fontSize={fit.fontSize}>
                    <textPath
                      href={`#${idBase}-${i}`}
                      startOffset="50%"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {line}
                    </textPath>
                  </text>
                ))}
              </>
            ) : (
              arcLength > fit.fontSize * fit.lines.length + 1 && (
                <text
                  className="wedge-label"
                  fontSize={fit.fontSize}
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  transform={`rotate(${label.rotation} ${label.x} ${label.y})`}
                >
                  {fit.lines.map((line, i) => (
                    <tspan
                      key={line}
                      x={label.x}
                      dy={i === 0 ? (fit.lines.length - 1) * -0.58 * fit.fontSize : fit.fontSize * 1.16}
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {fitText(line, available, fit.fontSize)}
                    </tspan>
                  ))}
                </text>
              )
            )}
          </g>
        );
      })}
    </svg>
  );
}
