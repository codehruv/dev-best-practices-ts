# Documentation

Package documentation follows [Diátaxis](https://diataxis.fr/), the system that began as
the [Divio documentation system](https://docs.divio.com/documentation-system/). It splits
documentation into four quadrants, because each serves a different reader need and mixing
them serves none well:

| Quadrant          | Reader need                       | Form                                |
| ----------------- | --------------------------------- | ----------------------------------- |
| **Tutorials**     | "Teach me." Learning by doing.    | A lesson with a guaranteed outcome. |
| **How-to guides** | "Help me do X." A real task.      | Steps for one goal, no teaching.    |
| **Reference**     | "Tell me exactly." Lookup.        | Complete, accurate, austere facts.  |
| **Explanation**   | "Help me understand." Background. | Discussion of why, and trade-offs.  |

## Docs Come From Tests

Every code sample in the docs runs as a test, so a sample can only be wrong if its test is
wrong. `@dbp/server-docs-gen` (`packages/server-docs-gen`) renders the pages, and `just verify` fails when
they are incomplete or broken.

| Quadrant      | Source                                   | Output                           | Generated? |
| ------------- | ---------------------------------------- | -------------------------------- | ---------- |
| Tutorials     | `tests/docs/tutorials/NN-slug.test.ts`   | `docs/tutorials/slug.md`         | Fully      |
| How-to guides | `tests/docs/how-to/NN-slug.test.ts`      | `docs/how-to/slug.md`            | Fully      |
| Reference     | TSDoc in `src/`, examples from doc tests | `docs/reference/`                | Fully      |
| Reference     | `features/*.feature` (Gherkin)           | `docs/reference/specifications/` | Fully      |
| Explanation   | `docs/explanation/*.md`                  | Same file                        | No         |
| Index         | All of the above                         | `docs/README.md`                 | Fully      |

**Explanation is hand-written on purpose.** It discusses design and trade-offs, and there is
no behavior to execute. The checks still verify its links and keep it in its quadrant.

### Doc Test Conventions

A doc test is an ordinary Vitest file. The generator parses it with the TypeScript compiler
API and maps its structure to the page:

| In the test file                                      | On the page                   |
| ----------------------------------------------------- | ----------------------------- |
| The JSDoc block before the first import               | Intro prose                   |
| `// #region name` blocks outside `describe()`         | Setup samples after the intro |
| The single top-level `describe('Title', ...)`         | Page title                    |
| Each `it('Heading', ...)` or `test(...)`              | A section                     |
| The JSDoc block above an `it()`                       | Section prose                 |
| Each `// #region name` ... `// #endregion name` in it | One code sample               |
| The whole `it()` body, when it has no regions         | One code sample               |
| Code outside regions, such as assertions              | Not rendered                  |

Rules the generator enforces, failing `just generate` with a `file:line:column` error:

- Import the package by its published name (`@dbp/iso-retry`), never by relative path. Rendered
  samples then copy-paste into real code. `tsconfig.json` `paths` and the Vitest `alias`
  map the name to `src/` in tests.
- Each sample gets only the imports it uses. Test-framework imports never render.
- A sample cannot use anything imported from a relative module, because readers cannot
  import test helpers. Define helpers inside a region instead.
- Plain `it()` and `test()` only: no `.each`, `.skip`, or `.only`, and no nested `describe`.
- Region names are unique within a file, and every `#region` has a matching `#endregion`.
- The numeric file prefix sets the order in the index and stays out of the page URL.

### Reference Examples

TypeDoc renders `docs/reference/` from TSDoc. Every `@example` pulls its code from a doc test
region instead of carrying hand-typed code:

```ts
/**
 * Retries transient failures.
 *
 * @example Retry an operation
 * {@includeCode ../tests/docs/reference/examples.test.ts#Retrier}
 */
```

The first `@example` line is the title (`jsDocCompatibility.exampleTag: false`).
`tests/docs/reference/examples.test.ts` holds those regions and runs as a test, but it does
not render as a page of its own. The shared TypeDoc config (`@dbp/server-docs-gen/typedoc.base.json`)
treats every warning as an error, requires documentation on every exported member, allows
only a fixed list of block tags, and disables source links, which point at files readers
cannot open.

### Specifications From Gherkin Features

A spec's acceptance criteria live in `features/<name>.feature` as Gherkin scenarios, and
[vitest-cucumber](https://vitest-cucumber.miceli.click/) runs them as tests from step
definitions in `tests/features/<name>.feature.test.ts`. The generator parses each feature
with the official [`@cucumber/gherkin`](https://github.com/cucumber/gherkin) parser and
renders it to `docs/reference/specifications/<name>.md`.

**Features are reference, not how-to guides.** A scenario states what the package does
under given conditions, as a fact a reader looks up ("does a predicate rejection still
count as an attempt?"). It does not walk the reader through a task, and its steps show no
code, so it cannot teach either. That is the austere, complete, lookup-oriented content
the reference quadrant holds.

| In the feature file                         | On the page                                |
| ------------------------------------------- | ------------------------------------------ |
| `Feature:` title and description            | Page title and intro                       |
| `@REQ-NNN` tags on scenarios or the feature | A requirements table, ID to scenarios      |
| `Background:`                               | A section of shared steps                  |
| Each `Scenario:` or `Scenario Outline:`     | A section, with "Verifies `REQ-NNN`" links |
| Steps, doc strings, and data tables         | A list of steps with their arguments       |
| `Examples:` tables                          | Tables after the steps                     |

Each requirement ID gets an anchor (`specifications/retry.md#req-003`), so a spec, PR, or
issue links straight to the scenarios that verify it.

vitest-cucumber fails the run when a scenario or step in the feature has no
implementation, or when a step's text or keyword differs from the feature. Load the feature
with an absolute path (`fileURLToPath(new URL('../../features/x.feature', import.meta.url))`),
because `loadFeature` cannot resolve relative paths under top-level await.

Feature steps do not count toward export coverage. A step definition imports the package,
but the page shows the step text, not the code, so a reader still has no tested sample of
the export.

## Priority Order

Write documentation in this order. Each step is worth more to a reader than the next, so a
package with only the first steps done is still useful:

1. **Getting-started tutorial.** One lesson from install to a working result. Without it,
   nobody gets far enough to need anything else.
2. **How-to guides for the top real tasks,** most common first. For `@dbp/iso-retry`: retry an
   HTTP request, cancel a retry, retry only transient errors, cap the total retry time, and
   test code that retries.
3. **A tested reference example for every export** that no tutorial or how-to covers.
4. **Explanation** for the design decisions a user would otherwise question.

The numeric prefixes of doc test files encode this order.

## The Checks

`just docs-check` runs as part of `just verify` and fails on any of:

- **Undocumented exports.** Every export of `src/index.ts` must be imported by a tutorial or
  how-to doc test, or have an `@example` whose `{@includeCode}` resolves to a region under
  `tests/docs/`. The report names each missing export. Prose alone never counts, because
  prose cannot fail when behavior changes.
- **Broken links.** Every relative link in every page, generated or hand-written, must reach
  an existing file, and every `#fragment` must match a heading (GitHub slug rules) or an
  explicit anchor.
- **Diátaxis violations.** Every page sits in exactly one quadrant directory and is reachable
  from `docs/README.md`. The index lists all four quadrants. Generated quadrants hold only
  generated pages, and explanation holds only hand-written ones. Each quadrant rejects
  content that belongs to another: a tutorial with a migration section, a how-to titled
  "Why ...", or an explanation with more than two code blocks.
- **Traceability problems.** Every scenario names at least one requirement (`@REQ-` and
  three or more digits), on itself or its feature. A near-miss tag such as `@req-1`, a tag
  repeated on one scenario, two scenarios with one title (step definitions bind by title),
  and a skip or focus tag (`@ignore`, `@skip`, `@only`, `@wip`) all fail. So does a feature
  with no `tests/features/<name>.feature.test.ts` that loads it, which no test would run.

`just freshness` (CI) regenerates everything and fails if any committed page differs.

## Commands

| Command              | What it does                                                       |
| -------------------- | ------------------------------------------------------------------ |
| `just generate`      | Runs TypeDoc, then renders pages and the index for every package.  |
| `just docs-check`    | Coverage, link, Diátaxis, and traceability checks.                 |
| `dbp-docs-gen trace` | From a package root, prints each requirement ID and its scenarios. |
| `just freshness`     | Fails when committed docs differ from a fresh generation (CI).     |

## Adding Docs to a Package

1. Add `@dbp/server-docs-gen`, `typedoc`, and `typedoc-plugin-markdown` as `catalog:` dev dependencies.
2. Copy `typedoc.json` from `packages/iso-retry`.
3. Add the scripts `"generate": "typedoc && dbp-docs-gen generate"` and
   `"docs:check": "dbp-docs-gen check"`.
4. Map the package name to `./src/index.ts` in `tsconfig.json` `paths` and in the Vitest `alias`.
5. Write doc tests in the priority order above, then run `just generate` and `just verify`.
6. For acceptance criteria, add `@amiceli/vitest-cucumber` as a `catalog:` dev dependency
   and write `features/<name>.feature` plus `tests/features/<name>.feature.test.ts`.

## Extending to Other Sources

The generator treats `docs/reference/` as output of an earlier step and only stamps and
indexes it. A future renderer for another contract, such as OpenAPI operations rendered
with examples from the spec, writes its pages into `docs/reference/` the same way TypeDoc
does. The link and Diátaxis checks then apply without change. Coverage of those items
(every operation documented) is a separate check alongside export coverage.
