# Agent Guidelines

The quality bar for every agent (Claude Code, Codex, Cursor, Copilot) and every human working in this repo.
`CLAUDE.md` is a symlink to this file, so every tool reads the same rules.

## Context Map

Context lives next to the code it governs. Read only what your task touches.

- **This file:** philosophy, hard rules, workflow, and the language conventions for this repo.
- **[`docs/principles.md`](docs/principles.md):** the reasoning behind the rules.
- **[`docs/reference/`](docs/reference/):** deep dives. When a section here points at one, read it before you implement in that area.
- **[`.agents/skills/`](.agents/skills/):** reusable agent workflows. `.claude/skills` is a symlink to this directory.
- **Nested `AGENTS.md` files** add rules for their subtree. The nearest file wins on conflict.

## Commands

Every repo in this family exposes the same `just` recipes. Use them instead of the underlying tools.

| Command       | What it does                                                         |
| ------------- | -------------------------------------------------------------------- |
| `just setup`  | Installs dependencies and git hooks.                                 |
| `just verify` | Runs every check CI runs. Run it before every push.                  |
| `just fix`    | Applies auto-fixes for formatting and lint, then runs `just verify`. |
| `just test`   | Runs the test suite.                                                 |
| `just --list` | Lists every recipe.                                                  |

The toolchain is pinned in `flake.nix`. If `$IN_NIX_SHELL` is empty and `direnv` is installed, prefix commands with `direnv exec .`.

## Before You Write Code

**State your assumptions.** Before implementing, list:

- What existing code you can reuse. Search by behavior, not by the name you would give it.
- Which patterns apply. Check the nearest `AGENTS.md` and the relevant `docs/reference/` file.
- How you will test the change.

**Say no when you lack context.** If requirements are ambiguous or the change touches code you have not read, say what you do not know and ask. Confidently wrong code costs more review time than the feature is worth.

## Hard Rules

