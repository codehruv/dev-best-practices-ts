#!/usr/bin/env bash
# Enforces Conventional Commits on the first line of a commit message. Runs from
# the lefthook commit-msg hook with the message file path as its argument.
set -euo pipefail

msg_file="$1"
first_line="$(head -n 1 "$msg_file")"

# Git generates these subjects itself, so they pass through untouched.
if [[ "$first_line" =~ ^(Merge|Revert|fixup!|squash!|amend!)\  ]]; then
  exit 0
fi

pattern='^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([a-z0-9._/-]+\))?!?: [^ ].*$'
if [[ ! "$first_line" =~ $pattern ]]; then
  cat >&2 <<EOF
error: commit message does not follow Conventional Commits.
  got:      $first_line
  expected: <type>(<optional scope>): <imperative description>
  types:    build chore ci docs feat fix perf refactor revert style test
EOF
  exit 1
fi

if [[ ${#first_line} -gt 72 ]]; then
  echo "error: first line is ${#first_line} characters. Keep it under 72." >&2
  exit 1
fi
