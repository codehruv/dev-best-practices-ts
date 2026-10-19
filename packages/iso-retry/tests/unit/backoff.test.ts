import { computeBackoffDelay } from '@dbp/iso-retry';
import { describe, expect, it } from 'vitest';

import { makePolicy, makeRandom } from './fakes.js';

describe('computeBackoffDelay', () => {
  const policy = makePolicy({ baseDelayMs: 100, maxDelayMs: 1_000 });

  it.each([
    { retryNumber: 1, expected: 50 },
    { retryNumber: 2, expected: 100 },
    { retryNumber: 3, expected: 200 },
    { retryNumber: 4, expected: 400 },
  ])('doubles the jitter window for retry $retryNumber', ({ retryNumber, expected }) => {
    expect(computeBackoffDelay(retryNumber, policy, makeRandom(0.5))).toBe(expected);
  });

  it('caps the window at maxDelayMs', () => {
    expect(computeBackoffDelay(20, policy, makeRandom(0.5))).toBe(500);
  });

  it('spans the full window from zero up to the ceiling', () => {
    expect(computeBackoffDelay(3, policy, makeRandom(0))).toBe(0);
    expect(computeBackoffDelay(3, policy, makeRandom(0.999_999))).toBe(399);
  });
});
