---
name: design-doc
description: Draft a one-pager, design doc, or ADR from the repo templates. Use when the user wants to propose a change, write up a plan, record a decision, or asks for an RFC, proposal, or ADR.
---

# Design Doc

1. Pick the format by blast radius:
   - Small or reversible: no doc. Say so and suggest making the call.
   - Medium, or affects a contract: one-pager, `docs/templates/one-pager.md`.
   - Large, architectural, or hard to roll back: design doc, `docs/templates/design-doc.md`.
   - A decision already made: ADR, `docs/templates/adr.md`, saved as `docs/adr/NNNN-kebab-title.md` with the next free number.
2. Read the code and existing ADRs the proposal touches before writing. Cite them by path.
3. Keep every template heading. Write "None" under a heading that does not apply instead of deleting it.
4. Use RFC 2119 language (MUST, SHOULD, MAY) in the Requirements section of a design doc.
5. For any contract change, spell out the Expand, Migrate, Contract plan (`docs/reference/schema-evolution.md`).
6. Draft one-pagers and design docs into `docs/drafts/<topic>.md` unless the user names another location.
7. List open questions explicitly. Do not invent answers to decisions that belong to the user.
