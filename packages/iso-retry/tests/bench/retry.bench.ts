import { computeBackoffDelay, Retrier, type RetryDependencies } from '@dbp/iso-retry';
import { bench, describe } from 'vitest';

// Each benchmark iteration repeats its operation a fixed number of times. A single call
// takes tens of nanoseconds, close to the timer's resolution, so one-call iterations
// would mostly measure the timer. These sizes must equal `batchSize` in
// slo/retry.openslo.yaml, because the SLO checker divides iteration time by them.
const DELAY_BATCH = 1_000;
const RUN_BATCH = 100;

// Warmup lets the JIT reach optimized code before measurement starts, and one second of
// samples yields thousands of iterations, which keeps the p99 estimate stable.
const OPTIONS = { time: 1_000, warmupTime: 250, warmupIterations: 100 };

const SHAPE = { baseDelayMs: 100, maxDelayMs: 10_000 };
const FIXED_RANDOM = { next: () => 0.5 };

// Collaborators that cost nothing, so the benchmark measures the retrier's own overhead
// and not sleeping or clock reads.
const INSTANT: RetryDependencies = {
  clock: { now: () => 0 },
  sleeper: { sleep: () => Promise.resolve() },
  random: FIXED_RANDOM,
};
const retrier = new Retrier({ maxAttempts: 5, ...SHAPE }, INSTANT);

// Preallocated, so the benchmark does not measure stack trace capture.
const TRANSIENT_FAILURE = new Error('transient');

describe('computeBackoffDelay', () => {
  bench(
    '1000 delays across retries 1-10',
    () => {
      let total = 0;
      for (let i = 0; i < DELAY_BATCH; i++) {
        total += computeBackoffDelay((i % 10) + 1, SHAPE, FIXED_RANDOM);
      }
      // Consuming the result keeps the engine from eliminating the loop as dead code.
      if (total < 0) {
        throw new Error('unreachable');
      }
    },
    OPTIONS,
  );
});

describe('Retrier.run', () => {
  bench(
    '100 runs that succeed on the first attempt',
    async () => {
      for (let i = 0; i < RUN_BATCH; i++) {
        await retrier.run(() => Promise.resolve(i));
      }
    },
    OPTIONS,
  );

  bench(
    '100 runs that succeed after 3 retries',
    async () => {
      for (let i = 0; i < RUN_BATCH; i++) {
        await retrier.run((attempt) =>
          attempt <= 3 ? Promise.reject(TRANSIENT_FAILURE) : Promise.resolve(attempt),
        );
      }
    },
    OPTIONS,
  );
});
