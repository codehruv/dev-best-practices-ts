# API Design

Public APIs are consumed by code we will never see. Design them defensively. The baseline is the [Google API Design Guide](https://google.aip.dev/) (AIPs). The rules below override it where they conflict.

## Resources and Routes

- Plural collection names, `{singular}_id` path parameters, a version prefix on every public route (`/v1/...`).
- Standard methods: `GET` list and get, `POST` create, `PATCH` merge update, `PUT` full replace only, `DELETE` delete.
- Custom actions are path segments (`/v1/runs/{run_id}/cancel`).

## Bodies and Responses

- JSON field names are `snake_case`.
- Request bodies are the bare resource, not wrapped.
- Responses use one envelope: `{ "data": ..., "pagination": ... }`. Never return a top-level array, because it cannot grow.
- Validate strictly: reject unknown fields with a clear error.
- Every field is well typed. Loosely typed fields (free-form maps, "any") cause downstream breakage.

## Pagination

Every list endpoint paginates from day one. Adding pagination later is a breaking change.

## Errors

- One error shape everywhere: a stable machine-readable `code`, a human-readable `message`, and optional `details`.
- Messages tell the caller what to do. `"limit must be between 1 and 100, got 500"`, not `"invalid input"`.
- Use the right status code. `400` for validation, `401` unauthenticated, `403` unauthorized, `404` missing, `409` conflict, `429` rate limited (with `Retry-After`), `5xx` for server faults only.

## Robustness

- **Idempotency.** `POST` endpoints that create resources accept an `Idempotency-Key` header, so client retries never create duplicates.
- **Rate limits** return `429` with `Retry-After` and rate-limit headers.
- **Timeouts** on every outbound call. Retries use exponential backoff with jitter and a retry budget.

## Evolution

Changes are additive only. Follow [`schema-evolution.md`](schema-evolution.md). The API specification is the source of truth and generates clients. See [`code-generation.md`](code-generation.md).
