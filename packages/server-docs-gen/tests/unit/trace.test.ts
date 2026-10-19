import { describe, expect, it } from 'vitest';

import { traceRequirements } from '../../src/trace.ts';
import { makePackage } from './fixtures.ts';

const STEPS = "await loadFeature('../../features/greet.feature');\n";

function feature(scenarios: string, featureTags = ''): string {
  return `${featureTags}\nFeature: Greet\n\n${scenarios}`;
}

describe('traceRequirements', () => {
  it('maps each requirement to the scenarios that verify it, including feature tags', () => {
    const fixture = makePackage({
      'features/greet.feature': feature(
        '  @REQ-002\n  Scenario: One\n    Given a\n\n  @REQ-002 @REQ-010\n  Scenario: Two\n    Given b\n',
        '@REQ-001',
      ),
      'tests/features/greet.feature.test.ts': STEPS,
    });

    const report = traceRequirements(fixture.dir);

    expect(report.problems).toEqual([]);
    expect(report.requirements).toEqual({
      'REQ-001': ['features/greet.feature: One', 'features/greet.feature: Two'],
      'REQ-002': ['features/greet.feature: One', 'features/greet.feature: Two'],
      'REQ-010': ['features/greet.feature: Two'],
    });
  });

  it('reports untraced scenarios, bad and repeated tags, skips, and duplicate titles', () => {
    const fixture = makePackage({
      'features/greet.feature': feature(
        [
          '  Scenario: Untraced',
          '    Given a',
          '',
          '  @req-1 @REQ-003 @REQ-003',
          '  Scenario: Messy',
          '    Given b',
          '',
          '  @REQ-004 @ignore',
          '  Scenario: Messy',
          '    Given c',
          '',
        ].join('\n'),
      ),
      'tests/features/greet.feature.test.ts': STEPS,
    });

    expect(traceRequirements(fixture.dir).problems).toEqual([
      'features/greet.feature:4: scenario "Untraced" names no requirement. Tag it @REQ-NNN.',
      'features/greet.feature:8: tag @req-1 is not a requirement ID. Use @REQ- and three or more digits.',
      'features/greet.feature:8: tag @REQ-003 appears twice.',
      'features/greet.feature:12: another scenario is already titled "Messy".',
      'features/greet.feature:12: tag @ignore skips or focuses scenarios. Acceptance criteria always run.',
    ]);
  });

  it('reports a feature that no step definitions load', () => {
    const fixture = makePackage({
      'features/greet.feature': feature('  @REQ-001\n  Scenario: One\n    Given a\n'),
      'features/other.feature': feature('  @REQ-002\n  Scenario: Two\n    Given b\n'),
      'tests/features/greet.feature.test.ts': '// loads nothing\n',
    });

    expect(traceRequirements(fixture.dir).problems).toEqual([
      'tests/features/greet.feature.test.ts: does not load features/greet.feature.',
      'features/other.feature: no step definitions. Add tests/features/other.feature.test.ts.',
    ]);
  });

  it('reports a syntax error as a problem instead of throwing', () => {
    const fixture = makePackage({
      'features/greet.feature': 'Feature: Broken\n  Scenario: One\n    Given a\n  Nonsense here\n',
      'tests/features/greet.feature.test.ts': STEPS,
    });

    expect(traceRequirements(fixture.dir).problems).toEqual([
      expect.stringMatching(/^features\/greet\.feature:4:3: /),
    ]);
  });

  it('passes a package without features', () => {
    expect(traceRequirements(makePackage().dir)).toEqual({ requirements: {}, problems: [] });
  });
});
