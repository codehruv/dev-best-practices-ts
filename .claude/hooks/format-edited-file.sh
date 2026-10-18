#!/usr/bin/env bash
# PostToolUse hook for file edits. Formats the edited file through `just fmt-file`,
# so agent output matches the formatter before any review or commit. Each repo's
# justfile decides which formatter handles which extension.
set -euo pipefail

file="$(jq -r '.tool_input.file_path // empty')"
[[ -z "$file" || ! -f "$file" ]] && exit 0

cd "$CLAUDE_PROJECT_DIR"
# A formatting failure must not block the edit itself, so the hook always exits 0.
just fmt-file "$file" >/dev/null 2>&1 || true
