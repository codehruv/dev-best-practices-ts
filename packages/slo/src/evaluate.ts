import type { BenchmarkStats } from './bench-report.js';
import type { BenchmarkSource, BenchmarkUnit } from './benchmark-source.js';
import type { ResolvedSlo } from './catalog.js';
import { SloInputError } from './errors.js';
import type { Comparison } from './openslo.js';

/** The outcome of one benchmark-backed objective. */
export interface ObjectiveResult {
  /** Stable identity across runs, used to key baselines: `<slo>/<objective index>`. */
  readonly key: string;
  readonly slo: string;
  readonly objective: string;
  /** Fraction of operations that must meet the threshold, such as 0.99. */
  readonly target: number;
  readonly op: Comparison;
  readonly threshold: number;
  readonly unit: BenchmarkUnit;
  /** The value at the target quantile, in `unit`. For latency, p99 when `target` is 0.99. */
  readonly measured: number;
  /**
   * Median per-operation latency, which the baseline comparison uses. The median of
   * thousands of iterations barely moves under machine load, while tail quantiles swing
   * by multiples. Nanoseconds, so it compares across units and batch sizes.
   */
  readonly medianNsPerOp: number;
  /** 1 means untouched, 0 means exhausted, below 0 means overspent. */
  readonly budgetRemaining: number;
  readonly passed: boolean;
  /** Relative margin of error of the benchmark mean, in percent. High values mean a noisy run. */
  readonly rme: number;
  readonly sampleCount: number;
}

interface QuantilePoint {
  readonly q: number;
  readonly ms: number;
}

/**
 * Evaluates every objective of a benchmark-backed SLO against its benchmark stats.
 *
 * An objective `op: lte, value: V, target: T` means "a fraction T of operations take at
 * most V", so it passes when the T quantile meets V, and its error budget is the 1 - T
 * fraction of operations allowed to miss.
 *
 * @throws {SloInputError} when the SLO has no benchmark source or the stats are not a
 *   valid distribution.
 */
export function evaluateBenchmarkSlo(slo: ResolvedSlo, stats: BenchmarkStats): ObjectiveResult[] {
  const source = slo.benchmark;
  if (source === undefined) {
    throw new SloInputError(`SLO "${slo.name}" is not measured by a benchmark`);
  }
  const points = distributionOf(stats, source.benchmark);

  return slo.objectives.map((objective) => {
    const { op, value } = objective;
    if (op === undefined || value === undefined) {
      throw new SloInputError(`SLO "${slo.name}" objective ${objective.index} has no op or value`);
    }
    const iterationMs = quantileAt(points, objective.target);
    const measured = toUnit(iterationMs, source);
    const goodFraction = fractionAtOrBelow(points, toIterationMs(value, source));
    const allowedBadFraction = 1 - objective.target;
    return {
      key: `${slo.name}/${objective.index}`,
      slo: slo.name,
      objective: objective.displayName,
      target: objective.target,
      op,
      threshold: value,
      unit: source.unit,
      measured,
      medianNsPerOp: (stats.median * 1e6) / source.batchSize,
      budgetRemaining: 1 - (1 - goodFraction) / allowedBadFraction,
      passed: compare(measured, op, value),
      rme: stats.rme,
      sampleCount: stats.sampleCount,
    };
  });
}

/** Builds the quantile curve Vitest reports and rejects one that is not non-decreasing. */
function distributionOf(stats: BenchmarkStats, benchmark: string): QuantilePoint[] {
  const points = [
    { q: 0, ms: stats.min },
    { q: 0.5, ms: stats.median },
    { q: 0.75, ms: stats.p75 },
    { q: 0.99, ms: stats.p99 },
    { q: 0.995, ms: stats.p995 },
    { q: 0.999, ms: stats.p999 },
    { q: 1, ms: stats.max },
  ];
  if (stats.sampleCount === 0) {
    throw new SloInputError(`benchmark "${benchmark}" recorded no samples`);
  }
  for (let i = 1; i < points.length; i++) {
    if ((points[i]?.ms ?? 0) < (points[i - 1]?.ms ?? 0)) {
      throw new SloInputError(`benchmark "${benchmark}" reports decreasing quantiles`);
    }
  }
  return points;
}

/**
 * Iteration time at quantile `q`, interpolated linearly between the reported quantiles.
 * Exact at the reported quantiles (0.5, 0.75, 0.99, 0.995, 0.999).
 */
function quantileAt(points: readonly QuantilePoint[], q: number): number {
  for (let i = 1; i < points.length; i++) {
    const lower = points[i - 1];
    const upper = points[i];
    if (lower !== undefined && upper !== undefined && q <= upper.q) {
      return lower.ms + ((q - lower.q) / (upper.q - lower.q)) * (upper.ms - lower.ms);
    }
  }
  return points.at(-1)?.ms ?? 0;
}

/**
 * Estimated fraction of iterations at or below `ms`: the inverse of {@link quantileAt}.
 * Vitest does not export raw samples, so the error budget comes from this estimate.
 */
function fractionAtOrBelow(points: readonly QuantilePoint[], ms: number): number {
  const first = points[0];
  const last = points.at(-1);
  if (first === undefined || last === undefined || ms < first.ms) {
    return 0;
  }
  if (ms >= last.ms) {
    return 1;
  }
  // The last point at or below `ms` starts the segment, which also handles flat
  // segments where several quantiles share one value.
  for (let i = points.length - 2; i >= 0; i--) {
    const lower = points[i];
    const upper = points[i + 1];
    if (lower !== undefined && upper !== undefined && lower.ms <= ms) {
      return lower.q + ((ms - lower.ms) / (upper.ms - lower.ms)) * (upper.q - lower.q);
    }
  }
  return 0;
}

/** Converts one iteration's time to the SLI's unit, per operation. */
function toUnit(iterationMs: number, source: BenchmarkSource): number {
  const msPerOp = iterationMs / source.batchSize;
  switch (source.unit) {
    case 'ns':
      return msPerOp * 1e6;
    case 'us':
      return msPerOp * 1e3;
    case 'ms':
      return msPerOp;
    case 'ops/s':
      return msPerOp === 0 ? Number.POSITIVE_INFINITY : 1_000 / msPerOp;
  }
}

/** The iteration time that corresponds to an objective's threshold value. */
function toIterationMs(value: number, source: BenchmarkSource): number {
  switch (source.unit) {
    case 'ns':
      return (value / 1e6) * source.batchSize;
    case 'us':
      return (value / 1e3) * source.batchSize;
    case 'ms':
      return value * source.batchSize;
    case 'ops/s':
      return (1_000 / value) * source.batchSize;
  }
}

function compare(measured: number, op: Comparison, threshold: number): boolean {
  switch (op) {
    case 'lt':
      return measured < threshold;
    case 'lte':
      return measured <= threshold;
    case 'gt':
      return measured > threshold;
    case 'gte':
      return measured >= threshold;
  }
}
