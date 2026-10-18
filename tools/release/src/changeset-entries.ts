import { CHANGE_TYPES, type ChangelogEntry, type ChangeType } from './types.js';

const BREAKING_MARKER = '**Breaking:**';
const ENTRY_START = new RegExp(`^(${CHANGE_TYPES.join('|')}):\\s+(\\S.*)$`);

/** The entries a changeset summary declares, or the reasons it does not parse. */
export type ParsedSummary =
  | { readonly ok: true; readonly entries: readonly ChangelogEntry[] }
  | { readonly ok: false; readonly errors: readonly string[] };

/**
 * Parses a changeset summary into Keep a Changelog entries.
 *
 * Each entry starts on its own line with a change type and a colon, for example
 * `Fixed: retries stop after the deadline.` Indented lines continue the entry above.
 * An entry that opens with `**Breaking:**` is a breaking change. Authors write entries
 * for readers instead of having them derived from commits, because Keep a Changelog
 * 2.0.0 asks humans to curate what is notable.
 */
export function parseChangesetSummary(summary: string): ParsedSummary {
  const entries: { type: ChangeType; lines: string[] }[] = [];
  const errors: string[] = [];

  summary.split('\n').forEach((line, index) => {
    if (line.trim() === '') return;
    const match = ENTRY_START.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      entries.push({ type: match[1] as ChangeType, lines: [match[2].trimEnd()] });
      return;
    }
    const current = entries.at(-1);
    if (current !== undefined && /^\s+\S/.test(line)) {
      current.lines.push(line.trim());
      return;
    }
    errors.push(
      `line ${index + 1} must start with one of ${CHANGE_TYPES.map((type) => `"${type}:"`).join(', ')} or be indented to continue the entry above: ${JSON.stringify(line)}`,
    );
  });

  if (entries.length === 0 && errors.length === 0) {
    errors.push('the summary declares no entries');
  }
  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    entries: entries.map(({ type, lines }) => {
      const text = lines.join(' ');
      const breaking = text.startsWith(BREAKING_MARKER);
      return { type, breaking, text: breaking ? text.slice(BREAKING_MARKER.length).trim() : text };
    }),
  };
}
