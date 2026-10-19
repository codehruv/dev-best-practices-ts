/**
 * Read a failing `just verify` documentation check and fix each kind of problem. Every
 * problem names the export, file, or line it is about, so the report doubles as a to-do
 * list.
 *
 * The samples build a package whose `farewell` export has no doc test and whose
 * explanation page links to a page that does not exist.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  checkDocs,
  type CoverageReport,
  type DocsReport,
  type DocsTreeReport,
  DocTestSyntaxError,
  generateDocs,
  parseDocTest,
} from '@dbp/server-docs-gen';
import { afterAll, describe, expect, it } from 'vitest';

const packageDir = mkdtempSync(join(tmpdir(), 'farewell-'));

function write(path: string, content: string): void {
  mkdirSync(dirname(join(packageDir, path)), { recursive: true });
  writeFileSync(join(packageDir, path), content);
}

write('package.json', JSON.stringify({ name: '@demo/words' }));
write(
  'tsconfig.json',
  JSON.stringify({
    compilerOptions: {
      strict: true,
      module: 'NodeNext',
      noEmit: true,
      paths: { '@demo/words': ['./src/index.ts'] },
    },
    include: ['src', 'tests'],
  }),
);
write(
  'src/index.ts',
  'export const hello = (): string => "hello";\nexport const farewell = (): string => "bye";\n',
);
write(
  'tests/docs/tutorials/01-hello.test.ts',
  "import { describe, it } from 'vitest';\nimport { hello } from '@demo/words';\n\ndescribe('Say hello', () => {\n  it('Call hello', () => {\n    hello();\n  });\n});\n",
);
write(
  'docs/explanation/words.md',
  '# Why words matter\n\nSee [the guide](../how-to/missing.md).\n',
);

afterAll(() => {
  rmSync(packageDir, { recursive: true, force: true });
});

describe('Fix a failing docs check', () => {
  /**
   * An export is undocumented when no tutorial or how-to doc test imports it and its TSDoc
   * has no tested `@example`. Fix it by using the export in a doc test, or by adding
   * `@example Title` plus `{@includeCode ../tests/docs/reference/examples.test.ts#name}`
   * to its TSDoc.
   */
  it('Find undocumented exports', async () => {
    await generateDocs(packageDir);
    // #region coverage
    const report: DocsReport = checkDocs(packageDir);
    const coverage: CoverageReport = report.coverage;
    // coverage.undocumented: ['farewell']
    // #endregion coverage

    expect(report.passed).toBe(false);
    expect(coverage.undocumented).toEqual(['farewell']);
  });

  /**
   * Broken links and Diátaxis violations name the file and line. A link must resolve to an
   * existing file and, with a `#fragment`, to a heading on that page. Fix the link or
   * create the page it promises.
   */
  it('Find broken links and structure problems', () => {
    // #region tree
    const tree: DocsTreeReport = checkDocs(packageDir);
    // tree.brokenLinks: ['docs/explanation/words.md:3: ../how-to/missing.md points to a missing file.']
    // #endregion tree

    expect(tree.brokenLinks).toEqual([
      'docs/explanation/words.md:3: ../how-to/missing.md points to a missing file.',
    ]);
    expect(tree.compliance).toEqual([]);
  });

  /**
   * `just generate` stops at the first malformed doc test. The error message starts with
   * `file:line:column` and says which convention the file breaks.
   */
  it('Fix a malformed doc test', () => {
    // #region syntax
    let message = '';
    try {
      parseDocTest("it('No describe', () => {});", 'tests/docs/how-to/01-broken.test.ts');
    } catch (error) {
      if (error instanceof DocTestSyntaxError) {
        message = error.message;
      }
    }
    // message: 'tests/docs/how-to/01-broken.test.ts:1:1: Expected describe() here.'
    // #endregion syntax

    expect(message).toBe('tests/docs/how-to/01-broken.test.ts:1:1: Expected describe() here.');
  });
});
