# Writing Comments

Write comments. Good code carries a lot of them. The bar is quality, not scarcity. A bad first attempt means think harder about what the reader needs, not skip the comment.

## Two Tests

**1. Does it bind the reader?** A comment earns its place when it changes what someone does. If a reader does their job identically without it, cut it.

**2. Does it name the thing, or where the thing currently sits?** Name symbols, types, and packages. Those survive edits, and a rename shows up in search. Never write line numbers, counts ("the three callers"), or positions ("the block below").

## Passes Both

- **Constraint the code cannot express.** `// The provider returns 200 with an error body, so status alone cannot decide success.`
- **Goal in the larger system.** `// Keeps the raw response so replay can rebuild the session without calling the provider.`
- **Ordering requirement.** `// Runs before the config loads, so it cannot read settings.`
- **Value that must match elsewhere.** `// Every key here must also exist in UserSchema. The API rejects unknown keys.`
- **Deliberate deviation.** `// Uses a blocking read here, because the caller holds the lock.`

## Fails the First Test

- **History.** How the code used to work, what changed, why it changed. Version control holds this.
- **Provenance.** "Copied from the users module." Where code came from binds nobody.
- **Rejected alternatives.** If a tempting alternative would break something, state the breakage, not the alternative.
- **Restating the code.** `// Increment the counter` above `counter += 1`.
- **Plan narration.** What a later change will do. The reader of the merged code has no access to that plan.
- **Facts with a general answer.** If the comment stays true when restated as a rule about the language or tooling, it says nothing about this code.

## Forward-Looking Comments

A `TODO` names an issue and the condition that makes it actionable: `// TODO(#123): delete after every client is on v2 (Contract step)`. A `TODO` with no trigger does not go in.

## Rewrite, Never Append

New information means rewriting the whole comment so it reads as if written once. A sentence bolted on to answer an objection reads as one.

## Form

As short as the point allows. No hedging (should, may, potentially). State the real limit instead. Active voice. Use a period, a comma, or parentheses, not dashes. Section banners that group declarations in a long file are fine.

## Worked Example

Before:

```text
// This used to call the auth service directly, but we switched to the token verifier.
// We considered caching keys in Redis, but that adds a dependency, so we poll.
// Note this may potentially fail if keys rotate faster than the poll interval
// (see the 3 callers below).
```

After:

```text
// Polls for new signing keys. A token signed after the last poll fails verification
// until the next poll completes.
```

Gone: the history, the rejected alternative, the hedge, the count, and the position. What survives is the limit a caller has to know about.

## Doc Comments

Every exported symbol gets a doc comment that explains why it exists. This is a separate obligation from inline comments, and it follows the same quality bar.
