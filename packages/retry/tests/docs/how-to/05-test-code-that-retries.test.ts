/**
 * Tests of code that retries must not wait for real delays or depend on random jitter.
 * `Retrier` takes its clock, sleeper, and random source as a second constructor argument,
 * so a test can pass fakes that implement the same interfaces. Time then only moves when
 * the retrier sleeps, every sleep returns at once, and the jitter is fixed.
 */
import {
  type Clock,
  type Random,
  Retrier,
  type RetryDependencies,
  RetryExhaustedError,
  type Sleeper,
} from '@dbp/retry';
import { describe, expect, it } from 'vitest';

// #region fakes
/** A clock that only moves when the retrier sleeps, and records every sleep. */
class FakeTime implements Clock, Sleeper {
  readonly sleeps: number[] = [];
  #now = 0;

  now(): number {
    return this.#now;
  }

  sleep(ms: number): Promise<void> {
    this.sleeps.push(ms);
    this.#now += ms;
    return Promise.resolve();
  }
}

// Pins every delay to half of its ceiling.
const halfRandom: Random = { next: () => 0.5 };

function makeFakes(): { time: FakeTime; dependencies: RetryDependencies } {
  const time = new FakeTime();
  return { time, dependencies: { clock: time, sleeper: time, random: halfRandom } };
}
// #endregion fakes

describe('Test code that retries', () => {
  /**
   * With the fakes, three failures take no real time, and the recorded delays are exact:
   * half of 100, 200, and 400 ms.
   */
  it('Assert the delays without waiting', async () => {
    // #region delays
    const { time, dependencies } = makeFakes();
    const retrier = new Retrier(
      { maxAttempts: 4, baseDelayMs: 100, maxDelayMs: 1_000 },
      dependencies,
    );

    let attempts = 0;
    await retrier.run(() => {
      attempts += 1;
      return attempts <= 3 ? Promise.reject(new Error('flaky')) : Promise.resolve();
    });
    // #endregion delays

    expect(time.sleeps).toEqual([50, 100, 200]);
  });

  /**
   * The fake clock also makes the time budget deterministic. After sleeping 50 and 100 ms,
   * the next delay of 200 ms would end at 350 ms, past the 250 ms budget, so the retrier
   * gives up after the third attempt.
   */
  it('Test the time budget', async () => {
    // #region budget
    const { time, dependencies } = makeFakes();
    const retrier = new Retrier(
      { maxAttempts: 10, baseDelayMs: 100, maxDelayMs: 1_000, maxElapsedMs: 250 },
      dependencies,
    );

    const error = await retrier
      .run(() => Promise.reject(new Error('down')))
      .catch((caught: unknown) => caught);
    // #endregion budget

    expect(error).toBeInstanceOf(RetryExhaustedError);
    expect(error).toMatchObject({ attempts: 3 });
    expect(time.sleeps).toEqual([50, 100]);
  });
});
