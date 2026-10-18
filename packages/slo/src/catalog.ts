import { parseAllDocuments } from 'yaml';
import type { z } from 'zod';

import {
  allowedComparisons,
  type BenchmarkSource,
  BenchmarkSourceSchema,
  VITEST_BENCH_SOURCE_TYPE,
} from './benchmark-source.js';
import { durationToMinutes } from './duration.js';
import { SloSpecError, type SpecIssue } from './errors.js';
import {
  type AlertConditionSpec,
  type Comparison,
  type Metadata,
  type Objective,
  type OpenSloObject,
  OpenSloObjectSchema,
  type SliSpec,
  type Slo,
} from './openslo.js';

// ── Repo-specific annotations ─────────────────────────────────────────────

/**
 * The short window of a multi-window burn-rate alert. OpenSLO v1 allows one condition per
 * policy, so the long window is the condition's `lookbackWindow` and the short window
 * lives here. It must be exactly 1/12 of the long window (Google SRE Workbook, ch. 5).
 */
export const SHORT_WINDOW_ANNOTATION = 'dev-best-practices/short-window';

/** Fractional slowdown against the committed baseline that fails `slo check`. */
export const REGRESSION_THRESHOLD_ANNOTATION = 'dev-best-practices/regression-threshold';

/** Applies when an SLO sets no regression threshold: 20% slower than baseline fails. */
export const DEFAULT_REGRESSION_THRESHOLD = 0.2;

// ── Resolved model ────────────────────────────────────────────────────────

/** One SLO spec file to load. */
export interface SpecFile {
  readonly source: string;
  readonly text: string;
}

/** An objective with its target normalized to a fraction and its position recorded. */
export interface ResolvedObjective {
  /** Position in the SLO's `objectives` list, which identifies an unnamed objective. */
  readonly index: number;
  readonly displayName: string;
  readonly target: number;
  readonly op: Comparison | undefined;
  readonly value: number | undefined;
}

/** A burn-rate condition with both windows of its multi-window pair resolved. */
export interface ResolvedAlertCondition {
  readonly policy: string;
  readonly name: string;
  readonly severity: string;
  readonly burnRate: number;
  readonly longWindow: string;
  readonly shortWindow: string;
}

/** An SLO with every reference followed, ready to evaluate or render. */
export interface ResolvedSlo {
  readonly source: string;
  readonly name: string;
  readonly displayName: string;
  readonly service: string;
  readonly budgetingMethod: Slo['spec']['budgetingMethod'];
  readonly timeWindow: string;
  readonly indicatorName: string;
  readonly indicator: SliSpec;
  readonly objectives: readonly ResolvedObjective[];
  readonly alertConditions: readonly ResolvedAlertCondition[];
  /** Set when the indicator is measured by a Vitest benchmark. */
  readonly benchmark: BenchmarkSource | undefined;
  readonly regressionThreshold: number;
}

/** Every SLO across the loaded spec files. */
export interface SloCatalog {
  readonly slos: readonly ResolvedSlo[];
}

// ── Loading ───────────────────────────────────────────────────────────────

interface LocatedObject {
  readonly source: string;
  readonly object: OpenSloObject;
}

/**
 * Parses, validates, and cross-references OpenSLO YAML files. Schema validation alone
 * cannot catch a dangling `indicatorRef` or an objective that does not fit its indicator,
 * so this also checks references and the field rules that depend on other objects.
 *
 * @throws {SloSpecError} with every issue found across all files.
 */
export function loadCatalog(files: readonly SpecFile[]): SloCatalog {
  const issues: SpecIssue[] = [];
  const objects: LocatedObject[] = [];
  const invalid = new Set<string>();
  for (const file of files) {
    objects.push(...parseFile(file, issues, invalid));
  }

  const index = indexObjects(objects, invalid, issues);
  const slos: ResolvedSlo[] = [];
  for (const { source, object } of objects) {
    if (object.kind === 'SLO') {
      const resolved = resolveSlo(source, object, index, issues);
      if (resolved !== undefined) {
        slos.push(resolved);
      }
    }
  }

  if (issues.length > 0) {
    throw new SloSpecError(issues);
  }
  return { slos };
}

