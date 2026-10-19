import ts from 'typescript';

import { DocTestSyntaxError } from './errors.ts';
import type { CodeSample, DocPage, DocSection } from './types.ts';

// Test-framework imports never appear in rendered samples, because readers run the
// sample in their own code, not inside a test.
const TEST_FRAMEWORK_MODULES: ReadonlySet<string> = new Set(['vitest']);

/** One import declaration, kept so each sample can re-emit only the names it uses. */
interface ImportBinding {
  readonly localName: string;
  readonly importedName: string;
  readonly moduleSpecifier: string;
  readonly isTypeOnly: boolean;
  readonly isDefault: boolean;
}

/** Shared state for one file, so helpers do not thread five arguments each. */
interface ParseContext {
  readonly file: ts.SourceFile;
  readonly sourcePath: string;
  readonly lines: readonly string[];
  readonly imports: readonly ImportBinding[];
}

/**
 * Parses one doc test file into a page. The file must hold exactly one top-level
 * `describe()` (the page title) whose direct children are plain `it()` or `test()`
 * calls (the sections). Any other shape throws, so a malformed doc test fails
 * `just generate` instead of silently producing a broken page.
 *
 * @throws {DocTestSyntaxError} when the file breaks a convention.
 */
export function parseDocTest(sourceText: string, sourcePath: string): DocPage {
  const file = ts.createSourceFile(sourcePath, sourceText, ts.ScriptTarget.Latest, true);
  const context: ParseContext = {
    file,
    sourcePath,
    lines: sourceText.split('\n'),
    imports: collectImports(file),
  };

  const describes = file.statements.filter((statement) => testCallName(statement) !== undefined);
  const [describeStatement, ...extra] = describes;
  if (describeStatement === undefined || extra.length > 0) {
    throw fail(
      context,
      extra[0] ?? file,
      'A doc test file needs exactly one top-level describe().',
    );
  }
  const describe = parseTestCall(context, describeStatement, 'describe');

  const describeLine = file.getLineAndCharacterOfPosition(describeStatement.getStart()).line;
  return {
    title: describe.title,
    intro: leadingJsDoc(context, file.statements[0]),
    setup: extractSamples(context, file, 0, describeLine - 1, false),
    sections: describe.body.statements
      .filter((statement) => testCallName(statement) !== undefined)
      .map((statement) => parseSection(context, statement)),
  };
}

function parseSection(context: ParseContext, statement: ts.Statement): DocSection {
  const call = parseTestCall(context, statement, 'it');
  return {
    title: call.title,
    prose: leadingJsDoc(context, statement),
    samples: extractBodySamples(context, call.body),
  };
}

/** The callee name when `statement` is a call to describe, it, or test, in any form. */
function testCallName(statement: ts.Statement): string | undefined {
  if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) {
    return undefined;
  }
  let callee: ts.Expression = statement.expression.expression;
  // Unwrap `it.skip(...)`, `it.each(...)(...)`, and similar to find the base name.
  while (ts.isPropertyAccessExpression(callee) || ts.isCallExpression(callee)) {
    callee = callee.expression;
  }
  return ts.isIdentifier(callee) && ['describe', 'it', 'test'].includes(callee.text)
    ? callee.text
    : undefined;
}

interface TestCall {
  readonly title: string;
  readonly body: ts.Block;
}

