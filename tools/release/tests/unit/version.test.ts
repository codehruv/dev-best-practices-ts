import { describe, expect, it } from 'vitest';

import { emptyChangelog } from '../../src/keep-a-changelog.js';
import { type VersionInput, writeChangelogs } from '../../src/version.js';
import {
  makeDiffer,
  makeEntry,
  makeFiles,
  makeGit,
  makePackage,
  makePending,
  makeRelease,
} from './fakes.js';

const CHANGELOG = 'packages/widget/CHANGELOG.md';
const SPEC_PATH = 'packages/widget/openapi/openapi.json';

function makeInput(overrides: Partial<VersionInput> = {}): VersionInput {
  return {
    date: '2026-10-18',
    repoUrl: 'https://github.com/o/r',
    packages: [makePackage()],
    pending: makePending([makeRelease()]),
    git: makeGit(),
    files: makeFiles({ [CHANGELOG]: emptyChangelog() }),
    differ: makeDiffer(),
    ...overrides,
  };
}

describe('writeChangelogs', () => {
  it('writes the package release and the central summary', async () => {
    const files = makeFiles();
    const written = await writeChangelogs(makeInput({ files }));
    expect(written).toEqual([CHANGELOG, 'CHANGELOG.md']);
    expect(files.contents.get(CHANGELOG)).toContain(
      '## [1.3.0] - 2026-10-18\n\n### Added\n\n- A feature.\n',
    );
    expect(files.contents.get('CHANGELOG.md')).toContain(
      '- [`@dbp/widget` 1.3.0](packages/widget/CHANGELOG.md)\n',
    );
  });

  it('links to the previous version only when the changelog records it', async () => {
    const files = makeFiles({ [CHANGELOG]: emptyChangelog() });
    await writeChangelogs(makeInput({ files }));
    expect(files.contents.get(CHANGELOG)).toContain(
      '[1.3.0]: https://github.com/o/r/releases/tag/',
    );
  });

  it('adds drafted contract entries from oasdiff since the last release tag', async () => {
    const differ = makeDiffer([
      {
        id: 'endpoint-added',
        text: 'endpoint added',
        level: 1,
        operation: 'GET',
        path: '/v1/tags',
        section: 'paths',
      },
    ]);
    const files = makeFiles({ [SPEC_PATH]: '{"head":true}' });
    await writeChangelogs(
      makeInput({
        packages: [makePackage({ openApiPath: SPEC_PATH })],
        git: makeGit({ '@dbp/widget@1.2.0': { [SPEC_PATH]: '{"base":true}' } }),
        files,
        differ,
      }),
    );
    expect(differ.calls).toEqual([['{"base":true}', '{"head":true}']]);
    expect(files.contents.get(CHANGELOG)).toContain('- `GET /v1/tags`: endpoint added.');
  });

  it('skips contract entries when the previous release was never tagged', async () => {
    const differ = makeDiffer();
    await writeChangelogs(
      makeInput({ packages: [makePackage({ openApiPath: SPEC_PATH })], differ }),
    );
    expect(differ.calls).toEqual([]);
  });

  it('records a dependency-only bump instead of an empty release', async () => {
    const files = makeFiles();
    await writeChangelogs(
      makeInput({
        files,
        pending: makePending([makeRelease({ type: 'patch', newVersion: '1.2.1', entries: [] })]),
      }),
    );
    expect(files.contents.get(CHANGELOG)).toContain(
      '### Changed\n\n- Updated internal dependencies.',
    );
  });

  it('flags a release with breaking entries in the central summary', async () => {
    const files = makeFiles();
    await writeChangelogs(
      makeInput({
        files,
        pending: makePending([
          makeRelease({
            type: 'major',
            newVersion: '2.0.0',
            entries: [makeEntry({ breaking: true })],
          }),
        ]),
      }),
    );
    expect(files.contents.get('CHANGELOG.md')).toContain(
      '2.0.0](packages/widget/CHANGELOG.md) contains breaking changes.',
    );
  });

  it('ignores releases of type none and writes nothing', async () => {
    const files = makeFiles();
    const written = await writeChangelogs(
      makeInput({ files, pending: makePending([makeRelease({ type: 'none' })]) }),
    );
    expect(written).toEqual([]);
    expect(files.contents.size).toBe(0);
  });

  it('fails when the plan names a package outside the workspace', async () => {
    await expect(writeChangelogs(makeInput({ packages: [] }))).rejects.toThrow(
      /not in the workspace/,
    );
  });
});
