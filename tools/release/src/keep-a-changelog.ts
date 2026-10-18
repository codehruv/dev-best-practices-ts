import { CHANGE_TYPES, type ChangelogEntry } from './types.js';

const SPEC_URL = 'https://keepachangelog.com/en/2.0.0/';
const UNRELEASED_HEADING = '## [Unreleased]';

/** A release to write into a changelog. */
export interface ReleaseSection {
  readonly version: string;
  /** ISO 8601 calendar date, `YYYY-MM-DD`. */
  readonly date: string;
  readonly entries: readonly ChangelogEntry[];
}

/** Where version tags live, so each release links to the diff that produced it. */
export interface ReleaseLinks {
  /** Repository web URL without a trailing slash, for example `https://github.com/o/r`. */
  readonly repoUrl: string;
  readonly packageName: string;
  /** The version this release follows, or `undefined` for the first release. */
  readonly previousVersion: string | undefined;
}

/**
 * The git tag Changesets creates for a package release. Changelog links point at these
 * tags, so the format must match what `changeset publish` and `changeset tag` create.
 */
export function releaseTag(packageName: string, version: string): string {
  return `${packageName}@${version}`;
}

function compareUrl(repoUrl: string, from: string, to: string): string {
  return `${repoUrl}/compare/${encodeURIComponent(from)}...${encodeURIComponent(to)}`;
}

function tagUrl(repoUrl: string, tag: string): string {
  return `${repoUrl}/releases/tag/${encodeURIComponent(tag)}`;
}

/** A new, empty package changelog with the preamble Keep a Changelog 2.0.0 recommends. */
export function emptyChangelog(): string {
  return [
    '# Changelog',
    '',
    'All notable changes to this package will be documented in this file.',
    '',
    `The format is based on [Keep a Changelog](${SPEC_URL}),`,
    'and this package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).',
    '',
    UNRELEASED_HEADING,
    '',
  ].join('\n');
}

/** Renders one release: the version heading, then one section per change type in spec order. */
export function renderRelease({ version, date, entries }: ReleaseSection): string {
  const lines = [`## [${version}] - ${date}`];
  for (const type of CHANGE_TYPES) {
    // Breaking entries lead their section so a reader scanning the section meets them first.
    const ofType = entries
      .filter((entry) => entry.type === type)
      .sort((a, b) => Number(b.breaking) - Number(a.breaking));
    if (ofType.length === 0) continue;
    lines.push('', `### ${type}`, '');
    for (const entry of ofType) {
      lines.push(`- ${entry.breaking ? '**Breaking:** ' : ''}${entry.text}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Inserts a release below `## [Unreleased]` and updates the reference links at the
 * bottom of the file. Pending changes live in `.changeset/`, so the Unreleased section
 * stays empty in the file, and a non-empty one is an error instead of being guessed at.
 */
export function addRelease(
  changelog: string,
  release: ReleaseSection,
  links: ReleaseLinks,
): string {
  const lines = changelog.replace(/\n*$/, '\n').split('\n');
  const headingIndex = lines.indexOf(UNRELEASED_HEADING);
  if (headingIndex === -1) {
    throw new Error(`changelog has no "${UNRELEASED_HEADING}" heading`);
  }
  const nextIndex = lines.findIndex(
    (line, index) => index > headingIndex && (line.startsWith('## ') || /^\[[^\]]+\]: /.test(line)),
  );
  const bodyEnd = nextIndex === -1 ? lines.length : nextIndex;
  if (lines.slice(headingIndex + 1, bodyEnd).some((line) => line.trim() !== '')) {
    throw new Error(
      `the "${UNRELEASED_HEADING}" section is not empty. Move its notes into a changeset, because the release tooling writes every entry from changesets.`,
    );
  }

  const newTag = releaseTag(links.packageName, release.version);
  const unreleasedLink = `[Unreleased]: ${compareUrl(links.repoUrl, newTag, 'HEAD')}`;
  const versionLink =
    links.previousVersion === undefined
      ? `[${release.version}]: ${tagUrl(links.repoUrl, newTag)}`
      : `[${release.version}]: ${compareUrl(links.repoUrl, releaseTag(links.packageName, links.previousVersion), newTag)}`;

  const before = lines.slice(0, headingIndex + 1);
  const after = lines.slice(bodyEnd).join('\n').replace(/^\n+/, '');
  const releaseText = renderRelease(release);

  const linkLines = after.split('\n');
  const unreleasedIndex = linkLines.findIndex((line) => line.startsWith('[Unreleased]: '));
  let rest: string;
  if (unreleasedIndex === -1) {
    const trimmed = after.replace(/\n*$/, '');
    rest = `${trimmed}${trimmed === '' ? '' : '\n\n'}${unreleasedLink}\n${versionLink}`;
  } else {
    linkLines.splice(unreleasedIndex, 1, unreleasedLink, versionLink);
    rest = linkLines.join('\n');
  }

  return `${before.join('\n')}\n\n${releaseText}\n${rest.replace(/\n*$/, '\n')}`;
}

/** A package release, summarized for the repository-level changelog. */
export interface ReleaseSummary {
  readonly packageName: string;
  readonly version: string;
  /** Path to the package changelog relative to the repository root. */
  readonly changelogPath: string;
  readonly breaking: boolean;
}

const CENTRAL_HEADER = [
  '# Changelog',
  '',
  'This repository publishes several independently versioned interfaces. Each one keeps',
  'a detailed changelog next to its code. This file is the summary: one dated entry per',
  'release run, linking to each released interface.',
  '',
  `Package changelogs follow [Keep a Changelog](${SPEC_URL}) and`,
  '[Semantic Versioning](https://semver.org/spec/v2.0.0.html).',
  '',
].join('\n');

/**
 * Adds one release run to the central changelog. Keep a Changelog 2.0.0 asks a product
 * split into components to keep a central summary so readers need not open every
 * component changelog to learn what a release means.
 */
export function addCentralSummary(
  changelog: string | undefined,
  date: string,
  releases: readonly ReleaseSummary[],
): string {
  const base = changelog ?? CENTRAL_HEADER;
  const lines = releases
    .toSorted((a, b) => a.packageName.localeCompare(b.packageName))
    .map(
      (release) =>
        `- [\`${release.packageName}\` ${release.version}](${release.changelogPath})${release.breaking ? ' contains breaking changes.' : ''}`,
    );
  const heading = `## ${date}`;
  const existing = base.split('\n');
  const headingIndex = existing.indexOf(heading);
  if (headingIndex !== -1) {
    existing.splice(headingIndex + 2, 0, ...lines);
    return existing.join('\n').replace(/\n*$/, '\n');
  }
  const firstRelease = existing.findIndex((line) => line.startsWith('## '));
  const insertAt = firstRelease === -1 ? existing.length : firstRelease;
  const head = existing.slice(0, insertAt).join('\n').replace(/\n*$/, '\n');
  const tail = existing.slice(insertAt).join('\n');
  const section = `${heading}\n\n${lines.join('\n')}\n`;
  return `${head}\n${section}${tail === '' ? '' : `\n${tail}`}`.replace(/\n*$/, '\n');
}
