import { describe, expect, it } from 'vitest';

import { checkWorkspacePackages, type WorkspacePackage } from '../../src/check.ts';

function makePackage(overrides: Partial<WorkspacePackage> = {}): WorkspacePackage {
  return {
    dir: 'packages/iso-thing',
    name: '@dbp/iso-thing',
    eslintConfig: 'export default getIsomorphicESLintConfig({ packageRootDir });',
    ...overrides,
  };
}

describe('checkWorkspacePackages', () => {
  it('accepts an iso- package on the isomorphic config', () => {
    expect(checkWorkspacePackages([makePackage()])).toEqual([]);
  });

  it('accepts a server- package on the node config', () => {
    const pkg = makePackage({
      dir: 'packages/server-thing',
      name: '@dbp/server-thing',
      eslintConfig: 'export default getNodeESLintConfig({ packageRootDir });',
    });
    expect(checkWorkspacePackages([pkg])).toEqual([]);
  });

  it('rejects a package directory without a prefix', () => {
    const pkg = makePackage({ dir: 'packages/thing', name: '@dbp/thing' });
    expect(checkWorkspacePackages([pkg])).toEqual([
      'packages/thing: directory must start with "iso-" (browser and Node) or "server-" (Node only).',
    ]);
  });

  it('rejects a package name that differs from its directory', () => {
    const pkg = makePackage({ name: '@dbp/thing' });
    expect(checkWorkspacePackages([pkg])).toEqual([
      'packages/iso-thing: package name "@dbp/thing" must end with "/iso-thing".',
    ]);
  });

  it('rejects an iso- package on the node config', () => {
    const pkg = makePackage({ eslintConfig: 'export default getNodeESLintConfig({});' });
    expect(checkWorkspacePackages([pkg])).toEqual([
      'packages/iso-thing: eslint.config.ts must call getIsomorphicESLintConfig and no other config factory.',
    ]);
  });

  it('rejects a config that calls both factories', () => {
    const pkg = makePackage({
      eslintConfig: 'getIsomorphicESLintConfig({}); getNodeESLintConfig({});',
    });
    expect(checkWorkspacePackages([pkg])).toHaveLength(1);
  });

  it('rejects a missing eslint config', () => {
    const pkg = makePackage({ eslintConfig: undefined });
    expect(checkWorkspacePackages([pkg])).toEqual([
      'packages/iso-thing: eslint.config.ts is missing.',
    ]);
  });

  it('exempts tools from the prefix but requires the node config', () => {
    const ok = makePackage({
      dir: 'tools/release',
      name: '@dbp/release-tools',
      eslintConfig: 'getNodeESLintConfig({})',
    });
    const wrong = makePackage({
      dir: 'tools/release',
      name: '@dbp/release-tools',
      eslintConfig: 'getIsomorphicESLintConfig({})',
    });
    expect(checkWorkspacePackages([ok])).toEqual([]);
    expect(checkWorkspacePackages([wrong])).toEqual([
      'tools/release: eslint.config.ts must call getNodeESLintConfig and no other config factory.',
    ]);
  });
});
