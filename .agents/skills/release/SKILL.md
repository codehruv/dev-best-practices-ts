---
name: release
description: Add a changeset with the right SemVer bump and Keep a Changelog entries, and check interface versions. Use after changing a package's public API or HTTP contract, when `just api-check` fails, or when the user asks to bump a version, write a changelog entry, or prepare a release.
---

# Release

Read `docs/reference/versioning.md` first.

1. **Regenerate.** Run `just generate`, then `git diff --stat -- '*.api.md' '*openapi.json'` to see which interfaces changed.
2. **Pick the bump** from the diff, not from how big the change feels:
   - MAJOR: anything removed or changed in a report or document, a new required member on an interface, an ERR-level oasdiff change.
   - MINOR: anything added, anything newly deprecated.
   - PATCH: behavior fixes that leave the report and document unchanged.
   - Before 1.0.0, a breaking change is MINOR.

   `just api-check` prints the bump each interface requires and why.

3. **Write the changeset.** `just changeset` is interactive. When you cannot answer prompts, write `.changeset/<kebab-summary>.md` directly:

   ```md
   ---
   '@dbp/iso-retry': minor
   ---

   Added: `Retrier.withPolicy()` returns a copy with an overridden policy.
   ```

   - One entry per line, starting with `Added:`, `Changed:`, `Deprecated:`, `Removed:`, `Fixed:`, or `Security:`.
   - A breaking entry starts with `**Breaking:**` and says what breaks and how to upgrade.
   - A `Deprecated:` entry names its replacement and the version that removes it.
   - Write for the reader of the changelog: notable, user-facing, plain words. Never paste commit messages or list internal refactors.
   - Name only packages whose interface or behavior changed.

4. **Verify.** Run `just changesets` and `just api-check`. Both must pass.
5. **Do not** edit `CHANGELOG.md` files, `package.json` versions, `etc/*.api.md`, or `openapi/openapi.json` by hand. The version PR writes changelogs and versions, and `just generate` writes the artifacts.
6. Report the changeset you wrote and the `just api-check` result.
