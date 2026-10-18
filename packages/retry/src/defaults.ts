import type { Clock, Random, RetryDependencies, Sleeper } from './types.js';

/**
 * Monotonic clock. `performance.now()` does not jump when the wall clock is adjusted.
 *
 * @example Measure elapsed time
 * {@includeCode ../tests/docs/reference/examples.test.ts#systemClock}
 */
export const systemClock: Clock = {
  now: () => performance.now(),
};

/**
 * Sleeps on a timer and wakes early when the signal aborts.
 *
 * @example Abort a long sleep
 * {@includeCode ../tests/docs/reference/examples.test.ts#timerSleeper}
 */
export const timerSleeper: Sleeper = {
  sleep: (ms, signal) =>
    new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(toError(signal.reason));
        return;
      }
      const onAbort = (): void => {
        clearTimeout(timer);
        reject(toError(signal?.reason));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      signal?.addEventListener('abort', onAbort, { once: true });
    }),
};

/**
 * `Math.random` is fine here. Jitter needs spread, not unpredictability.
 *
 * @example Draw a jitter value
 * {@includeCode ../tests/docs/reference/examples.test.ts#mathRandom}
 */
export const mathRandom: Random = {
  next: () => Math.random(),
};

/**
 * Production collaborators for a {@link Retrier}. The constructor uses them when you pass none.
 *
 * @example Implicit and explicit defaults
 * {@includeCode ../tests/docs/reference/examples.test.ts#defaultDependencies}
 */
export const defaultDependencies: RetryDependencies = {
  clock: systemClock,
  sleeper: timerSleeper,
  random: mathRandom,
};

// Promise rejections must be Error instances (`prefer-promise-reject-errors`), but an
// abort reason can be any value.
function toError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error('Aborted', { cause: reason });
}
