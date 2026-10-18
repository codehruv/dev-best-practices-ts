/**
 * Base class for every error this package throws, so callers can separate retry
 * failures from the operation's own errors with a single `instanceof` check.
 *
 * @public
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
 * @public
 */
export class InvalidRetryPolicyError extends RetryError {}

/**
 * Thrown when every allowed attempt failed, or the predicate or time budget stopped
 * retrying. `cause` holds the last attempt's error for debugging.
 *
 * @public
 */
export class RetryExhaustedError extends RetryError {
  readonly attempts: number;

  constructor(attempts: number, cause: unknown) {
    super(`Operation failed after ${attempts} attempt(s)`, { cause });
    this.attempts = attempts;
  }
}

/**
 * Thrown when the caller's `AbortSignal` fires. `cause` holds the signal's reason.
 *
 * @public
 */
export class RetryAbortedError extends RetryError {
  readonly attempts: number;

  constructor(attempts: number, cause: unknown) {
    super(`Operation aborted after ${attempts} attempt(s)`, { cause });
    this.attempts = attempts;
  }
}
