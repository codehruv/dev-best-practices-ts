import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadCatalog, SloSpecError, type SpecIssue } from '../../src/index.js';
import {
  loadOneSlo,
  makeAlertCondition,
  makeAlertPolicy,
  makeBenchSli,
  makeBenchSpec,
  makeNotificationTarget,
  makeObjective,
  makeService,
  makeSlo,
  toYaml,
  validBenchDocs,
} from './fakes.js';

/** Loads the documents and returns every issue, failing the test when loading succeeds. */
function issuesFor(...docs: readonly Record<string, unknown>[]): SpecIssue[] {
  try {
    loadCatalog([{ source: 'test.openslo.yaml', text: toYaml(...docs) }]);
  } catch (error: unknown) {
    if (error instanceof SloSpecError) {
      return [...error.issues];
    }
    throw error;
  }
  throw new Error('expected the spec to be rejected');
}

function messagesFor(...docs: readonly Record<string, unknown>[]): string[] {
  return issuesFor(...docs).map((issue) => `${issue.object} ${issue.path}: ${issue.message}`);
}

describe('the committed spec files', () => {
  const specDir = join(import.meta.dirname, '../../../../slo');
  const files = readdirSync(specDir)
    .filter((name) => name.endsWith('.openslo.yaml'))
    .map((name) => ({ source: name, text: readFileSync(join(specDir, name), 'utf8') }));

  it('exist', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('validate, including every reference and repo rule', () => {
    expect(() => loadCatalog(files)).not.toThrow();
  });
});

describe('loadCatalog', () => {
  it('resolves a benchmark-backed SLO with its source and objectives', () => {
    const slo = loadOneSlo(...validBenchDocs());

    expect(slo).toMatchObject({
      name: 'bench-slo',
      service: 'svc',
      indicatorName: 'bench-sli',
      timeWindow: '1d rolling',
      regressionThreshold: 0.2,
      benchmark: makeBenchSpec(),
      objectives: [{ index: 0, displayName: 'p99', target: 0.99, op: 'lte', value: 100 }],
    });
  });

  it('accepts an inline indicator instead of a reference', () => {
    const inline = makeSlo({
      spec: {
        indicatorRef: undefined,
        indicator: { metadata: { name: 'inline' }, spec: makeBenchSli()['spec'] },
      },
    });

    expect(loadOneSlo(makeService(), inline).indicatorName).toBe('inline');
  });

  it('normalizes targetPercent to a fraction', () => {
    const slo = makeSlo({
      spec: { objectives: [makeObjective({ target: undefined, targetPercent: 99.5 })] },
    });

    expect(loadOneSlo(makeService(), makeBenchSli(), slo).objectives[0]?.target).toBeCloseTo(0.995);
  });

  it('names unnamed objectives by position', () => {
    const slo = makeSlo({ spec: { objectives: [makeObjective({ displayName: undefined })] } });

    expect(loadOneSlo(makeService(), makeBenchSli(), slo).objectives[0]?.displayName).toBe(
      'objective 1',
    );
  });

  it('reads the regression threshold annotation', () => {
    const slo = makeSlo({
      metadata: { annotations: { 'dev-best-practices/regression-threshold': '0.35' } },
    });

    expect(loadOneSlo(makeService(), makeBenchSli(), slo).regressionThreshold).toBe(0.35);
  });

  it('leaves the benchmark unset for SLIs measured by monitoring', () => {
    const sli = {
      apiVersion: 'openslo/v1',
      kind: 'SLI',
      metadata: { name: 'bench-sli' },
      spec: { thresholdMetric: { metricSource: { type: 'Prometheus', spec: { query: 'up' } } } },
    };

    expect(loadOneSlo(makeService(), sli, makeSlo()).benchmark).toBeUndefined();
  });

  it('skips empty documents', () => {
    const text = `---\n${toYaml(...validBenchDocs())}\n---\n`;

    expect(loadCatalog([{ source: 'x.openslo.yaml', text }]).slos).toHaveLength(1);
  });
});

describe('schema validation', () => {
  it('reports YAML syntax errors with the document position', () => {
    const issues = (() => {
      try {
        loadCatalog([{ source: 'broken.openslo.yaml', text: 'kind: [unclosed' }]);
      } catch (error: unknown) {
        return error instanceof SloSpecError ? error.issues : [];
      }
      return [];
    })();

    expect(issues[0]).toMatchObject({ source: 'broken.openslo.yaml', object: 'document 1' });
  });

  it('rejects fields the subset does not define', () => {
    const service = { ...makeService(), spec: { description: 'x', owner: 'me' } };

    expect(messagesFor(service)).toEqual([
      expect.stringMatching(/^Service\/svc spec: Unrecognized key: "owner"/),
    ]);
  });

  it('rejects names that are not RFC 1123 labels', () => {
    expect(messagesFor(makeService('Not_Valid'))).toEqual([
      expect.stringContaining('metadata.name: must be an RFC 1123 label'),
    ]);
  });

  it('rejects durations that are not OpenSLO shorthand', () => {
    const slo = makeSlo({ spec: { timeWindow: [{ duration: '28 days', isRolling: true }] } });

    expect(messagesFor(makeService(), makeBenchSli(), slo)).toEqual([
      expect.stringContaining('spec.timeWindow.0.duration: must be a duration shorthand'),
    ]);
  });

  it('requires a calendar exactly when the window is not rolling', () => {
    const slo = makeSlo({ spec: { timeWindow: [{ duration: '1M', isRolling: false }] } });

    expect(messagesFor(makeService(), makeBenchSli(), slo)).toEqual([
      expect.stringContaining('"calendar" must be set when "isRolling" is false'),
    ]);
  });

  it('requires exactly one of target and targetPercent', () => {
    const slo = makeSlo({ spec: { objectives: [makeObjective({ targetPercent: 99 })] } });

    expect(messagesFor(makeService(), makeBenchSli(), slo)).toEqual([
      expect.stringContaining('exactly one of "target" and "targetPercent"'),
    ]);
  });

  it('rejects a target of 1, which leaves no error budget', () => {
    const slo = makeSlo({ spec: { objectives: [makeObjective({ target: 1 })] } });

    expect(messagesFor(makeService(), makeBenchSli(), slo)).toEqual([
      expect.stringContaining('spec.objectives.0.target'),
    ]);
  });

  it('rejects an unknown kind', () => {
    expect(
      messagesFor({ apiVersion: 'openslo/v1', kind: 'DataSource', metadata: { name: 'x' } }),
    ).toEqual([expect.stringContaining('DataSource/x kind')]);
  });
});

describe('reference checks', () => {
  it('reports a missing service', () => {
    expect(messagesFor(makeBenchSli(), makeSlo())).toEqual([
      'SLO/bench-slo spec.service: references Service "svc", which is not defined',
    ]);
  });

  it('reports a dangling indicatorRef', () => {
    expect(messagesFor(makeService(), makeSlo())).toEqual([
      'SLO/bench-slo spec.indicatorRef: references SLI "bench-sli", which is not defined',
    ]);
  });

  it('reports duplicate names within a kind', () => {
    expect(messagesFor(makeService(), makeService(), makeBenchSli(), makeSlo())).toEqual([
      'Service/svc metadata.name: duplicates the Service defined in test.openslo.yaml',
    ]);
  });

  it('allows the same name across kinds', () => {
    expect(() =>
      loadOneSlo(
        makeService('same'),
        makeBenchSli('same'),
        makeSlo({ spec: { service: 'same', indicatorRef: 'same' } }),
      ),
    ).not.toThrow();
  });

  it('reports dangling alert policy, condition, and target references', () => {
    const slo = makeSlo({
      spec: { alertPolicies: [{ alertPolicyRef: 'missing-policy' }, { alertPolicyRef: 'policy' }] },
    });

    expect(
      messagesFor(
        ...validBenchDocs().slice(0, 2),
        slo,
        makeAlertPolicy('policy', 'missing-condition', 'missing-target'),
      ),
    ).toEqual([
      'SLO/bench-slo spec.alertPolicies.0: references AlertPolicy "missing-policy", which is not defined',
      'SLO/bench-slo spec.alertPolicies.1: references AlertNotificationTarget "missing-target", which is not defined',
      'SLO/bench-slo spec.alertPolicies.1: references AlertCondition "missing-condition", which is not defined',
    ]);
  });

  it('collects issues from every file before failing', () => {
    try {
      loadCatalog([
        { source: 'a.openslo.yaml', text: toYaml(makeSlo({ metadata: { name: 'a' } })) },
        { source: 'b.openslo.yaml', text: toYaml(makeSlo({ metadata: { name: 'b' } })) },
      ]);
      expect.unreachable();
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(SloSpecError);
      const sources = (error as SloSpecError).issues.map((issue) => issue.source);
      expect(new Set(sources)).toEqual(new Set(['a.openslo.yaml', 'b.openslo.yaml']));
    }
  });
});

describe('objective rules', () => {
  it('requires op and value for a threshold indicator', () => {
    const slo = makeSlo({ spec: { objectives: [{ target: 0.99 }] } });

    expect(messagesFor(makeService(), makeBenchSli(), slo)).toEqual([
      'SLO/bench-slo spec.objectives.0: a threshold indicator needs "op" and "value"',
    ]);
  });

  it('forbids op and value for a ratio indicator', () => {
    const ratio = {
      apiVersion: 'openslo/v1',
      kind: 'SLI',
      metadata: { name: 'bench-sli' },
      spec: {
        ratioMetric: {
          counter: true,
          good: { metricSource: { type: 'Prometheus', spec: {} } },
          total: { metricSource: { type: 'Prometheus', spec: {} } },
        },
      },
    };

    expect(messagesFor(makeService(), ratio, makeSlo())).toEqual([
      'SLO/bench-slo spec.objectives.0: a ratio indicator does not take "op" or "value"',
    ]);
  });

  it.each([
    {
      method: 'Timeslices',
      objective: {},
      expected: ['"timeSliceWindow" is required', '"timeSliceTarget" is required'],
    },
    { method: 'RatioTimeslices', objective: {}, expected: ['"timeSliceWindow" is required'] },
    {
      method: 'Occurrences',
      objective: { timeSliceWindow: '1m', timeSliceTarget: 0.9 },
      expected: ['"timeSliceWindow" is not allowed', '"timeSliceTarget" is not allowed'],
    },
  ])('enforces time-slice fields for $method', ({ method, objective, expected }) => {
    const slo = makeSlo({
      spec: { budgetingMethod: method, objectives: [makeObjective(objective)] },
    });

    expect(messagesFor(makeService(), makeBenchSli(), slo)).toEqual(
      expected.map((text) => expect.stringContaining(text) as unknown),
    );
  });

  it('rejects an invalid regression threshold annotation', () => {
    const slo = makeSlo({
      metadata: { annotations: { 'dev-best-practices/regression-threshold': 'lots' } },
    });

    expect(messagesFor(makeService(), makeBenchSli(), slo)).toEqual([
      expect.stringContaining('must be a number greater than 0, got "lots"'),
    ]);
  });
});

describe('benchmark sources', () => {
  it('validates the vitest-bench source spec', () => {
    const sli = makeBenchSli('bench-sli', makeBenchSpec({ batchSize: 0, unit: 'seconds' }));

    expect(messagesFor(makeService(), sli, makeSlo())).toEqual([
      expect.stringContaining('metricSource.spec.batchSize'),
      expect.stringContaining('metricSource.spec.unit'),
    ]);
  });

  it.each([
    { unit: 'ns', op: 'gte' },
    { unit: 'ops/s', op: 'lte' },
  ])('rejects op $op for a $unit benchmark, which would reward getting slower', ({ unit, op }) => {
    const sli = makeBenchSli('bench-sli', makeBenchSpec({ unit }));
    const slo = makeSlo({ spec: { objectives: [makeObjective({ op })] } });

    expect(messagesFor(makeService(), sli, slo)).toEqual([expect.stringContaining(`got "${op}"`)]);
  });

  it('rejects a zero threshold', () => {
    const slo = makeSlo({ spec: { objectives: [makeObjective({ value: 0 })] } });

    expect(messagesFor(makeService(), makeBenchSli(), slo)).toEqual([
      'SLO/bench-slo spec.objectives.0.value: must be greater than 0 for a benchmark',
    ]);
  });

  it('rejects benchmark sources on ratio indicators', () => {
    const ratio = {
      apiVersion: 'openslo/v1',
      kind: 'SLI',
      metadata: { name: 'bench-sli' },
      spec: {
        ratioMetric: {
          counter: false,
          good: { metricSource: { type: 'vitest-bench', spec: {} } },
          total: { metricSource: { type: 'vitest-bench', spec: {} } },
        },
      },
    };
    const slo = makeSlo({ spec: { objectives: [{ target: 0.99 }] } });

    expect(messagesFor(makeService(), ratio, slo)).toEqual([
      expect.stringContaining('only support thresholdMetric indicators'),
    ]);
  });
});

describe('burn-rate alert conditions', () => {
  const alerting = (condition: Record<string, unknown>): Record<string, unknown>[] => [
    ...validBenchDocs().slice(0, 2),
    makeSlo({ spec: { alertPolicies: [{ alertPolicyRef: 'policy' }] } }),
    makeAlertPolicy('policy', 'burn'),
    makeNotificationTarget(),
    condition,
  ];

  it('resolves a long and short window pair', () => {
    const slo = loadOneSlo(...alerting(makeAlertCondition('burn', '1h', '5m')));

    expect(slo.alertConditions).toEqual([
      {
        policy: 'policy',
        name: 'burn',
        severity: 'page',
        burnRate: 14.4,
        longWindow: '1h',
        shortWindow: '5m',
      },
    ]);
  });

  it('accepts inline policies and conditions', () => {
    const condition = makeAlertCondition('burn', '6h', '30m');
    const slo = makeSlo({
      spec: {
        alertPolicies: [
          {
            kind: 'AlertPolicy',
            metadata: { name: 'inline-policy' },
            spec: {
              conditions: [
                {
                  kind: 'AlertCondition',
                  metadata: condition['metadata'],
                  spec: condition['spec'],
                },
              ],
              notificationTargets: [
                { kind: 'AlertNotificationTarget', metadata: { name: 't' }, spec: { target: 'x' } },
              ],
            },
          },
        ],
      },
    });

    expect(loadOneSlo(...validBenchDocs().slice(0, 2), slo).alertConditions[0]).toMatchObject({
      policy: 'inline-policy',
      longWindow: '6h',
      shortWindow: '30m',
    });
  });

  it('requires the short-window annotation', () => {
    expect(messagesFor(...alerting(makeAlertCondition('burn', '1h')))).toEqual([
      expect.stringContaining('needs the "dev-best-practices/short-window" annotation'),
    ]);
  });

  it('requires the short window to be 1/12 of the long window', () => {
    expect(messagesFor(...alerting(makeAlertCondition('burn', '1h', '10m')))).toEqual([
      expect.stringContaining('short window "10m" must be exactly 1/12 of lookbackWindow "1h"'),
    ]);
  });

  it('requires a rising comparison', () => {
    const condition = makeAlertCondition('burn', '1h', '5m');
    const spec = condition['spec'] as { condition: Record<string, unknown> };
    spec.condition['op'] = 'lt';

    expect(messagesFor(...alerting(condition))).toEqual([
      expect.stringContaining('must fire when the burn rate rises ("gt" or "gte"), got "lt"'),
    ]);
  });

  it('allows only one condition per policy, as OpenSLO v1 does', () => {
    const policy = makeAlertPolicy('policy', 'burn');
    const spec = policy['spec'] as Record<string, unknown>;
    spec['conditions'] = [{ conditionRef: 'burn' }, { conditionRef: 'burn' }];

    expect(
      messagesFor(
        ...alerting(makeAlertCondition('burn', '1h', '5m')).filter(
          (doc) => doc['kind'] !== 'AlertPolicy',
        ),
        policy,
      ),
    ).toEqual([expect.stringContaining('spec.conditions')]);
  });
});
