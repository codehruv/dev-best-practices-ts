import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import type { Linter } from 'eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import importIntegrityPlugin from 'import-integrity-lint';
import tseslint from 'typescript-eslint';

// Import Integrity never analyzes a file whose path has a dot-prefixed component,
// so a checkout inside a hidden directory analyzes zero files and every
// import-integrity rule passes silently. These are the hidden directories that
// worktree tooling checks repos out into (`claude --worktree` uses
// `<repo>/.claude/worktrees/<name>`).
const WORKTREE_DEFAULT_IGNORE_OVERRIDES = ['.claude', '.worktrees'];

// The plugin types its rules with @typescript-eslint/utils, whose RuleContext lacks
// members that ESLint 10's Linter.Config type requires, so the config object does not
// type-check as-is. ESLint itself loads it without issue.
const importIntegrityRecommended = importIntegrityPlugin.configs
  .recommended as unknown as Linter.Config;

/** Options every package passes to {@link getBaseESLintConfig}. */
export interface BaseESLintConfigOptions {
  /** Absolute path to the package root, so typed linting finds the package's tsconfig. */
  readonly packageRootDir: string;
  /**
   * The package's public API as `package.json`-style subpaths mapped to source files.
   * Import Integrity infers these only when `tsconfig.json` declares `rootDir` and
   * `outDir`, and the package tsconfig cannot, because it also covers tests and config
   * files outside `src`. Every subpath in `package.json` `exports` needs an entry here.
   */
  readonly entryPointFiles?: Readonly<Record<string, string>>;
  /** Extra glob patterns to ignore on top of build output. */
  readonly ignores?: readonly string[];
}

/**
 * Shared strict ESLint config for every package. Packages compose it and add
 * rules, but never weaken it, so the quality bar stays uniform across the repo.
 */
export function getBaseESLintConfig({
  packageRootDir,
  entryPointFiles = {},
  ignores = [],
}: BaseESLintConfigOptions) {
  return defineConfig([
    globalIgnores(['dist/**', 'coverage/**', '.direnv/**', ...ignores]),
    {
      settings: {
        'import-integrity': {
          packageRootDir,
          entryPointFiles,
          defaultIgnoreOverrides: WORKTREE_DEFAULT_IGNORE_OVERRIDES,
        },
      },
    },
    importIntegrityRecommended,
    js.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: {
        globals: globals.node,
        parserOptions: {
          // Each package's tsconfig.json includes src, tests, and config files, so the
          // project service resolves every linted file without a default project.
          projectService: true,
          tsconfigRootDir: packageRootDir,
        },
      },
      plugins: { 'simple-import-sort': simpleImportSort },
      linterOptions: { reportUnusedDisableDirectives: 'error' },
      rules: {
        'simple-import-sort/imports': 'error',
        'simple-import-sort/exports': 'error',
        'object-shorthand': 'error',
        eqeqeq: ['error', 'always'],
        'no-restricted-syntax': [
          'error',
          {
            selector: 'ExportAllDeclaration',
            message:
              'Barrel exports (export * from) hide the public API. Use explicit named exports.',
          },
          {
            selector: 'ImportNamespaceSpecifier',
            message: 'Namespace imports (import * as) defeat tree-shaking. Use named imports.',
          },
        ],
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { fixStyle: 'inline-type-imports' },
        ],
        '@typescript-eslint/no-import-type-side-effects': 'error',
        '@typescript-eslint/explicit-module-boundary-types': 'error',
        '@typescript-eslint/switch-exhaustiveness-check': 'error',
        '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      },
    },
    {
      // Libraries report through return values, errors, or an injected logger.
      files: ['src/**/*.ts'],
      rules: { 'no-console': 'error' },
    },
    prettier,
  ]);
}
