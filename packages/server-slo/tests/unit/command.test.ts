import { describe, expect, it } from 'vitest';

import { ExitCode, runSloCommand } from '../../src/index.js';
import {
  makeBenchReport,
  makeIo,
  makeObjective,
  makeSlo,
  makeStats,
  toYaml,
  validBenchDocs,
} from './fakes.js';

const BENCH_KEY = 'tests/bench/x.bench.ts > group > bench';
const SPEC_PATH = 'slo/lib.openslo.yaml';
const RESULTS_PATH = 'packages/iso-retry/.slo/bench.json';
const BASELINE_PATH = 'slo/baselines/lib.json';

/** A repo with one benchmark SLO (p99 <= 100 ns) and results measuring 90 ns. */
function repoFiles(objectiveValue = 100): Record<string, string> {
  const [service, sli] = validBenchDocs();
  return {
    [SPEC_PATH]: toYaml(
      service ?? {},
      sli ?? {},
      makeSlo({ spec: { objectives: [makeObjective({ value: objectiveValue })] } }),
    ),
    [RESULTS_PATH]: makeBenchReport([{ key: BENCH_KEY, stats: makeStats() }]),
  };
}

describe('runSloCommand', () => {
  describe('validate', () => {
    it('summarizes every SLO and exits 0', async () => {
      const io = makeIo(repoFiles());

      expect(await runSloCommand(['validate'], io)).toBe(ExitCode.ok);
      expect(io.out.join('')).toBe(
        `bench-slo: 1 objective(s), 0 alert tier(s), measured by benchmark "${BENCH_KEY}"\n` +
          'Validated 1 SLO(s) across 1 file(s).\n',
      );
    });

    it('exits 2 with every spec issue', async () => {
      const io = makeIo({ [SPEC_PATH]: toYaml(makeSlo()) });

      expect(await runSloCommand(['validate'], io)).toBe(ExitCode.invalidInput);
      expect(io.err.join('')).toContain('references Service "svc", which is not defined');
      expect(io.err.join('')).toContain('references SLI "bench-sli", which is not defined');
    });

    it('exits 2 when the directory has no spec files', async () => {
      const io = makeIo({ 'slo/notes.md': '' });

      expect(await runSloCommand(['validate'], io)).toBe(ExitCode.invalidInput);
      expect(io.err.join('')).toContain('slo contains no *.openslo.yaml files');
    });

    it('reads specs from --dir', async () => {
      const io = makeIo({ 'specs/lib.openslo.yaml': repoFiles()[SPEC_PATH] ?? '' });

      expect(await runSloCommand(['validate', '--dir', 'specs'], io)).toBe(ExitCode.ok);
    });
  });

  describe('check', () => {
    it('prints the table and exits 0 when every objective passes', async () => {
      const io = makeIo(repoFiles());

      expect(await runSloCommand(['check'], io)).toBe(ExitCode.ok);
      expect(io.out.join('')).toContain('bench-slo  p99        99%     <= 100 ns  p99 90 ns');
      expect(io.err).toEqual([]);
    });

    it('exits 1 when an objective misses', async () => {
      const io = makeIo(repoFiles(80));

      expect(await runSloCommand(['check'], io)).toBe(ExitCode.objectiveMissed);
      expect(io.out.join('')).toContain('FAIL');
      expect(io.err.join('')).toContain('1 objective(s) missed their SLO');
    });

    // Within the 500 ns objective, but the median is 50% slower than the recorded 50 ns.
    const SLOWER = makeBenchReport([
      { key: BENCH_KEY, stats: makeStats({ median: 0.000_75, p75: 0.0008 }) },
    ]);

    it('exits 1 when this machine regressed past the baseline threshold', async () => {
      const io = makeIo(repoFiles(500));
      await runSloCommand(['baseline'], io);
      io.files.set(RESULTS_PATH, SLOWER);
      io.out.length = 0;

      expect(await runSloCommand(['check'], io)).toBe(ExitCode.objectiveMissed);
      expect(io.out.join('')).toContain('+50.0%              REGRESSED');
    });

    it('ignores a baseline recorded on a different machine', async () => {
      const ci = { platform: 'linux', arch: 'x64', cpuModel: 'CI', nodeMajor: 22 };
      const recorder = makeIo(repoFiles(500), { environment: ci });
      await runSloCommand(['baseline'], recorder);
      const io = makeIo(Object.fromEntries(recorder.files));
      io.files.set(RESULTS_PATH, SLOWER);

      expect(await runSloCommand(['check'], io)).toBe(ExitCode.ok);
      expect(io.out.join('')).toContain('n/a                 PASS');
    });

    it('exits 2 and says how to produce missing benchmark results', async () => {
      const withoutResults = Object.entries(repoFiles()).filter(([path]) => path !== RESULTS_PATH);
      const io = makeIo(Object.fromEntries(withoutResults));

      expect(await runSloCommand(['check'], io)).toBe(ExitCode.invalidInput);
      expect(io.err.join('')).toContain(
        `${RESULTS_PATH} does not exist. Run the benchmarks first: just slo`,
      );
    });

    it('lists the known benchmarks when the SLI names an unknown one', async () => {
      const io = makeIo({
        ...repoFiles(),
        [RESULTS_PATH]: makeBenchReport([
          { key: 'tests/bench/x.bench.ts > group > renamed', stats: makeStats() },
        ]),
      });

      expect(await runSloCommand(['check'], io)).toBe(ExitCode.invalidInput);
      expect(io.err.join('')).toContain(
        'Known benchmarks:\n  tests/bench/x.bench.ts > group > renamed',
      );
    });

    it('appends a Markdown table to the job summary', async () => {
      const io = makeIo(
        { ...repoFiles(), 'summary.md': '# Earlier step\n' },
        { stepSummaryPath: 'summary.md' },
      );

      await runSloCommand(['check'], io);

      expect(io.files.get('summary.md')).toMatch(/^# Earlier step\n## SLO check\n\n\| SLO \|/);
    });

    it('writes github-action-benchmark input files on request', async () => {
      const io = makeIo(repoFiles());

      await runSloCommand(['check', '--benchmark-action-dir', 'out'], io);

      expect(JSON.parse(io.files.get('out/smaller-is-better.json') ?? '')).toEqual([
        {
          name: 'bench-slo: p99',
          unit: 'ns',
          value: expect.closeTo(90, 6) as unknown,
          extra: 'p99, 1000 samples, rme ±1.00%',
        },
      ]);
      expect(JSON.parse(io.files.get('out/bigger-is-better.json') ?? '')).toEqual([]);
    });

    it('warns about noisy runs without failing them', async () => {
      const io = makeIo({
        ...repoFiles(),
        [RESULTS_PATH]: makeBenchReport([{ key: BENCH_KEY, stats: makeStats({ rme: 12 }) }]),
      });

      expect(await runSloCommand(['check'], io)).toBe(ExitCode.ok);
      expect(io.err.join('')).toContain('warning: bench-slo/0 is noisy (rme ±12.0%)');
    });

    it('skips SLOs measured by monitoring', async () => {
      const prometheusSli = {
        apiVersion: 'openslo/v1',
        kind: 'SLI',
        metadata: { name: 'live' },
        spec: { thresholdMetric: { metricSource: { type: 'Prometheus', spec: {} } } },
      };
      const io = makeIo({
        ...repoFiles(),
        'slo/live.openslo.yaml': toYaml(
          prometheusSli,
          makeSlo({ metadata: { name: 'live-slo' }, spec: { indicatorRef: 'live' } }),
        ),
      });

      expect(await runSloCommand(['check'], io)).toBe(ExitCode.ok);
      expect(io.out.join('')).not.toContain('live-slo');
    });
  });

  describe('baseline', () => {
    it("writes this machine's measurements next to the spec", async () => {
      const io = makeIo(repoFiles());

      expect(await runSloCommand(['baseline'], io)).toBe(ExitCode.ok);
      expect(JSON.parse(io.files.get(BASELINE_PATH) ?? '')).toEqual({
        schemaVersion: 1,
        environments: [
          {
            environment: io.environment,
            recordedAt: '2026-10-18T12:00:00.000Z',
            medianNsPerOp: { 'bench-slo/0': 50 },
          },
        ],
      });
      expect(io.out.join('')).toContain(`Recorded 1 measurement(s) in ${BASELINE_PATH}`);
    });

    it('writes to --baselines', async () => {
      const io = makeIo(repoFiles());

      await runSloCommand(['baseline', '--baselines', 'elsewhere'], io);

      expect(io.files.has('elsewhere/lib.json')).toBe(true);
    });
  });

  it.each([[[]], [['explode']], [['check', '--unknown-flag']]])(
    'prints usage and exits 2 for %j',
    async (argv) => {
      const io = makeIo(repoFiles());

      expect(await runSloCommand(argv, io)).toBe(ExitCode.invalidInput);
      expect(io.err.join('')).toContain('Usage: slo <validate|check|baseline>');
    },
  );
});
