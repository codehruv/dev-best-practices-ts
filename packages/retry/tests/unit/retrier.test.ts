import {
  InvalidRetryPolicyError,
  Retrier,
  RetryAbortedError,
  RetryError,
  RetryExhaustedError,
} from '@dbp/retry';
import { describe, expect, it, vi } from 'vitest';

import { failingThenSucceeding, makeDependencies, makePolicy } from './fakes.js';

describe('Retrier', () => {
  describe('construction', () => {
    it.each([
      { name: 'zero attempts', overrides: { maxAttempts: 0 } },
      { name: 'fractional attempts', overrides: { maxAttempts: 1.5 } },
      { name: 'negative base delay', overrides: { baseDelayMs: -1 } },
      { name: 'NaN base delay', overrides: { baseDelayMs: Number.NaN } },
      { name: 'cap below base', overrides: { baseDelayMs: 500, maxDelayMs: 100 } },
      { name: 'zero time budget', overrides: { maxElapsedMs: 0 } },
    ])('rejects a policy with $name', ({ overrides }) => {
      expect(() => new Retrier(makePolicy(overrides), makeDependencies())).toThrow(
        InvalidRetryPolicyError,
      );
    });
  });

  describe('run', () => {
    it('returns the first success without sleeping', async () => {
      const deps = makeDependencies();
      const { operation, calls } = failingThenSucceeding(0, 'ok');

      await expect(new Retrier(makePolicy(), deps).run(operation)).resolves.toBe('ok');
      expect(calls).toEqual([1]);
      expect(deps.sleeps).toEqual([]);
    });

    it('retries with growing jittered delays until the operation succeeds', async () => {
      const deps = makeDependencies();
      const { operation, calls } = failingThenSucceeding(3, 'ok');

      await expect(new Retrier(makePolicy(), deps).run(operation)).resolves.toBe('ok');
      expect(calls).toEqual([1, 2, 3, 4]);
      expect(deps.sleeps).toEqual([50, 100, 200]);
    });

    it('throws RetryExhaustedError with the last error once attempts run out', async () => {
      const { operation } = failingThenSucceeding(10, 'never');

      const error = await new Retrier(makePolicy({ maxAttempts: 3 }), makeDependencies())
        .run(operation)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(RetryExhaustedError);
      expect(error).toBeInstanceOf(RetryError);
      expect(error).toMatchObject({ attempts: 3, cause: new Error('failure 3') });
    });

    it('stops at the first error the predicate rejects', async () => {
      const shouldRetry = vi.fn((_error: unknown, attempt: number) => attempt < 2);
      const { operation, calls } = failingThenSucceeding(10, 'never');

      await expect(
        new Retrier(makePolicy({ shouldRetry }), makeDependencies()).run(operation),
      ).rejects.toMatchObject({ attempts: 2 });
      expect(calls).toEqual([1, 2]);
      expect(shouldRetry).toHaveBeenLastCalledWith(new Error('failure 2'), 2);
    });

    it('gives up instead of sleeping past the time budget', async () => {
      const deps = makeDependencies();
      const { operation, calls } = failingThenSucceeding(10, 'never');

      await expect(
        new Retrier(makePolicy({ maxElapsedMs: 160 }), deps).run(operation),
      ).rejects.toBeInstanceOf(RetryExhaustedError);
      // Delays of 50 and 100 fit in 160 ms. The next delay (200) would not.
      expect(deps.sleeps).toEqual([50, 100]);
      expect(calls).toEqual([1, 2, 3]);
    });

    it('never starts an attempt when the signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort(new Error('cancelled'));
      const { operation, calls } = failingThenSucceeding(0, 'ok');

      await expect(
        new Retrier(makePolicy(), makeDependencies()).run(operation, controller.signal),
      ).rejects.toMatchObject({ attempts: 0, cause: new Error('cancelled') });
      expect(calls).toEqual([]);
    });

    it('reports an abort during an attempt as RetryAbortedError, not exhaustion', async () => {
      const controller = new AbortController();
      const operation = (): Promise<never> => {
        controller.abort(new Error('cancelled'));
        return Promise.reject(new Error('request aborted'));
      };

      await expect(
        new Retrier(makePolicy(), makeDependencies()).run(operation, controller.signal),
      ).rejects.toBeInstanceOf(RetryAbortedError);
    });

    it('reports an abort during a delay as RetryAbortedError', async () => {
      const controller = new AbortController();
      const deps = makeDependencies({
        sleeper: {
          sleep: () => {
            controller.abort(new Error('cancelled'));
            return Promise.reject(new Error('sleep interrupted'));
          },
        },
      });
      const { operation, calls } = failingThenSucceeding(10, 'never');

      await expect(
        new Retrier(makePolicy(), deps).run(operation, controller.signal),
      ).rejects.toMatchObject({ attempts: 1, cause: new Error('cancelled') });
      expect(calls).toEqual([1]);
    });
  });
});
