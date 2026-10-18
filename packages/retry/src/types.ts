/** Reads the current time. Injected so tests control elapsed time without real waiting. */
export interface Clock {
  /** Milliseconds since an arbitrary fixed origin. Only differences between readings matter. */
  now(): number;
}

/** Waits between attempts. Injected so tests run instantly and deterministically. */
export interface Sleeper {
  /** Resolves after `ms` milliseconds, or rejects with the signal's reason once `signal` aborts. */
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

/** Source of jitter. Injected so tests can pin the delay the backoff picks. */
export interface Random {
  /** A number in the half-open range [0, 1). */
  next(): number;
}

/** The collaborators a {@link Retrier} depends on. */
export interface RetryDependencies {
  readonly clock: Clock;
  readonly sleeper: Sleeper;
  readonly random: Random;
}

/** Decides whether a failed attempt is worth retrying. `attempt` is 1-based. */
export type RetryPredicate = (error: unknown, attempt: number) => boolean;

/** How many times to retry and how long to wait between attempts. */
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
