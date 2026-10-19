# One command interface shared by every repo in the dev-best-practices family.
# Run `just` to list recipes.

set shell := ["bash", "-euo", "pipefail", "-c"]

# Extra Turborepo flags for task-graph recipes. CI sets `--affected` so only changed
# packages and their dependents run.
turbo_flags := env("TURBO_FLAGS", "")

[private]
default:
    @just --list

# Install dependencies and git hooks. CI installs with a frozen lockfile.
setup:
    pnpm install
    pnpm exec lefthook install

# Run every check CI runs.
verify: fmt-check lint legacy-validate workspace-check deadcode banned-terms changesets typecheck test docs-check

# Apply linter then formatter fixes, then verify. Lint fixes run first because they can
# leave code the formatter has to reflow.
fix:
    pnpm run lint:fix {{ turbo_flags }}
    pnpm run format
    just verify

# Format every file.
fmt:
    pnpm run format

# Check formatting without writing.
fmt-check:
    pnpm run format:check

# Format one file. The Claude Code PostToolUse hook calls this after every edit.
fmt-file FILE:
    #!/usr/bin/env bash
    set -euo pipefail
    case "{{ FILE }}" in
      *.ts|*.tsx|*.mts|*.cts|*.json|*.jsonc|*.md|*.yaml|*.yml|*.css|*.html)
        pnpm exec prettier --write --ignore-unknown "{{ FILE }}" ;;
      *) ;;
    esac

# Lint every package with type-aware ESLint.
lint:
    pnpm run lint {{ turbo_flags }}

# Type-check every package, including tests and config files.
typecheck:
    pnpm run typecheck {{ turbo_flags }}

# Run unit tests.
test:
    pnpm run test {{ turbo_flags }}

# Fail on undocumented exports, broken doc links, or Diátaxis violations.
docs-check:
    pnpm run docs:check {{ turbo_flags }}

# Check legacied lint suppressions against the compare branch. The linter catches new
# violations; this catches new suppressions.
legacy-validate:
    pnpm run lint:legacy-validation

# Prune legacy comments and database entries after fixing legacied violations. Never use
# it to absorb a new violation: validate rejects a database that grew.
legacy-update:
    pnpm run lint:legacy-validation:update

# Find unused files, dependencies, and binaries. Unused exports belong to
# import-integrity-lint, which runs inside ESLint.
# Fail when a package lacks an iso- or server- prefix, or lints with the wrong config
# factory for its prefix.
workspace-check:
    pnpm run workspace-check

deadcode:
    pnpm run deadcode

# Fail on any string listed in .banned-terms.
banned-terms:
    bash scripts/lint-banned-terms.sh

# Regenerate every committed generated file.
generate:
    pnpm run generate

# Fail when committed generated files differ from a fresh `just generate`. CI only:
# it fails on any uncommitted change.
freshness: generate
    git diff --exit-code
    test -z "$(git status --porcelain)"

# Fail when an interface changed since BASE without a pending changeset that covers it.
# Regenerates first, so the API reports and OpenAPI documents match the source.
api-check BASE="main": generate
    pnpm run release-tools check --base {{ BASE }}

# Fail when a pending changeset does not follow the Keep a Changelog entry convention.
changesets:
    pnpm run release-tools lint

# Record a pending release: pick packages, a bump, and write Keep a Changelog entries.
changeset:
    pnpm changeset

# Turn pending changesets into versions and changelog sections. The release workflow runs
# this in its version PR, so it rarely runs locally.
version-packages:
    pnpm run version-packages

# Timings depend on machine load, so this stays out of `verify`. CI runs it in its own
# workflow (.github/workflows/slo.yaml).

# Run the benchmarks and check every benchmark-backed SLO against its objectives and baseline.
slo *ARGS: bench
    #!/usr/bin/env bash
    set -uo pipefail
    pnpm run --silent slo check {{ ARGS }}
    status=$?
    # A burst of background load can fail a healthy run, so a miss (exit 1) is measured
    # once more before it counts. A real regression fails both runs. Exit 2 means bad
    # input, which re-measuring cannot fix.
    if [[ $status -eq 1 ]]; then
      echo "Re-measuring once to rule out machine noise." >&2
      pnpm run bench && pnpm run --silent slo check {{ ARGS }}
      status=$?
    fi
    exit $status

# Every later `just slo` on this machine compares against the baseline, so record it on
# an idle machine and commit the result.

# Record this machine's benchmark results as its baseline in slo/baselines/.
slo-baseline: bench
    pnpm run --silent slo baseline

# Validate the OpenSLO specs in slo/ without running benchmarks.
slo-validate:
    pnpm run --silent slo validate

# Run every package's benchmarks, one package at a time so they do not compete for CPU.
bench:
    pnpm run bench
