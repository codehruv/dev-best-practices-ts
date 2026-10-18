import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  type BaselineFile,
  compareToBaseline,
  type Environment,
  parseBaselineFile,
  recordBaseline,
} from './baseline.js';
import { type BenchmarkStats, parseVitestBenchReport } from './bench-report.js';
import { loadCatalog, type ResolvedSlo, type SloCatalog } from './catalog.js';
import { SloError, SloInputError } from './errors.js';
import { evaluateBenchmarkSlo, type ObjectiveResult } from './evaluate.js';
import {
  failingRows,
  renderMarkdownTable,
  renderTextTable,
  type ReportRow,
  toBenchmarkActionEntries,
} from './report.js';

/**
 * Everything the command touches outside its own memory. The CLI passes real file system
 * and process access, and tests pass in-memory fakes.
 */
export interface CommandIo {
  /** Resolves undefined when the file does not exist. */
  readFile(path: string): Promise<string | undefined>;
  writeFile(path: string, text: string): Promise<void>;
  appendFile(path: string, text: string): Promise<void>;
  listDir(path: string): Promise<string[]>;
  stdout(text: string): void;
  stderr(text: string): void;
  readonly environment: Environment;
  readonly stepSummaryPath: string | undefined;
  now(): Date;
}

/** Exit codes, so CI can tell a missed objective from a broken spec or missing input. */
export const ExitCode = { ok: 0, objectiveMissed: 1, invalidInput: 2 } as const;

const USAGE = `Usage: slo <validate|check|baseline> [options]

  validate   Validate every *.openslo.yaml file and its references.
  check      Evaluate benchmark-backed SLOs and compare them to the baseline.
  baseline   Evaluate benchmark-backed SLOs and record them as this machine's baseline.

Options:
  --dir <path>        SLO spec directory (default: slo)
  --root <path>       Repository root that contains packages/ (default: .)
  --baselines <path>  Baseline directory (default: <dir>/baselines)
  --benchmark-action-dir <path>
                      Also write github-action-benchmark input files to this directory
`;

const SPEC_SUFFIX = '.openslo.yaml';

/**
 * Runs one `slo` subcommand and returns the process exit code. Spec and input problems
 * print a message and return {@link ExitCode.invalidInput}. Bugs throw.
 */
export async function runSloCommand(argv: readonly string[], io: CommandIo): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        dir: { type: 'string', default: 'slo' },
        root: { type: 'string', default: '.' },
        baselines: { type: 'string' },
        'benchmark-action-dir': { type: 'string' },
      },
    });
  } catch (error: unknown) {
    io.stderr(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
    return ExitCode.invalidInput;
  }
  const { values, positionals } = parsed;
  const options: Options = {
    dir: values.dir,
    root: values.root,
    baselines: values.baselines ?? join(values.dir, 'baselines'),
    benchmarkActionDir: values['benchmark-action-dir'],
  };

  try {
    switch (positionals[0]) {
      case 'validate':
        return await validate(options, io);
      case 'check':
        return await check(options, io);
      case 'baseline':
        return await baseline(options, io);
      case undefined:
      default:
        io.stderr(USAGE);
        return ExitCode.invalidInput;
    }
  } catch (error: unknown) {
    if (error instanceof SloError) {
      io.stderr(`${error.message}\n`);
      return ExitCode.invalidInput;
    }
    throw error;
  }
}

interface Options {
  readonly dir: string;
  readonly root: string;
  readonly baselines: string;
  readonly benchmarkActionDir: string | undefined;
}

// ── Subcommands ───────────────────────────────────────────────────────────

async function validate(options: Options, io: CommandIo): Promise<number> {
  const { catalog, fileCount } = await readCatalog(options, io);
  for (const slo of catalog.slos) {
    const measuredBy =
      slo.benchmark === undefined ? 'monitoring' : `benchmark "${slo.benchmark.benchmark}"`;
    io.stdout(
      `${slo.name}: ${slo.objectives.length} objective(s), ${slo.alertConditions.length} alert tier(s), measured by ${measuredBy}\n`,
    );
  }
  io.stdout(`Validated ${catalog.slos.length} SLO(s) across ${fileCount} file(s).\n`);
  return ExitCode.ok;
}

async function check(options: Options, io: CommandIo): Promise<number> {
  const evaluation = await evaluate(options, io);
  const rows = evaluation.flatMap(({ slos, baseline }) =>
    slos.flatMap(({ slo, results }) =>
      results.map((result) => ({
        result,
        baseline: compareToBaseline(result, baseline, io.environment, slo.regressionThreshold),
      })),
    ),
  );
  await report(rows, options, io);

  const failing = failingRows(rows);
  if (failing.length > 0) {
    io.stderr(
      `${failing.length} objective(s) missed their SLO or regressed past the baseline threshold.\n`,
    );
    return ExitCode.objectiveMissed;
  }
  return ExitCode.ok;
}

