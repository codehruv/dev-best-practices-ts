import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach } from 'vitest';

const created: string[] = [];

afterEach(() => {
  for (const dir of created.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A package on disk with the files a test needs. Removed after each test. */
export interface PackageFixture {
  readonly dir: string;
  write(path: string, content: string): void;
}

/** Creates a package named `@fx/pkg` whose doc tests resolve the package name to `src/index.ts`. */
export function makePackage(files: Readonly<Record<string, string>> = {}): PackageFixture {
  const dir = mkdtempSync(join(tmpdir(), 'docs-gen-unit-'));
  created.push(dir);
  const write = (path: string, content: string): void => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  };
  write('package.json', JSON.stringify({ name: '@fx/pkg', description: 'Fixture package.' }));
  write(
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: {
        strict: true,
        module: 'NodeNext',
        noEmit: true,
        paths: { '@fx/pkg': ['./src/index.ts'] },
      },
      include: ['src', 'tests'],
    }),
  );
  for (const [path, content] of Object.entries(files)) {
    write(path, content);
  }
  return { dir, write };
}

/** Builds a doc test source from its parts, so tests state only what they vary. */
export function docTest({
  imports = ["import { describe, expect, it } from 'vitest';"],
  title = 'Page title',
  body,
}: {
  imports?: readonly string[];
  title?: string;
  body: string;
}): string {
  return [...imports, '', `describe('${title}', () => {`, body, '});', ''].join('\n');
}
