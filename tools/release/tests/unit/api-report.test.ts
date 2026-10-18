import { describe, expect, it } from 'vitest';

import { classifyApiReportChange } from '../../src/api-report.js';
import { requiredBump } from '../../src/semver.js';
import { apiReport } from './fakes.js';

const BASE = apiReport(`
// @public
export interface Policy {
    readonly attempts: number;
    readonly delayMs?: number;
}

// @public
export class Runner {
    constructor(policy: Policy);
    run(): Promise<void>;
}

// @public
export function retry(times: number): Promise<void>;

// @public (undocumented)
export const VERSION: string;
`);

function bumpFor(head: string): string {
  return requiredBump(classifyApiReportChange(BASE, head));
}

describe('classifyApiReportChange', () => {
  it('requires nothing when the report is unchanged', () => {
    expect(classifyApiReportChange(BASE, BASE)).toEqual([]);
  });

  it('requires no bump for a new interface, which starts at its current version', () => {
    expect(classifyApiReportChange(undefined, BASE)).toEqual([]);
  });

  it('requires major when a declaration is removed', () => {
    const head = BASE.replace(
      '// @public\nexport function retry(times: number): Promise<void>;\n',
      '',
    );
    expect(classifyApiReportChange(BASE, head)).toContainEqual({
      bump: 'major',
      message: 'removed function retry',
    });
  });

  it('requires major when a signature changes', () => {
    expect(bumpFor(BASE.replace('retry(times: number)', 'retry(times: string)'))).toBe('major');
  });

  it('requires major when an interface gains a required member', () => {
    expect(
      bumpFor(
        BASE.replace(
          'readonly attempts: number;',
          'readonly attempts: number;\n    readonly jitter: boolean;',
        ),
      ),
    ).toBe('major');
  });

  it('requires minor when an interface gains an optional member', () => {
    expect(
      bumpFor(
        BASE.replace(
          'readonly attempts: number;',
          'readonly attempts: number;\n    readonly jitter?: boolean;',
        ),
      ),
    ).toBe('minor');
  });

  it('requires minor when a class gains a method', () => {
    expect(
      bumpFor(BASE.replace('run(): Promise<void>;', 'run(): Promise<void>;\n    stop(): void;')),
    ).toBe('minor');
  });

  it('requires minor when a declaration is added', () => {
    expect(
      bumpFor(
        BASE.replace(
          '// @public (undocumented)',
          '// @public\nexport type Mode = "a";\n\n// @public (undocumented)',
        ),
      ),
    ).toBe('minor');
  });

  it('requires major when a release tag changes', () => {
    expect(
      bumpFor(BASE.replace('// @public\nexport class Runner', '// @beta\nexport class Runner')),
    ).toBe('major');
  });

  it('ignores documentation-only changes', () => {
    const head = BASE.replace('// @public (undocumented)', '// @public');
    expect(bumpFor(head)).toBe('patch');
  });

  it('ignores "(undocumented)" markers inside a body', () => {
    const base = BASE.replace(
      '    run(): Promise<void>;',
      '    // (undocumented)\n    run(): Promise<void>;',
    );
    expect(requiredBump(classifyApiReportChange(base, BASE))).toBe('patch');
  });

  it('parses multi-line types nested inside a declaration', () => {
    const base = apiReport(`
// @public
export const Schema: z.ZodObject<{
    title: z.ZodString;
}, z.core.$strict>;
`);
    const head = base.replace(
      'title: z.ZodString;',
      'title: z.ZodString;\n    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;',
    );
    expect(classifyApiReportChange(base, head)).toEqual([
      {
        bump: 'minor',
        message: 'const Schema gained: tags: z.ZodOptional<z.ZodArray<z.ZodString>>;',
      },
    ]);
  });

  it('merges function overloads into one declaration', () => {
    const base = apiReport(`
// @public
export function parse(input: string): number;

// @public
export function parse(input: Buffer): number;
`);
    const head = base.replace('// @public\nexport function parse(input: Buffer): number;\n', '');
    expect(classifyApiReportChange(base, head)).toEqual([
      {
        bump: 'major',
        message: 'function parse removed or changed: export function parse(input: Buffer): number;',
      },
    ]);
  });
});
