import { z } from 'zod';

import { SloInputError } from './errors.js';
import type { ObjectiveResult } from './evaluate.js';

const EnvironmentSchema = z.strictObject({
  platform: z.string(),
  arch: z.string(),
  cpuModel: z.string(),
  nodeMajor: z.int().positive(),
});

const BaselineFileSchema = z.strictObject({
  schemaVersion: z.literal(1),
  environments: z.array(
    z.strictObject({
      environment: EnvironmentSchema,
      recordedAt: z.iso.datetime(),
      /** Median nanoseconds per operation, keyed by result key. */
      medianNsPerOp: z.record(z.string(), z.number().nonnegative()),
    }),
  ),
});

/**
 * The machine a measurement came from. Benchmark timings only compare within one machine
 * class, so a baseline applies only where the fingerprint matches.
 */
export type Environment = z.infer<typeof EnvironmentSchema>;

/** Committed reference measurements for one spec file, one entry per machine class. */
export type BaselineFile = z.infer<typeof BaselineFileSchema>;

/** How one objective compares to the baseline for this machine. */
export type BaselineComparison =
  | { readonly status: 'no-baseline' }
  | { readonly status: 'ok' | 'regressed'; readonly change: number };

/**
 * @throws {SloInputError} when the text is not a valid baseline file.
 */
export function parseBaselineFile(text: string, source: string): BaselineFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error: unknown) {
    throw new SloInputError(`${source} is not valid JSON`, { cause: error });
  }
  const parsed = BaselineFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new SloInputError(
      `${source} is not a valid baseline file: ${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}

/**
 * Compares a result's median to the baseline recorded on the same machine class.
 * `change` is the fractional slowdown (0.25 means 25% slower), and the result regresses
 * when the change exceeds `threshold`.
 */
export function compareToBaseline(
  result: ObjectiveResult,
  baseline: BaselineFile | undefined,
  environment: Environment,
  threshold: number,
): BaselineComparison {
  const reference = findEntry(baseline, environment)?.medianNsPerOp[result.key];
  if (reference === undefined || reference === 0) {
    return { status: 'no-baseline' };
  }
  const change = result.medianNsPerOp / reference - 1;
  return { status: change > threshold ? 'regressed' : 'ok', change };
}

/**
 * Records `results` as the baseline for `environment`, replacing that machine's previous
 * entry and keeping every other machine's. Keys and entries are sorted so re-recording
 * produces a minimal diff.
 */
export function recordBaseline(
  baseline: BaselineFile | undefined,
  environment: Environment,
  results: readonly ObjectiveResult[],
  recordedAt: Date,
): BaselineFile {
  const others = (baseline?.environments ?? []).filter(
    (entry) => environmentKey(entry.environment) !== environmentKey(environment),
  );
  const medianNsPerOp = Object.fromEntries(
    results
      .map((result) => [result.key, round(result.medianNsPerOp)] as const)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  const entry = { environment, recordedAt: recordedAt.toISOString(), medianNsPerOp };
  return {
    schemaVersion: 1,
    environments: [...others, entry].sort((a, b) =>
      environmentKey(a.environment).localeCompare(environmentKey(b.environment)),
    ),
  };
}

function findEntry(
  baseline: BaselineFile | undefined,
  environment: Environment,
): BaselineFile['environments'][number] | undefined {
  const key = environmentKey(environment);
  return baseline?.environments.find((entry) => environmentKey(entry.environment) === key);
}

function environmentKey(environment: Environment): string {
  return [environment.platform, environment.arch, environment.cpuModel, environment.nodeMajor].join(
    '|',
  );
}

// Four significant digits keep the file readable. Run-to-run noise is far larger.
function round(value: number): number {
  return Number(value.toPrecision(4));
}
