import { describe, expect, it } from 'vitest';

import { DocTestSyntaxError } from '../../src/errors.ts';
import { parseFeature } from '../../src/parse-feature.ts';

const FEATURE = `@REQ-100
Feature: Greet people
    Greets a person by name.
    Second line.

  Background:
    Given a greeter

  @REQ-001 @smoke
  Scenario: Greet by name
    Says hello first.
    When I greet "Ada"
    Then the greeting is:
      """
      Hello, Ada
      """

  Scenario Outline: Greet in a language
    When I greet "<name>" in <language>
    Then the table reads:
      | name | greeting |
      | Ada  | Hola     |

    Examples: Spanish
      | name | language |
      | Ada  | es       |
`;

describe('parseFeature', () => {
  it('reads the title, dedented description, tags, background, and scenarios', () => {
    const page = parseFeature(FEATURE, 'features/greet.feature');

    expect(page.title).toBe('Greet people');
    expect(page.description).toBe('Greets a person by name.\nSecond line.');
    expect(page.tags).toEqual(['REQ-100']);
    expect(page.background).toEqual([
      { keyword: 'Given', text: 'a greeter', docString: undefined, table: [] },
    ]);
    expect(page.scenarios.map((scenario) => scenario.title)).toEqual([
      'Greet by name',
      'Greet in a language',
    ]);
  });

  it('keeps scenario tags, line, description, and step arguments', () => {
    const [byName] = parseFeature(FEATURE, 'features/greet.feature').scenarios;

    expect(byName).toMatchObject({
      tags: ['REQ-001', 'smoke'],
      line: 10,
      description: 'Says hello first.',
    });
    expect(byName?.steps[1]).toEqual({
      keyword: 'Then',
      text: 'the greeting is:',
      docString: 'Hello, Ada',
      table: [],
    });
  });

  it('keeps data tables and outline examples', () => {
    const [, outline] = parseFeature(FEATURE, 'features/greet.feature').scenarios;

    expect(outline?.steps[1]?.table).toEqual([
      ['name', 'greeting'],
      ['Ada', 'Hola'],
    ]);
    expect(outline?.examples).toEqual([
      { title: 'Spanish', header: ['name', 'language'], rows: [['Ada', 'es']] },
    ]);
  });

  it('reports a syntax error with its file, line, and column', () => {
    const parse = (): unknown =>
      parseFeature('Feature: Broken\n  Scenario: One\n    Given a\n  Nonsense here\n', 'f.feature');

    expect(parse).toThrow(DocTestSyntaxError);
    expect(parse).toThrow(/^f\.feature:4:3: /);
  });

  it('rejects a file with no Feature line', () => {
    expect(() => parseFeature('# only a comment\n', 'empty.feature')).toThrow(
      'empty.feature:1:1: A feature file needs a `Feature:` line.',
    );
  });

  it('rejects Rule blocks, which the pages cannot render', () => {
    const source = 'Feature: F\n  Rule: R\n    Scenario: S\n      Given a\n';

    expect(() => parseFeature(source, 'rule.feature')).toThrow(/^rule\.feature:2:3: `Rule` blocks/);
  });
});
