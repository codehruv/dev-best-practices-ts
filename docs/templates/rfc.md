# RFC: <Title>

- **Author:** <name>
- **Approvers:** <names>
- **Status:** Draft | In review | Accepted | Rejected | Implemented | Superseded
- **Decision deadline:** YYYY-MM-DD
- **PRD:** <link> (required reading before this RFC), or "None: stand-alone RFC"

How we will build it. Include the minimum detail needed to understand the core architecture and to estimate the work with reasonable confidence, and no more. See [`../reference/proposals.md`](../reference/proposals.md).

## Problem Statement

With a PRD: one sentence and a link. Do not repeat the PRD. Stand-alone: the full problem and its evidence.

### Complicating Factors

Technical constraints: existing contracts, data volume, compatibility windows, dependencies.

## Out of Scope

## Definitions

## Requirements

Requirements follow RFC 2119 and the traits in [`../reference/proposals.md`](../reference/proposals.md#writing-requirements). Reuse PRD requirement IDs where they apply.

### General

- **REQ-001:** <The system MUST ...>

## Proposal

### Overview

The approach: components, data flow, and the interfaces between them.

### Interfaces and Versioning

Every public interface added or changed, and its SemVer impact. Breaking changes follow Expand, Migrate, Contract ([`../reference/schema-evolution.md`](../reference/schema-evolution.md)).

### Implementation Plan

Work packages in dependency order, each with a completion check. This table becomes the PR stacks.

| Work package | Delivers | Depends on | Completion check | Estimate (median) |
| ------------ | -------- | ---------- | ---------------- | ----------------- |

## Alternatives Considered

## Open Questions

Each with an owner and the default we take if it stays open.
