// Spec loading
export {
  DEFAULT_REGRESSION_THRESHOLD,
  loadCatalog,
  REGRESSION_THRESHOLD_ANNOTATION,
  type ResolvedAlertCondition,
  type ResolvedObjective,
  type ResolvedSlo,
  SHORT_WINDOW_ANNOTATION,
  type SloCatalog,
  type SpecFile,
} from './catalog.js';
export { type OpenSloObject } from './openslo.js';

// Benchmarks
export { type BenchmarkStats, parseVitestBenchReport } from './bench-report.js';
export { type BenchmarkSource, VITEST_BENCH_SOURCE_TYPE } from './benchmark-source.js';
export { evaluateBenchmarkSlo, type ObjectiveResult } from './evaluate.js';

// Baselines
export {
  type BaselineComparison,
  type BaselineFile,
  compareToBaseline,
  type Environment,
  parseBaselineFile,
  recordBaseline,
} from './baseline.js';

// Reporting
export {
  type BenchmarkActionEntry,
  failingRows,
  renderMarkdownTable,
  renderTextTable,
  type ReportRow,
  toBenchmarkActionEntries,
} from './report.js';

// Command
export { type CommandIo, ExitCode, runSloCommand } from './command.js';

// Errors
export { SloError, SloInputError, SloSpecError, type SpecIssue } from './errors.js';
