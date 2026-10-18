# Changelog

All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-18

### Added

- `Retrier` retries a failing async operation with capped exponential backoff and full jitter.
- `RetryPolicy` sets `maxAttempts`, `baseDelayMs`, `maxDelayMs`, an optional `maxElapsedMs` time budget, and an optional `shouldRetry` predicate.
- `run()` accepts an `AbortSignal` and rejects with `RetryAbortedError` when it aborts.
- Typed errors: `RetryError`, `InvalidRetryPolicyError`, `RetryExhaustedError`, and `RetryAbortedError`.
- Injectable `Clock`, `Sleeper`, and `Random`, with the production defaults `systemClock`, `timerSleeper`, and `mathRandom`.
- `computeBackoffDelay()` exposes the delay schedule.

[Unreleased]: https://github.com/codehruv/dev-best-practices-ts/compare/%40dbp%2Fretry%400.1.0...HEAD
[0.1.0]: https://github.com/codehruv/dev-best-practices-ts/releases/tag/%40dbp%2Fretry%400.1.0
