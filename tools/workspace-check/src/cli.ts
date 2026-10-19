import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { checkWorkspacePackages, type WorkspacePackage } from './check.ts';

// Must list the same globs as the `packages` key in pnpm-workspace.yaml.
const WORKSPACE_ROOTS = ['packages', 'tools'];

const repoRoot = join(import.meta.dirname, '../../..');

function readPackage(dir: string): WorkspacePackage {
  const packageJson: unknown = JSON.parse(
    readFileSync(join(repoRoot, dir, 'package.json'), 'utf8'),
  );
  const name =
    typeof packageJson === 'object' &&
    packageJson !== null &&
    'name' in packageJson &&
    typeof packageJson.name === 'string'
      ? packageJson.name
      : '';
  const eslintPath = join(repoRoot, dir, 'eslint.config.ts');
  return {
    dir,
    name,
    eslintConfig: existsSync(eslintPath) ? readFileSync(eslintPath, 'utf8') : undefined,
  };
}

const packages = WORKSPACE_ROOTS.flatMap((root) =>
  readdirSync(join(repoRoot, root), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && existsSync(join(repoRoot, root, entry.name, 'package.json')),
    )
    .map((entry) => readPackage(`${root}/${entry.name}`)),
);

const problems = checkWorkspacePackages(packages);
for (const problem of problems) {
  process.stderr.write(`${problem}\n`);
}
if (problems.length > 0) {
  process.exitCode = 1;
} else {
  process.stdout.write(
    `workspace-check: ${String(packages.length)} packages follow the naming rules\n`,
  );
}
