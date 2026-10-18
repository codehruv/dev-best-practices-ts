import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { discoverPackages, gitCli, nodeFiles } from '../../src/adapters.js';

let root: string;

function git(...args: string[]): void {
  execFileSync('git', args, { cwd: root, stdio: 'ignore' });
}

function write(path: string, content: string): void {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), content);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'release-tools-'));
  git('init', '--quiet', '--initial-branch', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  git('config', 'commit.gpgsign', 'false');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('gitCli', () => {
  it('reads a file at a ref and reports files that do not exist there', async () => {
    write('a.txt', 'v1');
    git('add', '.');
    git('commit', '--quiet', '--no-verify', '-m', 'one');
    git('tag', '@dbp/widget@1.0.0');
    write('b.txt', 'new');

    const repo = gitCli(root);
    await expect(repo.readFileAtRef('main', 'a.txt')).resolves.toBe('v1');
    await expect(repo.readFileAtRef('main', 'b.txt')).resolves.toBeUndefined();
    await expect(repo.readFileAtRef('main', 'missing.txt')).resolves.toBeUndefined();
    await expect(repo.tagExists('@dbp/widget@1.0.0')).resolves.toBe(true);
    await expect(repo.tagExists('@dbp/widget@2.0.0')).resolves.toBe(false);
  });

  it('fails when the ref does not exist instead of skipping the check', async () => {
    write('a.txt', 'v1');
    git('add', '.');
    git('commit', '--quiet', '--no-verify', '-m', 'one');
    await expect(gitCli(root).readFileAtRef('origin/main', 'a.txt')).rejects.toThrow(
      /git show origin\/main:a.txt failed/,
    );
  });
});

describe('nodeFiles', () => {
  it('reads, writes, and reports missing files', async () => {
    const files = nodeFiles(root);
    await files.write('x.md', 'hello');
    await expect(files.read('x.md')).resolves.toBe('hello');
    await expect(files.read('y.md')).resolves.toBeUndefined();
  });
});

describe('discoverPackages', () => {
  it('finds report and contract files by convention', async () => {
    write('packages/plain/package.json', '{"name":"@dbp/plain","version":"1.0.0"}');
    write('packages/lib/package.json', '{"name":"@dbp/lib","version":"0.2.0"}');
    write('packages/lib/api-extractor.json', '{}');
    write('packages/api/package.json', '{"name":"@dbp/api","version":"3.0.0"}');
    write('packages/api/openapi/openapi.json', '{}');
    mkdirSync(join(root, 'packages', 'not-a-package'));

    await expect(discoverPackages(root)).resolves.toEqual([
      {
        name: '@dbp/api',
        dir: 'packages/api',
        version: '3.0.0',
        openApiPath: 'packages/api/openapi/openapi.json',
      },
      {
        name: '@dbp/lib',
        dir: 'packages/lib',
        version: '0.2.0',
        apiReportPath: 'packages/lib/etc/lib.api.md',
      },
      { name: '@dbp/plain', dir: 'packages/plain', version: '1.0.0' },
    ]);
  });

  it('rejects a manifest without a version', async () => {
    write('packages/bad/package.json', '{"name":"@dbp/bad"}');
    await expect(discoverPackages(root)).rejects.toThrow(/needs string "name" and "version"/);
  });
});
