# Proposals: PRD, RFC, Design Doc, Spec, ADR

Written proposals let the team decide asynchronously, keep the reasoning next to the code, and give humans and agents a precise contract to implement against. This document says which document to write, how to write it, how it gets reviewed, and how it turns into code, tests, and docs.

## The Document Ladder

Each document answers one question. Higher rungs feed lower ones. A change uses only the rungs its blast radius needs (see [Choosing a Format](#choosing-a-format)).

| Document                               | Answers                                                                | Perspective                         | Template                                      |
| -------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------- |
| **PRD** (product requirements doc)     | What are we building, and why?                                         | The user's                          | [`prd.md`](../templates/prd.md)               |
| **RFC** (request for comments)         | How will we build it?                                                  | The implementer's, seeking review   | [`rfc.md`](../templates/rfc.md)               |
| **Design doc**                         | How will we build it, in depth, for a large or hard-to-reverse change? | The implementer's, seeking sign-off | [`design-doc.md`](../templates/design-doc.md) |
| **One-pager**                          | A short what, why, and how for a small initiative                      | Both, briefly                       | [`one-pager.md`](../templates/one-pager.md)   |
| **Spec**                               | What exactly must be true when we are done?                            | The verifier's                      | [`spec.md`](../templates/spec.md)             |
| **ADR** (architecture decision record) | What did we decide, and why?                                           | The future reader's                 | [`adr.md`](../templates/adr.md)               |

### PRD: What and Why

A PRD defines the requirements of a feature from the user's perspective. It describes the proposed solution only at a high level, and only as the user experiences it. It never says how the code works.

**Litmus test.** Every item in a PRD is either:

1. content that could appear, rephrased, in the product documentation for the feature, or
2. content that supports deciding (1), such as user feedback, constraints, or security context.

If an item links to neither, cut it.

**Write it before you think about implementation.** Thinking about the current code while drafting requirements constrains the solution space and hides the best option. Finish the creative pass first, then switch to implementation thinking and poke holes.

**Do not open a PRD for review until the first RFC draft exists.** Implementation complications often force a product pivot. Fold those pivots into the PRD before reviewers spend time on it.

### RFC: How

An RFC fills in how the PRD gets built. Most RFCs pair with a PRD. A stand-alone RFC is only for work with no notable user-facing change that is too big for a one-pager, such as a risky migration.

- With a PRD: state at the top that the PRD is required reading, link it, and do not repeat its problem statement.
- **Level of detail is the craft.** Too much detail buries the key points and wastes reviewer time. Too little hides "dragons": complications that surface mid-project. Include the minimum detail that answers yes to both questions:
  - Is there enough detail to be reasonably confident in the estimate of how much work this is?
  - Does each detail help a reader understand the core architecture or reach that estimate? Cut any detail that does neither.

### Design Doc: How, in Depth

A design doc is an RFC with mandatory sections for changes where a mistake is expensive: architecture, cross-service contracts, data migrations, security boundaries. It adds security and privacy, observability, contract rollout (Expand, Migrate, Contract), and alternatives considered. It needs explicit sign-off from named approvers, not only comments.

### One-Pager: Small and Stand-Alone

A one-pager is a short RFC for a small initiative. It stands alone with no PRD. If it grows past one page, it was an RFC.

### Spec: The Testable Contract

A spec turns an accepted PRD and RFC (or design doc) into precise, numbered, verifiable requirements with acceptance criteria. It is the document that humans and agents implement against and that tests cite. A spec contains no rationale. Rationale lives in the RFC and the ADR.

Write a spec when work will be split across people, agents, or pull requests, or when the behavior is a public contract. For small changes, the RFC's requirements section is the spec.

### ADR: The Decision Record

An ADR records one significant decision, its context, and its consequences. ADRs are numbered, never edited after acceptance, and superseded by new ADRs when a decision changes. Every accepted RFC or design doc that settles an architectural question produces an ADR in [`docs/adr/`](../adr/).

## Choosing a Format

Match the process to the blast radius.

| Change                                                                  | Write                                                     |
| ----------------------------------------------------------------------- | --------------------------------------------------------- |
| Small or reversible (a bug fix, a refactor behind a stable interface)   | Nothing. Make the call. The PR description is the record. |
| Small initiative, no new user-facing surface                            | One-pager                                                 |
| New user-facing capability                                              | PRD plus at least one RFC                                 |
| Large technical change with no user-facing change (a migration)         | Stand-alone RFC                                           |
| Architectural, cross-boundary, security-sensitive, or hard to roll back | Design doc, with explicit sign-off                        |
| Work split across several PRs, people, or agents, or a public contract  | Add a spec                                                |
| An architectural question was settled                                   | ADR                                                       |

Every planned project that is not routine maintenance has a PRD and at least one RFC.

## Writing Requirements

Requirements carry the alignment. Every requirement in a PRD, RFC, design doc, or spec uses [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) keywords as clarified by [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174): the keywords carry their special meaning only in UPPERCASE.

Each requirement has every trait below. Use the table as a review checklist.

| Trait                   | Meaning                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Atomic**              | It states a single requirement.                                                                                      |
| **Complete**            | It defines the behavior without needing amplification.                                                               |
| **Concise**             | It states what must be done and only that, in 50 words or fewer.                                                     |
| **Consistent**          | It contradicts and duplicates no other requirement, and uses the same terms throughout.                              |
| **Correct**             | It follows from the problem statement and does not extend beyond it.                                                 |
| **Implementation-free** | It says what, not how. Exceptions: existing contracts, protocols, and compliance mandates.                           |
| **Necessary**           | Removing it would leave a gap.                                                                                       |
| **Traceable**           | It has a unique ID (`REQ-001`) that designs, PRs, and tests cite.                                                    |
| **Unambiguous**         | It has one interpretation. Ban vague words: appropriate, quickly, fast, robust, large, many, as needed, and/or, etc. |
| **Verifiable**          | A test, analysis, or review can confirm it. If you cannot observe it, rewrite it.                                    |
| **Viable**              | It can be implemented, and it helps the design once implemented.                                                     |

Before: "The retry helper should be fast and robust."
After: "REQ-004: The retry helper MUST compute the next delay in under 1 µs at p99 on the reference benchmark."

## Lifecycle

| Status          | Meaning                                                                       |
| --------------- | ----------------------------------------------------------------------------- |
| **Draft**       | The author is still writing. Comments welcome, no decision expected.          |
| **In review**   | Complete and open for comments, with named approvers and a decision deadline. |
| **Accepted**    | Approvers signed off. Implementation can start.                               |
| **Rejected**    | Approvers declined. The document stays as a record of why.                    |
| **Implemented** | The work shipped. Links to the PRs and ADRs are filled in.                    |
| **Superseded**  | A newer document replaces it. Link the replacement.                           |

Statuses describe the document's workflow, not a ruling on its quality.

## Review

- **Asynchronous by default.** Reviewers comment in writing on the document. Meetings resolve only what writing could not.
- **Named approvers and a decision deadline.** "In review" without both is a draft.
- **Self-review first.** The author checks the requirements against the trait table and the document against [`../principles.md`](../principles.md) before requesting review.
- **Comments carry evidence.** Data, a prototype, a benchmark, or a failing test beats opinion.
- **Decide, then commit.** Once accepted, the team commits. Reopen a decision only with new evidence, through a new document that supersedes the old one.
- **Record the outcome.** Update the status, and write an ADR for any architectural decision.

## From Proposal to Code

An accepted proposal compiles into stacked pull requests, and every link in that chain is traceable.

1. **Stack per work package.** The RFC's implementation plan is the skeleton. Each work package becomes one stack of PRs, in the RFC's dependency order. Do not invent a different cut.
2. **One PR per one-day task.** A PR is a task only if it passes five gates, all within one working day:
   - **Intended:** one sentence says why it exists and which requirement it serves.
   - **Prepared:** every input exists today (dependency merged, access granted, decision made). If not, preparing is the task.
   - **Begun:** the first action is obvious within minutes.
   - **Completed:** one artifact changes state, named by one concrete verb in the title (`Add`, `Remove`, `Migrate`). Titles that need "investigate", "improve", or "clean up" are not tasks.
   - **Validated:** a check (test, review, measurement) runs in the same context.
3. **Trace both ways.** Each PR lists the requirement IDs it implements. Keep a requirement-to-PR table in the plan. Every requirement gets at least one PR. A PR with no requirement is scope creep: cut it or justify it.
4. **Never resolve open decisions silently.** A PR that depends on an open question is blocked on that decision, with the proposal's default written down.
5. **Spike the unknowns.** Unknown scope gets a time-boxed spike whose deliverable is an answer and a task list, never production code.

### Estimates

Task durations follow a heavy-tailed (lognormal) distribution, and a gut estimate is a median, not a mean. With the commonly observed spread, the mean is about 1.65 times the median, and the 90th percentile is about 3.6 times. Plan with the mean, commit externally to a high percentile, and say which one you are quoting. When a task outlives its day, re-decompose it the next morning instead of pushing on.

## From Spec to Tests, Docs, Versions, and SLOs

The spec is the hub that keeps the other artifacts honest.

- **Tests.** Every acceptance criterion becomes at least one test whose name cites the requirement ID (`REQ-003: aborts the pending sleep when the signal fires`). A requirement with no test is not done.
- **Docs.** Acceptance criteria become Gherkin scenarios in the package's `features/*.feature`, tagged with their requirement IDs. They run as tests, and the generated specification page links each ID to its scenarios. See [`documentation.md`](documentation.md#specifications-from-gherkin-features).
- **Versions.** The spec's interface section states the SemVer impact on every public interface it touches. See [`versioning.md`](versioning.md) and [`schema-evolution.md`](schema-evolution.md).
- **SLOs.** The spec's SLO section names every objective the change adds or affects, with targets that benchmarks verify. See [`slo.md`](slo.md).

## References

- [RFC 2119: Key words for use in RFCs to Indicate Requirement Levels](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)
- Hunter Scott, _Designing Electronics That Work_ (requirement traits), and Leanna Rierson, _Developing Safety-Critical Software_ (requirements practice under DO-178C)
- [INCOSE Guide to Writing Requirements](https://www.incose.org/products-and-publications/se-handbook) (rules for well-formed requirements)
- [Design Docs at Google](https://www.industrialempathy.com/posts/design-docs-at-google/)
- [Companies Using RFCs or Design Docs](https://blog.pragmaticengineer.com/rfcs-and-design-docs/) (The Pragmatic Engineer)
- [Rust RFC process](https://github.com/rust-lang/rfcs) and [Oxide RFD 1: Requests for Discussion](https://rfd.shared.oxide.computer/rfd/0001)
- [Working Backwards PR/FAQ](https://workingbackwards.com/resources/working-backwards-pr-faq/) (product-first writing)
- [Shape Up](https://basecamp.com/shapeup) (shaping and appetite before building)
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) (Michael Nygard) and [adr.github.io](https://adr.github.io/)
- [GitHub Spec Kit](https://github.com/github/spec-kit) (spec-driven development with agents)
- [Gherkin reference](https://cucumber.io/docs/gherkin/reference/) (Given/When/Then)
- [Task Estimation: Conquering Hofstadter's Law](https://thesearesystems.substack.com/p/task-estimation-conquering-hofstadters) (lognormal task durations)
