import { describe, expect, it } from 'vitest';

import { type CheckInput, checkInterfaces } from '../../src/check.js';
import {
  apiReport,
  makeDiffer,
  makeEntry,
  makeFiles,
  makeGit,
  makePackage,
  makePending,
  makeRelease,
} from './fakes.js';

const REPORT_PATH = 'packages/widget/etc/widget.api.md';
const SPEC_PATH = 'packages/widget/openapi/openapi.json';

const BASE_REPORT = apiReport(`
// @public
export function run(): void;
`);
const REMOVED_REPORT = apiReport('');
const ADDED_REPORT = apiReport(`
// @public
export function run(): void;

// @public
export function stop(): void;
`);

function makeInput(overrides: Partial<CheckInput> = {}): CheckInput {
  return {
    baseRef: 'main',
    interfaces: [makePackage({ apiReportPath: REPORT_PATH })],
    pending: makePending(),
    git: makeGit({ main: { [REPORT_PATH]: BASE_REPORT } }),
    files: makeFiles({ [REPORT_PATH]: BASE_REPORT }),
    differ: makeDiffer(),
    ...overrides,
  };
}

describe('checkInterfaces', () => {
  it('passes an unchanged interface with no changesets', async () => {
    const result = await checkInterfaces(makeInput());
    expect(result.verdicts).toEqual([
      {
        name: '@dbp/widget',
        version: '1.2.0',
        required: 'none',
        planned: 'none',
        reasons: [],
        problems: [],
      },
    ]);
  });

  it('fails a TypeScript API addition without a changeset', async () => {
    const result = await checkInterfaces(
      makeInput({ files: makeFiles({ [REPORT_PATH]: ADDED_REPORT }) }),
    );
    const [verdict] = result.verdicts;
    expect(verdict?.required).toBe('minor');
    expect(verdict?.problems).toEqual([
      expect.stringContaining('requires at least a minor bump, but pending changesets plan none'),
    ]);
  });

  it('passes an addition covered by a minor changeset', async () => {
    const result = await checkInterfaces(
      makeInput({
        files: makeFiles({ [REPORT_PATH]: ADDED_REPORT }),
        pending: makePending([makeRelease({ type: 'minor' })]),
      }),
    );
    expect(result.verdicts[0]?.problems).toEqual([]);
  });

  it('fails a breaking change planned as minor on a 1.x package', async () => {
    const result = await checkInterfaces(
      makeInput({
        files: makeFiles({ [REPORT_PATH]: REMOVED_REPORT }),
        pending: makePending([
          makeRelease({ type: 'minor', entries: [makeEntry({ type: 'Removed', breaking: true })] }),
        ]),
      }),
    );
    expect(result.verdicts[0]?.required).toBe('major');
    expect(result.verdicts[0]?.problems).toEqual([
      expect.stringContaining('requires at least a major bump'),
    ]);
  });

  it('requires a **Breaking:** entry even when the bump is large enough', async () => {
    const result = await checkInterfaces(
      makeInput({
        files: makeFiles({ [REPORT_PATH]: REMOVED_REPORT }),
        pending: makePending([
          makeRelease({ type: 'major', entries: [makeEntry({ type: 'Removed' })] }),
        ]),
      }),
    );
    expect(result.verdicts[0]?.problems).toEqual([
      expect.stringContaining('no changeset entry for it starts with "**Breaking:**"'),
    ]);
  });

  it('accepts a breaking change on 0.x with a minor bump', async () => {
    const result = await checkInterfaces(
      makeInput({
        interfaces: [makePackage({ version: '0.3.0', apiReportPath: REPORT_PATH })],
        files: makeFiles({ [REPORT_PATH]: REMOVED_REPORT }),
        pending: makePending([
          makeRelease({ type: 'minor', entries: [makeEntry({ type: 'Removed', breaking: true })] }),
        ]),
      }),
    );
    expect(result.verdicts[0]).toMatchObject({ required: 'minor', planned: 'minor', problems: [] });
  });

  it('fails an HTTP contract break that oasdiff reports', async () => {
    const differ = makeDiffer([
      {
        id: 'api-path-removed-without-deprecation',
        text: 'api path removed',
        level: 3,
        section: 'paths',
      },
    ]);
    const result = await checkInterfaces(
      makeInput({
        interfaces: [makePackage({ openApiPath: SPEC_PATH })],
        git: makeGit({ main: { [SPEC_PATH]: '{"base":true}' } }),
        files: makeFiles({ [SPEC_PATH]: '{"head":true}' }),
        differ,
      }),
    );
    expect(differ.calls).toEqual([['{"base":true}', '{"head":true}']]);
    expect(result.verdicts[0]?.required).toBe('major');
    expect(result.verdicts[0]?.reasons[0]?.message).toBe(
      'HTTP contract: [api-path-removed-without-deprecation] api path removed.',
    );
  });

  it('skips oasdiff when the document did not change', async () => {
    const differ = makeDiffer();
    await checkInterfaces(
      makeInput({
        interfaces: [makePackage({ openApiPath: SPEC_PATH })],
        git: makeGit({ main: { [SPEC_PATH]: '{}' } }),
        files: makeFiles({ [SPEC_PATH]: '{}' }),
        differ,
      }),
    );
    expect(differ.calls).toEqual([]);
  });

  it('requires no bump for a document that is new on the branch', async () => {
    const result = await checkInterfaces(
      makeInput({
        interfaces: [makePackage({ openApiPath: SPEC_PATH })],
        git: makeGit({ main: {} }),
        files: makeFiles({ [SPEC_PATH]: '{}' }),
      }),
    );
    expect(result.verdicts[0]).toMatchObject({ required: 'none', problems: [] });
  });

  it('fails loudly when a committed report is missing', async () => {
    await expect(checkInterfaces(makeInput({ files: makeFiles() }))).rejects.toThrow(
      /Run `just generate`/,
    );
  });

  it('passes changeset parse errors through', async () => {
    const result = await checkInterfaces(
      makeInput({ pending: makePending([], ['bad changeset']) }),
    );
    expect(result.errors).toEqual(['bad changeset']);
  });
});
