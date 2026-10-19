/** One workspace package, as the check needs to see it. */
export interface WorkspacePackage {
  /** Path from the repo root, such as `packages/iso-retry`. */
  readonly dir: string;
  /** The `name` field of the package's `package.json`. */
  readonly name: string;
  /** The text of the package's `eslint.config.ts`, or `undefined` when the file is missing. */
  readonly eslintConfig: string | undefined;
}

// The prefix decides where a package's code may run, and the ESLint factory enforces it.
// Each entry here must match a factory exported by eslint.config.base.ts.
const FACTORY_BY_PREFIX: Readonly<Record<string, string>> = {
  'iso-': 'getIsomorphicESLintConfig',
  'server-': 'getNodeESLintConfig',
};

// Tools are dev-only CLIs that never ship, so they skip the prefix rule but still run on Node.
const TOOL_FACTORY = 'getNodeESLintConfig';

/**
 * Checks that every package declares where it runs: libraries under `packages/` carry an
 * `iso-` or `server-` prefix in both directory and package name, and lint with the
 * matching ESLint factory. A name alone enforces nothing, so the check ties it to the
 * lint rules that do.
 *
 * @returns One message per problem. An empty list means the workspace is consistent.
 */
export function checkWorkspacePackages(packages: readonly WorkspacePackage[]): string[] {
  return packages.flatMap(checkPackage);
}

function checkPackage(pkg: WorkspacePackage): string[] {
  const [root, dirName = ''] = pkg.dir.split('/');
  if (root === 'tools') {
    return checkFactory(pkg, TOOL_FACTORY);
  }

  const prefix = Object.keys(FACTORY_BY_PREFIX).find((candidate) => dirName.startsWith(candidate));
  if (prefix === undefined) {
    return [
      `${pkg.dir}: directory must start with "iso-" (browser and Node) or "server-" (Node only).`,
    ];
  }

  const problems: string[] = [];
  const unscopedName = pkg.name.split('/').at(-1);
  if (unscopedName !== dirName) {
    problems.push(`${pkg.dir}: package name "${pkg.name}" must end with "/${dirName}".`);
  }
  const factory = FACTORY_BY_PREFIX[prefix];
  if (factory !== undefined) {
    problems.push(...checkFactory(pkg, factory));
  }
  return problems;
}

function checkFactory(pkg: WorkspacePackage, factory: string): string[] {
  if (pkg.eslintConfig === undefined) {
    return [`${pkg.dir}: eslint.config.ts is missing.`];
  }
  const otherFactories = [...new Set([...Object.values(FACTORY_BY_PREFIX), TOOL_FACTORY])].filter(
    (candidate) => candidate !== factory,
  );
  if (
    !pkg.eslintConfig.includes(`${factory}(`) ||
    otherFactories.some((other) => pkg.eslintConfig?.includes(`${other}(`))
  ) {
    return [`${pkg.dir}: eslint.config.ts must call ${factory} and no other config factory.`];
  }
  return [];
}
