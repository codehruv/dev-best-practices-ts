# Engineering Principles

The rules in `AGENTS.md` are enforceable. This document holds the reasoning behind them, so a reader can apply the spirit of a rule where the letter does not reach.

## Philosophy

**Simplicity beats cleverness.** Build small pieces that each do one thing. Combining simple things is easier than untangling complex ones. When code needs a special case, first try to restructure it until the special case disappears.

**Data dominates.** "Bad programmers worry about the code. Good programmers worry about data structures and their relationships." (Linus Torvalds.) Get the types and the shape of the data right, and the algorithms become obvious.

**Never break your users.** "We do not break userspace." (Linus Torvalds.) If a change breaks a consumer, the change is wrong, even when the old behavior was a bug. Contracts evolve additively through Expand, Migrate, Contract.

**Programs are for people.** "Programs are meant to be read by humans and only incidentally for computers to execute." (Donald Knuth.) Optimize for the reader: clear names, small functions, comments that explain constraints.

**Measure before you optimize.** "Premature optimization is the root of all evil," and the rest of the quote matters too: do not pass up the critical 3%. Profile first, then optimize what the profile shows.

**Show the code.** "Talk is cheap. Show me the code." Settle debates with evidence: a prototype, a benchmark, a failing test.

**Have opinions, commit to decisions.** Debate with evidence, not seniority. Once a decision is made, everyone commits. Relitigating burns time and trust.

**Build tools to make your job easier.** If a task repeats, automate it. If a rule matters, enforce it with a tool rather than a reviewer's memory. Tools do not get tired.

**Ratchet quality upward.** Strictness only increases. Legacy violations get a baseline that can shrink but never grow. New code meets the bar from day one.

## Golden Rules for a Modern Repository

1. **Build and test only what changed.** A task graph with affected-only execution and caching keeps CI time proportional to the diff.
2. **Enforce boundaries with tools.** Module boundaries, import rules, and dead-code detection run in CI.
3. **One version of everything.** One lockfile, one version per dependency, automated updates with a cooldown.
4. **Hermetic toolchain.** The compiler, runtime, and tools are pinned. Local and CI run the same bits.
5. **Trunk-based with small changes.** Short-lived branches, a green `main`, flags for unfinished work.
6. **Contracts are the source of truth.** Schemas generate code. Generated code is never hand-edited. Freshness checks catch drift.
7. **Everything as code, in the repo.** CI, lint rules, ownership, agent instructions, ADRs, and runbooks live next to the code.
8. **Strict by default.** Shared strict configs that packages extend and never weaken.
9. **Fast, layered tests.** Many unit tests, a meaningful integration layer, thin end-to-end tests. Flaky tests are bugs.
10. **Built for agents too.** Small files, clear names, scoped `AGENTS.md` files, and one-command verification so an agent can check its own work.

## Commit Discipline

- One logical change per commit. Every commit builds and passes tests, so `git bisect` works.
- Commit messages explain why. The diff already shows what.
- Large changes land as a series of small, reviewable steps.

## Correctness

- Write the test that proves the behavior before trusting the behavior.
- "Beware of bugs in the above code; I have only proved it correct, not tried it." (Donald Knuth.) Proofs and tests complement each other.
- Keep a record of what broke and why (postmortems, regression tests). Patterns in past failures predict future ones.

## Focus

Deep work produces the best code. Batch interruptions, keep meetings rare, and default to asynchronous written communication: design docs, PR descriptions, and ADRs.
