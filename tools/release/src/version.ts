import {
  addCentralSummary,
  addRelease,
  emptyChangelog,
  type ReleaseSummary,
  releaseTag,
} from './keep-a-changelog.js';
import { oasdiffEntries } from './oasdiff.js';
import type { Files, Git, OpenApiDiffer, PendingChanges } from './ports.js';
import type { ChangelogEntry, InterfacePackage } from './types.js';

/** What `version` needs. Runs before `changeset version`, which deletes the changesets. */
export interface VersionInput {
  /** Release date, `YYYY-MM-DD`. */
  readonly date: string;
  /** Repository web URL for compare links. */
  readonly repoUrl: string;
  readonly packages: readonly InterfacePackage[];
  readonly pending: PendingChanges;
  readonly git: Git;
  readonly files: Files;
  readonly differ: OpenApiDiffer;
}

const CENTRAL_CHANGELOG = 'CHANGELOG.md';

async function contractEntries(
  input: VersionInput,
  pkg: InterfacePackage,
  oldVersion: string | undefined,
): Promise<ChangelogEntry[]> {
  if (pkg.openApiPath === undefined || oldVersion === undefined) return [];
  const tag = releaseTag(pkg.name, oldVersion);
  if (!(await input.git.tagExists(tag))) return [];
  const base = await input.git.readFileAtRef(tag, pkg.openApiPath);
  const head = await input.files.read(pkg.openApiPath);
  if (base === undefined || head === undefined || base === head) return [];
  return oasdiffEntries(await input.differ.changelog(base, head));
}

/**
 * Writes a Keep a Changelog release section for every package the pending changesets
 * release, then adds the run to the central changelog. Returns the paths it wrote.
 * Changesets' own changelog writer is disabled, because it groups entries by bump size
 * ("Minor Changes") instead of by change type.
 */
export async function writeChangelogs(input: VersionInput): Promise<string[]> {
  const written: string[] = [];
  const summaries: ReleaseSummary[] = [];

  for (const release of input.pending.releases) {
    if (release.type === 'none' || release.newVersion === undefined) continue;
    const pkg = input.packages.find((candidate) => candidate.name === release.name);
    if (pkg === undefined) {
      throw new Error(`${release.name} is in the release plan but not in the workspace`);
    }

    const entries = [
      ...release.entries,
      ...(await contractEntries(input, pkg, release.oldVersion)),
    ];
    if (entries.length === 0) {
      // Changesets bumps dependents of a released package without a changeset of their own.
      entries.push({ type: 'Changed', text: 'Updated internal dependencies.', breaking: false });
    }

    const path = `${pkg.dir}/CHANGELOG.md`;
    const existing = (await input.files.read(path)) ?? emptyChangelog();
    const previousVersion =
      release.oldVersion !== undefined && existing.includes(`## [${release.oldVersion}]`)
        ? release.oldVersion
        : undefined;
    await input.files.write(
      path,
      addRelease(
        existing,
        { version: release.newVersion, date: input.date, entries },
        { repoUrl: input.repoUrl, packageName: pkg.name, previousVersion },
      ),
    );
    written.push(path);
    summaries.push({
      packageName: pkg.name,
      version: release.newVersion,
      changelogPath: path,
      breaking: entries.some((entry) => entry.breaking),
    });
  }

  if (summaries.length > 0) {
    const central = await input.files.read(CENTRAL_CHANGELOG);
    await input.files.write(CENTRAL_CHANGELOG, addCentralSummary(central, input.date, summaries));
    written.push(CENTRAL_CHANGELOG);
  }
  return written;
}
