import { z } from 'zod';

import type { Comparison } from './openslo.js';

/** The `metricSource.type` that marks an SLI as measured by a Vitest benchmark. */
export const VITEST_BENCH_SOURCE_TYPE = 'vitest-bench';

/**
 * The `metricSource.spec` of a benchmark-backed SLI. OpenSLO leaves `spec` free-form for
 * each source type, so this schema is the contract for the `vitest-bench` type.
 */
export const BenchmarkSourceSchema = z.strictObject({
  /** Directory name under `packages/` whose `.slo/bench.json` holds the results. */
  package: z.string().regex(/^[a-z0-9][-a-z0-9]*$/, 'must be a directory name under packages/'),
  /** `<file> > <describe> > <bench>`, exactly as Vitest names the benchmark. */
  benchmark: z.string().min(1),
  /**
   * How many operations one benchmark iteration performs. Must match the batch size in
   * the bench file, because measured values are divided by it.
   */
  batchSize: z.int().positive(),
  /** Per-operation latency (`ns`, `us`, `ms`) or throughput (`ops/s`). */
  unit: z.enum(['ns', 'us', 'ms', 'ops/s']),
});

/** A validated benchmark source. */
export type BenchmarkSource = z.infer<typeof BenchmarkSourceSchema>;

/** The unit a benchmark SLI reports in. */
export type BenchmarkUnit = BenchmarkSource['unit'];

/**
 * Latency objectives must cap the value (`lt`, `lte`), and throughput objectives must
 * floor it (`gt`, `gte`). Any other pairing would reward getting slower.
 */
export function allowedComparisons(unit: BenchmarkUnit): readonly Comparison[] {
  return unit === 'ops/s' ? ['gt', 'gte'] : ['lt', 'lte'];
}
