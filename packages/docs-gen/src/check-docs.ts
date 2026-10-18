import { checkDocsTree, type DocsTreeReport } from './check-docs-tree.ts';
import { checkDocCoverage, type CoverageReport } from './coverage.ts';

/** Every documentation problem in one package. `passed` is false when any list is non-empty. */
export interface DocsReport extends DocsTreeReport {
  /** Which exports lack executable documentation. */
  readonly coverage: CoverageReport;
  /** True only when coverage, links, and Diátaxis compliance all have no problems. */
  readonly passed: boolean;
}

/**
 * Runs every documentation check on one package: export coverage, link integrity, and
 * Diátaxis compliance. Each problem names the file or export it is about, so the report
 * is a to-do list rather than a score.
 */
export function checkDocs(packageDir: string): DocsReport {
  const coverage = checkDocCoverage(packageDir);
  const tree = checkDocsTree(packageDir);
  const passed =
    coverage.undocumented.length === 0 &&
    coverage.brokenExamples.length === 0 &&
    tree.brokenLinks.length === 0 &&
    tree.compliance.length === 0;
  return { ...tree, coverage, passed };
}
