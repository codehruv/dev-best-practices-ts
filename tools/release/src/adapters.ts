import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { getReleasePlan } from '@changesets/get-release-plan';

import { parseChangesetSummary } from './changeset-entries.js';
import { parseOasdiffChangelog } from './oasdiff.js';
import type { Files, Git, OpenApiDiffer, PendingChanges, PendingRelease } from './ports.js';
import type { ChangelogEntry, InterfacePackage } from './types.js';

const run = promisify(execFile);

function errorText(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'stderr' in error) {
    return String(error.stderr);
  }
  return String(error);
}

/** {@link Git} backed by the `git` CLI. */
export function gitCli(root: string): Git {
  return {
    async readFileAtRef(ref, path) {
      try {
        const { stdout } = await run('git', ['show', `${ref}:${path}`], {
          cwd: root,
          maxBuffer: 64 * 1024 * 1024,
        });
        return stdout;
      } catch (error) {
        const text = errorText(error);
        // A file that is new on this branch is a normal case. A missing ref is not: CI
        // must fetch the base branch, and passing silently would skip the check.
        if (text.includes('does not exist in') || text.includes('exists on disk, but not in')) {
          return undefined;
        }
        throw new Error(`git show ${ref}:${path} failed: ${text.trim()}`, { cause: error });
      }
    },
    async tagExists(tag) {
      try {
        await run('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`], { cwd: root });
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** {@link OpenApiDiffer} backed by the `oasdiff` CLI, which the dev shell and CI install. */
export function oasdiffCli(): OpenApiDiffer {
  return {
    async changelog(base, revision) {
      const dir = await mkdtemp(join(tmpdir(), 'oasdiff-'));
      try {
        await writeFile(join(dir, 'base.json'), base);
        await writeFile(join(dir, 'revision.json'), revision);
        // External refs are off, so a spec cannot make oasdiff fetch arbitrary URLs.
        const { stdout } = await run(
          'oasdiff',
          [
            'changelog',
            join(dir, 'base.json'),
            join(dir, 'revision.json'),
            '--format',
            'json',
            '--allow-external-refs=false',
          ],
          { maxBuffer: 64 * 1024 * 1024 },
        );
        return parseOasdiffChangelog(stdout.trim());
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
}

/** {@link Files} rooted at the repository. */
export function nodeFiles(root: string): Files {
  return {
    async read(path) {
      try {
        return await readFile(join(root, path), 'utf8');
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
        throw error;
      }
    },
    async write(path, content) {
      await writeFile(join(root, path), content);
    },
  };
}

function readPackageJson(text: string, path: string): { name: string; version: string } {
  const parsed: unknown = JSON.parse(text);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('name' in parsed) ||
    !('version' in parsed) ||
    typeof parsed.name !== 'string' ||
    typeof parsed.version !== 'string'
  ) {
    throw new Error(`${path} needs string "name" and "version" fields`);
  }
  return { name: parsed.name, version: parsed.version };
}

/**
 * Finds every package under `packages/`. A package with `api-extractor.json` has a
 * TypeScript API report, and one with `openapi/openapi.json` has an HTTP contract. The
 * conventions replace per-package configuration, so a new interface needs no wiring.
 */
export async function discoverPackages(root: string): Promise<InterfacePackage[]> {
  const entries = await readdir(join(root, 'packages'), { withFileTypes: true });
  const packages: InterfacePackage[] = [];
  for (const entry of entries
    .filter((candidate) => candidate.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const dir = `packages/${entry.name}`;
    const manifestPath = join(root, dir, 'package.json');
    if (!existsSync(manifestPath)) continue;
    const { name, version } = readPackageJson(await readFile(manifestPath, 'utf8'), manifestPath);
    const unscoped = name.replace(/^@[^/]+\//, '');
    packages.push({
      name,
      dir,
      version,
      ...(existsSync(join(root, dir, 'api-extractor.json')) && {
        apiReportPath: `${dir}/etc/${unscoped}.api.md`,
      }),
      ...(existsSync(join(root, dir, 'openapi', 'openapi.json')) && {
        openApiPath: `${dir}/openapi/openapi.json`,
      }),
    });
  }
  return packages;
}

/** Reads `.changeset/` through Changesets' own release planner and parses every summary. */
export async function readPendingChanges(root: string): Promise<PendingChanges> {
  const plan = await getReleasePlan(root);
  const errors: string[] = [];
  const entriesByChangeset = new Map<string, readonly ChangelogEntry[]>();
  for (const changeset of plan.changesets) {
    const parsed = parseChangesetSummary(changeset.summary);
    if (parsed.ok) entriesByChangeset.set(changeset.id, parsed.entries);
    else errors.push(...parsed.errors.map((error) => `.changeset/${changeset.id}.md: ${error}`));
  }
  const releases: PendingRelease[] = plan.releases.map((release) => ({
    name: release.name,
    type: release.type,
    oldVersion: release.oldVersion,
    newVersion: release.newVersion,
    entries: release.changesets.flatMap((id) => entriesByChangeset.get(id) ?? []),
  }));
  return { releases, errors };
}
