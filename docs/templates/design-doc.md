# Design Doc: <Title>

- **Author:** <name>
- **Approvers:** <names> (explicit sign-off required)
- **Status:** Draft | In review | Accepted | Rejected | Implemented | Superseded
- **Date:** YYYY-MM-DD
- **Decision deadline:** YYYY-MM-DD
- **PRD:** <link>, or "None"

An RFC with mandatory sections, for changes that are architectural, cross-boundary, security-sensitive, or hard to roll back. See [`../reference/proposals.md`](../reference/proposals.md).

## Context

Background a reviewer needs. Link related docs and ADRs.

## Goals and Non-Goals

- **Goals:** what this design MUST achieve.
- **Non-goals:** what it deliberately does not address.

## Requirements

Use [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) language: MUST, SHOULD, MAY. Give each requirement a permanent ID (`REQ-001`) and check it against the traits in [`../reference/proposals.md`](../reference/proposals.md#writing-requirements).

## Design

The proposed solution: components, data model, interfaces, and data flow. Diagrams help.

## Implementation Plan

Work packages in dependency order, each with a completion check and a median estimate. This table becomes the PR stacks.

## Contract Changes and Rollout

Every public API, schema, or storage change, and its Expand, Migrate, Contract plan. Feature flags, rollout stages, and the rollback plan.

## Security and Privacy

Assets, entry points, trust boundaries, threats, and mitigations. What data is stored, for how long, and who can read it.

## Observability

Metrics, logs, traces, SLOs, and alerts that show the design works in production.

## Testing

Unit, integration, and end-to-end coverage. Load or performance testing if relevant.

## Alternatives Considered

Each alternative and why it lost.

## Open Questions

Unresolved decisions and who owns them.
