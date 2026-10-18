import { describe, expect, it } from 'vitest';

import {
  failingRows,
  renderMarkdownTable,
  renderTextTable,
  type ReportRow,
  toBenchmarkActionEntries,
} from '../../src/index.js';
import { makeResult } from './fakes.js';

const PASSING: ReportRow = {
  result: makeResult({ slo: 'fast', objective: 'p99', measured: 76.66, budgetRemaining: 1 }),
  baseline: { status: 'ok', change: 0.031 },
};
const FAILING: ReportRow = {
  result: makeResult({
    slo: 'slow',
    objective: 'p99',
    measured: 250,
    passed: false,
    budgetRemaining: -3,
  }),
  baseline: { status: 'no-baseline' },
};
const REGRESSED: ReportRow = {
  result: makeResult({
    slo: 'drift',
    objective: 'p50',
    target: 0.5,
    measured: 40,
    budgetRemaining: 0.9123,
  }),
  baseline: { status: 'regressed', change: 0.25 },
};

describe('renderTextTable', () => {
  it('aligns columns and labels status, budget, and baseline change', () => {
    expect(renderTextTable([PASSING, FAILING, REGRESSED])).toBe(
      [
        'SLO    Objective  Target  Threshold  Measured     Budget left  Median vs baseline  Status',
        '-----  ---------  ------  ---------  -----------  -----------  ------------------  ---------',
        'fast   p99        99%     <= 100 ns  p99 76.7 ns  100%         +3.1%               PASS',
        'slow   p99        99%     <= 100 ns  p99 250 ns   exhausted    n/a                 FAIL',
        'drift  p50        50%     <= 100 ns  p50 40 ns    91.23%       +25.0%              REGRESSED',
      ].join('\n'),
    );
  });

  it('formats large values with separators and throughput units', () => {
    const row: ReportRow = {
      result: makeResult({
        unit: 'ops/s',
        op: 'gte',
        threshold: 2_000_000,
        measured: 14_869_888.4,
        target: 0.5,
      }),
      baseline: { status: 'ok', change: -0.12 },
    };

    expect(renderTextTable([row])).toContain('>= 2,000,000 ops/s  p50 14,869,888 ops/s');
    expect(renderTextTable([row])).toContain('-12.0%');
  });
});

describe('renderMarkdownTable', () => {
  it('renders a GitHub table with the same cells', () => {
    expect(renderMarkdownTable([PASSING]).split('\n')).toEqual([
      '| SLO | Objective | Target | Threshold | Measured | Budget left | Median vs baseline | Status |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
      '| fast | p99 | 99% | <= 100 ns | p99 76.7 ns | 100% | +3.1% | PASS |',
    ]);
  });
});

describe('failingRows', () => {
  it('returns rows that missed the objective or regressed', () => {
    expect(failingRows([PASSING, FAILING, REGRESSED])).toEqual([FAILING, REGRESSED]);
  });
});

describe('toBenchmarkActionEntries', () => {
  it('splits latency and throughput into separate series', () => {
    const latency = makeResult({
      slo: 'a',
      objective: 'p99',
      measured: 5,
      rme: 1.234,
      sampleCount: 9,
    });
    const throughput = makeResult({
      slo: 'b',
      objective: 'p50',
      unit: 'ops/s',
      target: 0.5,
      measured: 1e6,
    });

    expect(toBenchmarkActionEntries([latency, throughput])).toEqual({
      smallerIsBetter: [
        { name: 'a: p99', unit: 'ns', value: 5, extra: 'p99, 9 samples, rme ±1.23%' },
      ],
      biggerIsBetter: [
        { name: 'b: p50', unit: 'ops/s', value: 1e6, extra: 'p50, 1000 samples, rme ±1.00%' },
      ],
    });
  });
});
