import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Options every package passes to {@link getBaseESLintConfig}. */
export interface BaseESLintConfigOptions {
  /** Absolute path to the package root, so typed linting finds the package's tsconfig. */
  readonly packageRootDir: string;
  /** Extra glob patterns to ignore on top of build output. */
  readonly ignores?: readonly string[];
}

/**
 * Shared strict ESLint config for every package. Packages compose it and add
 * rules, but never weaken it, so the quality bar stays uniform across the repo.
 */
export function getBaseESLintConfig({ packageRootDir, ignores = [] }: BaseESLintConfigOptions) {
  return defineConfig([
    globalIgnores(['dist/**', 'coverage/**', '.direnv/**', ...ignores]),
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
