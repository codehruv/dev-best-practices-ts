#!/usr/bin/env bash
# Fails when a pattern from the root `.banned-terms` file appears in any tracked
# file. Applying the rule with a script keeps enforcement deterministic instead
# of relying on reviewers or agents to remember it.
#
# Rule format, one per line:
#   # ...    comment, ignored
#   !glob    exclude matching tracked paths (git pathspec glob, relative to the repo root)
#   other    case-insensitive Perl-compatible regular expression
#
# git grep searches only tracked files, so local scratch files never fail the check.
set -euo pipefail
cd "$(dirname "$0")/.."

patterns=()
excludes=()
# A while-read loop instead of mapfile keeps this runnable on the bash 3.2 that macOS ships.
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "${line// /}" || "$line" == \#* ]] && continue
  if [[ "$line" == !* ]]; then
    excludes+=(":(exclude,glob)${line#!}")
  else
    patterns+=(-e "$line")
  fi
done <.banned-terms

if [[ ${#patterns[@]} -eq 0 ]]; then
  echo "banned-terms: no patterns configured"
  exit 0
fi

# Exit status 1 means no match. Anything above 1 is a git grep error, which must
# fail the check instead of passing it.
status=0
git grep --perl-regexp --ignore-case --line-number -I "${patterns[@]}" -- . "${excludes[@]}" || status=$?
case "$status" in
  0)
    echo "error: banned terms found above. Remove them." >&2
    exit 1
    ;;
  1) echo "banned-terms: clean" ;;
  *) exit "$status" ;;
esac
