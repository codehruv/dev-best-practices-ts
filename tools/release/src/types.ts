/**
 * The six change types Keep a Changelog 2.0.0 allows, in the order sections appear
 * within a release. The spec fixes the set, so tooling never invents a seventh.
 */
export const CHANGE_TYPES = [
  'Added',
  'Changed',
  'Deprecated',
  'Removed',
  'Fixed',
  'Security',
] as const;

/** One of the {@link CHANGE_TYPES}. */
export type ChangeType = (typeof CHANGE_TYPES)[number];

/** One line of a changelog release section, before rendering. */
export interface ChangelogEntry {
  readonly type: ChangeType;
  /** Markdown text without the leading `- ` and without the `**Breaking:**` marker. */
  readonly text: string;
  /** Rendered with the `**Breaking:**` marker that Keep a Changelog 2.0.0 asks for. */
  readonly breaking: boolean;
}

/** A SemVer bump. `none` means the interface did not change. */
export type BumpType = 'none' | 'patch' | 'minor' | 'major';

/**
 * A versioned interface: a workspace package whose public TypeScript API, HTTP contract,
 * or both are checked for breaking changes. Each one carries its own version.
 */
export interface InterfacePackage {
  readonly name: string;
  /** Package directory relative to the repository root, with forward slashes. */
  readonly dir: string;
  readonly version: string;
  /** The committed API Extractor report, relative to the repository root. */
  readonly apiReportPath?: string;
  /** The committed OpenAPI document, relative to the repository root. */
  readonly openApiPath?: string;
}

/** Why a bump is required, for messages that tell the author what to do. */
export interface BumpReason {
  readonly bump: Exclude<BumpType, 'none'>;
  readonly message: string;
}
