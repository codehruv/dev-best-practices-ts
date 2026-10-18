/** A code block on a doc page, with the import lines a reader needs to run it. */
export interface CodeSample {
  /** Import statements for the identifiers the sample uses, in source order. */
  readonly imports: readonly string[];
  /** The sample body, dedented. */
  readonly code: string;
}

/** One `it()` or `test()` call in a doc test, rendered as a page section. */
export interface DocSection {
  /** The test name, used verbatim as the section heading. */
  readonly title: string;
  /** Markdown from the JSDoc block above the test call. Empty when there is none. */
  readonly prose: string;
  /** One sample per `#region` in the test body, or the whole body when it has no regions. */
  readonly samples: readonly CodeSample[];
}

/**
 * A tutorial or how-to page parsed from one doc test file. The page structure mirrors
 * the test structure, so a test that passes is proof that every sample on the page works.
 */
export interface DocPage {
  /** The name of the file's single top-level `describe()`. */
  readonly title: string;
  /** Markdown from the file-level JSDoc block. Empty when there is none. */
  readonly intro: string;
  /**
   * Regions outside the `describe()`, rendered after the intro. They hold definitions that
   * several sections share, such as a configured instance or a helper class.
   */
  readonly setup: readonly CodeSample[];
  /** One per `it()` or `test()` inside the `describe()`, in source order. */
  readonly sections: readonly DocSection[];
}
