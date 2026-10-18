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
verify: fmt-check lint deadcode banned-terms changesets typecheck test

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

# Find unused files, exports, and dependencies.
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
