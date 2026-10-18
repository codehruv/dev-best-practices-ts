import { classifyApiReportChange } from './api-report.js';
import { oasdiffBumpReasons } from './oasdiff.js';
import type { Files, Git, OpenApiDiffer, PendingChanges } from './ports.js';
import { effectiveBump, requiredBump, satisfiesBump } from './semver.js';
import type { BumpReason, BumpType, InterfacePackage } from './types.js';

/** What `check` needs. Every collaborator is injected so tests run without git or oasdiff. */
export interface CheckInput {
  /** The ref the working tree is compared against, usually the PR base branch. */
  readonly baseRef: string;
  readonly interfaces: readonly InterfacePackage[];
  readonly pending: PendingChanges;
  readonly git: Git;
  readonly files: Files;
  readonly differ: OpenApiDiffer;
}

/** The verdict for one interface. */
export interface InterfaceVerdict {
  readonly name: string;
  readonly version: string;
  /** The bump the diff requires, after the 0.x policy. */
  readonly required: BumpType;
  /** The bump pending changesets plan for this package. */
  readonly planned: BumpType;
  readonly reasons: readonly BumpReason[];
  /** Why the planned changes do not cover the diff. Empty when the interface passes. */
  readonly problems: readonly string[];
}

/** The result of checking every interface against the base ref. */
export interface CheckResult {
  readonly verdicts: readonly InterfaceVerdict[];
  /** Problems that belong to no single interface, such as unparseable changesets. */
  readonly errors: readonly string[];
}

async function apiReportReasons(input: CheckInput, path: string): Promise<BumpReason[]> {
  const head = await input.files.read(path);
  if (head === undefined) {
    throw new Error(`${path} is missing. Run \`just generate\` and commit the report.`);
  }
  const base = await input.git.readFileAtRef(input.baseRef, path);
  return classifyApiReportChange(base, head).map((reason) => ({
    ...reason,
    message: `TypeScript API: ${reason.message}`,
  }));
}

async function openApiReasons(input: CheckInput, path: string): Promise<BumpReason[]> {
  const head = await input.files.read(path);
  if (head === undefined) {
    throw new Error(`${path} is missing. Run \`just generate\` and commit the document.`);
  }
  const base = await input.git.readFileAtRef(input.baseRef, path);
  // A new document is a new interface. Its first version is the package's current version.
  if (base === undefined || base === head) return [];
  const changes = await input.differ.changelog(base, head);
  return oasdiffBumpReasons(changes).map((reason) => ({
    ...reason,
    message: `HTTP contract: ${reason.message}`,
  }));
}

/**
 * Checks that pending changesets cover every interface change since `baseRef`: the
 * planned bump is at least the bump the diff requires, and a breaking change carries
 * an entry marked `**Breaking:**`. This turns "remember to bump the version" from a
 * review comment into a failing check.
 */
export async function checkInterfaces(input: CheckInput): Promise<CheckResult> {
  const verdicts: InterfaceVerdict[] = [];

  for (const pkg of input.interfaces) {
    const reasons = [
      ...(pkg.apiReportPath === undefined ? [] : await apiReportReasons(input, pkg.apiReportPath)),
      ...(pkg.openApiPath === undefined ? [] : await openApiReasons(input, pkg.openApiPath)),
    ];
    const rawRequired = requiredBump(reasons);
    const required = effectiveBump(rawRequired, pkg.version);
    const release = input.pending.releases.find((candidate) => candidate.name === pkg.name);
    const planned = release?.type ?? 'none';
    const problems: string[] = [];

    if (!satisfiesBump(planned, required)) {
      problems.push(
        `requires at least a ${required} bump, but pending changesets plan ${planned}. Run \`pnpm changeset\`, select ${pkg.name}, and choose ${required}.`,
      );
    }
    if (rawRequired === 'major' && !(release?.entries.some((entry) => entry.breaking) ?? false)) {
      problems.push(
        'has a breaking change, but no changeset entry for it starts with "**Breaking:**". Say what breaks and how to upgrade.',
      );
    }
    verdicts.push({ name: pkg.name, version: pkg.version, required, planned, reasons, problems });
  }

  return { verdicts, errors: input.pending.errors };
}
