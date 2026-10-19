import { AstBuilder, Errors, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator, type Step } from '@cucumber/messages';

import { DocTestSyntaxError } from './errors.ts';
import type { FeaturePage, FeatureScenario, FeatureStep } from './types.ts';

/**
 * Parses a Gherkin `.feature` file with the official Cucumber parser. Any syntax error, or
 * a construct the specification pages cannot render yet (a `Rule` block), throws with
 * `file:line:column`, so a malformed feature fails `just generate`.
 *
 * @throws {DocTestSyntaxError} when the file is not valid Gherkin or uses a `Rule` block.
 */
export function parseFeature(sourceText: string, sourcePath: string): FeaturePage {
  const parser = new Parser(
    new AstBuilder(IdGenerator.incrementing()),
    new GherkinClassicTokenMatcher(),
  );
  let document: ReturnType<Parser<unknown>['parse']>;
  try {
    document = parser.parse(sourceText);
  } catch (error: unknown) {
    throw toSyntaxError(error, sourcePath);
  }

  const { feature } = document;
  if (feature === undefined) {
    throw new DocTestSyntaxError(sourcePath, 0, 0, 'A feature file needs a `Feature:` line.');
  }

  const background: FeatureStep[] = [];
  const scenarios: FeatureScenario[] = [];
  for (const child of feature.children) {
    if (child.rule !== undefined) {
      const { line, column = 1 } = child.rule.location;
      throw new DocTestSyntaxError(
        sourcePath,
        line - 1,
        column - 1,
        '`Rule` blocks are not supported. Split the rule into its own feature file.',
      );
    }
    if (child.background !== undefined) {
      background.push(...child.background.steps.map(toStep));
    }
    if (child.scenario !== undefined) {
      const scenario = child.scenario;
      scenarios.push({
        title: scenario.name,
        description: dedent(scenario.description),
        tags: scenario.tags.map((tag) => tag.name.replace(/^@/, '')),
        line: scenario.location.line,
        steps: scenario.steps.map(toStep),
        examples: scenario.examples.map((examples) => ({
          title: examples.name,
          header: examples.tableHeader?.cells.map((cell) => cell.value) ?? [],
          rows: examples.tableBody.map((row) => row.cells.map((cell) => cell.value)),
        })),
      });
    }
  }

  return {
    title: feature.name,
    description: dedent(feature.description),
    tags: feature.tags.map((tag) => tag.name.replace(/^@/, '')),
    background,
    scenarios,
  };
}

function toStep(step: Step): FeatureStep {
  return {
    keyword: step.keyword.trim(),
    text: step.text,
    docString: step.docString?.content,
    table: step.dataTable?.rows.map((row) => row.cells.map((cell) => cell.value)) ?? [],
  };
}

/** Gherkin keeps description indentation. Markdown would render it as a code block. */
function dedent(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

function toSyntaxError(error: unknown, sourcePath: string): Error {
  if (!(error instanceof Errors.GherkinException)) {
    return error instanceof Error ? error : new Error(String(error));
  }
  // The declared types promise `errors` and `location`, but the parser only sets `errors`
  // on composite exceptions and leaves `location` unset when it has none, so both are read
  // as unknown. A composite wraps one exception per problem. The first one is reported.
  const errors: unknown = Reflect.get(error, 'errors');
  const first: unknown = Array.isArray(errors) ? errors[0] : undefined;
  const located = first instanceof Error ? first : error;
  const { line, column } = locationOf(located);
  const message = located.message.replace(/^\(-?\d+:-?\d+\):\s*/, '');
  return new DocTestSyntaxError(sourcePath, line - 1, column - 1, message);
}

function locationOf(error: Error): { line: number; column: number } {
  const location: unknown = Reflect.get(error, 'location');
  if (typeof location !== 'object' || location === null) {
    return { line: 1, column: 1 };
  }
  const line: unknown = Reflect.get(location, 'line');
  const column: unknown = Reflect.get(location, 'column');
  return {
    line: typeof line === 'number' && line > 0 ? line : 1,
    column: typeof column === 'number' && column > 0 ? column : 1,
  };
}
