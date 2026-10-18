import { describe, expect, it } from 'vitest';

import {
  addCentralSummary,
  addRelease,
  emptyChangelog,
  releaseTag,
  renderRelease,
} from '../../src/keep-a-changelog.js';
import { makeEntry } from './fakes.js';

const REPO = 'https://github.com/o/r';
const TAG_020 = '%40dbp%2Fwidget%400.2.0';
const TAG_010 = '%40dbp%2Fwidget%400.1.0';

describe('releaseTag', () => {
  it('matches the tag Changesets creates', () => {
    expect(releaseTag('@dbp/widget', '1.0.0')).toBe('@dbp/widget@1.0.0');
  });
});

describe('emptyChangelog', () => {
  it('pins the Keep a Changelog 2.0.0 preamble and an Unreleased section', () => {
    const changelog = emptyChangelog();
    expect(changelog).toContain('https://keepachangelog.com/en/2.0.0/');
    expect(changelog).toContain('https://semver.org/spec/v2.0.0.html');
    expect(changelog.trimEnd().endsWith('## [Unreleased]')).toBe(true);
  });
});

describe('renderRelease', () => {
  it('groups entries by type in spec order with breaking entries first', () => {
    const text = renderRelease({
      version: '2.0.0',
      date: '2026-10-18',
      entries: [
        makeEntry({ type: 'Fixed', text: 'A bug.' }),
        makeEntry({ type: 'Changed', text: 'Minor tweak.' }),
        makeEntry({ type: 'Changed', text: 'New return type.', breaking: true }),
        makeEntry({ type: 'Added', text: 'A feature.' }),
      ],
    });
    expect(text).toBe(
      [
        '## [2.0.0] - 2026-10-18',
        '',
        '### Added',
        '',
        '- A feature.',
        '',
        '### Changed',
        '',
        '- **Breaking:** New return type.',
        '- Minor tweak.',
        '',
        '### Fixed',
        '',
        '- A bug.',
        '',
      ].join('\n'),
    );
  });
});

describe('addRelease', () => {
  it('adds the first release below Unreleased with a tag link', () => {
    const result = addRelease(
      emptyChangelog(),
      { version: '0.1.0', date: '2026-10-18', entries: [makeEntry()] },
      { repoUrl: REPO, packageName: '@dbp/widget', previousVersion: undefined },
    );
    expect(result).toContain(
      '## [Unreleased]\n\n## [0.1.0] - 2026-10-18\n\n### Added\n\n- A feature.\n',
    );
    expect(result).toContain(`[Unreleased]: ${REPO}/compare/${TAG_010}...HEAD\n`);
    expect(result).toContain(`[0.1.0]: ${REPO}/releases/tag/${TAG_010}\n`);
  });

  it('puts the newest release first and links it to the previous tag', () => {
    const first = addRelease(
      emptyChangelog(),
      { version: '0.1.0', date: '2026-10-01', entries: [makeEntry()] },
      { repoUrl: REPO, packageName: '@dbp/widget', previousVersion: undefined },
    );
    const second = addRelease(
      first,
      { version: '0.2.0', date: '2026-10-18', entries: [makeEntry({ type: 'Fixed', text: 'B.' })] },
      { repoUrl: REPO, packageName: '@dbp/widget', previousVersion: '0.1.0' },
    );
    expect(second.indexOf('## [0.2.0]')).toBeLessThan(second.indexOf('## [0.1.0]'));
    expect(second).toContain(
      `[Unreleased]: ${REPO}/compare/${TAG_020}...HEAD\n[0.2.0]: ${REPO}/compare/${TAG_010}...${TAG_020}\n[0.1.0]:`,
    );
    expect(second.match(/\[Unreleased\]:/g)).toHaveLength(1);
    expect(second.endsWith('\n')).toBe(true);
    expect(second).not.toMatch(/\n\n\n/);
  });

  it('refuses to drop notes written under Unreleased', () => {
    expect(() =>
      addRelease(
        `${emptyChangelog()}\n- Hand-written note.\n`,
        { version: '0.1.0', date: '2026-10-18', entries: [makeEntry()] },
        { repoUrl: REPO, packageName: '@dbp/widget', previousVersion: undefined },
      ),
    ).toThrow(/is not empty/);
  });

  it('refuses a changelog without an Unreleased heading', () => {
    expect(() =>
      addRelease(
        '# Changelog\n',
        { version: '0.1.0', date: '2026-10-18', entries: [makeEntry()] },
        { repoUrl: REPO, packageName: '@dbp/widget', previousVersion: undefined },
      ),
    ).toThrow(/no "## \[Unreleased\]" heading/);
  });
});

describe('addCentralSummary', () => {
  const release = {
    packageName: '@dbp/widget',
    version: '1.0.0',
    changelogPath: 'packages/widget/CHANGELOG.md',
    breaking: true,
  };

  it('creates the central changelog with a dated entry', () => {
    const result = addCentralSummary(undefined, '2026-10-18', [release]);
    expect(result).toMatch(/^# Changelog\n/);
    expect(result).toContain(
      '## 2026-10-18\n\n- [`@dbp/widget` 1.0.0](packages/widget/CHANGELOG.md) contains breaking changes.\n',
    );
  });

  it('puts newer runs above older ones', () => {
    const first = addCentralSummary(undefined, '2026-10-01', [release]);
    const second = addCentralSummary(first, '2026-10-18', [
      { ...release, version: '1.1.0', breaking: false },
    ]);
    expect(second.indexOf('## 2026-10-18')).toBeLessThan(second.indexOf('## 2026-10-01'));
  });

  it('appends to an existing run on the same date', () => {
    const first = addCentralSummary(undefined, '2026-10-18', [release]);
    const second = addCentralSummary(first, '2026-10-18', [
      { ...release, packageName: '@dbp/other', changelogPath: 'packages/other/CHANGELOG.md' },
    ]);
    expect(second.match(/## 2026-10-18/g)).toHaveLength(1);
    expect(second).toContain('@dbp/other');
  });
});