async function baseline(options: Options, io: CommandIo): Promise<number> {
  const evaluation = await evaluate(options, io);
  for (const { baselinePath, baseline: previous, slos } of evaluation) {
    const results = slos.flatMap((entry) => entry.results);
    const next = recordBaseline(previous, io.environment, results, io.now());
    await io.writeFile(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
    io.stdout(`Recorded ${results.length} measurement(s) in ${baselinePath}\n`);
  }
  await report(
    evaluation.flatMap(({ slos }) =>
      slos.flatMap(({ results }) =>
        results.map((result) => ({ result, baseline: { status: 'no-baseline' as const } })),
      ),
    ),
    options,
    io,
  );
  return ExitCode.ok;
}

// ── Evaluation ────────────────────────────────────────────────────────────

interface SpecEvaluation {
  readonly baselinePath: string;
  readonly baseline: BaselineFile | undefined;
  readonly slos: readonly { readonly slo: ResolvedSlo; readonly results: ObjectiveResult[] }[];
}

async function evaluate(options: Options, io: CommandIo): Promise<SpecEvaluation[]> {
  const { catalog } = await readCatalog(options, io);
  const reports = new Map<string, Map<string, BenchmarkStats>>();
  const bySource = new Map<string, ResolvedSlo[]>();
  for (const slo of catalog.slos) {
    if (slo.benchmark !== undefined) {
      bySource.set(slo.source, [...(bySource.get(slo.source) ?? []), slo]);
    }
  }

  const evaluations: SpecEvaluation[] = [];
  for (const [source, slos] of bySource) {
    const baselinePath = join(options.baselines, `${basename(source, SPEC_SUFFIX)}.json`);
    const baselineText = await io.readFile(baselinePath);
    const evaluated = [];
    for (const slo of slos) {
      const stats = await statsFor(slo, options, io, reports);
      evaluated.push({ slo, results: evaluateBenchmarkSlo(slo, stats) });
    }
    evaluations.push({
      baselinePath,
      baseline:
        baselineText === undefined ? undefined : parseBaselineFile(baselineText, baselinePath),
      slos: evaluated,
    });
  }
  return evaluations;
}

async function statsFor(
  slo: ResolvedSlo,
  options: Options,
  io: CommandIo,
  cache: Map<string, Map<string, BenchmarkStats>>,
): Promise<BenchmarkStats> {
  const source = slo.benchmark;
  if (source === undefined) {
    throw new SloInputError(`SLO "${slo.name}" is not measured by a benchmark`);
  }
  const path = join(options.root, 'packages', source.package, '.slo', 'bench.json');
  let report = cache.get(path);
  if (report === undefined) {
    const text = await io.readFile(path);
    if (text === undefined) {
      throw new SloInputError(`${path} does not exist. Run the benchmarks first: just slo`);
    }
    report = parseVitestBenchReport(text, path);
    cache.set(path, report);
  }
  const stats = report.get(source.benchmark);
  if (stats === undefined) {
    const known = [...report.keys()].map((key) => `  ${key}`).join('\n');
    throw new SloInputError(
      `SLO "${slo.name}" names benchmark "${source.benchmark}", which ${path} does not contain. Known benchmarks:\n${known}`,
    );
  }
  return stats;
}

async function readCatalog(
  options: Options,
  io: CommandIo,
): Promise<{ catalog: SloCatalog; fileCount: number }> {
  const names = (await io.listDir(options.dir)).filter((name) => name.endsWith(SPEC_SUFFIX)).sort();
  if (names.length === 0) {
    throw new SloInputError(`${options.dir} contains no *${SPEC_SUFFIX} files`);
  }
  const files = [];
  for (const name of names) {
    const source = join(options.dir, name);
    files.push({ source, text: (await io.readFile(source)) ?? '' });
  }
  return { catalog: loadCatalog(files), fileCount: files.length };
}

// ── Output ────────────────────────────────────────────────────────────────

async function report(rows: readonly ReportRow[], options: Options, io: CommandIo): Promise<void> {
  io.stdout(`${renderTextTable(rows)}\n`);
  for (const { result } of rows) {
    // A wide margin of error means the machine was busy, so the numbers above carry less weight.
    if (result.rme > 5) {
      io.stderr(
        `warning: ${result.key} is noisy (rme ±${result.rme.toFixed(1)}%). Re-run on an idle machine.\n`,
      );
    }
  }
  if (io.stepSummaryPath !== undefined) {
    await io.appendFile(io.stepSummaryPath, `## SLO check\n\n${renderMarkdownTable(rows)}\n`);
  }
  if (options.benchmarkActionDir !== undefined) {
    const entries = toBenchmarkActionEntries(rows.map((row) => row.result));
    await io.writeFile(
      join(options.benchmarkActionDir, 'smaller-is-better.json'),
      `${JSON.stringify(entries.smallerIsBetter, null, 2)}\n`,
    );
    await io.writeFile(
      join(options.benchmarkActionDir, 'bigger-is-better.json'),
      `${JSON.stringify(entries.biggerIsBetter, null, 2)}\n`,
    );
  }
}
