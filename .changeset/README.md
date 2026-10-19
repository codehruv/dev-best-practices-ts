# Changesets

Each file here declares a pending release of one or more interfaces: which packages bump,
by how much, and the changelog entries a reader needs. `pnpm changeset` creates one.

Write the summary as Keep a Changelog entries, one per line, each starting with its type:

```md
---
'@dbp/iso-retry': minor
---

Added: `Retrier.withPolicy()` returns a copy with an overridden policy.
Fixed: `RetryAbortedError.cause` holds the abort reason instead of `undefined`.
```

Types: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`. Start a breaking
entry with `**Breaking:**`. Indent a line to continue the entry above it. Full rules:
[`docs/reference/versioning.md`](../docs/reference/versioning.md).
