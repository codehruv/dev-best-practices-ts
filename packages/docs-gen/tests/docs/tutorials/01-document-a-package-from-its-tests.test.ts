/**
 * In this tutorial you document a tiny package, `@demo/greet`, without writing a single
 * page by hand. You write one doc test, generate its page, and check the result. By the
 * end you know the loop every package in this repo follows: the test is the source, the
 * page is output.
 *
 * The samples build the package in a temporary directory. In a real package the files
 * already exist, and you run `just generate` and `just verify` instead.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { checkDocs, generateDocs } from '@dbp/docs-gen';
import { afterAll, describe, expect, it } from 'vitest';

// #region package
const packageDir = mkdtempSync(join(tmpdir(), 'greet-'));

function write(path: string, content: string): void {
  mkdirSync(dirname(join(packageDir, path)), { recursive: true });
  writeFileSync(join(packageDir, path), content);
}

write('package.json', JSON.stringify({ name: '@demo/greet', description: 'Greets people.' }));
write(
  'tsconfig.json',
  JSON.stringify({
    compilerOptions: {
      strict: true,
      module: 'NodeNext',
      noEmit: true,
      paths: { '@demo/greet': ['./src/index.ts'] },
    },
    include: ['src', 'tests'],
  }),
);
write(
  'src/index.ts',
  [
    '/** Builds a greeting for one person. */',
    'export function greet(name: string): string {',
    "  return 'Hello, ' + name + '!';",
    '}',
  ].join('\n'),
);
// #endregion package

afterAll(() => {
  rmSync(packageDir, { recursive: true, force: true });
});

describe('Document a package from its tests', () => {
  /**
   * A doc test is an ordinary Vitest file under `tests/docs/tutorials/` or
   * `tests/docs/how-to/`. The file's JSDoc block becomes the page intro, `describe` becomes
   * the title, and each `it` becomes a section. The JSDoc above an `it` is the section
   * prose, and the code between `// #region` and `// #endregion` is the sample. The
   * assertions after the region prove the sample works, and stay off the page.
   */
  it('Write a doc test', () => {
    // #region doc-test
    write(
      'tests/docs/tutorials/01-first-greeting.test.ts',
      [
        '/** Say hello with `@demo/greet`. */',
        "import { describe, expect, it } from 'vitest';",
        "import { greet } from '@demo/greet';",
        '',
        "describe('Your first greeting', () => {",
        '  /** Call `greet` with a name. */',
        "  it('Greet someone', () => {",
        '    // #region greet',
        "    const message = greet('Ada');",
        '    // #endregion greet',
        "    expect(message).toBe('Hello, Ada!');",
        '  });',
        '});',
      ].join('\n'),
    );
    // #endregion doc-test

    expect(
      readFileSync(join(packageDir, 'tests/docs/tutorials/01-first-greeting.test.ts'), 'utf8'),
    ).toContain('Your first greeting');
  });

  /**
   * `generateDocs` writes one page per doc test, plus `docs/README.md`, the index of the
   * four documentation quadrants. The numeric prefix of the test file orders the index
   * and stays out of the page name.
   */
  it('Generate the pages', async () => {
    // #region generate
    const written = await generateDocs(packageDir);
    // ['docs/tutorials/first-greeting.md', 'docs/README.md']
    // #endregion generate

    expect(written).toEqual(['docs/tutorials/first-greeting.md', 'docs/README.md']);
    const page = readFileSync(join(packageDir, 'docs/tutorials/first-greeting.md'), 'utf8');
    expect(page).toContain('# Your first greeting');
    expect(page).toContain('import { greet } from');
  });

  /**
   * `checkDocs` fails when an export has no doc test, a link is broken, or a page breaks
   * the Diátaxis structure. `greet` appears in the tutorial, so the check passes.
   */
  it('Check the result', () => {
    // #region check
    const report = checkDocs(packageDir);
    // report.passed === true
    // #endregion check

    expect(report.passed).toBe(true);
  });
});
