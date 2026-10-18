/**
 * Write a spec's acceptance criteria as Gherkin scenarios in `features/*.feature`, tag each
 * scenario with the requirement IDs it verifies, and let the docs check prove that every
 * criterion is traced and runs. `just generate` renders each feature as a page under
 * `docs/reference/specifications/`, with a table from requirement ID to scenarios.
 *
 * Step definitions live in `tests/features/<name>.feature.test.ts` and run with
 * vitest-cucumber, which fails the run when a scenario or step has no implementation.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { checkDocs, generateDocs, type TraceReport } from '@dbp/docs-gen';
import { afterAll, describe, expect, it } from 'vitest';

const packageDir = mkdtempSync(join(tmpdir(), 'greet-'));

function write(path: string, content: string): void {
  mkdirSync(dirname(join(packageDir, path)), { recursive: true });
  writeFileSync(join(packageDir, path), content);
}

write('package.json', JSON.stringify({ name: '@demo/greet' }));
write(
  'tsconfig.json',
  JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ['src'] }),
);
write('src/index.ts', 'export {};\n');

afterAll(() => {
  rmSync(packageDir, { recursive: true, force: true });
});

describe('Trace requirements to scenarios', () => {
  /**
   * Tag every scenario with at least one `@REQ-NNN` ID from the spec. A tag on the
   * `Feature:` line applies to every scenario in the file.
   */
  it('Tag scenarios with requirement IDs', async () => {
    // #region feature
    write(
      'features/greet.feature',
      [
        'Feature: Greet people',
        '',
        '  @REQ-001',
        '  Scenario: Greet by name',
        '    When I greet "Ada"',
        '    Then the greeting is "Hello, Ada"',
        '',
      ].join('\n'),
    );
    write(
      'tests/features/greet.feature.test.ts',
      "const feature = await loadFeature('../../features/greet.feature');\n",
    );
    await generateDocs(packageDir);

    const trace: TraceReport = checkDocs(packageDir).traceability;
    // trace.requirements: { 'REQ-001': ['features/greet.feature: Greet by name'] }
    // #endregion feature

    expect(trace.problems).toEqual([]);
    expect(trace.requirements).toEqual({
      'REQ-001': ['features/greet.feature: Greet by name'],
    });
  });

  /**
   * The check fails a scenario with no requirement, a malformed ID such as `@req-1`, a
   * skip tag such as `@ignore`, and a feature that no step definition file loads. Each
   * problem names the file and line.
   */
  it('Fix a traceability problem', () => {
    // #region problem
    write(
      'features/greet.feature',
      ['Feature: Greet people', '', '  Scenario: Greet by name', '    When I greet "Ada"', ''].join(
        '\n',
      ),
    );

    const { problems } = checkDocs(packageDir).traceability;
    // problems: ['features/greet.feature:3: scenario "Greet by name" names no requirement. ...']
    // #endregion problem

    expect(problems).toEqual([
      'features/greet.feature:3: scenario "Greet by name" names no requirement. Tag it @REQ-NNN.',
    ]);
  });
});
