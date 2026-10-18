import { describe, expect, it } from 'vitest';

import { lintPendingChanges } from '../../src/lint.js';
import { makeEntry, makePackage, makePending, makeRelease } from './fakes.js';

describe('lintPendingChanges', () => {
  it('passes well-formed changesets', () => {
    expect(lintPendingChanges(makePending([makeRelease()]), [makePackage()])).toEqual([]);
  });

  it('reports parse errors', () => {
    expect(lintPendingChanges(makePending([], ['.changeset/a.md: bad']), [])).toEqual([
      '.changeset/a.md: bad',
    ]);
  });

  it('requires a breaking entry for a major release of a 1.x package', () => {
    expect(
      lintPendingChanges(makePending([makeRelease({ type: 'major' })]), [makePackage()]),
    ).toEqual([
      expect.stringContaining(
        'plans a major release, but no changeset entry starts with "**Breaking:**"',
      ),
    ]);
  });

  it('accepts a major release that names what breaks', () => {
    const release = makeRelease({
      type: 'major',
      entries: [makeEntry({ type: 'Removed', breaking: true })],
    });
    expect(lintPendingChanges(makePending([release]), [makePackage()])).toEqual([]);
  });

  it('does not demand a breaking entry for the 0.x to 1.0.0 graduation', () => {
    expect(
      lintPendingChanges(makePending([makeRelease({ type: 'major' })]), [
        makePackage({ version: '0.9.0' }),
      ]),
    ).toEqual([]);
  });
});
