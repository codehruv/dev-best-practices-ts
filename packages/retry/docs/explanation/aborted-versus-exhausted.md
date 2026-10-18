# Aborted versus exhausted

`run` fails in exactly two ways, and the difference matters to whoever handles the error.

- **`RetryExhaustedError`** means the dependency kept failing. The retrier ran out of
  attempts, ran out of time budget, or met an error the `shouldRetry` predicate rejected.
  This is a signal about the dependency: log it, alert on its rate, and consider a circuit
  breaker.
- **`RetryAbortedError`** means the caller stopped waiting. The `AbortSignal` fired, for
  example because a user cancelled or a request deadline passed. This says nothing about
  the dependency, and counting it as a dependency failure makes dashboards lie.

Both extend `RetryError`, so code that only needs "the retry failed" catches one type.

## Why an abort during an attempt counts as an abort

When the signal fires while an attempt is in flight, the operation usually rejects with
its own error, such as fetch's `AbortError`. The retrier checks the signal before
classifying that error. If the signal has fired, the failure is reported as
`RetryAbortedError`, because the abort caused it, not the dependency.

## Why `cause` holds the original error

Each error keeps the underlying failure in the standard `Error.cause` property: the last
attempt's error for an exhausted retry, the abort reason for an aborted one. Standard
`cause` chains print in Node.js stack traces and in most structured loggers without any
custom handling.
