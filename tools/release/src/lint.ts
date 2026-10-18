import type { PendingChanges } from './ports.js';
import type { InterfacePackage } from './types.js';

/**
 * Validates pending changesets without looking at the diff: every summary parses, and
 * every MAJOR release of a 1.x+ package names what breaks. Cheap enough for
 * `just verify`, unlike `check`, which needs the base branch.
 */
export function lintPendingChanges(
  pending: PendingChanges,
  packages: readonly InterfacePackage[],
): string[] {
  const errors = [...pending.errors];
  for (const release of pending.releases) {
    if (release.type !== 'major') continue;
    const pkg = packages.find((candidate) => candidate.name === release.name);
    if (pkg?.version.startsWith('0.') ?? false) continue;
    if (!release.entries.some((entry) => entry.breaking)) {
      errors.push(
        `${release.name} plans a major release, but no changeset entry starts with "**Breaking:**". Say what breaks and how to upgrade.`,
      );
    }
  }
  return errors;
}
