---
name: write-comments
description: Write or audit code comments and doc comments against the repo's comment standard. Use when adding comments, reviewing comment quality, or when the user says "comment this" or "clean up comments".
---

# Write Comments

Read `docs/reference/comments.md` first. Then, for each comment in scope:

1. **Bind test.** Would a reader act differently without it? If not, delete it.
2. **Name test.** Does it name symbols instead of positions, counts, or line numbers? Rewrite it if not.
3. **Delete** history, provenance, rejected alternatives, restated code, plan narration, and facts that hold for any code in the language.
4. **Keep and sharpen** constraints the code cannot express, ordering requirements, values that must match elsewhere, and deliberate deviations.
5. **Rewrite, never append.** Fold new information into one comment that reads as if written once.
6. **Form.** Shortest version that carries the point. No hedging. Active voice. No dashes as punctuation.
7. **Doc comments.** Every exported symbol says why it exists.
8. **TODOs** name an issue and the condition that makes them actionable. Delete any TODO with no trigger.

Report the comments you deleted, rewrote, and added, each with a one-line reason.
