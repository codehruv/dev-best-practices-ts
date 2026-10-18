import { describe, expect, it } from 'vitest';

import {
  compareToBaseline,
  parseBaselineFile,
  parseVitestBenchReport,
  recordBaseline,
  SloInputError,
} from '../../src/index.js';
import { LAPTOP, makeBenchReport, makeResult, makeStats } from './fakes.js';

describe('parseVitestBenchReport', () => {
  it('keys each benchmark as "<file> > <describe> > <bench>"', () => {
    const text = makeBenchReport([
      { key: 'tests/a.bench.ts > group > first', stats: makeStats({ p99: 1 }) },
      { key: 'tests/b.bench.ts > other > second', stats: makeStats({ p99: 2 }) },
    ]);

    const report = parseVitestBenchReport(text, 'bench.json');

    expect([...report.keys()]).toEqual([
      'tests/a.bench.ts > group > first',
      'tests/b.bench.ts > other > second',
    ]);
    expect(report.get('tests/b.bench.ts > other > second')?.p99).toBe(2);
  });

  it('rejects text that is not JSON', () => {
    expect(() => parseVitestBenchReport('{', 'bench.json')).toThrow(/bench.json is not valid JSON/);
  });

  it('rejects JSON that is not a benchmark report', () => {
    expect(() => parseVitestBenchReport('{"files": [{}]}', 'bench.json')).toThrow(SloInputError);
  });
});

describe('baselines', () => {
  const OTHER_MACHINE = { ...LAPTOP, cpuModel: 'Other CPU' };

  it('round-trips through parseBaselineFile', () => {
    const recorded = recordBaseline(
      undefined,
      LAPTOP,
      [makeResult()],
      new Date('2026-10-18T00:00:00Z'),
    );

    expect(parseBaselineFile(JSON.stringify(recorded), 'baseline.json')).toEqual(recorded);
  });

  it('compares against the entry for the same machine', () => {
    const baseline = recordBaseline(
      undefined,
      LAPTOP,
      [makeResult({ medianNsPerOp: 100 })],
      new Date(),
    );

    expect(compareToBaseline(makeResult({ medianNsPerOp: 110 }), baseline, LAPTOP, 0.2)).toEqual({
      status: 'ok',
      change: expect.closeTo(0.1, 9) as unknown,
    });
    expect(
      compareToBaseline(makeResult({ medianNsPerOp: 130 }), baseline, LAPTOP, 0.2),
    ).toMatchObject({
      status: 'regressed',
    });
  });

  it('reports improvements as negative change', () => {
    const baseline = recordBaseline(
      undefined,
      LAPTOP,
      [makeResult({ medianNsPerOp: 100 })],
      new Date(),
    );

    expect(compareToBaseline(makeResult({ medianNsPerOp: 50 }), baseline, LAPTOP, 0.2)).toEqual({
      status: 'ok',
      change: -0.5,
    });
  });

  it('skips the comparison on a machine without a baseline', () => {
    const baseline = recordBaseline(undefined, LAPTOP, [makeResult()], new Date());

    expect(compareToBaseline(makeResult(), baseline, OTHER_MACHINE, 0.2)).toEqual({
      status: 'no-baseline',
    });
    expect(compareToBaseline(makeResult(), undefined, LAPTOP, 0.2)).toEqual({
      status: 'no-baseline',
    });
  });

  it('skips objectives the baseline has not recorded', () => {
    const baseline = recordBaseline(undefined, LAPTOP, [makeResult({ key: 'a/0' })], new Date());

    expect(compareToBaseline(makeResult({ key: 'b/0' }), baseline, LAPTOP, 0.2)).toEqual({
      status: 'no-baseline',
    });
  });

  it("replaces this machine's entry and keeps every other machine's", () => {
    const first = recordBaseline(
      undefined,
      OTHER_MACHINE,
      [makeResult({ medianNsPerOp: 7 })],
      new Date('2026-01-01T00:00:00Z'),
    );
    const second = recordBaseline(
      first,
      LAPTOP,
      [makeResult({ medianNsPerOp: 1 })],
      new Date('2026-02-01T00:00:00Z'),
    );
    const third = recordBaseline(
      second,
      LAPTOP,
      [makeResult({ medianNsPerOp: 2 })],
      new Date('2026-03-01T00:00:00Z'),
    );

    expect(
      third.environments.map((entry) => [
        entry.environment.cpuModel,
        entry.medianNsPerOp['bench-slo/0'],
      ]),
    ).toEqual([
      ['Other CPU', 7],
      ['Test CPU', 2],
    ]);
  });

  it('sorts keys and rounds to four significant digits for small diffs', () => {
    const recorded = recordBaseline(
      undefined,
      LAPTOP,
      [
        makeResult({ key: 'z/0', medianNsPerOp: 123.456_789 }),
        makeResult({ key: 'a/0', medianNsPerOp: 1 }),
      ],
      new Date(),
    );

    expect(Object.entries(recorded.environments[0]?.medianNsPerOp ?? {})).toEqual([
      ['a/0', 1],
      ['z/0', 123.5],
    ]);
  });

  it('rejects an invalid baseline file', () => {
    expect(() => parseBaselineFile('{"schemaVersion": 2, "environments": []}', 'b.json')).toThrow(
      /b.json is not a valid baseline file/,
    );
    expect(() => parseBaselineFile('nope', 'b.json')).toThrow(/b.json is not valid JSON/);
  });
});
