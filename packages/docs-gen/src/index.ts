// Types
export { type CodeSample, type DocPage, type DocSection } from './types.ts';

// Errors
export { DocTestSyntaxError } from './errors.ts';

// Generator
export { checkDocs, type DocsReport } from './check-docs.ts';
export { type DocsTreeReport } from './check-docs-tree.ts';
export { type CoverageReport } from './coverage.ts';
export { generateDocs } from './generate.ts';
export { parseDocTest } from './parse-doc-test.ts';
export { type PageSource, renderPage } from './render-markdown.ts';
