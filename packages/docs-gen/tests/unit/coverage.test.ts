import { describe, expect, it } from 'vitest';

import { checkDocCoverage } from '../../src/coverage.ts';
import { docTest, makePackage } from './fixtures.ts';

const INDEX = [
  'export { alpha } from "./alpha.ts";',
  '/** Beta. */',
  'export function beta(): void {}',
  '/** Gamma. */',
  'export interface Gamma { readonly value: number }',
].join('\n');

const usesAlpha = docTest({
  imports: ["import { describe, it } from 'vitest';", "import { alpha as a } from '@fx/pkg';"],
  body: "  it('Use alpha', () => {\n    a();\n  });",
});

describe('checkDocCoverage', () => {
  it('counts an export a tutorial or how-to imports by the package name, through aliases', () => {
    const fixture = makePackage({
      'src/index.ts': INDEX,
      'src/alpha.ts': '/** Alpha. */\nexport function alpha(): void {}\n',
      'tests/docs/how-to/01-alpha.test.ts': usesAlpha,
    });

    expect(checkDocCoverage(fixture.dir)).toEqual({
      exports: ['Gamma', 'alpha', 'beta'],
      undocumented: ['Gamma', 'beta'],
      brokenExamples: [],
    });
  });

  it('ignores imports from unit tests and reference examples', () => {
    const fixture = makePackage({
      'src/index.ts': INDEX,
      'src/alpha.ts': 'export function alpha(): void {}\n',
      'tests/unit/alpha.test.ts': usesAlpha,
      'tests/docs/reference/examples.test.ts': usesAlpha,
    });

    expect(checkDocCoverage(fixture.dir).undocumented).toEqual(['Gamma', 'alpha', 'beta']);
  });

  it('counts an @example that includes an existing doc test region', () => {
    const fixture = makePackage({
      'src/index.ts': [
        '/**',
        ' * Beta.',
        ' *',
        ' * @example Use beta',
        ' * {@includeCode ../tests/docs/reference/examples.test.ts#beta}',
        ' */',
        'export function beta(): void {}',
      ].join('\n'),
      'tests/docs/reference/examples.test.ts': '// #region beta\nbeta();\n// #endregion beta\n',
    });

    expect(checkDocCoverage(fixture.dir)).toMatchObject({ undocumented: [], brokenExamples: [] });
  });

  it.each([
    {
      name: 'a missing region',
      include: '../tests/docs/reference/examples.test.ts#other',
      problem: 'names a region that tests/docs/reference/examples.test.ts does not define',
    },
    {
      name: 'a missing file',
      include: '../tests/docs/reference/nope.test.ts#beta',
      problem: 'points to a missing file',
    },
    {
      name: 'a file outside tests/docs',
      include: '../src/index.ts#beta',
      problem: 'must point into tests/docs/',
    },
    {
      name: 'no region',
      include: '../tests/docs/reference/examples.test.ts',
      problem: 'must name a region',
    },
  ])('reports an @example include with $name', ({ include, problem }) => {
    const fixture = makePackage({
      'src/index.ts': `/**\n * Beta.\n *\n * @example Use beta\n * {@includeCode ${include}}\n */\nexport function beta(): void {}\n`,
      'tests/docs/reference/examples.test.ts': '// #region beta\nbeta();\n// #endregion beta\n',
    });

    const report = checkDocCoverage(fixture.dir);

    expect(report.undocumented).toEqual(['beta']);
    expect(report.brokenExamples).toHaveLength(1);
    expect(report.brokenExamples[0]).toContain(problem);
  });

  it('throws when the entry point is missing', () => {
    const fixture = makePackage({ 'src/other.ts': 'export const x = 1;' });

    expect(() => checkDocCoverage(fixture.dir)).toThrow(
      'src/index.ts is missing or exports nothing.',
    );
  });
});
