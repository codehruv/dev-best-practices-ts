/**
 * Base class for every error this package throws, so callers can separate retry
 * failures from the operation's own errors with a single `instanceof` check.
 *
 * @example Separate retry failures from other errors
 * {@includeCode ../tests/docs/reference/examples.test.ts#RetryError}
 */
export class RetryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/**
 * Rejects a policy at construction time, so a bad config fails at startup and not mid-request.
 *
 * @example Catch an invalid policy
 * {@includeCode ../tests/docs/reference/examples.test.ts#InvalidRetryPolicyError}
 */
export class InvalidRetryPolicyError extends RetryError {}

/**
 * Thrown when every allowed attempt failed, or the predicate or time budget stopped
 * retrying. `cause` holds the last attempt's error for debugging.
 *
 * @example Inspect an exhausted retry
 * {@includeCode ../tests/docs/reference/examples.test.ts#RetryExhaustedError}
 */
export class RetryExhaustedError extends RetryError {
  /** How many times the operation ran before retrying stopped. */
  readonly attempts: number;

  constructor(attempts: number, cause: unknown) {
    super(`Operation failed after ${attempts} attempt(s)`, { cause });
    this.attempts = attempts;
  }
}

/** Thrown when the caller's `AbortSignal` fires. `cause` holds the signal's reason. */
export class RetryAbortedError extends RetryError {
  /** How many attempts started before the abort. 0 when the signal fired before the first. */
  readonly attempts: number;

  constructor(attempts: number, cause: unknown) {
    super(`Operation aborted after ${attempts} attempt(s)`, { cause });
    this.attempts = attempts;
  }
}