function parseFile(file: SpecFile, issues: SpecIssue[], invalid: Set<string>): LocatedObject[] {
  const located: LocatedObject[] = [];
  parseAllDocuments(file.text).forEach((document, position) => {
    const label = `document ${position + 1}`;
    for (const error of document.errors) {
      issues.push({ source: file.source, object: label, path: '', message: error.message });
    }
    if (document.errors.length > 0) {
      return;
    }
    const raw: unknown = document.toJS();
    if (raw === null || raw === undefined) {
      return;
    }
    const parsed = OpenSloObjectSchema.safeParse(raw);
    if (parsed.success) {
      located.push({ source: file.source, object: parsed.data });
      return;
    }
    const object = describeRaw(raw) ?? label;
    invalid.add(object);
    for (const issue of parsed.error.issues) {
      issues.push({
        source: file.source,
        object,
        path: formatPath(issue.path),
        message: issue.message,
      });
    }
  });
  return located;
}

// ── Indexing ──────────────────────────────────────────────────────────────

type Kind = OpenSloObject['kind'];
type ObjectOfKind<K extends Kind> = Extract<OpenSloObject, { kind: K }>;

type Reporter = (path: string, message: string) => void;

interface ObjectIndex {
  /**
   * Returns the named object, or reports a dangling reference. A reference to an object
   * that failed schema validation stays silent, because that object already reported
   * its own issues.
   */
  resolve<K extends Kind>(
    kind: K,
    name: string,
    path: string,
    report: Reporter,
  ): ObjectOfKind<K> | undefined;
}

function indexObjects(
  objects: readonly LocatedObject[],
  invalid: ReadonlySet<string>,
  issues: SpecIssue[],
): ObjectIndex {
  const byKey = new Map<string, LocatedObject>();
  for (const located of objects) {
    const key = objectLabel(located.object.kind, located.object.metadata);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, located);
    } else {
      issues.push({
        source: located.source,
        object: key,
        path: 'metadata.name',
        message: `duplicates the ${located.object.kind} defined in ${existing.source}`,
      });
    }
  }
  return {
    resolve: <K extends Kind>(kind: K, name: string, path: string, report: Reporter) => {
      const key = `${kind}/${name}`;
      const found = byKey.get(key)?.object as ObjectOfKind<K> | undefined;
      if (found === undefined && !invalid.has(key)) {
        report(path, `references ${kind} "${name}", which is not defined`);
      }
      return found;
    },
  };
}

// ── SLO resolution ────────────────────────────────────────────────────────

function resolveSlo(
  source: string,
  slo: ObjectOfKind<'SLO'>,
  index: ObjectIndex,
  issues: SpecIssue[],
): ResolvedSlo | undefined {
  const object = objectLabel('SLO', slo.metadata);
  const report = (path: string, message: string): void => {
    issues.push({ source, object, path, message });
  };
  const { spec } = slo;
  const issueCount = issues.length;

  index.resolve('Service', spec.service, 'spec.service', report);

  const indicator = resolveIndicator(slo, index, report);
  const objectives = spec.objectives.map((objective, position) =>
    resolveObjective(objective, position, spec.budgetingMethod, indicator?.spec, report),
  );
  const alertConditions = resolveAlertConditions(slo, index, report);
  const benchmark =
    indicator === undefined ? undefined : resolveBenchmark(indicator.spec, objectives, report);
  const regressionThreshold = resolveRegressionThreshold(slo.metadata, report);

  if (indicator === undefined || issues.length > issueCount) {
    return undefined;
  }
  return {
    source,
    name: slo.metadata.name,
    displayName: slo.metadata.displayName ?? slo.metadata.name,
    service: spec.service,
    budgetingMethod: spec.budgetingMethod,
    timeWindow: describeTimeWindow(spec.timeWindow),
    indicatorName: indicator.name,
    indicator: indicator.spec,
    objectives,
    alertConditions,
    benchmark,
    regressionThreshold,
  };
}

