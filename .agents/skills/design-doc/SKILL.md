---
name: design-doc
description: Draft a PRD, RFC, design doc, one-pager, spec, or ADR from the repo templates, or compile an accepted proposal into PR stacks. Use when the user wants to propose a change, write up a plan, define requirements, record a decision, or asks for a PRD, RFC, design doc, spec, proposal, or ADR.
---

# Proposals

Read [`docs/reference/proposals.md`](../../../docs/reference/proposals.md) first. It defines the document ladder, the requirement traits, the lifecycle, and how proposals become PRs and tests.

## Draft a Document

1. **Pick the format by blast radius** using the "Choosing a Format" table:
   - Small or reversible: no document. Say so and suggest making the call.
   - Small initiative: one-pager (`docs/templates/one-pager.md`).
   - New user-facing capability: PRD (`docs/templates/prd.md`) plus an RFC (`docs/templates/rfc.md`). Draft the PRD without implementation thinking, then the RFC, then fold any pivots back into the PRD before it goes to review.
   - Large technical change with no user-facing change: stand-alone RFC.
   - Architectural, cross-boundary, security-sensitive, or hard to roll back: design doc (`docs/templates/design-doc.md`).
   - Work split across several PRs or agents, or a public contract: add a spec (`docs/templates/spec.md`).
   - A settled decision: ADR (`docs/templates/adr.md`), saved as `docs/adr/NNNN-kebab-title.md` with the next free number.
2. **Read before writing.** Read the code, ADRs, and proposals the document touches. Cite them by path.
3. **Keep every template heading.** Write "None" under a heading that does not apply.
4. **Write requirements to the trait table.** RFC 2119 keywords in uppercase, permanent IDs (`REQ-001`), at most 50 words each, implementation-free, verifiable, no vague words. Audit every requirement against the table before handing the draft back.
5. **RFC detail:** include the minimum needed to understand the core architecture and estimate the work with reasonable confidence. Cut any detail that serves neither.
6. **Contracts:** for every interface change, state the SemVer impact and the Expand, Migrate, Contract plan (`docs/reference/schema-evolution.md`).
7. **Save drafts** to `docs/drafts/<topic>.md` unless the user names another location.
8. **List open questions explicitly.** Do not invent answers to decisions that belong to the user. Give each one an owner and a default.

## Compile an Accepted Proposal into PR Stacks

1. Use the RFC's implementation plan as the skeleton: one stack per work package, in its dependency order.
2. Split each work package into PRs that pass the five gates (intended, prepared, begun, completed, validated) within one working day. Titles name one artifact and one concrete verb.
3. Give every PR its requirement IDs, and build a requirement-to-PR table. Flag any requirement with no PR, and any PR with no requirement.
4. Mark PRs that depend on an open question as blocked on that decision, with the proposal's default. Never resolve the question yourself.
5. Turn unknown scope into a time-boxed spike whose output is an answer and a task list.
6. Report requirement defects you find while compiling. Do not silently rewrite an accepted proposal.
