/**
 * `maxAttempts` bounds how many times an operation runs, not how long the whole loop
 * takes. Set `maxElapsedMs` to give the loop a time budget as well. The retrier gives up
 * as soon as the next delay would end past the budget, instead of sleeping into it, so it
 * never wastes the remaining time on a wait it cannot finish.
 *
 * Use `maxElapsedMs` when the budget belongs to the policy. Use an `AbortSignal` deadline
 * instead when the caller owns the deadline. See [Cancel a retry](cancel-a-retry.md).
 */
import { Retrier, RetryExhaustedError } from '@dbp/iso-retry';
import { describe, expect, it } from 'vitest';

describe('Cap the total retry time', () => {
  /**
   * The policy allows 100 attempts, but the 50 ms budget runs out first. The retrier
   * throws `RetryExhaustedError` well before 100 attempts.
   */
  it('Give the loop a time budget', async () => {
    // #region budget
    const retrier = new Retrier({
      maxAttempts: 100,
      baseDelayMs: 20,
      maxDelayMs: 1_000,
      maxElapsedMs: 50,
    });

    const startedAt = performance.now();
    const error = await retrier
      .run(() => Promise.reject(new Error('Still down')))
      .catch((caught: unknown) => caught);
    const elapsedMs = performance.now() - startedAt;
    // #endregion budget

    expect(error).toBeInstanceOf(RetryExhaustedError);
    expect((error as RetryExhaustedError).attempts).toBeLessThan(100);
    expect(elapsedMs).toBeLessThan(1_000);
  });
});
