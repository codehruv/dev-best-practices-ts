#!/usr/bin/env bash
# Gates `legacy-lint-manager validate` in the package.json scripts. Exits 1 only when the
# compare branch has no legacy-lint.config.jsonc yet, which is the single change that
# adopts the tool: validate reads the config and database from the compare branch with
# `git show`, so it throws in that state. Every other state exits 0 and validate runs,
# including a change that deletes the config locally, which validate then rejects.
set -euo pipefail
cd "$(dirname "$0")/.."

config=legacy-lint.config.jsonc
compare_branch="$(sed -nE 's/^[[:space:]]*"compareBranch":[[:space:]]*"([^"]+)".*/\1/p' "$config" 2>/dev/null || true)"

# An unreadable config is validate's error to report, so let it run.
if [[ -z "$compare_branch" ]]; then
  exit 0
fi

# CI checkouts often have only the remote-tracking ref, which validate also falls back to.
if git cat-file -e "${compare_branch}:${config}" 2>/dev/null ||
  git cat-file -e "origin/${compare_branch}:${config}" 2>/dev/null; then
  exit 0
fi

echo "legacy-lint: ${compare_branch} has no ${config} yet (adoption bootstrap). Skipping validate."
exit 1
