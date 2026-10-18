# dev-best-practices-ts

A TypeScript monorepo template that bundles battle-tested engineering practices: strict compiler and lint configs, a hermetic toolchain, supply-chain defenses, CI and security automation, agent instructions and skills, and decision-making templates.

It is one of three sibling templates (`-ts`, `-py`, `-go`) that share the same core (principles, agent defaults, docs, hooks, and the `just` command interface) and add each language's official best practices on top.

## Quick Start

```sh
direnv allow        # or: nix develop
just setup          # pnpm install + git hooks
just verify         # every check CI runs
```

No Nix? Install Node 22.18+, enable Corepack (`corepack enable`), and install [`just`](https://just.systems), [`lefthook`](https://lefthook.dev), and [`gitleaks`](https://github.com/gitleaks/gitleaks).

## What You Get

| Area         | Tooling                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Toolchain    | Nix flake + direnv; pnpm pinned through `packageManager` and Corepack                                                  |
| Monorepo     | pnpm workspaces and catalogs, Turborepo with caching and `--affected`                                                  |
| Compiler     | `tsconfig.base.json` with every strictness flag on                                                                     |
| Lint         | ESLint flat config in TypeScript, `strictTypeChecked` with type-aware rules, import sorting, barrel and namespace bans |
| Format       | Prettier, also applied by a Claude Code hook after every agent edit                                                    |
| Dead code    | knip (unused files, exports, dependencies)                                                                             |
| Tests        | Vitest                                                                                                                 |
| Supply chain | 7-day `minimumReleaseAge`, install scripts denied, frozen lockfile in CI, SHA-pinned actions, Dependabot with cooldown |
| Security     | gitleaks (hook + CI), zizmor and actionlint for workflows, banned-terms check                                          |
| Git          | lefthook pre-commit and commit-msg hooks, Conventional Commits for commits and PR titles                               |
| Agents       | `AGENTS.md` (`CLAUDE.md` symlink), `.claude/settings.json` permissions and hooks, skills in `.agents/skills/`          |
| Process      | Principles, reference docs, ADRs, one-pager, design doc, and postmortem templates                                      |

## Layout

```text
AGENTS.md                 rules for agents and humans (CLAUDE.md -> AGENTS.md)
docs/principles.md        the reasoning behind the rules
docs/reference/           deep dives: typescript, testing, api-design, schema-evolution, ...
docs/templates/           one-pager, design doc, ADR, postmortem
docs/adr/                 architecture decision records
.agents/skills/           verify, review, design-doc, write-comments, new-package
.claude/                  permissions and hooks (guard dangerous commands, format on edit)
.github/                  CI, security scans, PR title check, Dependabot, CODEOWNERS
packages/retry/           reference package: retry with backoff and jitter
scripts/                  banned-terms and commit-message checks
eslint.config.base.ts     shared strict ESLint config
tsconfig.base.json        shared strict compiler config
justfile                  the command interface
```

## Using It as a Template

1. Copy the repo (or mark it as a GitHub template repository) and rename it.
2. Replace the `@dbp/` scope and the `CODEOWNERS` owner.
3. Add your private names and internal hosts to `.banned-terms`.
4. Delete `packages/retry` once you have a package of your own, or keep it as a reference.
5. Turn on branch protection for `main`: required reviews, the `just verify` and security checks, a merge queue, and squash merges.

## Sources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html), [TSConfig Reference](https://www.typescriptlang.org/tsconfig/)
- [typescript-eslint](https://typescript-eslint.io/), [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- [Node.js ESM](https://nodejs.org/api/esm.html), [Node.js type stripping](https://nodejs.org/api/typescript.html)
- [pnpm](https://pnpm.io/), [Turborepo](https://turborepo.com/docs), [Vitest](https://vitest.dev/)
- [Google API Design Guide](https://google.aip.dev/), [Conventional Commits](https://www.conventionalcommits.org/)
- [AWS Builders' Library: timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
- [OpenSSF Scorecard checks](https://github.com/ossf/scorecard/blob/main/docs/checks.md), [zizmor audits](https://docs.zizmor.sh/audits/)