function parseTestCall(
  context: ParseContext,
  statement: ts.Statement,
  expected: 'describe' | 'it',
): TestCall {
  const name = testCallName(statement);
  const expression = (statement as ts.ExpressionStatement).expression as ts.CallExpression;
  const accepted = expected === 'describe' ? ['describe'] : ['it', 'test'];

  if (name === undefined || !accepted.includes(name)) {
    throw fail(context, statement, `Expected ${accepted.join('() or ')}() here.`);
  }
  if (!ts.isIdentifier(expression.expression)) {
    throw fail(
      context,
      statement,
      `Doc tests use plain ${name}(). Modifiers such as .each, .skip, or .only cannot render as a page.`,
    );
  }

  const [titleArg, bodyArg] = expression.arguments;
  if (titleArg === undefined || !ts.isStringLiteralLike(titleArg)) {
    throw fail(context, statement, `The first argument of ${name}() must be a string literal.`);
  }
  if (
    bodyArg === undefined ||
    !(ts.isArrowFunction(bodyArg) || ts.isFunctionExpression(bodyArg)) ||
    !ts.isBlock(bodyArg.body)
  ) {
    throw fail(
      context,
      statement,
      `The second argument of ${name}() must be a function with a block body.`,
    );
  }
  return { title: titleArg.text, body: bodyArg.body };
}

/** Renders the markdown inside the last JSDoc block (`/** ... *\/`) that precedes `node`. */
function leadingJsDoc(context: ParseContext, node: ts.Node | undefined): string {
  if (node === undefined) {
    return '';
  }
  const text = context.file.text;
  const ranges = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [];
  const jsDocs = ranges.filter(
    (range) =>
      range.kind === ts.SyntaxKind.MultiLineCommentTrivia &&
      text.startsWith('/**', range.pos) &&
      !text.startsWith('/**/', range.pos),
  );
  const last = jsDocs.at(-1);
  return last === undefined ? '' : jsDocToMarkdown(text.slice(last.pos, last.end));
}

function jsDocToMarkdown(comment: string): string {
  const body = comment.slice('/**'.length, -'*/'.length);
  const lines = body.split('\n').map((line) => {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith('*')) {
      return trimmed;
    }
    const afterStar = trimmed.slice(1);
    return afterStar.startsWith(' ') ? afterStar.slice(1) : afterStar;
  });
  return trimBlankLines(lines).join('\n').trimEnd();
}

/** One sample per region in a test body, else the whole body. */
function extractBodySamples(context: ParseContext, body: ts.Block): CodeSample[] {
  const { file } = context;
  const firstLine = file.getLineAndCharacterOfPosition(body.getStart()).line + 1;
  const lastLine = file.getLineAndCharacterOfPosition(body.getEnd()).line - 1;
  return extractSamples(context, body, firstLine, lastLine, true);
}

/**
 * One sample per `// #region name` ... `// #endregion name` pair between `firstLine` and
 * `lastLine`. With no regions, the whole range is one sample when `wholeRangeFallback`
 * is set, else there are no samples.
 */
function extractSamples(
  context: ParseContext,
  scope: ts.Node,
  firstLine: number,
  lastLine: number,
  wholeRangeFallback: boolean,
): CodeSample[] {
  const { file, lines } = context;

  const ranges: { start: number; end: number }[] = [];
  let openAt: number | undefined;
  for (let line = firstLine; line <= lastLine; line++) {
    const marker = (lines[line] ?? '').trim();
    if (marker.startsWith('// #region')) {
      if (openAt !== undefined) {
        throw fail(context, line, 'Regions cannot nest. Close the previous #region first.');
      }
      openAt = line;
    } else if (marker.startsWith('// #endregion')) {
      if (openAt === undefined) {
        throw fail(context, line, 'Found #endregion without a matching #region.');
      }
      ranges.push({ start: openAt + 1, end: line - 1 });
      openAt = undefined;
    }
  }
  if (openAt !== undefined) {
    throw fail(context, openAt, 'Found #region without a matching #endregion.');
  }
  if (ranges.length === 0 && wholeRangeFallback) {
    ranges.push({ start: firstLine, end: lastLine });
  }

  return ranges.map(({ start, end }) => {
    const code = dedent(trimBlankLines(lines.slice(start, end + 1)));
    if (code.length === 0) {
      throw fail(context, start, 'A doc sample cannot be empty.');
    }
    const used = identifiersBetween(file, scope, start, end);
    return { imports: renderImports(context, used, start), code: code.join('\n') };
  });
}

