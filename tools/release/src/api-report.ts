import type { BumpReason } from './types.js';

type DeclarationKind =
  | 'class'
  | 'abstract class'
  | 'interface'
  | 'type'
  | 'const'
  | 'let'
  | 'function'
  | 'enum'
  | 'namespace';

interface Declaration {
  readonly kind: DeclarationKind;
  readonly name: string;
  /** Release tags from the `// @public` style comment API Extractor writes above it. */
  readonly tags: string;
  /** Every line of the declaration, trimmed, header included. */
  readonly lines: readonly string[];
}

const HEADER =
  /^export (?:declare )?(abstract class|class|interface|type|const|let|function|enum|namespace) ([\w$]+)/;

// Members added to these kinds break code that implements or constructs the type,
// unless the member is optional.
const IMPLEMENTED_KINDS: ReadonlySet<DeclarationKind> = new Set([
  'interface',
  'type',
  'abstract class',
]);

function codeBlock(report: string): string[] {
  const start = report.indexOf('```ts');
  if (start === -1) return [];
  const end = report.indexOf('```', start + 5);
  return report.slice(start + 5, end === -1 ? undefined : end).split('\n');
}

function depthChange(line: string): number {
  let depth = 0;
  for (const char of line) {
    if (char === '{' || char === '(' || char === '[') depth += 1;
    else if (char === '}' || char === ')' || char === ']') depth -= 1;
  }
  return depth;
}

/**
 * Splits an API Extractor report into its exported declarations. API Extractor writes
 * one declaration per statement, preceded by a release-tag comment, which is the only
 * structure this relies on.
 */
function parseReport(report: string): Map<string, Declaration> {
  const declarations = new Map<string, Declaration>();
  let tags = '';
  let current: { kind: DeclarationKind; name: string; lines: string[]; tags: string } | undefined;
  let depth = 0;

  for (const raw of codeBlock(report)) {
    const line = raw.trim();
    if (current !== undefined) {
      // Comments inside a body are "(undocumented)" markers and warnings, not API.
      if (line.startsWith('//')) continue;
      current.lines.push(line);
      depth += depthChange(line);
    } else if (line.startsWith('// @')) {
      // "(undocumented)" tracks doc comments, which are not part of the contract.
      tags = line.replace(' (undocumented)', '');
      continue;
    } else {
      const match = HEADER.exec(line);
      if (match?.[1] === undefined || match[2] === undefined) continue;
      current = { kind: match[1] as DeclarationKind, name: match[2], lines: [line], tags };
      tags = '';
      depth = depthChange(line);
    }
    if (depth <= 0 && /[;}]$/.test(line)) {
      const key = `${current.kind} ${current.name}`;
      const existing = declarations.get(key);
      // Function overloads share a key, so their lines merge into one declaration.
      declarations.set(key, {
        kind: current.kind,
        name: current.name,
        tags: existing?.tags ?? current.tags,
        lines: [...(existing?.lines ?? []), ...current.lines],
      });
      current = undefined;
    }
  }
  return declarations;
}

function countLines(lines: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of lines) counts.set(line, (counts.get(line) ?? 0) + 1);
  return counts;
}

/** Lines in `a` that `b` lacks, counting duplicates. */
function missingLines(a: readonly string[], b: readonly string[]): string[] {
  const remaining = countLines(b);
  const missing: string[] = [];
  for (const line of a) {
    const count = remaining.get(line) ?? 0;
    if (count > 0) remaining.set(line, count - 1);
    else missing.push(line);
  }
  return missing;
}

function isOptionalMember(line: string): boolean {
  return /^(readonly )?[\w$]+\?[:(]/.test(line);
}

/**
 * Classifies the change between two API Extractor reports into the SemVer bumps it
 * requires. This is a conservative line-level heuristic, not a type checker:
 *
 * - A removed declaration, a changed release tag, or any removed line is MAJOR.
 * - A required member added to an interface, a type literal, or an abstract class is
 *   MAJOR, because implementers no longer compile.
 * - Any other addition is MINOR.
 * - A report that changed in no other way (imports, warnings) is PATCH.
 *
 * It errs toward MAJOR, so it sets a floor on the bump, and the changeset author can
 * always choose a larger one. A report with no base is a new interface, whose first
 * version is the package's current version, so it requires no bump.
 */
export function classifyApiReportChange(base: string | undefined, head: string): BumpReason[] {
  if (base === undefined || base === head) return [];

  const before = parseReport(base);
  const after = parseReport(head);
  const reasons: BumpReason[] = [];

  for (const [key, declaration] of before) {
    const next = after.get(key);
    if (next === undefined) {
      reasons.push({ bump: 'major', message: `removed ${key}` });
      continue;
    }
    if (next.tags !== declaration.tags) {
      reasons.push({
        bump: 'major',
        message: `${key} changed release tag from "${declaration.tags}" to "${next.tags}"`,
      });
    }
    for (const line of missingLines(declaration.lines, next.lines)) {
      reasons.push({ bump: 'major', message: `${key} removed or changed: ${line}` });
    }
    for (const line of missingLines(next.lines, declaration.lines)) {
      const breaksImplementers = IMPLEMENTED_KINDS.has(next.kind) && !isOptionalMember(line);
      reasons.push(
        breaksImplementers
          ? { bump: 'major', message: `${key} gained a required member: ${line}` }
          : { bump: 'minor', message: `${key} gained: ${line}` },
      );
    }
  }
  for (const key of after.keys()) {
    if (!before.has(key)) reasons.push({ bump: 'minor', message: `added ${key}` });
  }

  if (reasons.length === 0) {
    reasons.push({ bump: 'patch', message: 'API report changed without changing declarations' });
  }
  return reasons;
}
