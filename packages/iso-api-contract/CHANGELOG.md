# Changelog

All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-18

### Added

- Notes API contract: `GET /v1/notes`, `POST /v1/notes`, `GET /v1/notes/{note_id}`, `PATCH /v1/notes/{note_id}`, and `DELETE /v1/notes/{note_id}`.
- Zod schemas for every request and response, exported with their inferred types.
- `buildOpenApiDocument()` and the generated OpenAPI 3.1 document at `openapi/openapi.json`.

[Unreleased]: https://github.com/codehruv/dev-best-practices-ts/compare/%40dbp%2Fiso-api-contract%400.1.0...HEAD
[0.1.0]: https://github.com/codehruv/dev-best-practices-ts/releases/tag/%40dbp%2Fiso-api-contract%400.1.0
