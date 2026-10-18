import { describe, expect, it } from 'vitest';

import { effectiveBump, requiredBump, satisfiesBump } from '../../src/semver.js';

describe('requiredBump', () => {
  it('returns the largest bump regardless of order', () => {
    expect(
      requiredBump([
        { bump: 'patch', message: 'fixed' },
        { bump: 'major', message: 'removed' },
        { bump: 'minor', message: 'added' },
      ]),
    ).toBe('major');
  });

  it('returns none when there are no reasons', () => {
    expect(requiredBump([])).toBe('none');
  });

  it('takes the largest bump among reasons', () => {
    expect(
      requiredBump([
        { bump: 'minor', message: 'added' },
        { bump: 'patch', message: 'fixed' },
      ]),
    ).toBe('minor');
  });
});

describe('effectiveBump', () => {
  it('maps a breaking change before 1.0.0 to minor', () => {
    expect(effectiveBump('major', '0.4.2')).toBe('minor');
  });

  it('keeps major from 1.0.0 on', () => {
    expect(effectiveBump('major', '1.0.0')).toBe('major');
  });

  it('leaves non-breaking bumps alone before 1.0.0', () => {
    expect(effectiveBump('patch', '0.1.0')).toBe('patch');
  });
});

describe('satisfiesBump', () => {
  it.each([
    ['major', 'minor', true],
    ['minor', 'minor', true],
    ['patch', 'minor', false],
    ['none', 'none', true],
    ['none', 'patch', false],
  ] as const)('planned %s covers required %s: %s', (planned, required, expected) => {
    expect(satisfiesBump(planned, required)).toBe(expected);
  });
});
