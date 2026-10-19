import { mathRandom, timerSleeper } from '@dbp/iso-retry';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('timerSleeper', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves after the requested delay', async () => {
    const sleep = timerSleeper.sleep(1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(sleep).resolves.toBeUndefined();
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort(new Error('cancelled'));
    await expect(timerSleeper.sleep(1_000, controller.signal)).rejects.toThrow('cancelled');
  });

  it('rejects early when the signal aborts mid-sleep', async () => {
    const controller = new AbortController();
    const sleep = timerSleeper.sleep(1_000, controller.signal);
    controller.abort('stop');
    await expect(sleep).rejects.toMatchObject({ message: 'Aborted', cause: 'stop' });
  });
});

describe('mathRandom', () => {
  it('returns values in [0, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const value = mathRandom.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
