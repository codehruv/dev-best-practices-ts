/** One problem found in an SLO spec, located precisely enough to fix without searching. */
export interface SpecIssue {
  /** The file (or other label) the document came from. */
  readonly source: string;
  /** The object, as `<kind>/<name>`, or `document <n>` when the object has no usable name. */
  readonly object: string;
  /** Dotted path to the field inside the object. Empty for object-level problems. */
  readonly path: string;
  readonly message: string;
}

/**
 * Base class for every error this package throws, so the CLI can separate spec and
 * input problems (exit with a readable message) from bugs (crash with a stack).
 */
export class SloError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Thrown when SLO spec files fail validation. Carries every issue, not only the first. */
export class SloSpecError extends SloError {
  readonly issues: readonly SpecIssue[];

  constructor(issues: readonly SpecIssue[]) {
    super(`SLO spec has ${issues.length} problem(s):\n${issues.map(formatIssue).join('\n')}`);
    this.issues = issues;
  }
}

/** Thrown when benchmark results or a baseline file cannot be used as evaluation input. */
export class SloInputError extends SloError {}

function formatIssue(issue: SpecIssue): string {
  const field = issue.path === '' ? '' : ` ${issue.path}:`;
  return `  ${issue.source} ${issue.object}${field} ${issue.message}`;
}
