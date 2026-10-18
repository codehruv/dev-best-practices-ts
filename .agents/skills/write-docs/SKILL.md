---
name: write-docs
description: Write or extend package documentation as executable doc tests that generate Diátaxis pages (tutorials, how-to guides, reference, explanation). Use when documenting a package or export, when `just docs-check` reports undocumented exports, broken links, or Diátaxis violations, or when the user asks for docs, examples, a tutorial, or a how-to guide.
---

# Write Docs

Read `docs/reference/documentation.md` first. Then:

1. **Find the gaps.** Run `just docs-check`. It lists undocumented exports, broken links, and
   Diátaxis violations by name and file.
2. **Pick the quadrant** for each gap, in priority order:
   1. No getting-started tutorial: write `tests/docs/tutorials/01-getting-started.test.ts`.
   2. A real task users perform: a how-to guide in `tests/docs/how-to/NN-<task>.test.ts`,
      titled with the task in the imperative ("Retry an HTTP request").
   3. An export no tutorial or how-to needs: a region in
      `tests/docs/reference/examples.test.ts`, plus `@example Title` and
      `{@includeCode ../tests/docs/reference/examples.test.ts#Name}` in its TSDoc.
   4. A design decision users question: a hand-written page in `docs/explanation/`.
3. **Write the doc test.** File JSDoc is the intro, `describe` is the title, each `it` is a
   section with JSDoc prose above it. Put the reader-facing code in
   `// #region name` ... `// #endregion name`, and the assertions after `#endregion`.
   - Import the package by its published name, never by relative path.
   - Keep samples self-contained: no helpers imported from relative modules.
   - Use tiny real delays or injected fakes. Never sleep waiting for a condition.
   - Teach in tutorials, instruct in how-to guides, describe in reference, discuss in
     explanation. Never mix them on one page.
4. **Never edit generated pages** (`docs/tutorials/`, `docs/how-to/`, `docs/reference/`,
   `docs/README.md`). Change the doc test or the TSDoc, then run `just generate`.
5. **Verify.** Run `just generate`, then `just verify`. Both must pass, and the generated
   pages are committed with the tests that produce them.
6. **Report** which exports, tasks, and pages you documented, and the final
   `just docs-check` summary line.