function resolveIndicator(
  slo: ObjectOfKind<'SLO'>,
  index: ObjectIndex,
  report: Reporter,
): { name: string; spec: SliSpec } | undefined {
  const { indicator, indicatorRef } = slo.spec;
  if (indicator !== undefined) {
    return { name: indicator.metadata.name, spec: indicator.spec };
  }
  if (indicatorRef === undefined) {
    return undefined;
  }
  const sli = index.resolve('SLI', indicatorRef, 'spec.indicatorRef', report);
  return sli === undefined ? undefined : { name: sli.metadata.name, spec: sli.spec };
}

function resolveObjective(
  objective: Objective,
  position: number,
  budgetingMethod: Slo['spec']['budgetingMethod'],
  indicator: SliSpec | undefined,
  report: Reporter,
): ResolvedObjective {
  const path = `spec.objectives.${position}`;
  if (indicator?.thresholdMetric !== undefined) {
    if (objective.op === undefined || objective.value === undefined) {
      report(path, 'a threshold indicator needs "op" and "value"');
    }
  } else if (indicator?.ratioMetric !== undefined) {
    if (objective.op !== undefined || objective.value !== undefined) {
      report(path, 'a ratio indicator does not take "op" or "value"');
    }
  }

  const needsWindow = budgetingMethod !== 'Occurrences';
  if (needsWindow !== (objective.timeSliceWindow !== undefined)) {
    report(
      path,
      `"timeSliceWindow" is ${needsWindow ? 'required' : 'not allowed'} with ${budgetingMethod}`,
    );
  }
  const needsSliceTarget = budgetingMethod === 'Timeslices';
  if (needsSliceTarget !== (objective.timeSliceTarget !== undefined)) {
    report(
      path,
      `"timeSliceTarget" is ${needsSliceTarget ? 'required' : 'not allowed'} with ${budgetingMethod}`,
    );
  }

  return {
    index: position,
    displayName: objective.displayName ?? `objective ${position + 1}`,
    target: objective.target ?? (objective.targetPercent ?? 0) / 100,
    op: objective.op,
    value: objective.value,
  };
}

function resolveAlertConditions(
  slo: ObjectOfKind<'SLO'>,
  index: ObjectIndex,
  report: Reporter,
): ResolvedAlertCondition[] {
  const resolved: ResolvedAlertCondition[] = [];
  (slo.spec.alertPolicies ?? []).forEach((entry, position) => {
    const path = `spec.alertPolicies.${position}`;
    const policy =
      'alertPolicyRef' in entry
        ? index.resolve('AlertPolicy', entry.alertPolicyRef, path, report)
        : entry;
    if (policy === undefined) {
      return;
    }

    for (const target of policy.spec.notificationTargets) {
      if ('targetRef' in target) {
        index.resolve('AlertNotificationTarget', target.targetRef, path, report);
      }
    }

    const [conditionEntry] = policy.spec.conditions;
    if (conditionEntry === undefined) {
      return;
    }
    const condition =
      'conditionRef' in conditionEntry
        ? index.resolve('AlertCondition', conditionEntry.conditionRef, path, report)
        : conditionEntry;
    if (condition === undefined) {
      return;
    }
    const pair = resolveWindowPair(condition.metadata, condition.spec, (message) => {
      report(path, `AlertCondition "${condition.metadata.name}" ${message}`);
    });
    if (pair !== undefined) {
      resolved.push({
        policy: policy.metadata.name,
        name: condition.metadata.name,
        severity: condition.spec.severity,
        burnRate: condition.spec.condition.threshold,
        ...pair,
      });
    }
  });
  return resolved;
}

