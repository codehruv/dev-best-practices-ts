import { computeBackoffDelay } from './backoff.js';
import { defaultDependencies } from './defaults.js';
import { InvalidRetryPolicyError, RetryAbortedError, RetryExhaustedError } from './errors.js';
import type { RetryDependencies, RetryPolicy } from './types.js';

/**
 * An operation the retrier calls once per attempt. `attempt` is 1-based. Pass `signal` on
 * to I/O calls so cancellation stops in-flight work.
 *
 * @public
 *
 * @example Forward the signal to fetch
 * {@includeCode ../tests/docs/reference/examples.test.ts#RetryOperation}
 */
export type RetryOperation<T> = (attempt: number, signal: AbortSignal | undefined) => Promise<T>;

/**
 * Retries transient failures of async operations with capped exponential backoff and
 * full jitter. Validate the policy once at construction and reuse the instance across calls.
 *
 * @public
 *
 * @example Retry an operation
 * {@includeCode ../tests/docs/reference/examples.test.ts#Retrier}
 */
export class Retrier {
  readonly #policy: RetryPolicy;
  readonly #deps: RetryDependencies;

  /** @throws {@link InvalidRetryPolicyError} when the policy cannot produce a valid schedule. */
  constructor(policy: RetryPolicy, deps: RetryDependencies = defaultDependencies) {
    validatePolicy(policy);
    this.#policy = policy;
    this.#deps = deps;
  }

  /**
   * Runs `operation` until it resolves or retrying stops.
   *
   * @throws {@link RetryExhaustedError} when attempts, the predicate, or the time budget stop retrying.
   * @throws {@link RetryAbortedError} when `signal` aborts before or between attempts.
   */
  async run<T>(operation: RetryOperation<T>, signal?: AbortSignal): Promise<T> {
    const { clock, sleeper, random } = this.#deps;
    const { maxAttempts, maxElapsedMs, shouldRetry = retryEverything } = this.#policy;
    const startedAt = clock.now();

    for (let attempt = 1; ; attempt++) {
      if (signal?.aborted) {
        throw new RetryAbortedError(attempt - 1, signal.reason);
      }

      try {
        return await operation(attempt, signal);
      } catch (error: unknown) {
        // An abort during the attempt surfaces as the operation's own error. Report it
        // as an abort, so callers do not mistake cancellation for a failing dependency.
        if (signal?.aborted) {
          throw new RetryAbortedError(attempt, signal.reason);
        }
        if (attempt >= maxAttempts || !shouldRetry(error, attempt)) {
          throw new RetryExhaustedError(attempt, error);
        }

        const delayMs = computeBackoffDelay(attempt, this.#policy, random);
        const elapsedAfterDelay = clock.now() - startedAt + delayMs;
        if (maxElapsedMs !== undefined && elapsedAfterDelay > maxElapsedMs) {
          throw new RetryExhaustedError(attempt, error);
        }

        try {
          await sleeper.sleep(delayMs, signal);
        } catch {
          throw new RetryAbortedError(attempt, signal?.reason);
        }
      }
    }
  }
}

const retryEverything = (): boolean => true;

function validatePolicy(policy: RetryPolicy): void {
  const { maxAttempts, baseDelayMs, maxDelayMs, maxElapsedMs } = policy;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new InvalidRetryPolicyError(`maxAttempts must be an integer >= 1, got ${maxAttempts}`);
  }
  if (!(baseDelayMs >= 0)) {
    throw new InvalidRetryPolicyError(`baseDelayMs must be >= 0, got ${baseDelayMs}`);
  }
  if (!(maxDelayMs >= baseDelayMs)) {
    throw new InvalidRetryPolicyError(
      `maxDelayMs must be >= baseDelayMs (${baseDelayMs}), got ${maxDelayMs}`,
    );
  }
  if (maxElapsedMs !== undefined && !(maxElapsedMs > 0)) {
    throw new InvalidRetryPolicyError(`maxElapsedMs must be > 0, got ${maxElapsedMs}`);
  }
}
