/**
 * Thrown when a doc test file breaks the conventions the generator relies on. The
 * message starts with `file:line:column`, so editors and CI logs link straight to it.
 */
export class DocTestSyntaxError extends Error {
  constructor(sourcePath: string, line: number, column: number, message: string) {
    super(`${sourcePath}:${line + 1}:${column + 1}: ${message}`);
    this.name = new.target.name;
  }
}
