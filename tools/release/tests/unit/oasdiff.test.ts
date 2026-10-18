import { describe, expect, it } from 'vitest';

import { oasdiffBumpReasons, oasdiffEntries, parseOasdiffChangelog } from '../../src/oasdiff.js';
import { requiredBump } from '../../src/semver.js';

// Captured from `oasdiff changelog --format json` 1.33.0 after removing a required
// response property, adding a request property, deprecating and adding endpoints.
const SAMPLE = JSON.stringify([
  {
    id: 'response-required-property-removed',
    text: 'removed the required property `data/body` from the response with the `200` status',
    level: 3,
    operation: 'GET',
    operationId: 'get_note',
    path: '/v1/notes/{note_id}',
    section: 'paths',
    fingerprint: 'e3e20b2cc2a1',
  },
  {
    id: 'api-version-not-bumped',
    text: 'a breaking change was detected but the version is still `0.1.0`',
    level: 1,
    section: 'info',
    fingerprint: '17417607419e',
  },
  {
    id: 'new-optional-request-property',
    text: 'added the new optional request property `tags`',
    level: 1,
    operation: 'POST',
    path: '/v1/notes',
    section: 'paths',
  },
  {
    id: 'endpoint-deprecated',
    text: 'endpoint deprecated',
    level: 1,
    operation: 'DELETE',
    path: '/v1/notes/{note_id}',
    section: 'paths',
  },
  {
    id: 'endpoint-added',
    text: 'endpoint added',
    level: 1,
    operation: 'GET',
    path: '/v1/tags',
    section: 'paths',
  },
  {
    id: 'response-property-became-optional',
    text: 'the property became optional',
    level: 2,
    section: 'paths',
  },
  {
    id: 'request-parameter-description-changed',
    text: 'changed a description',
    level: 1,
    section: 'paths',
  },
]);

describe('parseOasdiffChangelog', () => {
  it('reads the fields the checks use', () => {
    const [first] = parseOasdiffChangelog(SAMPLE);
    expect(first).toEqual({
      id: 'response-required-property-removed',
      text: 'removed the required property `data/body` from the response with the `200` status',
      level: 3,
      operation: 'GET',
      path: '/v1/notes/{note_id}',
      section: 'paths',
    });
  });

  it('treats empty output as no changes', () => {
    expect(parseOasdiffChangelog('')).toEqual([]);
  });

  it('fails loudly when the format is not what it expects', () => {
    expect(() => parseOasdiffChangelog('{}')).toThrow(/not a JSON array/);
    expect(() => parseOasdiffChangelog('[{"id": 1}]')).toThrow(/change 0/);
  });
});

describe('oasdiffBumpReasons', () => {
  const reasons = oasdiffBumpReasons(parseOasdiffChangelog(SAMPLE));

  it('requires major for ERR-level changes', () => {
    expect(requiredBump(reasons)).toBe('major');
    expect(reasons[0]).toEqual({
      bump: 'major',
      message:
        '[response-required-property-removed] `GET /v1/notes/{note_id}`: removed the required property `data/body` from the response with the `200` status.',
    });
  });

  it('ignores document metadata changes', () => {
    expect(reasons.some((reason) => reason.message.includes('api-version-not-bumped'))).toBe(false);
  });

  it('requires minor for additions and deprecations, patch otherwise', () => {
    expect(reasons.map((reason) => reason.bump)).toEqual([
      'major',
      'minor',
      'minor',
      'minor',
      'patch',
      'patch',
    ]);
  });

  it('flags WARN-level changes for review', () => {
    expect(reasons[4]?.message).toMatch(/^potentially breaking, review: /);
  });
});

describe('oasdiffEntries', () => {
  it('drafts typed entries and marks breaking ones', () => {
    const entries = oasdiffEntries(parseOasdiffChangelog(SAMPLE));
    expect(entries.map((entry) => [entry.type, entry.breaking])).toEqual([
      ['Removed', true],
      ['Added', false],
      ['Deprecated', false],
      ['Added', false],
      ['Changed', false],
      ['Changed', false],
    ]);
    expect(entries[2]?.text).toBe('`DELETE /v1/notes/{note_id}`: endpoint deprecated.');
  });
});
