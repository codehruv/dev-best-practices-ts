# Versioning and Changelogs

Every interface in this repository versions independently with [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) and keeps its own changelog in the [Keep a Changelog 2.0.0](https://keepachangelog.com/en/2.0.0/) format. Tools enforce both, so a reviewer never has to remember to ask "did you bump the version?"

## What Is an Interface

An interface is anything another codebase depends on. Each one has a version, a `CHANGELOG.md`, and a committed artifact that tools diff:

| Interface                         | Version lives in                                   | Committed artifact                                                            | Diffed by                                     |
| --------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------- |
| A package's TypeScript public API | `package.json` `version`                           | `etc/<package>.api.md`, an [API Extractor](https://api-extractor.com/) report | `tools/release` (`classifyApiReportChange`)   |
| A package's HTTP contract         | `package.json` `version`, copied to `info.version` | `openapi/openapi.json`, generated from Zod schemas                            | [oasdiff](https://github.com/oasdiff/oasdiff) |

Packages are discovered by convention. A package with `api-extractor.json` has an API report. A package with `openapi/openapi.json` has an HTTP contract. A package can have both (`@dbp/iso-api-contract` does). An artifact that does not exist on `main` yet is a new interface: its first version is the package's current version, so it needs no bump. Both artifacts are generated, committed, and kept fresh by `just generate` and the CI freshness check (see [`code-generation.md`](code-generation.md)).

Every exported symbol carries a release tag (`@public`, `@beta`, `@alpha`, or `@internal`). API Extractor fails on a missing tag, because SemVer only covers what you declare stable.

## What Each Bump Means

### TypeScript APIs

| Change                                                                                      | Bump                  |
| ------------------------------------------------------------------------------------------- | --------------------- |
| Remove an export, or change a signature, type, or release tag                               | MAJOR                 |
| Add a required member to an interface, type literal, or abstract class (implementers break) | MAJOR                 |
| Add an export, an optional member, or a class member                                        | MINOR                 |
| Mark something `@deprecated`                                                                | MINOR (SemVer item 7) |
| Fix behavior without touching the API report                                                | PATCH                 |

The check is a conservative line-level heuristic over the API report. It sets a floor: it errs toward MAJOR, and you can always choose a bigger bump than it asks for. When it overestimates, the fix is a bigger bump, never a suppression.

### HTTP Contracts

`oasdiff` classifies every change. ERR-level changes (removing an endpoint, a response field, or an enum value, or tightening a request) break existing clients and require MAJOR. Added endpoints and fields and deprecations require MINOR. Anything else requires PATCH. WARN-level changes are printed as "potentially breaking, review" for a human to judge.

The rules behind these levels, such as "requests widen, responses never widen", are in [`schema-evolution.md`](schema-evolution.md). Follow Expand, Migrate, Contract so a breaking change is rarely needed.

### Before 1.0.0

SemVer item 4 makes 0.y.z unstable. Here a breaking change bumps MINOR (0.3.0 to 0.4.0) and everything else bumps PATCH. Graduating to 1.0.0 is a deliberate MAJOR changeset that declares the API stable.

## Deprecation Policy

1. Mark the symbol `@deprecated` (TypeScript) or `deprecated: true` (OpenAPI) and say what replaces it. Release it as MINOR with a `Deprecated:` entry that names the version that will remove it.
2. Keep it working for at least one MINOR release.
3. Remove it in the next MAJOR with a `Removed: **Breaking:** ...` entry.

Keep a Changelog 2.0.0 is explicit: always record deprecations, removals, and breaking changes.

## Changesets

A changeset is a file in `.changeset/` that declares a pending release. Create one with `just changeset`, which asks which packages changed and by how much.

The summary is a list of Keep a Changelog entries, one per line, each starting with its type:

```md
---
'@dbp/iso-retry': major
'@dbp/iso-api-contract': minor
---

Removed: **Breaking:** `Retrier.run()` no longer accepts a numeric timeout. Pass an `AbortSignal`.
Added: `GET /v1/tags` lists the tags in use.
Deprecated: `DELETE /v1/notes/{note_id}`. Archive notes with `PATCH` instead.
Removal is planned for 2.0.0.
```

- Types are the six Keep a Changelog defines: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`. There is no seventh.
- `Fixed` means the old behavior was a bug. `Changed` means it worked as intended and now works differently.
- A `Security` entry with a CVE starts with the identifier: `Security: CVE-2026-12345: ...`.
- Start a breaking entry with `**Breaking:**`, keep it under its type, and say which interface breaks and how to upgrade.
- Indent a line to continue the entry above it.
- Every entry in the changeset goes into the changelog of every package the changeset names. Split unrelated changes into separate changesets.

`just changesets` (part of `just verify`) validates every pending summary.

## Changelogs

Each interface's `CHANGELOG.md` follows Keep a Changelog 2.0.0: the fixed preamble, an `## [Unreleased]` heading, one `## [x.y.z] - YYYY-MM-DD` section per release, and reference links at the bottom that compare each release tag with the one before it. Tags have the form `@dbp/iso-retry@1.2.0`.

The `[Unreleased]` section stays empty in the file. Pending changes live in `.changeset/`, which avoids merge conflicts between PRs. `pnpm changeset status` lists them.

The root `CHANGELOG.md` is the central summary that Keep a Changelog 2.0.0 asks a multi-component repository to keep: one dated entry per release run, linking to each released interface.

Changesets' own changelog writer is turned off (`"changelog": false`), because it groups entries by bump size ("Minor Changes") instead of by change type. `tools/release` writes the changelogs instead.

### Machines Draft, Humans Curate

Changelog entries come from changesets that people write for readers, never from commit messages. For an HTTP contract, the release also drafts entries from `oasdiff changelog` since the last release tag. Those drafts land in the version PR, where a person edits them down to what is notable before merging.

## The Workflow

1. **Change an interface.** Run `just generate` to update the API report or the OpenAPI document.
2. **Add a changeset.** Run `just changeset`, pick the bump, and write the entries.
3. **Check it.** Run `just api-check`. It compares every interface with `main` and fails when the planned bump is smaller than the diff requires, or when a breaking change has no `**Breaking:**` entry. CI runs the same check (`.github/workflows/api-check.yaml`) and annotates HTTP contract changes on the PR.
4. **Merge.** Changesets accumulate on `main`.
5. **Version PR.** `.github/workflows/release.yaml` keeps a "version packages" PR open. It runs `pnpm run version-packages`, which:
   1. writes Keep a Changelog sections from the pending changesets (and drafts from oasdiff),
   2. runs `changeset version` to bump each `package.json` and delete the changesets,
   3. regenerates the API reports and OpenAPI documents so `info.version` matches.
6. **Curate and merge the version PR.** Edit the changelog text if needed.
7. **Release.** The next run on `main` tags each release (`@dbp/iso-retry@1.3.0`) and publishes every package that is not `private`. Publishing needs an `NPM_TOKEN` repository secret, and the workflow fails early without one. Packages publish with npm provenance.

## oasdiff

The dev shell and CI pin the same oasdiff release. Useful commands:

```sh
# Every change between main and the working tree, with severity levels.
oasdiff changelog main:packages/iso-api-contract/openapi/openapi.json packages/iso-api-contract/openapi/openapi.json

# Only breaking changes. Exits 1 on any ERR-level change.
oasdiff breaking main:packages/iso-api-contract/openapi/openapi.json packages/iso-api-contract/openapi/openapi.json --fail-on ERR
```

`tools/release` runs oasdiff with `--allow-external-refs=false`, so a document cannot make it fetch URLs.

## Publishing a Package

Packages start `"private": true`, so a release only tags them. To publish one:

1. Pick an npm scope you own and rename the package.
2. Set `"private": false` and add `"publishConfig": { "access": "public", "provenance": true }`.
3. Add the `NPM_TOKEN` repository secret.
