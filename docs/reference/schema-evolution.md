# Schema Evolution and Contract Changes

Consumers upgrade on their own schedule. Any change that assumes every consumer upgrades at once is a breaking change.

## Expand, Migrate, Contract

A breaking change ships as three separate releases:

1. **Expand.** Add the new field, column, endpoint, or flag alongside the old one. Both work.
2. **Migrate.** Move every reader and writer to the new path. The old path still works.
3. **Contract.** Remove the old path once no supported consumer uses it.

The steps never share a release. Skipping a step breaks every consumer that is mid-upgrade.

## Requests: Widen, Never Narrow

- Never remove an accepted field. Under strict validation, an unknown field becomes an error, so removal turns every client that still sends it into a failing client.
- Never make an optional field required.
- Never narrow an enum or a type.
- Adding an optional field is safe.

## Responses: Never Widen

Generated clients validate responses against the shape they were built with.

- Never remove or rename a response field. Clients read it.
- Never add an enum value, make a field nullable, or generalize a type in an existing field. Old clients reject values they do not know.
- Adding a brand-new field is safe.

## Deprecating a Field

1. Keep the field accepted and emitted.
2. Mark it deprecated in the schema, both human-readable (a description that starts with `Deprecated:`) and machine-readable (the schema's deprecated flag).
3. Discard an incoming deprecated value explicitly where the request is handled. Do not rely on a downstream layer to ignore it.
4. If a deprecated response field reads data you no longer maintain, degrade malformed values to null in the mapping code. One bad row must not fail the whole response.

## Removing a Field

Removal is a major version of every published client. Batch removals into a planned major release, agreed with consumers. Never remove a field because it looks unused or as cleanup inside an unrelated change.

## Database Migrations

- Migrations are forward-only and backward compatible with the previous release of the code.
- Add columns as nullable or with a default. Backfill in batches, then add constraints.
- Create indexes without locking writes where the database supports it.
- Never rename a column in place. Add the new column, dual-write, migrate readers, then drop the old column (Expand, Migrate, Contract).

## Enforce It With Tools

Run a breaking-change detector on every contract in CI (`oasdiff` for OpenAPI, `buf breaking` for protobuf). Reviewers miss breaking changes. Tools do not.
