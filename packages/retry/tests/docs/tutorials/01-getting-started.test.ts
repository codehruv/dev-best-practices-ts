/**
 * In this tutorial you retry your first flaky operation with `@dbp/retry`. By the end you
 * have a reusable `Retrier`, you have watched it recover from failures, and you know what
 * it reports when an operation never succeeds.
 *
 * You need Node.js 22 or later and a project that uses ES modules.
 */
import { Retrier, RetryExhaustedError } from '@dbp/retry';
import { describe, expect, it } from 'vitest';

describe('Getting started', () => {
  /**
   * A `Retrier` holds one retry policy. Create it once at startup and reuse it for every
   * call that needs the same policy.
   *
   * This policy makes at most 3 attempts. Before the second attempt it waits a random
   * delay of up to 10 ms, and before the third up to 20 ms, never more than 100 ms.
   */
  it('Create a retrier', () => {
    // #region create
    const retrier = new Retrier({ maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100 });
    // #endregion create

    expect(retrier).toBeInstanceOf(Retrier);
  });

  /**
   * `run` calls your operation and retries it while it fails. The `connect` function below
   * fails twice, the way a database does while it is still starting, then succeeds.
   *
   * `status` is `'connected'`, and `connect` ran 3 times.
   */
  it('Retry a flaky operation', async () => {
    // #region flaky
    const retrier = new Retrier({ maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100 });

    let attempts = 0;
    function connect(): Promise<string> {
      attempts += 1;
      return attempts < 3
        ? Promise.reject(new Error('Connection refused'))
        : Promise.resolve('connected');
    }

    const status = await retrier.run(() => connect());
    // #endregion flaky

    expect(status).toBe('connected');
    expect(attempts).toBe(3);
  });

  /**
   * When every attempt fails, `run` throws `RetryExhaustedError`. It records how many
   * attempts ran, and its `cause` is the error from the last attempt, so you can log the
   * real failure.
   */
  it('Handle an operation that never succeeds', async () => {
    // #region exhausted
    const retrier = new Retrier({ maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100 });

    let message = 'succeeded';
    try {
      await retrier.run(() => Promise.reject(new Error('Disk full')));
    } catch (error) {
      if (error instanceof RetryExhaustedError) {
        message = `Gave up after ${error.attempts} attempts: ${String(error.cause)}`;
      }
    }
    // #endregion exhausted

    expect(message).toBe('Gave up after 3 attempts: Error: Disk full');
  });
});
