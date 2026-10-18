import type { Random } from './types.js';

/** The policy fields that shape a delay. */
interface BackoffShape {
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
}

/**
 * Exponential backoff with full jitter: a uniform pick in [0, min(cap, base * 2^(n-1))).
 * Full jitter spreads retries from many clients across the window, so a recovering
 * dependency does not get hit by synchronized waves of retries.
 * See https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/.
 *
 * @param retryNumber - 1 for the delay before the second attempt, 2 before the third, and so on.
 *
 * @public
 */
export function computeBackoffDelay(
  retryNumber: number,
  shape: BackoffShape,
  random: Random,
): number {
  const ceiling = Math.min(shape.maxDelayMs, shape.baseDelayMs * 2 ** (retryNumber - 1));
  return Math.floor(random.next() * ceiling);
}
