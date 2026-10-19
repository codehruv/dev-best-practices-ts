/**
 * By default the retrier retries every error. Most errors are not worth retrying: a
 * permission error or a validation error fails the same way every time, and retrying it
 * only delays the real error. Pass a `shouldRetry` predicate that returns `true` only for
 * errors a retry can fix.
 *
 * The predicate below retries Node.js network errors by their `code`.
 */
import { Retrier, RetryExhaustedError, type RetryPredicate } from '@dbp/iso-retry';
import { describe, expect, it } from 'vitest';

// #region predicate
const TRANSIENT_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN']);

const isTransient: RetryPredicate = (error) =>
  error instanceof Error && 'code' in error && TRANSIENT_CODES.has(String(error.code));

const retrier = new Retrier({
  maxAttempts: 3,
  baseDelayMs: 10,
  maxDelayMs: 100,
  shouldRetry: isTransient,
});

function failWith(code: string): Error {
  return Object.assign(new Error(code), { code });
}
// #endregion predicate

describe('Retry only transient errors', () => {
  /** A connection reset passes the predicate, so the retrier tries again and succeeds. */
  it('Retry a transient error', async () => {
    // #region transient
    let attempts = 0;
    const result = await retrier.run(() => {
      attempts += 1;
      return attempts === 1 ? Promise.reject(failWith('ECONNRESET')) : Promise.resolve('done');
    });
    // #endregion transient

    expect(result).toBe('done');
    expect(attempts).toBe(2);
  });

  /**
   * A permission error fails the predicate, so the retrier throws after the first attempt
   * instead of waiting through two pointless retries.
   */
  it('Fail fast on a permanent error', async () => {
    // #region permanent
    const error = await retrier
      .run(() => Promise.reject(failWith('EACCES')))
      .catch((caught: unknown) => caught);
    // #endregion permanent

    expect(error).toBeInstanceOf(RetryExhaustedError);
    expect(error).toMatchObject({ attempts: 1 });
  });

  /**
   * The predicate also receives the 1-based attempt number. Use it to give one kind of
   * error a smaller budget than `maxAttempts`. DNS failures (`EAI_AGAIN`) rarely clear
   * within seconds, so this predicate retries them only once.
   */
  it('Limit retries for one kind of error', async () => {
    // #region per-error-budget
    const isDnsFailure = (error: unknown): boolean =>
      error instanceof Error && 'code' in error && error.code === 'EAI_AGAIN';

    const shouldRetry: RetryPredicate = (error, attempt) =>
      isTransient(error, attempt) && !(isDnsFailure(error) && attempt >= 2);

    const strict = new Retrier({ maxAttempts: 5, baseDelayMs: 10, maxDelayMs: 100, shouldRetry });

    const error = await strict
      .run(() => Promise.reject(failWith('EAI_AGAIN')))
      .catch((caught: unknown) => caught);
    // #endregion per-error-budget

    expect(error).toMatchObject({ attempts: 2 });
  });
});
