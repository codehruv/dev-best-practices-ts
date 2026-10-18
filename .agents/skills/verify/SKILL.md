---
name: verify
description: Run every check CI runs and fix failures until the repo is green. Use before committing or pushing, after finishing a change, or when the user says "verify", "make CI pass", or "check my work".
---

# Verify

1. Run `just fix`. It applies formatter and linter auto-fixes, then runs `just verify`.
2. If `just verify` fails, read the first failure, not the last. Later failures often cascade from it.
3. Fix the root cause in the code. Never:
   - relax a config, add a suppression, or skip a test to get green (ask the user if you believe a suppression is warranted),
   - weaken an assertion in a behavior test (challenge the implementation and ask instead),
   - hand-edit a generated file (regenerate with `just generate`).
4. Re-run `just verify` until it passes.
5. Report what failed, what you changed, and the final `just verify` result. If you could not get to green, say so and show the remaining failure output.
