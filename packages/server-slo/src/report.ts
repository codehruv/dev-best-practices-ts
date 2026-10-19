import type { BaselineComparison } from './baseline.js';
import type { ObjectiveResult } from './evaluate.js';

/** A result plus its baseline comparison: one row of the report. */
export interface ReportRow {
  readonly result: ObjectiveResult;
  readonly baseline: BaselineComparison;
}

/** Rows whose objective failed or regressed against the baseline. */
export function failingRows(rows: readonly ReportRow[]): ReportRow[] {
  return rows.filter((row) => !row.result.passed || row.baseline.status === 'regressed');
}

const HEADERS = [
  'SLO',
  'Objective',
  'Target',
  'Threshold',
  'Measured',
  'Budget left',
  'Median vs baseline',
  'Status',
];

/** A fixed-width table for terminals and CI logs. */
export function renderTextTable(rows: readonly ReportRow[]): string {
  const cells = [HEADERS, ...rows.map(rowCells)];
  const widths = HEADERS.map((_, column) =>
    Math.max(...cells.map((row) => row[column]?.length ?? 0)),
  );
  const format = (row: readonly string[]): string =>
    row
      .map((cell, column) => cell.padEnd(widths[column] ?? 0))
      .join('  ')
      .trimEnd();
  const rule = widths.map((width) => '-'.repeat(width)).join('  ');
  return [format(HEADERS), rule, ...cells.slice(1).map(format)].join('\n');
}

/** A GitHub-flavored Markdown table for the CI job summary. */
export function renderMarkdownTable(rows: readonly ReportRow[]): string {
  const line = (row: readonly string[]): string => `| ${row.join(' | ')} |`;
  return [
    line(HEADERS),
    line(HEADERS.map(() => '---')),
    ...rows.map((row) => line(rowCells(row))),
  ].join('\n');
}

/** One data point in the format `github-action-benchmark` reads for custom tools. */
export interface BenchmarkActionEntry {
  readonly name: string;
  readonly unit: string;
  readonly value: number;
  readonly extra: string;
}

/**
 * Splits results by direction, because `github-action-benchmark` takes smaller-is-better
 * and bigger-is-better data as separate tools.
 */
export function toBenchmarkActionEntries(results: readonly ObjectiveResult[]): {
  readonly smallerIsBetter: BenchmarkActionEntry[];
  readonly biggerIsBetter: BenchmarkActionEntry[];
} {
  const entry = (result: ObjectiveResult): BenchmarkActionEntry => ({
    name: `${result.slo}: ${result.objective}`,
    unit: result.unit,
    value: result.measured,
    extra: `${percentileLabel(result.target)}, ${result.sampleCount} samples, rme ±${result.rme.toFixed(2)}%`,
  });
  return {
    smallerIsBetter: results.filter((result) => result.unit !== 'ops/s').map(entry),
    biggerIsBetter: results.filter((result) => result.unit === 'ops/s').map(entry),
  };
}

function rowCells({ result, baseline }: ReportRow): string[] {
  return [
    result.slo,
    result.objective,
    formatPercent(result.target),
    `${OPERATORS[result.op]} ${formatNumber(result.threshold)} ${result.unit}`,
    `${percentileLabel(result.target)} ${formatNumber(result.measured)} ${result.unit}`,
    result.budgetRemaining <= 0 ? 'exhausted' : formatPercent(result.budgetRemaining),
    formatBaseline(baseline),
    statusOf(result, baseline),
  ];
}

const OPERATORS = { lt: '<', lte: '<=', gt: '>', gte: '>=' } as const;

function statusOf(result: ObjectiveResult, baseline: BaselineComparison): string {
  if (!result.passed) {
    return 'FAIL';
  }
  return baseline.status === 'regressed' ? 'REGRESSED' : 'PASS';
}

function formatBaseline(baseline: BaselineComparison): string {
  if (baseline.status === 'no-baseline') {
    return 'n/a';
  }
  const percent = baseline.change * 100;
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
}

/** 0.99 becomes "p99", 0.995 becomes "p99.5". */
function percentileLabel(target: number): string {
  return `p${Number((target * 100).toFixed(3))}`;
}

function formatPercent(fraction: number): string {
  return `${Number((fraction * 100).toFixed(2))}%`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  return value >= 1_000
    ? Math.round(value).toLocaleString('en-US')
    : String(Number(value.toPrecision(3)));
}
