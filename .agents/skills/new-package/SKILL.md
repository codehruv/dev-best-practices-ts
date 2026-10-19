---
name: new-package
description: Scaffold a new TypeScript package in packages/ that follows the repo conventions. Use when the user asks to create, add, or bootstrap a package, library, or module.
---

# New Package

1. **Confirm the package is needed.** Search `packages/` for existing code with the same behavior. Ask the user if an existing package should grow instead.
2. **Copy the structure of `packages/iso-retry`**, not its code:
   - **Pick the prefix:** `iso-<name>` when the code must run in the browser and Node, `server-<name>` when it needs Node. Name the directory and the package identically (`packages/iso-cache`, `@dbp/iso-cache`).
   - `package.json`: name `@dbp/<iso-|server-><name>`, `"type": "module"`, `"private": true`, the `exports` map pointing at `dist/`, `"sideEffects": false`, the standard scripts (`build`, `typecheck`, `lint`, `lint:fix`, `test:unit`, `clean`), and dev dependencies as `"catalog:"`.
   - `tsconfig.json` (extends `../../tsconfig.base.json`, `noEmit`, includes `src`, `tests`, `*.config.ts`) and `tsconfig.build.json` (emits `src` to `dist`). Never override a strictness flag.
   - `eslint.config.ts`: `getIsomorphicESLintConfig` for `iso-`, `getNodeESLintConfig` for `server-`, with `{ packageRootDir: import.meta.dirname, entryPointFiles: { '.': './src/index.ts' } }`. Add rules only to tighten. Node-only tooling of an `iso-` package goes in `scripts/`, never `src/`.
   - `vitest.config.ts`, `src/index.ts`, `tests/unit/`.
3. **Design the interface first.** Write the types and interfaces in `src/types.ts`, then the implementation. Inject I/O, time, and randomness.
4. **Export by name** from `src/index.ts`, grouped under section comments. Every export gets a doc comment that says why it exists.
5. **Write tests** in `tests/unit/` through the public entry point, with factory helpers for test data.
6. Run `pnpm install`, then `just verify`. Fix every failure (`.agents/skills/verify/SKILL.md`).
7. If the package needs a new runtime dependency, justify it to the user before adding it.