function resolveWindowPair(
  metadata: Metadata,
  spec: AlertConditionSpec,
  report: (message: string) => void,
): { longWindow: string; shortWindow: string } | undefined {
  const { op, lookbackWindow } = spec.condition;
  if (op !== 'gt' && op !== 'gte') {
    report(`must fire when the burn rate rises ("gt" or "gte"), got "${op}"`);
  }
  const shortWindow = metadata.annotations?.[SHORT_WINDOW_ANNOTATION];
  if (shortWindow === undefined) {
    report(`needs the "${SHORT_WINDOW_ANNOTATION}" annotation for its short window`);
    return undefined;
  }
  const longMinutes = durationToMinutes(lookbackWindow);
  const shortMinutes = durationToMinutes(shortWindow);
  if (
    longMinutes === undefined ||
    shortMinutes === undefined ||
    shortMinutes * 12 !== longMinutes
  ) {
    report(
      `short window "${shortWindow}" must be exactly 1/12 of lookbackWindow "${lookbackWindow}"`,
    );
    return undefined;
  }
  return { longWindow: lookbackWindow, shortWindow };
}

function resolveBenchmark(
  indicator: SliSpec,
  objectives: readonly ResolvedObjective[],
  report: Reporter,
): BenchmarkSource | undefined {
  const ratioSources = [
    indicator.ratioMetric?.good,
    indicator.ratioMetric?.bad,
    indicator.ratioMetric?.total,
  ];
  if (ratioSources.some((holder) => holder?.metricSource.type === VITEST_BENCH_SOURCE_TYPE)) {
    report(
      'indicator',
      `"${VITEST_BENCH_SOURCE_TYPE}" sources only support thresholdMetric indicators`,
    );
    return undefined;
  }
  const source = indicator.thresholdMetric?.metricSource;
  if (source?.type !== VITEST_BENCH_SOURCE_TYPE) {
    return undefined;
  }

  const parsed = BenchmarkSourceSchema.safeParse(source.spec);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      report(
        `indicator.thresholdMetric.metricSource.spec.${formatPath(issue.path)}`,
        issue.message,
      );
    }
    return undefined;
  }
  const allowed = allowedComparisons(parsed.data.unit);
  for (const objective of objectives) {
    if (objective.op !== undefined && !allowed.includes(objective.op)) {
      report(
        `spec.objectives.${objective.index}.op`,
        `must be one of ${allowed.join(', ')} for a "${parsed.data.unit}" benchmark, got "${objective.op}"`,
      );
    }
    if (objective.value !== undefined && !(objective.value > 0)) {
      report(`spec.objectives.${objective.index}.value`, 'must be greater than 0 for a benchmark');
    }
  }
  return parsed.data;
}

function resolveRegressionThreshold(metadata: Metadata, report: Reporter): number {
  const raw = metadata.annotations?.[REGRESSION_THRESHOLD_ANNOTATION];
  if (raw === undefined) {
    return DEFAULT_REGRESSION_THRESHOLD;
  }
  const threshold = Number(raw);
  if (!(threshold > 0)) {
    report(
      `metadata.annotations.${REGRESSION_THRESHOLD_ANNOTATION}`,
      `must be a number greater than 0, got "${raw}"`,
    );
  }
  return threshold;
}

// ── Formatting helpers ────────────────────────────────────────────────────

function describeTimeWindow(windows: Slo['spec']['timeWindow']): string {
  const [window] = windows;
  if (window === undefined) {
    return '';
  }
  return window.isRolling ? `${window.duration} rolling` : `${window.duration} calendar`;
}

function objectLabel(kind: Kind, metadata: Metadata): string {
  return `${kind}/${metadata.name}`;
}

function describeRaw(raw: unknown): string | undefined {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const kind: unknown = Reflect.get(raw, 'kind');
  const metadata: unknown = Reflect.get(raw, 'metadata');
  const name: unknown =
    typeof metadata === 'object' && metadata !== null ? Reflect.get(metadata, 'name') : undefined;
  return typeof kind === 'string' && typeof name === 'string' ? `${kind}/${name}` : undefined;
}

function formatPath(path: z.core.$ZodIssue['path']): string {
  return path.map(String).join('.');
}
