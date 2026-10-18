# Spec: <Title>

- **Author:** <name>
- **Status:** Draft | In review | Accepted | Implemented | Superseded
- **Version:** 0.1.0
- **Implements:** <links to the accepted PRD, RFC, or design doc>

The precise, testable contract that implementers (human or agent) build against and that tests cite. No rationale here; it lives in the RFC and ADRs. See [`../reference/proposals.md`](../reference/proposals.md).

## Scope

What this spec covers, in one paragraph.

### Non-Goals

What it deliberately does not cover.

## Definitions

Every term with a specific meaning. Use them consistently below.

## Requirements

Keywords follow [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174). Each requirement is atomic, implementation-free, verifiable, and at most 50 words. IDs are permanent: never renumber, and mark a dropped requirement `Withdrawn` instead of deleting it.

| ID      | Requirement                                   | Priority |
| ------- | --------------------------------------------- | -------- |
| REQ-001 | The <component> MUST <observable behavior>.   | MUST     |
| REQ-002 | The <component> SHOULD <observable behavior>. | SHOULD   |

## Acceptance Criteria

One or more scenarios per requirement, in Given/When/Then. Each scenario becomes at least one test whose name starts with the requirement ID, and doc tests render them into the documentation ([`../reference/documentation.md`](../reference/documentation.md)).

### REQ-001

- **Given** <precondition>
- **When** <action>
- **Then** <observable outcome>

## Interfaces

Every public interface this spec adds or changes: signatures, schemas, error codes, and CLI or config keys.

| Interface               | Change                         | SemVer impact         |
| ----------------------- | ------------------------------ | --------------------- |
| `<package or endpoint>` | <added / changed / deprecated> | major / minor / patch |

Breaking changes follow Expand, Migrate, Contract ([`../reference/schema-evolution.md`](../reference/schema-evolution.md)). Versioning rules: [`../reference/versioning.md`](../reference/versioning.md).

## SLO Impact

Every service level objective this spec adds or affects, with its target and the benchmark or measurement that verifies it ([`../reference/slo.md`](../reference/slo.md)). "None" if none.

| SLO | Target | Verified by |
| --- | ------ | ----------- |

## Traceability

Filled in during implementation. Every requirement maps to at least one PR and one test.

| Requirement | PRs | Tests |
| ----------- | --- | ----- |
| REQ-001     |     |       |

## Open Questions

Each with an owner. An open question blocks every requirement it touches.
