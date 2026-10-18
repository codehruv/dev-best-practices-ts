# Code Generation

Contracts (OpenAPI, protobuf, JSON Schema, database schemas) are the source of truth. Code generated from them is a build artifact that happens to be committed.

## Rules

- **Never hand-edit generated files.** Change the generator or its source, regenerate, and commit both in the same change.
- **Generated files carry a header** that says they are generated and names the command that regenerates them. Linters and formatters skip them by that header or by path.
- **Generation is deterministic.** The same input produces the same bytes on every machine. Sort keys, pin generator versions, and avoid timestamps in output.
- **A freshness check runs in CI.** It regenerates everything and fails if the working tree changes. `just generate` regenerates locally.
- **Build never depends on generate.** Build trusts the committed generated source. The freshness check is the only drift detector, which keeps builds fast and hermetic.

## Commit or Ignore

- **Commit** generated code that consumers read, review, or import without running the generator (clients, SDKs, types).
- **Gitignore** output that is cheap to produce and only the build needs. Produce it inside the build step, and do not call that step `generate`.

## Extension Points

Generated low-level code plus a thin hand-written layer on top beats patching generated output. Custom behavior lives in separate files that wrap or extend the generated code.
