import { describe, expect, it } from 'vitest';

import { evaluateBenchmarkSlo, SloInputError } from '../../src/index.js';
import {
  loadOneSlo,
  makeBenchSli,
  makeBenchSpec,
  makeObjective,
  makeService,
  makeSlo,
  makeStats,
} from './fakes.js';

/** An SLO over a benchmark with batch size 10, so 0.001 ms per iteration is 100 ns per op. */
function sloWith(objectives: Record<string, unknown>[], unit = 'ns') {
  return loadOneSlo(
    makeService(),
    makeBenchSli('bench-sli', makeBenchSpec({ unit, batchSize: 10 })),
    makeSlo({ spec: { objectives } }),
  );
}

describe('evaluateBenchmarkSlo', () => {
  it('reads the reported quantile matching the target, per operation', () => {
    // p99 iteration time 0.0009 ms over a batch of 10 is 90 ns per operation, and the
    // median 0.0005 ms is 50 ns.
    const [result] = evaluateBenchmarkSlo(sloWith([makeObjective({ value: 100 })]), makeStats());

    expect(result).toMatchObject({
      key: 'bench-slo/0',
      measured: expect.closeTo(90, 6) as unknown,
      medianNsPerOp: expect.closeTo(50, 6) as unknown,
      passed: true,
    });
  });

  it.each([
    { target: 0.5, expected: 50 },
    { target: 0.75, expected: 60 },
    { target: 0.995, expected: 95 },
    { target: 0.999, expected: 99 },
  ])('maps target $target to its reported quantile', ({ target, expected }) => {
    const [result] = evaluateBenchmarkSlo(
      sloWith([makeObjective({ target, value: 1_000 })]),
      makeStats(),
    );

    expect(result?.measured).toBeCloseTo(expected, 6);
  });

  it('interpolates targets between reported quantiles', () => {
    // Halfway between p50 (0.0005) and p75 (0.0006).
    const [result] = evaluateBenchmarkSlo(
      sloWith([makeObjective({ target: 0.625, value: 1_000 })]),
      makeStats(),
    );

    expect(result?.measured).toBeCloseTo(55, 6);
  });

  it('fails an objective whose quantile misses the threshold', () => {
    const [result] = evaluateBenchmarkSlo(sloWith([makeObjective({ value: 80 })]), makeStats());

    expect(result?.passed).toBe(false);
  });

  it('treats lt as strict and lte as inclusive', () => {
    const stats = makeStats();
    const measured = evaluateBenchmarkSlo(sloWith([makeObjective()]), stats)[0]?.measured ?? 0;

    const results = evaluateBenchmarkSlo(
      sloWith([
        makeObjective({ op: 'lte', value: measured }),
        makeObjective({ op: 'lt', value: measured }),
      ]),
      stats,
    );

    expect(results.map((result) => result.passed)).toEqual([true, false]);
  });

  describe('error budget', () => {
    it('is untouched when every iteration meets the threshold', () => {
      const [result] = evaluateBenchmarkSlo(sloWith([makeObjective({ value: 500 })]), makeStats());

      expect(result?.budgetRemaining).toBe(1);
    });

    it('is the share of the allowed misses still unused', () => {
      // 95 ns per op is the p99.5, so 0.5% of iterations miss. A 0.99 target allows 1%.
      const [result] = evaluateBenchmarkSlo(sloWith([makeObjective({ value: 95 })]), makeStats());

      expect(result?.budgetRemaining).toBeCloseTo(0.5, 6);
    });

    it('is exactly zero when the target quantile sits on the threshold', () => {
      const [result] = evaluateBenchmarkSlo(sloWith([makeObjective({ value: 90 })]), makeStats());

      expect(result?.budgetRemaining).toBeCloseTo(0, 6);
      expect(result?.passed).toBe(true);
    });

    it('goes negative when overspent', () => {
      // 50 ns per op is the median, so half of iterations miss against a 1% allowance.
      const [result] = evaluateBenchmarkSlo(sloWith([makeObjective({ value: 50 })]), makeStats());

      expect(result?.budgetRemaining).toBeCloseTo(1 - 0.5 / 0.01, 6);
    });

    it('is fully spent when every iteration misses', () => {
      const [result] = evaluateBenchmarkSlo(sloWith([makeObjective({ value: 5 })]), makeStats());

      expect(result?.budgetRemaining).toBeCloseTo(1 - 1 / 0.01, 6);
    });

    it('uses the highest quantile when several share one value', () => {
      const stats = makeStats({ p99: 0.0009, p995: 0.0009, p999: 0.0009 });
      const [result] = evaluateBenchmarkSlo(sloWith([makeObjective({ value: 90 })]), stats);

      // 0.999 of iterations are at or below 90 ns, so 0.1% miss against a 1% allowance.
      expect(result?.budgetRemaining).toBeCloseTo(0.9, 6);
    });
  });

  describe('units', () => {
    it.each([
      { unit: 'us', value: 1, expected: 0.09 },
      { unit: 'ms', value: 1, expected: 0.000_09 },
    ])('converts iteration time to $unit per operation', ({ unit, value, expected }) => {
      const [result] = evaluateBenchmarkSlo(sloWith([makeObjective({ value })], unit), makeStats());

      expect(result?.measured).toBeCloseTo(expected, 9);
    });

    it('reports throughput as operations per second at the target quantile', () => {
      // Median 0.0005 ms per 10 operations is 20 million operations per second. The
      // slowest iteration (0.002 ms) still delivers 5 million, above the 4 million floor.
      const [result] = evaluateBenchmarkSlo(
        sloWith([makeObjective({ op: 'gte', target: 0.5, value: 4_000_000 })], 'ops/s'),
        makeStats(),
      );

      expect(result).toMatchObject({ passed: true, budgetRemaining: 1 });
      expect(result?.measured).toBeCloseTo(20_000_000, 0);
    });

    it('spends throughput budget on iterations slower than the floor', () => {
      // 12.5 million ops/s needs 0.0008 ms per iteration, which sits between p75 and p99.
      const [result] = evaluateBenchmarkSlo(
        sloWith([makeObjective({ op: 'gte', target: 0.5, value: 12_500_000 })], 'ops/s'),
        makeStats(),
      );
      const fasterFraction = 0.75 + ((0.0008 - 0.0006) / (0.0009 - 0.0006)) * (0.99 - 0.75);

      expect(result?.budgetRemaining).toBeCloseTo(1 - (1 - fasterFraction) / 0.5, 6);
    });

    it('reports infinite throughput when iterations are below timer resolution', () => {
      const stats = makeStats({ min: 0, median: 0 });
      const [result] = evaluateBenchmarkSlo(
        sloWith([makeObjective({ op: 'gte', target: 0.5, value: 1 })], 'ops/s'),
        stats,
      );

      expect(result?.measured).toBe(Number.POSITIVE_INFINITY);
    });
  });

  it('carries noise indicators through', () => {
    const [result] = evaluateBenchmarkSlo(
      sloWith([makeObjective()]),
      makeStats({ rme: 7.5, sampleCount: 42 }),
    );

    expect(result).toMatchObject({ rme: 7.5, sampleCount: 42 });
  });

  it('rejects stats with decreasing quantiles', () => {
    expect(() =>
      evaluateBenchmarkSlo(sloWith([makeObjective()]), makeStats({ p75: 0.0001 })),
    ).toThrow(/decreasing quantiles/);
  });

  it('rejects stats with no samples', () => {
    expect(() =>
      evaluateBenchmarkSlo(sloWith([makeObjective()]), makeStats({ sampleCount: 0 })),
    ).toThrow(SloInputError);
  });

  it('rejects an SLO not measured by a benchmark', () => {
    const prometheus = {
      apiVersion: 'openslo/v1',
      kind: 'SLI',
      metadata: { name: 'bench-sli' },
      spec: { thresholdMetric: { metricSource: { type: 'Prometheus', spec: {} } } },
    };
    const slo = loadOneSlo(makeService(), prometheus, makeSlo());

    expect(() => evaluateBenchmarkSlo(slo, makeStats())).toThrow(/not measured by a benchmark/);
  });
});
