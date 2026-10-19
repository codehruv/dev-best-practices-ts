# Why docs come from tests

Hand-written documentation drifts. A sample that compiled when it was written stops
compiling after a rename, and nothing notices until a reader copies it. The fix is to make
every sample executable and to make the test suite the only place samples live.

`@dbp/server-docs-gen` turns that into structure. A doc test is an ordinary test file, so it runs
in `just verify` with every other test. The generator renders it as a page, and the
freshness check fails when the committed page differs from what the tests would produce.
A sample on a page can therefore only be wrong if its test is wrong.

## What is generated and what is not

The four [Diátaxis](https://diataxis.fr/) quadrants do not all suit generation:

- **Tutorials and how-to guides** are sequences of working code with prose between steps.
  That is exactly the shape of a test file, so they are generated in full.
- **Reference** describes every export. TypeDoc generates it from TSDoc comments, and
  every `@example` in a comment pulls its code from a doc test region.
- **Explanation** is discussion: why a design is shaped the way it is, and what it trades
  away. There is no behavior to execute, so these pages are hand-written. The checks
  still verify their links and keep them in their quadrant.

## Why the checks are separate from generation

Generation answers "do the pages match the tests?". The checks answer "are the docs
complete and well formed?": every export documented, every link resolving, every page in
exactly one quadrant and reachable from the index. Keeping them apart lets a package adopt
generation first and turn on the stricter checks once its docs catch up.
