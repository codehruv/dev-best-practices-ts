# 0001: Record Architecture Decisions

- **Status:** Accepted
- **Date:** 2026-10-18

## Context

Decisions made in chat threads, meetings, and external documents get lost, and the reasoning behind the code disappears with them. New contributors and agents then relitigate settled decisions or break their assumptions.

## Decision

We will record every significant architectural decision as an Architecture Decision Record in `docs/adr/`, using [`../templates/adr.md`](../templates/adr.md). Records are numbered sequentially and never edited after acceptance. A changed decision gets a new record that supersedes the old one.

## Consequences

- The reasoning behind the code lives next to the code and is reviewed like code.
- Writing an ADR adds a small cost to each significant decision.
- Agents can read past decisions instead of inferring them.
