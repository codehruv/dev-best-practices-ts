import { z } from 'zod';

import { SloInputError } from './errors.js';

// Vitest writes more fields than these. Only the distribution summary is read, and the
// per-sample array stays empty in `--outputJson` output, so it is not part of the contract.
const BenchmarkStatsSchema = z.object({
  name: z.string(),
  /** Relative margin of error of the mean, in percent. */
  rme: z.number(),
  sampleCount: z.number().int().nonnegative(),
  min: z.number().nonnegative(),
  median: z.number().nonnegative(),
  p75: z.number().nonnegative(),
  p99: z.number().nonnegative(),
  p995: z.number().nonnegative(),
  p999: z.number().nonnegative(),
  max: z.number().nonnegative(),
});

const VitestBenchReportSchema = z.object({
  files: z.array(
    z.object({
      groups: z.array(
        z.object({
          fullName: z.string(),
          benchmarks: z.array(BenchmarkStatsSchema),
        }),
      ),
    }),
  ),
});

/** The distribution of one benchmark's iteration times, in milliseconds per iteration. */
export type BenchmarkStats = z.infer<typeof BenchmarkStatsSchema>;

/**
 * Parses a `vitest bench --outputJson` report into stats keyed the way SLIs reference
 * them: `<file> > <describe> > <bench>`.
 *
 * @throws {SloInputError} when the text is not a Vitest benchmark report.
 */
export function parseVitestBenchReport(text: string, source: string): Map<string, BenchmarkStats> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error: unknown) {
    throw new SloInputError(`${source} is not valid JSON`, { cause: error });
  }
  const parsed = VitestBenchReportSchema.safeParse(raw);
  if (!parsed.success) {
    throw new SloInputError(
      `${source} is not a Vitest benchmark report: ${z.prettifyError(parsed.error)}`,
    );
  }

  const stats = new Map<string, BenchmarkStats>();
  for (const file of parsed.data.files) {
    for (const group of file.groups) {
      for (const benchmark of group.benchmarks) {
        stats.set(`${group.fullName} > ${benchmark.name}`, benchmark);
      }
    }
  }
  return stats;
}
