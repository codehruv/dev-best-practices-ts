import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { discoverPackages, gitCli, nodeFiles, oasdiffCli, readPendingChanges } from './adapters.js';
import { checkInterfaces } from './check.js';
import { lintPendingChanges } from './lint.js';
import { writeChangelogs } from './version.js';

const USAGE = `Usage: release <command> [options]

Commands:
  check [--base <ref>]     Fail when an interface changed since <ref> (default: main)
                           without a pending changeset that covers the change.
  lint                     Fail when a pending changeset does not follow the
                           Keep a Changelog entry convention.
  changelog [--date <d>]   Write Keep a Changelog sections for every pending
                           release. Run before \`changeset version\`.
`;

// The working directory is the repository root: every `just` recipe runs from there.
const root = process.cwd();

function print(line = ''): void {
  process.stdout.write(`${line}\n`);
}

function fail(line: string): void {
  process.stderr.write(`${line}\n`);
  process.exitCode = 1;
}

async function repositoryUrl(): Promise<string> {
  const manifest: unknown = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const repository =
    typeof manifest === 'object' && manifest !== null && 'repository' in manifest
      ? manifest.repository
      : undefined;
  const url =
    typeof repository === 'string'
      ? repository
      : typeof repository === 'object' && repository !== null && 'url' in repository
        ? repository.url
        : undefined;
  if (typeof url !== 'string') {
    throw new Error('package.json needs a "repository.url" so changelog links can point at tags');
  }
  return url.replace(/^git\+/, '').replace(/\.git$/, '');
}

async function check(baseRef: string): Promise<void> {
  const result = await checkInterfaces({
    baseRef,
    interfaces: (await discoverPackages(root)).filter(
      (pkg) => pkg.apiReportPath !== undefined || pkg.openApiPath !== undefined,
    ),
    pending: await readPendingChanges(root),
    git: gitCli(root),
    files: nodeFiles(root),
    differ: oasdiffCli(),
  });

  for (const verdict of result.verdicts) {
    const status = verdict.problems.length === 0 ? 'ok' : 'FAIL';
    print(
      `${status}  ${verdict.name}@${verdict.version}: requires ${verdict.required}, planned ${verdict.planned}`,
    );
    for (const reason of verdict.reasons)
      print(`      ${reason.bump.padEnd(5)}  ${reason.message}`);
    for (const problem of verdict.problems) fail(`  ${verdict.name} ${problem}`);
  }
  for (const error of result.errors) fail(error);
}

async function lint(): Promise<void> {
  const errors = lintPendingChanges(await readPendingChanges(root), await discoverPackages(root));
  for (const error of errors) fail(error);
  if (errors.length === 0) print('changesets: ok');
}

async function changelog(date: string): Promise<void> {
  const pending = await readPendingChanges(root);
  if (pending.errors.length > 0) {
    for (const error of pending.errors) fail(error);
    return;
  }
  const written = await writeChangelogs({
    date,
    repoUrl: await repositoryUrl(),
    packages: await discoverPackages(root),
    pending,
    git: gitCli(root),
    files: nodeFiles(root),
    differ: oasdiffCli(),
  });
  for (const path of written) print(`wrote ${path}`);
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: 'string', default: 'main' },
    date: { type: 'string', default: new Date().toISOString().slice(0, 10) },
  },
});

switch (positionals[0]) {
  case 'check':
    await check(values.base);
    break;
  case 'lint':
    await lint();
    break;
  case 'changelog':
    await changelog(values.date);
    break;
  case undefined:
  default:
    fail(USAGE);
}