1. **Never weaken strictness.** Do not relax compiler, linter, formatter, or type-checker configs to make code pass. Fix the code.
2. **No suppressions without approval.** Every suppression (lint disable, type ignore, `nolint`) needs explicit human approval for that instance, the narrowest possible scope, and a comment with the reason.
3. **All new code has tests.** Never commit skipped or focused tests. When a behavior test fails, question the implementation before the assertion, and ask instead of weakening the test.
4. **Conventional Commits.** `<type>(<scope>): <imperative description>`, first line under 72 characters. Types: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`. The `commit-msg` hook enforces this.
5. **Never hand-edit generated files.** Change the generator or its source, regenerate, and commit both in the same change. See [`docs/reference/code-generation.md`](docs/reference/code-generation.md).
6. **No secrets anywhere.** Not in code, fixtures, logs, or commit history. `gitleaks` runs in the pre-commit hook and in CI.
7. **Never break a published contract in one step.** Public APIs, schemas, CLI flags, and config keys change through Expand, Migrate, Contract. See [`docs/reference/schema-evolution.md`](docs/reference/schema-evolution.md).
8. **Justify every new dependency.** Prefer the standard library. A new dependency must be maintained, permissively licensed, and pinned through the lockfile. Dependency updates wait out a release cooldown, which defends against compromised publishes.
9. **Ask before destructive actions.** Never delete files, force-push, rewrite published history, drop data, or run infrastructure changes without explicit approval.
10. **Keep banned terms out.** `.banned-terms` lists strings that must never appear in the repo (private names, internal hosts). `just verify` enforces it.

## Design

- **Small, composable pieces.** Each function, file, and package does one thing. Consider splitting any file over ~500 lines.
- **Data structures first.** Get the shape of the data right and the code follows.
- **Remove special cases instead of adding branches.** Restructure until the edge case is the normal case.
- **Interfaces before implementations.** Define the contract, then fulfill it. Accept the narrowest interface a function needs.
- **Inject dependencies.** Pass collaborators (clock, I/O, clients) in through constructors or parameters. Do not reach for globals or singletons. This keeps code testable without patching internals.
- **Functional core, imperative shell.** Keep logic pure. Push I/O and side effects to the edges.
- **No speculative generality.** Build for today's requirement. Wait for the third duplicate before abstracting.
- **Explicit, debuggable errors.** Errors carry enough context to act on. Never swallow an error. Handle it, or wrap it with context and propagate it.
- **Document why.** Every exported symbol gets a doc comment that says why it exists, not only what it does.

## Comments

Good code carries comments that change what the reader does: constraints the code cannot express, ordering requirements, values that must match elsewhere, and deliberate deviations. Comments never hold history, provenance, rejected alternatives, restated code, or line numbers. A `TODO` names an issue and the condition that makes it actionable. Full rules and worked examples: [`docs/reference/comments.md`](docs/reference/comments.md).

## Testing

Unit tests are fast and deterministic and run on every change. Integration tests cover real boundaries. End-to-end tests stay thin. Mock by implementing the interface, never by patching internals. Each test sets up its own state. Flaky tests get quarantined with an issue and fixed on a deadline. Full rules: [`docs/reference/testing.md`](docs/reference/testing.md).

## Observability

Services expose health and readiness endpoints and metrics. Instrument every external call and every endpoint (latency, status, count). Log structured JSON with a static message and the dynamic values as fields. Never log secrets or PII. Full rules: [`docs/reference/observability.md`](docs/reference/observability.md).

## APIs

Our APIs are consumed by code we will never see. Changes are additive. Errors are explicit, with debuggable messages. Collections paginate from day one. Full rules: [`docs/reference/api-design.md`](docs/reference/api-design.md).

## Security

Validate all input at trust boundaries. Use parameterized queries. Grant least privilege. Pin CI actions by commit SHA. Full rules: [`docs/reference/security.md`](docs/reference/security.md).

## Changes and Review

- **Small PRs.** Ideal: 100 to 300 lines with one behavior change. Avoid more than 600 lines. Split large work into stacked PRs, landing utilities first without behavior changes.
- **Every commit builds and passes tests,** so `git bisect` works.
- **PR descriptions are the system of record:** what changed, why, how it was validated, and the risk.
- **Trunk-based.** Short-lived branches, merged to `main` within days. Hide unfinished work behind a flag instead of a long branch.
- Full workflow: [`docs/reference/git-workflow.md`](docs/reference/git-workflow.md).

## Decisions

Debate with evidence, then commit. Match the process to the blast radius:

- **Small or reversible:** make the call and move on.
- **Medium, or affects a contract:** write a one-pager from [`docs/templates/one-pager.md`](docs/templates/one-pager.md).
- **Large, architectural, or hard to roll back:** write a design doc from [`docs/templates/design-doc.md`](docs/templates/design-doc.md) and get explicit sign-off.

Record every accepted architectural decision as an ADR in [`docs/adr/`](docs/adr/).

## What Not To Do

- Do not create documentation files unless asked.
- Do not start long-running servers, run migrations, or apply infrastructure without approval.
- Do not copy patterns from code that violates these rules because it happens to sit nearby.

<!-- LANGUAGE-SECTION: each repo appends its language conventions below this line. -->

## TypeScript Conventions

Full rules with links to the official sources: [`docs/reference/typescript.md`](docs/reference/typescript.md). The essentials:

- **Layout.** Library packages live in `packages/<name>/` (scope `@dbp/`), with `src/index.ts` as the only public entry point and tests in `tests/unit/`. `packages/retry` is the reference implementation. Scaffold new packages with the `new-package` skill.
- **Strict compiler.** Every package extends `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, and more). Never override a strictness flag.
- **ESM only.** `"type": "module"`, `NodeNext` resolution, `.js` extensions on relative imports. No new `.js`, `.mjs`, or `.cjs` files. Config files are TypeScript.
- **Exports.** Explicit named exports in `src/index.ts`. No `export *` barrels and no `import * as`.
- **Types.** No `any` (use `unknown` and narrow), no non-null assertions, no `@ts-ignore`. Exported functions declare parameter and return types. `readonly` interface properties, discriminated unions with exhaustive `switch`.
- **Classes.** `#private` fields, dependencies injected through the constructor with production defaults. No `enum`, `namespace`, or parameter properties.
- **Errors.** `Error` subclasses with a package base class, typed fields, and `cause`. Every promise is awaited or returned.
- **Library code never uses `console`.** Inject a logger.
- **Dependencies.** Shared versions live in the pnpm `catalog:`. New versions wait 7 days (`minimumReleaseAge`). Install scripts are denied unless listed in `allowBuilds`.

### Commands

| `just` recipe    | Runs                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `just setup`     | `pnpm install`, `lefthook install`                                                                                                   |
| `just verify`    | `prettier --check .`, `turbo run lint`, `knip`, `scripts/lint-banned-terms.sh`, `tsc` + `turbo run typecheck`, `turbo run test:unit` |
| `just fix`       | `turbo run lint:fix`, `prettier --write .`, then `just verify`                                                                       |
| `just test`      | `turbo run test:unit` (Vitest)                                                                                                       |
| `just generate`  | `turbo run generate`                                                                                                                 |
| `just freshness` | `just generate`, then fails on any diff (CI only)                                                                                    |

Set `TURBO_FLAGS=--affected` to limit task-graph recipes to changed packages, as CI does on pull requests. Run one package directly with `pnpm --filter @dbp/<name> <script>`.
