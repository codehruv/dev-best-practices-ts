# Lint Ratchet and Import Integrity

Two tools keep the lint bar rising: [`import-integrity-lint`](https://nebrius.github.io/import-integrity-lint/) checks the import and export graph, and [`legacy-lint-manager`](https://github.com/nebrius/legacy-lint-manager) makes the set of suppressed violations a one-way ratchet.

## The Ratchet

Quality only moves up. A rule can be tightened today even when existing code violates it: each existing violation is _legacied_ once, with a tracked disable comment, and from then on:

- **New violations fail lint.** The linter enforces the rule on all new code.
- **New suppressions fail validation.** `validate` rejects any new legacy comment, copied comment, or database entry that does not exist on `main`.
- **Fixed violations shrink the database.** Removing a legacied violation is always allowed. `just legacy-update` prunes its comment and entry.

The database can shrink but never grow. That asymmetry is the ratchet.

## The Artifacts

| Artifact                   | What it is                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| Legacy comment             | `// eslint-disable-next-line <rule> -- This lint error is legacied. DO NOT COPY (<rule>) <id>` |
| `legacy-lint.data.json`    | Maps each 12-character ID to the rules it legacies. No paths or line numbers.                  |
| `legacy-lint.config.jsonc` | Lint command, pragma, compare branch, and the rules nobody may suppress.                       |

The comment travels with the code, so moving or renaming a file never breaks a legacy.

## Rules

- **Never hand-edit the artifacts.** Not the database, not a legacy comment, not the enforcement settings in the config. `validate` detects every hand edit.
- **Never copy a legacy comment.** It is a one-time grant for one violation, not a template. A duplicate ID fails validation.
- **`just legacy-update` only prunes.** Run it after fixing a legacied violation. It cannot register a new violation, and it never should.
- **Never loosen the config.** Removing a non-disableable rule, changing the pragma or compare branch, or adding an ignored package fails validation against `main`.
- **`legacy-errors` is a human decision.** It grants amnesty when a rule is first enabled. It has no script or `just` recipe on purpose. An agent that thinks it needs one stops and asks.

## Non-Disableable Rules

`nonDisableableRules` in `legacy-lint.config.jsonc` lists rules that no new suppression may disable, because each has a fix that keeps the rule satisfied:

- `import-integrity/no-cycle`, `no-test-imports-in-prod`, `no-test-only-imports`, `no-unused-exports`: restructure the import graph instead.
- `@typescript-eslint/no-explicit-any`: use `unknown` with a type guard.
- `@typescript-eslint/ban-ts-comment`: fix the type error.
- `@typescript-eslint/no-floating-promises`: `await` the promise, or mark an intentional fire-and-forget with `void`.
- `no-restricted-syntax`: carries the barrel-export and namespace-import bans.

The list may grow. It may never shrink.

## Import Integrity

`import-integrity-lint` runs inside ESLint through `eslint.config.base.ts`, with each package as its own root. Its recommended rules catch:

- **Dead exports**, including exports that only tests import.
- **Boundary leaks**: production code importing test code.
- **Cycles, unresolved imports**, and entry-point mistakes.

Conventions:

- **Entry points.** Each package passes its public API as `entryPointFiles` (mirroring `package.json` `exports`) to `getBaseESLintConfig`. Exports from those files are exempt from unused-export checks.
- **Test-only exports** use the `_testOnly` prefix (`export function _testOnlyReset()`). Production code importing a `_testOnly` symbol fails lint.
- **Never disable `no-unused-exports`.** Delete the export, make it test-only, or add it to the package's public API.
- **Worktrees in hidden directories.** The plugin skips any path with a dot-prefixed component. `eslint.config.base.ts` exempts `.claude` and `.worktrees` so worktree checkouts are still analyzed.

The vendored agent skills `.agents/skills/import-integrity` and `.agents/skills/legacy-lint-validation` explain how to fix each violation and validation error.

## Split With knip

Both tools find dead code, so each owns a different slice:

| Tool                    | Owns                                                                    |
| ----------------------- | ----------------------------------------------------------------------- |
| `import-integrity-lint` | Unused exports and types, test-only exports, cycles, import boundaries. |
| `knip`                  | Unused files, unused and unlisted dependencies, unused binaries.        |

`knip.json` excludes the export, type, and duplicate checks so the two never report the same problem.

## Validation Wiring

`just verify` runs `just legacy-validate`, and so does the lefthook pre-commit hook. `validate` reads the config and database from `main` with `git show`, so CI checks out full history (`fetch-depth: 0`).

`scripts/legacy-lint-adopted.sh` gates validation in the `lint:legacy-validation` scripts. It skips validation only while `main` has no `legacy-lint.config.jsonc`, which is true for exactly one change: the one that adopts the tool. Once the config is on `main`, every run validates, and a change that deletes the config fails.

## Enabling a New Rule

1. Get `just legacy-validate` passing.
2. Prefer fixing every violation, then enabling the rule. The rule starts clean.
3. If that is not practical, enable the rule and run `pnpm exec legacy-lint-manager legacy-errors`. Commit the comments and database together.
4. That change fails validation against `main` by design, because the database grew. It needs an explicit maintainer override to merge. That friction keeps `legacy-errors` from becoming a way to skip fixing new code.

## Merge Conflicts on the Database

The database is one line, so concurrent changes always conflict on the whole file. Resolve in this direction only:

1. Take `main`'s side. During a merge that is usually `--theirs`. During a rebase it is usually `--ours`. Check before choosing.
2. Run `just legacy-update` and commit the result.
3. If that reports "Unregistered legacy error", `main` already fixed that violation. Remove the comment, fix the violation, and run `just legacy-update` again.

Never take your own side and never hand-merge the JSON. Your side can hold entries `main` removed, which validation rejects as new before `--update` can clean them up.

## Limits

- `validate` checks suppressions, not violations. It never runs the linter, so lint and validate both run in `just verify`.
- Changes to the ESLint config itself are not tracked. Turning a non-disableable rule off in config is a review concern.
- A stale legacy comment (its violation fixed) is caught by `reportUnusedDisableDirectives: 'error'` in the base config, not by `validate`.
