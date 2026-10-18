#!/usr/bin/env node
// The bin points at this source file, not at dist/, because pnpm links workspace bins
// at install time, before any build has run. Node 22.18+ strips the types natively,
// which is why every relative import in this package names the .ts file.
import process from 'node:process';

import { checkDocs } from './check-docs.ts';
import { generateDocs } from './generate.ts';

const USAGE = `Usage: dbp-docs-gen <command>

Run from a package root.

Commands:
  generate   Write docs/ from tests/docs/ and stamp TypeDoc output. Run TypeDoc first.
  check      Fail on undocumented exports, broken links, or Diátaxis violations.
`;

async function main(command: string | undefined): Promise<number> {
  switch (command ?? '') {
    case 'generate': {
      const written = await generateDocs(process.cwd());
      process.stdout.write(`docs-gen: wrote ${written.length} file(s)\n`);
      return 0;
    }
    case 'check': {
      const report = checkDocs(process.cwd());
      const { coverage } = report;
      printSection(
        'Undocumented exports (import them in a tutorial or how-to doc test, or give them a tested @example)',
        coverage.undocumented,
      );
      printSection('Broken @example includes', coverage.brokenExamples);
      printSection('Broken links', report.brokenLinks);
      printSection('Diátaxis violations', report.compliance);
      const documented = coverage.exports.length - coverage.undocumented.length;
      process.stdout.write(
        `docs-gen: ${documented}/${coverage.exports.length} exports documented, ` +
          `${report.brokenLinks.length} broken link(s), ${report.compliance.length} Diátaxis violation(s)\n`,
      );
      return report.passed ? 0 : 1;
    }
    default:
      process.stderr.write(USAGE);
      return 2;
  }
}

function printSection(title: string, items: readonly string[]): void {
  if (items.length > 0) {
    process.stderr.write(`${title}:\n${items.map((item) => `  - ${item}\n`).join('')}`);
  }
}

process.exitCode = await main(process.argv[2]);