function identifiersBetween(
  file: ts.SourceFile,
  scope: ts.Node,
  startLine: number,
  endLine: number,
): Set<string> {
  const startPos = file.getPositionOfLineAndCharacter(startLine, 0);
  const endPos = file.getLineEndOfPosition(file.getPositionOfLineAndCharacter(endLine, 0));
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (node.getEnd() < startPos || node.getStart() > endPos) {
      return;
    }
    if (ts.isIdentifier(node) && node.getStart() >= startPos && node.getEnd() <= endPos) {
      names.add(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(scope);
  return names;
}

function collectImports(file: ts.SourceFile): ImportBinding[] {
  const bindings: ImportBinding[] = [];
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    const moduleSpecifier = statement.moduleSpecifier.text;
    const clause = statement.importClause;
    if (clause === undefined) {
      continue;
    }
    if (clause.name !== undefined) {
      bindings.push({
        localName: clause.name.text,
        importedName: 'default',
        moduleSpecifier,
        isTypeOnly: clause.phaseModifier === ts.SyntaxKind.TypeKeyword,
        isDefault: true,
      });
    }
    if (clause.namedBindings !== undefined && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        bindings.push({
          localName: element.name.text,
          importedName: (element.propertyName ?? element.name).text,
          moduleSpecifier,
          isTypeOnly: clause.phaseModifier === ts.SyntaxKind.TypeKeyword || element.isTypeOnly,
          isDefault: false,
        });
      }
    }
  }
  return bindings;
}

function renderImports(context: ParseContext, used: ReadonlySet<string>, line: number): string[] {
  const byModule = new Map<string, ImportBinding[]>();
  for (const binding of context.imports) {
    if (!used.has(binding.localName) || TEST_FRAMEWORK_MODULES.has(binding.moduleSpecifier)) {
      continue;
    }
    if (binding.moduleSpecifier.startsWith('.')) {
      throw fail(
        context,
        line,
        `The sample uses ${binding.localName} from the relative module '${binding.moduleSpecifier}'. ` +
          'Readers cannot import test helpers, so define it inside the sample or import it from a package.',
      );
    }
    const group = byModule.get(binding.moduleSpecifier) ?? [];
    group.push(binding);
    byModule.set(binding.moduleSpecifier, group);
  }

  return [...byModule].map(([moduleSpecifier, bindings]) => {
    const defaultBinding = bindings.find((binding) => binding.isDefault);
    const named = bindings
      .filter((binding) => !binding.isDefault)
      .map((binding) => {
        const name =
          binding.importedName === binding.localName
            ? binding.localName
            : `${binding.importedName} as ${binding.localName}`;
        return binding.isTypeOnly ? `type ${name}` : name;
      });
    const parts = [
      ...(defaultBinding === undefined ? [] : [defaultBinding.localName]),
      ...(named.length === 0 ? [] : [`{ ${named.join(', ')} }`]),
    ];
    return `import ${parts.join(', ')} from '${moduleSpecifier}';`;
  });
}

function trimBlankLines(lines: readonly string[]): string[] {
  const isBlank = (line: string | undefined): boolean => line === undefined || line.trim() === '';
  let start = 0;
  let end = lines.length;
  while (start < end && isBlank(lines[start])) {
    start++;
  }
  while (end > start && isBlank(lines[end - 1])) {
    end--;
  }
  return lines.slice(start, end);
}

function dedent(lines: readonly string[]): string[] {
  const indents = lines
    .filter((line) => line.trim() !== '')
    .map((line) => line.length - line.trimStart().length);
  const strip = indents.length === 0 ? 0 : Math.min(...indents);
  return lines.map((line) => line.slice(strip).trimEnd());
}

function fail(context: ParseContext, at: ts.Node | number, message: string): DocTestSyntaxError {
  const { line, character } =
    typeof at === 'number'
      ? { line: at, character: 0 }
      : context.file.getLineAndCharacterOfPosition(at.getStart(context.file));
  return new DocTestSyntaxError(context.sourcePath, line, character, message);
}
