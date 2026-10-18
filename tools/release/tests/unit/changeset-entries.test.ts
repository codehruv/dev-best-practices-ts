import { describe, expect, it } from 'vitest';

import { parseChangesetSummary } from '../../src/changeset-entries.js';

describe('parseChangesetSummary', () => {
  it('parses one entry per typed line', () => {
    expect(parseChangesetSummary('Added: a thing.\nFixed: a bug.')).toEqual({
      ok: true,
      entries: [
        { type: 'Added', text: 'a thing.', breaking: false },
        { type: 'Fixed', text: 'a bug.', breaking: false },
      ],
    });
  });

  it('marks entries that open with **Breaking:** and strips the marker', () => {
    expect(
      parseChangesetSummary('Removed: **Breaking:** `run()` no longer accepts a number.'),
    ).toEqual({
      ok: true,
      entries: [{ type: 'Removed', text: '`run()` no longer accepts a number.', breaking: true }],
    });
  });

  it('joins indented continuation lines onto the entry above', () => {
    expect(
      parseChangesetSummary('Changed: retries now honor\n  `Retry-After` headers.\n\nFixed: x.'),
    ).toEqual({
      ok: true,
      entries: [
        { type: 'Changed', text: 'retries now honor `Retry-After` headers.', breaking: false },
        { type: 'Fixed', text: 'x.', breaking: false },
      ],
    });
  });

  it('rejects a line without a change type, naming the line', () => {
    const result = parseChangesetSummary('Added: ok.\nImproved: speed.');
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toEqual([
      expect.stringContaining('line 2 must start with one of'),
    ]);
  });

  it('rejects a continuation with no entry above it', () => {
    expect(parseChangesetSummary('  dangling').ok).toBe(false);
  });

  it('rejects an empty summary', () => {
    expect(parseChangesetSummary('\n\n')).toEqual({
      ok: false,
      errors: ['the summary declares no entries'],
    });
  });

  it('requires text after the type', () => {
    expect(parseChangesetSummary('Added:').ok).toBe(false);
  });
});
