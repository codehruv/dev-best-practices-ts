---
name: review
description: Review a diff, branch, or PR against this repo's AGENTS.md rules and reference docs. Use when the user says "review", "review my diff", "check this PR", or before opening a PR.
---

# Review

1. Get the diff: `git diff main...HEAD` unless the user names another range or PR.
2. Read `AGENTS.md`, every nested `AGENTS.md` above the changed files, and the `docs/reference/` files for the areas touched.
3. Check in priority order, and stop to report anything severe:
   1. **Correctness:** logic errors, unhandled errors, race conditions, edge cases.
   2. **Contracts:** removed or narrowed request fields, widened response fields, breaking CLI or config changes (`docs/reference/schema-evolution.md`).
   3. **Security:** unvalidated input at trust boundaries, injection, secrets, over-broad permissions.
   4. **Tests:** new behavior without tests, weakened assertions, skipped or focused tests.
   5. **Hard rules:** suppressions, relaxed configs, hand-edited generated files, new dependencies without justification.
   6. **Design:** special cases that a restructure would remove, hidden dependencies, files doing two things.
   7. **Comments and naming:** per `docs/reference/comments.md`.
4. Skip formatting. The formatter owns it.
5. Report one line per finding: `path:line: severity: problem. fix.` Severity is `blocker`, `major`, or `minor`. No praise and no restating the diff. If nothing survives, say "No findings."
