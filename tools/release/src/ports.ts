import type { OasdiffChange } from './oasdiff.js';
import type { BumpType, ChangelogEntry } from './types.js';

/** Read access to git history. Checks compare the working tree against a base ref. */
export interface Git {
  /** The file at `ref`, or `undefined` when the file does not exist at that ref. */
  readFileAtRef(ref: string, path: string): Promise<string | undefined>;
  tagExists(tag: string): Promise<boolean>;
}

/** Diffs two OpenAPI documents, given as file contents, the way `oasdiff changelog` does. */
export interface OpenApiDiffer {
  changelog(base: string, revision: string): Promise<readonly OasdiffChange[]>;
}

/** Working-tree files, addressed relative to the repository root. */
export interface Files {
  /** The file contents, or `undefined` when the file does not exist. */
  read(path: string): Promise<string | undefined>;
  write(path: string, content: string): Promise<void>;
}

/** One package release that pending changesets plan. */
export interface PendingRelease {
  readonly name: string;
  readonly type: BumpType;
  readonly oldVersion: string | undefined;
  readonly newVersion: string | undefined;
  /** Entries from every changeset that names this package. */
  readonly entries: readonly ChangelogEntry[];
}

/** Everything the `.changeset/` directory plans, plus summaries that failed to parse. */
export interface PendingChanges {
  readonly releases: readonly PendingRelease[];
  readonly errors: readonly string[];
}
