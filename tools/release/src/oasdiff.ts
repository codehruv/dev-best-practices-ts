import type { BumpReason, ChangelogEntry, ChangeType } from './types.js';

/** oasdiff severity levels, from `oasdiff changelog --format json`. */
const LEVEL_ERR = 3;
const LEVEL_WARN = 2;

/** One change reported by `oasdiff changelog --format json`. */
export interface OasdiffChange {
  readonly id: string;
  readonly text: string;
  readonly level: number;
  readonly operation?: string;
  readonly path?: string;
  readonly section?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Validates oasdiff JSON output, so a format change in oasdiff fails loudly. */
export function parseOasdiffChangelog(json: string): OasdiffChange[] {
  const parsed: unknown = JSON.parse(json === '' ? '[]' : json);
  if (!Array.isArray(parsed)) throw new Error('oasdiff output is not a JSON array');
  return parsed.map((item: unknown, index) => {
    if (
      !isRecord(item) ||
      typeof item['id'] !== 'string' ||
      typeof item['text'] !== 'string' ||
      typeof item['level'] !== 'number'
    ) {
      throw new Error(`oasdiff change ${index} lacks a string id, string text, or numeric level`);
    }
    return {
      id: item['id'],
      text: item['text'],
      level: item['level'],
      ...(typeof item['operation'] === 'string' && { operation: item['operation'] }),
      ...(typeof item['path'] === 'string' && { path: item['path'] }),
      ...(typeof item['section'] === 'string' && { section: item['section'] }),
    };
  });
}

// The info section is document metadata (title, version). oasdiff also reports
// "api-version-not-bumped" there, which the version check covers more precisely.
function isContractChange(change: OasdiffChange): boolean {
  return change.section !== 'info';
}

function changeType(id: string): ChangeType {
  if (id.includes('deprecated')) return 'Deprecated';
  if (id.includes('removed')) return 'Removed';
  if (id.includes('added') || id.startsWith('new-')) return 'Added';
  return 'Changed';
}

function describe(change: OasdiffChange): string {
  const where =
    change.operation !== undefined && change.path !== undefined
      ? `\`${change.operation} ${change.path}\`: `
      : '';
  return `${where}${change.text}.`;
}

/**
 * The bumps an HTTP contract change requires. ERR-level changes break existing clients
 * (MAJOR). Additions and deprecations are MINOR, as SemVer item 7 requires for
 * deprecations. Everything else is PATCH.
 */
export function oasdiffBumpReasons(changes: readonly OasdiffChange[]): BumpReason[] {
  return changes.filter(isContractChange).map((change) => {
    const prefix = change.level === LEVEL_WARN ? 'potentially breaking, review: ' : '';
    const message = `${prefix}[${change.id}] ${describe(change)}`;
    if (change.level >= LEVEL_ERR) return { bump: 'major', message };
    const type = changeType(change.id);
    return { bump: type === 'Added' || type === 'Deprecated' ? 'minor' : 'patch', message };
  });
}

/**
 * Drafts changelog entries from oasdiff output. They land in the version PR, where a
 * human curates them before release, because oasdiff reports every schema-level
 * change while a changelog lists only the notable ones.
 */
export function oasdiffEntries(changes: readonly OasdiffChange[]): ChangelogEntry[] {
  return changes.filter(isContractChange).map((change) => ({
    type: changeType(change.id),
    text: describe(change),
    breaking: change.level >= LEVEL_ERR,
  }));
}
