/**
 * Reads the current time. Injected so tests control elapsed time without real waiting.
 *
 * @public
 */
export interface Clock {
  /** Milliseconds since an arbitrary fixed origin. Only differences between readings matter. */
  now(): number;
}

/**
 * Waits between attempts. Injected so tests run instantly and deterministically.
 *
 * @public
 */
export interface Sleeper {
  /** Resolves after `ms` milliseconds, or rejects with the signal's reason once `signal` aborts. */
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

/**
 * Source of jitter. Injected so tests can pin the delay the backoff picks.
 *
 * @public
 */
export interface Random {
  /** A number in the half-open range [0, 1). */
  next(): number;
}

/**
 * The collaborators a {@link Retrier} depends on.
 *
 * @public
 */
export interface RetryDependencies {
  /** Measures elapsed time against the policy's `maxElapsedMs`. */
  readonly clock: Clock;
  /** Waits out each backoff delay. */
  readonly sleeper: Sleeper;
  /** Picks where each delay falls inside its jitter window. */
  readonly random: Random;
}

/**
 * Decides whether a failed attempt is worth retrying. `attempt` is 1-based.
 *
 * @public
 */
export type RetryPredicate = (error: unknown, attempt: number) => boolean;

/**
 * How many times to retry and how long to wait between attempts.
 *
 * @public
 *
 * @example A policy with a time budget and a predicate
 * {@includeCode ../tests/docs/reference/examples.test.ts#RetryPolicy}
 */
export interface RetryPolicy {
  /** Total attempts, including the first. Must be an integer of at least 1. */
  readonly maxAttempts: number;
  /** Upper bound of the delay before the second attempt. Doubles for each later attempt. */
  readonly baseDelayMs: number;
  /** Cap on any single delay, so the exponential growth cannot produce multi-minute waits. */
  readonly maxDelayMs: number;
  /**
   * Total time budget across all attempts and delays. The retrier gives up instead of
   * starting a delay that would end past the budget.
   */
  readonly maxElapsedMs?: number;
  /** Defaults to retrying every error. Return false for errors a retry cannot fix. */
  readonly shouldRetry?: RetryPredicate;
}
