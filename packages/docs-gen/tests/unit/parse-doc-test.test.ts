import { describe, expect, it } from 'vitest';

import { DocTestSyntaxError } from '../../src/errors.ts';
import { parseDocTest } from '../../src/parse-doc-test.ts';
import { docTest } from './fixtures.ts';

const PATH = 'tests/docs/how-to/01-x.test.ts';

describe('parseDocTest', () => {
  it('maps the file JSDoc, describe, it, and section JSDoc to the page structure', () => {
    const source = [
      '/**',
      ' * Intro line one.',
      ' *',
      ' * - a list item',
      ' */',
      "import { it, describe } from 'vitest';",
      '',
      "describe('Title', () => {",
      '  /** Section prose. */',
      "  it('First', () => {",
      '    const value = 1;',
      '  });',
      "  test('Second', function () {",
      '    const other = 2;',
      '  });',
      '});',
    ].join('\n');

    const page = parseDocTest(source, PATH);

    expect(page.title).toBe('Title');
    expect(page.intro).toBe('Intro line one.\n\n- a list item');
    expect(page.sections.map((section) => [section.title, section.prose])).toEqual([
      ['First', 'Section prose.'],
      ['Second', ''],
    ]);
    expect(page.sections.map((section) => section.samples.map((sample) => sample.code))).toEqual([
      ['const value = 1;'],
      ['const other = 2;'],
    ]);
  });

  it('renders each region as its own dedented sample and leaves the rest of the body out', () => {
    const page = parseDocTest(
      docTest({
        body: [
          "  it('Step', () => {",
          '    const hidden = 0;',
          '    // #region one',
          '    if (hidden === 0) {',
          '      run();',
          '    }',
          '    // #endregion one',
          '    // #region two',
          '    run();',
          '    // #endregion two',
          '    expect(hidden).toBe(0);',
          '  });',
        ].join('\n'),
      }),
      PATH,
    );

    expect(page.sections[0]?.samples.map((sample) => sample.code)).toEqual([
      'if (hidden === 0) {\n  run();\n}',
      'run();',
    ]);
  });

  it('renders top-level regions outside describe as page setup', () => {
    const source = [
      "import { describe, it } from 'vitest';",
      "import { Thing } from '@fx/pkg';",
      '',
      '// #region setup',
      'const thing = new Thing();',
      '// #endregion setup',
      'const notRendered = 1;',
      '',
      "describe('Title', () => {",
      "  it('Use it', () => {",
      '    thing.use(notRendered);',
      '  });',
      '});',
    ].join('\n');

    const page = parseDocTest(source, PATH);

    expect(page.setup).toEqual([
      { imports: ["import { Thing } from '@fx/pkg';"], code: 'const thing = new Thing();' },
    ]);
  });

  it('emits only the imports a sample uses, keeping type, alias, and default forms', () => {
    const page = parseDocTest(
      docTest({
        imports: [
          "import { describe, expect, it } from 'vitest';",
          "import Default, { type Shape, original as renamed, unused } from '@fx/pkg';",
          "import type { OnlyType } from '@fx/types';",
        ],
        body: [
          "  it('Step', () => {",
          '    const shape: Shape = renamed(Default);',
          '    const typed: OnlyType = shape;',
          '    expect(typed).toBeDefined();',
          '  });',
        ].join('\n'),
      }),
      PATH,
    );

    expect(page.sections[0]?.samples[0]?.imports).toEqual([
      "import Default, { type Shape, original as renamed } from '@fx/pkg';",
      "import { type OnlyType } from '@fx/types';",
    ]);
  });

  it.each([
    {
      name: 'no describe',
      source: "it('x', () => { run(); });",
      message: `${PATH}:1:1: Expected describe() here.`,
    },
    {
      name: 'two describes',
      source: "describe('a', () => {});\ndescribe('b', () => {});",
      message: `${PATH}:2:1: A doc test file needs exactly one top-level describe().`,
    },
    {
      name: 'it.each',
      source: docTest({ body: "  it.each([1])('x %s', () => { run(); });" }),
      message: 'Doc tests use plain it()',
    },
    {
      name: 'a nested describe',
      source: docTest({ body: "  describe('inner', () => {});" }),
      message: 'Expected it() or test() here.',
    },
    {
      name: 'a computed title',
      source: docTest({ body: '  it(name, () => { run(); });' }),
      message: 'must be a string literal',
    },
    {
      name: 'an unclosed region',
      source: docTest({ body: "  it('x', () => {\n    // #region a\n    run();\n  });" }),
      message: 'Found #region without a matching #endregion.',
    },
    {
      name: 'a stray endregion',
      source: docTest({ body: "  it('x', () => {\n    run();\n    // #endregion a\n  });" }),
      message: 'Found #endregion without a matching #region.',
    },
    {
      name: 'nested regions',
      source: docTest({
        body: "  it('x', () => {\n    // #region a\n    // #region b\n    run();\n  });",
      }),
      message: 'Regions cannot nest.',
    },
    {
      name: 'an empty body',
      source: docTest({ body: "  it('x', () => {\n  });" }),
      message: 'A doc sample cannot be empty.',
    },
    {
      name: 'a sample that needs a relative import',
      source: docTest({
        imports: [
          "import { describe, it } from 'vitest';",
          "import { helper } from './helpers.ts';",
        ],
        body: "  it('x', () => {\n    helper();\n  });",
      }),
      message: "uses helper from the relative module './helpers.ts'",
    },
  ])('rejects $name with a located DocTestSyntaxError', ({ source, message }) => {
    expect(() => parseDocTest(source, PATH)).toThrow(DocTestSyntaxError);
    expect(() => parseDocTest(source, PATH)).toThrow(message);
  });
});
