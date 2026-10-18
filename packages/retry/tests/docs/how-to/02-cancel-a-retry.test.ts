/**
 * Stop a retry loop when the caller no longer wants the result, for example when a user
 * cancels a request or a deadline passes. Pass an `AbortSignal` to `run`. The retrier
 * checks it before every attempt, wakes up early from a delay when it fires, and passes it
 * to your operation so in-flight work stops too.
 *
 * Cancellation throws `RetryAbortedError`, never `RetryExhaustedError`, so callers can tell
 * "we gave up on purpose" apart from "the dependency is failing".
 */
import { Retrier, RetryAbortedError } from '@dbp/retry';
import { describe, expect, it } from 'vitest';

describe('Cancel a retry', () => {
  /**
   * Abort the controller from anywhere, such as a request-closed handler. The retrier
   * stops at once, even when the policy would wait several seconds before the next attempt.
   * The error's `cause` is the reason you passed to `abort`.
   */
  it('Cancel when the caller gives up', async () => {
    // #region cancel
    const retrier = new Retrier({ maxAttempts: 5, baseDelayMs: 1_000, maxDelayMs: 10_000 });
    const controller = new AbortController();

    const pending = retrier.run(
      () => Promise.reject(new Error('Upstream timeout')),
      controller.signal,
    );
    controller.abort(new Error('Client disconnected'));

    const error = await pending.catch((caught: unknown) => caught);
    // #endregion cancel

    expect(error).toBeInstanceOf(RetryAbortedError);
    expect(error).toMatchObject({ cause: new Error('Client disconnected') });
  });

  /**
   * `AbortSignal.timeout` puts a deadline on the whole loop, including the attempts
   * themselves. Here the retrier gives up after 50 ms even though the policy allows waits
   * of several seconds.
   */
  it('Put a deadline on the whole retry loop', async () => {
    // #region deadline
    const retrier = new Retrier({ maxAttempts: 10, baseDelayMs: 1_000, maxDelayMs: 10_000 });

    const error = await retrier
      .run(() => Promise.reject(new Error('Upstream timeout')), AbortSignal.timeout(50))
      .catch((caught: unknown) => caught);
    // #endregion deadline

    expect(error).toBeInstanceOf(RetryAbortedError);
  });
});
