import { describe, expect, it } from 'vitest';
import { PROTOCOL } from '../domain/protocol.js';
import { clockAt, formatClock, isProtocolComplete, stepsReachedAt } from './timer.js';

describe('the protocol clock', () => {
  it('starts on the pour', () => {
    const state = clockAt(0);
    expect(state.step.id).toBe('pour');
    expect(state.stepIndex).toBe(0);
    expect(state.done).toBe(false);
  });

  it('holds a step until the next one is due', () => {
    expect(clockAt(239).step.id).toBe('steep');
    expect(clockAt(240).step.id).toBe('break');
    expect(clockAt(241).step.id).toBe('break');
  });

  it('counts down to the next step', () => {
    const state = clockAt(200);
    expect(state.next!.id).toBe('break');
    expect(state.secondsToNext).toBe(40);
  });

  // The reason the clock is a function of elapsed time rather than a chain of timers: a phone that
  // slept through the crust break has to come back showing the right step, not the one it was on.
  it('lands on the right step however late it is asked', () => {
    expect(clockAt(1200).step.id).toBe('third-pass');
    expect(clockAt(99999).step.id).toBe(PROTOCOL.steps.at(-1)!.id);
  });

  it('reports the last step as done with nothing left to count down to', () => {
    const state = clockAt(PROTOCOL.durationSec);
    expect(state.done).toBe(true);
    expect(state.next).toBeNull();
    expect(state.secondsToNext).toBeNull();
  });

  it('clamps and floors the elapsed time it is given', () => {
    expect(clockAt(-50).elapsedSec).toBe(0);
    expect(clockAt(240.9).step.id).toBe('break');
  });

  // An abandoned session has to be visible as one, or the palate meter counts cups nobody tasted.
  it('reports which steps were actually reached', () => {
    expect(stepsReachedAt(0)).toEqual(['pour']);
    expect(stepsReachedAt(300)).toEqual(['pour', 'steep', 'break', 'skim']);
    expect(stepsReachedAt(PROTOCOL.durationSec)).toHaveLength(PROTOCOL.steps.length);
  });

  it('knows when the protocol is finished', () => {
    expect(isProtocolComplete(PROTOCOL.durationSec - 1)).toBe(false);
    expect(isProtocolComplete(PROTOCOL.durationSec)).toBe(true);
  });

  it('formats a wall clock', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(9)).toBe('0:09');
    expect(formatClock(240)).toBe('4:00');
    expect(formatClock(1505)).toBe('25:05');
    expect(formatClock(-5)).toBe('0:00');
  });
});
