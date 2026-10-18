import { stringify } from 'yaml';

import {
  type BenchmarkStats,
  type CommandIo,
  type Environment,
  loadCatalog,
  type ObjectiveResult,
  type ResolvedSlo,
} from '../../src/index.js';

// ── OpenSLO documents ─────────────────────────────────────────────────────

type Doc = Record<string, unknown>;

/** Joins documents into one multi-document YAML file, as spec files are written. */
export function toYaml(...docs: readonly Doc[]): string {
  return docs.map((doc) => stringify(doc)).join('---\n');
}

export function makeService(name = 'svc'): Doc {
  return { apiVersion: 'openslo/v1', kind: 'Service', metadata: { name }, spec: {} };
}

export function makeBenchSpec(overrides: Doc = {}): Doc {
  return {
    package: 'retry',
    benchmark: 'tests/bench/x.bench.ts > group > bench',
    batchSize: 10,
    unit: 'ns',
    ...overrides,
  };
}

export function makeBenchSli(name = 'bench-sli', spec: Doc = makeBenchSpec()): Doc {
  return {
    apiVersion: 'openslo/v1',
    kind: 'SLI',
    metadata: { name },
    spec: { thresholdMetric: { metricSource: { type: 'vitest-bench', spec } } },
  };
}

export function makeObjective(overrides: Doc = {}): Doc {
  return { displayName: 'p99', op: 'lte', value: 100, target: 0.99, ...overrides };
}

export function makeSlo(overrides: { metadata?: Doc; spec?: Doc } = {}): Doc {
  return {
    apiVersion: 'openslo/v1',
    kind: 'SLO',
    metadata: { name: 'bench-slo', ...overrides.metadata },
    spec: {
      service: 'svc',
      indicatorRef: 'bench-sli',
      budgetingMethod: 'Occurrences',
      timeWindow: [{ duration: '1d', isRolling: true }],
      objectives: [makeObjective()],
      ...overrides.spec,
    },
  };
}

export function makeAlertCondition(
  name: string,
  lookbackWindow: string,
  shortWindow?: string,
): Doc {
  return {
    apiVersion: 'openslo/v1',
    kind: 'AlertCondition',
    metadata: {
      name,
      ...(shortWindow === undefined
        ? {}
        : { annotations: { 'dev-best-practices/short-window': shortWindow } }),
    },
    spec: {
      severity: 'page',
      condition: { kind: 'burnrate', op: 'gte', threshold: 14.4, lookbackWindow },
    },
  };
}

export function makeAlertPolicy(name: string, conditionRef: string, targetRef = 'pager'): Doc {
  return {
    apiVersion: 'openslo/v1',
    kind: 'AlertPolicy',
    metadata: { name },
    spec: { conditions: [{ conditionRef }], notificationTargets: [{ targetRef }] },
  };
}

export function makeNotificationTarget(name = 'pager'): Doc {
  return {
    apiVersion: 'openslo/v1',
    kind: 'AlertNotificationTarget',
    metadata: { name },
    spec: { target: 'pager' },
  };
}

/** A complete, valid benchmark-backed SLO set. */
export function validBenchDocs(): Doc[] {
  return [makeService(), makeBenchSli(), makeSlo()];
}

/** Loads documents and returns the one SLO they define. */
export function loadOneSlo(...docs: readonly Doc[]): ResolvedSlo {
  const [slo] = loadCatalog([{ source: 'test.openslo.yaml', text: toYaml(...docs) }]).slos;
  if (slo === undefined) {
    throw new Error('expected one SLO');
  }
  return slo;
}

// ── Benchmark stats ───────────────────────────────────────────────────────

/** Iteration times in milliseconds. The defaults rise steadily, so interpolation is easy to follow. */
export function makeStats(overrides: Partial<BenchmarkStats> = {}): BenchmarkStats {
  return {
    name: 'bench',
    rme: 1,
    sampleCount: 1_000,
    min: 0.0001,
    median: 0.0005,
    p75: 0.0006,
    p99: 0.0009,
    p995: 0.00095,
    p999: 0.00099,
    max: 0.002,
    ...overrides,
  };
}

/** A `vitest bench --outputJson` report holding one benchmark per entry. */
export function makeBenchReport(
  entries: readonly { key: string; stats: BenchmarkStats }[],
): string {
  return JSON.stringify({
    files: entries.map(({ key, stats }) => {
      const separator = key.lastIndexOf(' > ');
      return {
        filepath: '/abs/path.bench.ts',
        groups: [
          {
            fullName: key.slice(0, separator),
            benchmarks: [{ ...stats, name: key.slice(separator + 3), samples: [] }],
          },
        ],
      };
    }),
  });
}

export function makeResult(overrides: Partial<ObjectiveResult> = {}): ObjectiveResult {
  return {
    key: 'bench-slo/0',
    slo: 'bench-slo',
    objective: 'p99',
    target: 0.99,
    op: 'lte',
    threshold: 100,
    unit: 'ns',
    measured: 90,
    medianNsPerOp: 90,
    budgetRemaining: 0.5,
    passed: true,
    rme: 1,
    sampleCount: 1_000,
    ...overrides,
  };
}

export const LAPTOP: Environment = {
  platform: 'darwin',
  arch: 'arm64',
  cpuModel: 'Test CPU',
  nodeMajor: 22,
};

// ── Command IO ────────────────────────────────────────────────────────────

/** In-memory file system and captured output for {@link runSloCommand} tests. */
interface FakeIo extends CommandIo {
  readonly files: Map<string, string>;
  readonly out: string[];
  readonly err: string[];
}

export function makeIo(
  files: Record<string, string> = {},
  overrides: Partial<CommandIo> = {},
): FakeIo {
  const store = new Map(Object.entries(files));
  const out: string[] = [];
  const err: string[] = [];
  return {
    files: store,
    out,
    err,
    readFile: (path) => Promise.resolve(store.get(path)),
    writeFile: (path, text) => {
      store.set(path, text);
      return Promise.resolve();
    },
    appendFile: (path, text) => {
      store.set(path, (store.get(path) ?? '') + text);
      return Promise.resolve();
    },
    listDir: (path) =>
      Promise.resolve(
        [...store.keys()]
          .filter((key) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/'))
          .map((key) => key.slice(path.length + 1)),
      ),
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
    environment: LAPTOP,
    stepSummaryPath: undefined,
    now: () => new Date('2026-10-18T12:00:00.000Z'),
    ...overrides,
  };
}
