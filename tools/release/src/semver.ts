import type { BumpReason, BumpType } from './types.js';

const RANK: Record<BumpType, number> = { none: 0, patch: 1, minor: 2, major: 3 };

/** The larger of the given bumps, or `none` for an empty list. */
function maxBump(bumps: Iterable<BumpType>): BumpType {
  let result: BumpType = 'none';
  for (const bump of bumps) {
    if (RANK[bump] > RANK[result]) result = bump;
  }
  return result;
}

/** The largest bump among the reasons, or `none` when there are no reasons. */
export function requiredBump(reasons: readonly BumpReason[]): BumpType {
  return maxBump(reasons.map((reason) => reason.bump));
}

/**
 * Applies the 0.x policy: before 1.0.0 a breaking change bumps MINOR, because SemVer
 * item 4 leaves 0.y.z unstable and a MAJOR bump would declare 1.0.0 by accident.
 */
export function effectiveBump(bump: BumpType, currentVersion: string): BumpType {
  return bump === 'major' && currentVersion.startsWith('0.') ? 'minor' : bump;
}

/** True when `planned` covers `required`. */
export function satisfiesBump(planned: BumpType, required: BumpType): boolean {
  return RANK[planned] >= RANK[required];
}
