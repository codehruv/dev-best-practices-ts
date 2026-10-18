import type { Clock, Random, RetryDependencies, RetryPolicy } from '../../src/index.js';

/** A clock that only moves when the fake sleeper sleeps. */
export interface FakeClock extends Clock {
  advance(ms: number): void;
}

export function makeClock(start = 0): FakeClock {
  let current = start;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
  };
}

/** Always returns `value`, which pins the jittered delay to `value * ceiling`. */
export function makeRandom(value = 0.5): Random {
  return { next: () => value };
}

/** Fake collaborators plus a record of every delay the retrier slept for. */
export interface FakeDependencies extends RetryDependencies {
  readonly clock: FakeClock;
  readonly sleeps: number[];
}

export function makeDependencies(
  overrides: Partial<Omit<FakeDependencies, 'sleeps'>> = {},
): FakeDependencies {
  const clock = overrides.clock ?? makeClock();
  const sleeps: number[] = [];
  return {
    clock,
    random: overrides.random ?? makeRandom(),
    sleeps,
    sleeper: overrides.sleeper ?? {
      sleep: (ms, signal) => {
        if (signal?.aborted) {
          return Promise.reject(new Error('aborted'));
        }
        sleeps.push(ms);
        clock.advance(ms);
        return Promise.resolve();
      },
    },
  };
}

export function makePolicy(overrides: Partial<RetryPolicy> = {}): RetryPolicy {
  return { maxAttempts: 4, baseDelayMs: 100, maxDelayMs: 1_000, ...overrides };
}

/** A scripted operation plus the attempt numbers it was called with. */
export interface ScriptedOperation<T> {
  readonly operation: (attempt: number) => Promise<T>;
  readonly calls: readonly number[];
}

/** An operation that fails `failures` times, then resolves with `value`. */
export function failingThenSucceeding<T>(failures: number, value: T): ScriptedOperation<T> {
  const calls: number[] = [];
  const operation = (attempt: number): Promise<T> => {
    calls.push(attempt);
    return attempt <= failures
      ? Promise.reject(new Error(`failure ${attempt}`))
      : Promise.resolve(value);
  };
  return { operation, calls };
}
