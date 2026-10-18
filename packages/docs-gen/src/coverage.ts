import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

import ts from 'typescript';

/** Where the coverage check looks, relative to the package root. */
const ENTRY_POINT = 'src/index.ts';
const PAGE_TEST_DIRS = ['tests/docs/tutorials', 'tests/docs/how-to'];
const DOC_TEST_ROOT = 'tests/docs';

/** Export coverage of one package. Coverage passes when both lists are empty. */
export interface CoverageReport {
  /** Every name the package entry point exports. */
  readonly exports: readonly string[];
  /** Exports that no tutorial or how-to imports and that have no tested `@example`. */
  readonly undocumented: readonly string[];
  /** `@includeCode` targets that do not resolve to a region of a doc test. */
  readonly brokenExamples: readonly string[];
}

/**
 * Checks that every export of a package is documented by executable code: either a
 * tutorial or how-to doc test imports it, or its TSDoc has an `@example` that includes a
 * region of a doc test with `{@includeCode path#region}`. Prose alone never counts,
 * because prose cannot fail when behavior changes.
 *
 * @param packageDir The package root, holding `tsconfig.json`, `package.json`, and `src/index.ts`.
 */
export function checkDocCoverage(packageDir: string): CoverageReport {
  const root = resolve(packageDir);
  const packageName = readPackageName(root);
  const program = createProgram(root);
  const checker = program.getTypeChecker();

  const entry = program.getSourceFile(join(root, ENTRY_POINT));
  const moduleSymbol = entry === undefined ? undefined : checker.getSymbolAtLocation(entry);
  if (moduleSymbol === undefined) {
    throw new Error(`${join(root, ENTRY_POINT)} is missing or exports nothing.`);
  }
  const exported = checker.getExportsOfModule(moduleSymbol);

  const imported = importedFromDocTests(program, root, packageName);
  const brokenExamples: string[] = [];
  const undocumented: string[] = [];

  for (const symbol of exported) {
    const name = symbol.getName();
    const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    const includes = (target.getDeclarations() ?? []).flatMap((declaration) =>
      exampleIncludes(declaration).map((include) => ({ include, declaration })),
    );
    let hasTestedExample = false;
    for (const { include, declaration } of includes) {
      const problem = checkInclude(root, declaration.getSourceFile().fileName, include);
      if (problem === undefined) {
        hasTestedExample = true;
      } else {
        brokenExamples.push(`${name}: ${problem}`);
      }
    }
    if (!imported.has(name) && !hasTestedExample) {
      undocumented.push(name);
    }
  }

  return {
    exports: exported.map((symbol) => symbol.getName()).sort(),
    undocumented: undocumented.sort(),
    brokenExamples: brokenExamples.sort(),
  };
}

function readPackageName(root: string): string {
  const manifest: unknown = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    !('name' in manifest) ||
    typeof manifest.name !== 'string'
  ) {
    throw new Error(`${join(root, 'package.json')} has no "name".`);
  }
  return manifest.name;
}

function createProgram(root: string): ts.Program {
  const configPath = join(root, 'tsconfig.json');
  const config = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      },
    },
  );
  if (config === undefined) {
    throw new Error(`Could not read ${configPath}.`);
  }
  return ts.createProgram(config.fileNames, config.options);
}

/** Names that tutorial and how-to doc tests import from the package by its published name. */
function importedFromDocTests(program: ts.Program, root: string, packageName: string): Set<string> {
  const names = new Set<string>();
  const pageDirs = PAGE_TEST_DIRS.map((dir) => join(root, dir) + sep);
  for (const file of program.getSourceFiles()) {
    if (!pageDirs.some((dir) => resolve(file.fileName).startsWith(dir))) {
      continue;
    }
    for (const statement of file.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        statement.moduleSpecifier.text !== packageName
      ) {
        continue;
      }
      const bindings = statement.importClause?.namedBindings;
      if (bindings !== undefined && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          names.add((element.propertyName ?? element.name).text);
        }
      }
    }
  }
  return names;
}

/** The `path#region` targets of every `{@includeCode}` inside an `@example` tag. */
function exampleIncludes(declaration: ts.Declaration): string[] {
  return ts
    .getJSDocTags(declaration)
    .filter((tag) => tag.tagName.text === 'example')
    .flatMap((tag) => {
      // TypeScript only models {@link}-family inline tags, so {@includeCode} stays raw text.
      const text = ts.getTextOfJSDocComment(tag.comment) ?? '';
      return [...text.matchAll(/\{@includeCode\s+([^}\s]+)\s*\}/g)].map((match) => match[1] ?? '');
    });
}

/** Undefined when `include` names an existing region in a doc test, else the problem. */
function checkInclude(root: string, declaringFile: string, include: string): string | undefined {
  const [path = '', region] = include.split('#');
  if (region === undefined || region === '') {
    return `{@includeCode ${include}} must name a region (path#region), so the example is one tested snippet.`;
  }
  const target = resolve(dirname(declaringFile), path);
  if (!target.startsWith(join(root, DOC_TEST_ROOT) + sep)) {
    return `{@includeCode ${include}} must point into ${DOC_TEST_ROOT}/, where examples run as tests.`;
  }
  if (!existsSync(target)) {
    return `{@includeCode ${include}} points to a missing file.`;
  }
  const hasRegion = readFileSync(target, 'utf8')
    .split('\n')
    .some((line) => line.trim() === `// #region ${region}`);
  return hasRegion
    ? undefined
    : `{@includeCode ${include}} names a region that ${relative(root, target)} does not define.`;
}
