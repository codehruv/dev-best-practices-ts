/**
 * Examples for the API reference. Each region is pulled into the TSDoc `@example` of one
 * export with `{@includeCode}`, so every example in the reference runs as a test here.
 * This file does not render as a page of its own.
 */
import {
  computeBackoffDelay,
  defaultDependencies,
  InvalidRetryPolicyError,
  mathRandom,
  Retrier,
  RetryError,
  RetryExhaustedError,
  type RetryOperation,
  type RetryPolicy,
  systemClock,
  timerSleeper,
} from '@dbp/iso-retry';
import { describe, expect, it } from 'vitest';

describe('Reference examples', () => {
  it('Retrier', async () => {
    // #region Retrier
    const retrier = new Retrier({ maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100 });
    const value = await retrier.run(() => Promise.resolve(42));
    // value === 42
    // #endregion Retrier

    expect(value).toBe(42);
  });

  it('RetryPolicy', () => {
    // #region RetryPolicy
    const policy: RetryPolicy = {
      maxAttempts: 5,
      baseDelayMs: 100,
      maxDelayMs: 2_000,
      maxElapsedMs: 10_000,
      shouldRetry: (error) => !(error instanceof TypeError),
    };
    const retrier = new Retrier(policy);
    // #endregion RetryPolicy

    expect(retrier).toBeInstanceOf(Retrier);
  });

  it('RetryOperation', async () => {
    // #region RetryOperation
    const operation: RetryOperation<string> = async (attempt, signal) => {
      const response = await fetch(`data:text/plain,attempt ${attempt}`, {
        signal: signal ?? null,
      });
      return response.text();
    };
    const text = await new Retrier({ maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 10 }).run(
      operation,
    );
    // text === 'attempt 1'
    // #endregion RetryOperation

    expect(text).toBe('attempt 1');
  });

  it('computeBackoffDelay', () => {
    // #region computeBackoffDelay
    const shape = { baseDelayMs: 100, maxDelayMs: 1_000 };
    const half = { next: () => 0.5 };

    computeBackoffDelay(1, shape, half); // 50: half of 100
    computeBackoffDelay(3, shape, half); // 200: half of 400
    computeBackoffDelay(10, shape, half); // 500: half of the 1000 cap
    // #endregion computeBackoffDelay

    expect([1, 3, 10].map((n) => computeBackoffDelay(n, shape, half))).toEqual([50, 200, 500]);
  });

  it('RetryError', async () => {
    // #region RetryError
    const retrier = new Retrier({ maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 });
    try {
      await retrier.run(() => Promise.reject(new Error('boom')));
    } catch (error) {
      if (error instanceof RetryError) {
        // A RetryExhaustedError or RetryAbortedError. Inspect error.cause for the real failure.
      }
    }
    // #endregion RetryError

    await expect(retrier.run(() => Promise.reject(new Error('boom')))).rejects.toBeInstanceOf(
      RetryError,
    );
  });

  it('RetryExhaustedError', async () => {
    // #region RetryExhaustedError
    const error = await new Retrier({ maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 })
      .run(() => Promise.reject(new Error('boom')))
      .catch((caught: unknown) => caught);
    // error instanceof RetryExhaustedError, error.attempts === 2, error.cause is Error('boom')
    // #endregion RetryExhaustedError

    expect(error).toBeInstanceOf(RetryExhaustedError);
    expect(error).toMatchObject({ attempts: 2, cause: new Error('boom') });
  });

  it('InvalidRetryPolicyError', () => {
    // #region InvalidRetryPolicyError
    let message = '';
    try {
      new Retrier({ maxAttempts: 0, baseDelayMs: 100, maxDelayMs: 1_000 });
    } catch (error) {
      if (error instanceof InvalidRetryPolicyError) {
        message = error.message; // 'maxAttempts must be an integer >= 1, got 0'
      }
    }
    // #endregion InvalidRetryPolicyError

    expect(message).toBe('maxAttempts must be an integer >= 1, got 0');
  });

  it('defaultDependencies', () => {
    // #region defaultDependencies
    // Both retriers use the real clock, timers, and Math.random.
    const implicit = new Retrier({ maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100 });
    const explicit = new Retrier(
      { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100 },
      defaultDependencies,
    );
    // #endregion defaultDependencies

    expect(implicit).toBeInstanceOf(Retrier);
    expect(explicit).toBeInstanceOf(Retrier);
  });

  it('systemClock', () => {
    // #region systemClock
    const startedAt = systemClock.now();
    const elapsedMs = systemClock.now() - startedAt; // never negative, even if the wall clock moves back
    // #endregion systemClock

    expect(elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('timerSleeper', async () => {
    // #region timerSleeper
    const controller = new AbortController();
    const sleeping = timerSleeper.sleep(60_000, controller.signal);
    controller.abort(new Error('Shutting down'));
    await sleeping.catch((error: unknown) => error); // rejects at once with Error('Shutting down')
    // #endregion timerSleeper

    await expect(sleeping).rejects.toThrow('Shutting down');
  });

  it('mathRandom', () => {
    // #region mathRandom
    const value = mathRandom.next(); // 0 <= value < 1
    // #endregion mathRandom

    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });
});
