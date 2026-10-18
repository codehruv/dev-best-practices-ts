# Git Workflow

## Branching

- Trunk-based. `main` is always releasable.
- Branches live for days, not weeks. Name them `<type>/<short-description>` (`feat/bulk-export`).
- Unfinished work merges behind a feature flag instead of waiting on a long-lived branch.
- Protect `main`: required reviews, required status checks, linear history, no force-pushes.

## Commits

- [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<optional scope>): <description>`.
- Types: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`.
- Imperative mood, first line under 72 characters, body explains why.
- One logical change per commit. Every commit builds and passes tests.

## Pull Requests

- Size: ideal 100 to 300 lines with one behavior change. Acceptable up to 600 when cohesive. Split anything larger into stacked PRs.
- The PR title follows Conventional Commits, because squash merges use it as the commit message.
- The description covers what, why, validation, and risk. It is the system of record for the change.
- Authors review their own diff before requesting review.
- Reviewers respond within one working day. Reviews check correctness, contracts, tests, and naming before style. Formatting belongs to the formatter.
- Squash-merge through a merge queue so `main` stays green.

## Ownership

`CODEOWNERS` assigns an owner to every path. Owners review changes to their area.

## Hooks

`lefthook` runs fast checks locally (formatting, lint on staged files, secret scan, commit message). CI runs the full `just verify`. Never bypass hooks with `--no-verify`. Fix the failure instead.
