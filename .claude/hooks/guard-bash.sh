#!/usr/bin/env bash
# PreToolUse hook for Bash. Blocks commands that bypass the repo's safety nets.
# Exit code 2 rejects the tool call and shows stderr to the agent.
set -euo pipefail

command="$(jq -r '.tool_input.command // empty')"

if [[ "$command" =~ (^|[[:space:]])--no-verify([[:space:]]|$) ]]; then
  echo "Blocked: --no-verify skips the git hooks. Fix the hook failure instead." >&2
  exit 2
fi

if [[ "$command" =~ git[[:space:]]+push.*(--force([[:space:]]|$)|[[:space:]]-f([[:space:]]|$)) ]]; then
  echo "Blocked: force-push needs explicit human approval. Ask the user to run it." >&2
  exit 2
fi
