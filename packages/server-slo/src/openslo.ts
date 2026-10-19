import { z } from 'zod';

// Zod schemas for the subset of OpenSLO v1 this repo uses. Field rules follow the
// specification at https://openslo.com (generated from the official Go SDK). The subset
// leaves out composite SLOs, DataSource objects, and `raw` ratio metrics, so the
// validator rejects them instead of accepting fields nothing evaluates.

// ── Shared fields ─────────────────────────────────────────────────────────

const RFC1123_LABEL = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const LABEL_KEY = /^[a-zA-Z0-9]([-._a-zA-Z0-9]{0,61}[a-zA-Z0-9])?$/;
const ANNOTATION_KEY =
  /^([a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?(\.[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?)*\/)?[a-zA-Z0-9]([-._a-zA-Z0-9]{0,61}[a-zA-Z0-9])?$/;

/** OpenSLO duration shorthand: a positive integer and a case-sensitive unit. */
const DURATION = /^[1-9][0-9]*(m|h|d|w|M|Q|Y)$/;

const ObjectNameSchema = z
  .string()
  .min(1)
  .max(63)
  .regex(RFC1123_LABEL, 'must be an RFC 1123 label (lowercase letters, digits, "-")');

const DurationSchema = z
  .string()
  .regex(DURATION, 'must be a duration shorthand such as "5m", "1h", or "28d"');

const DescriptionSchema = z.string().max(1050);

const MetadataSchema = z.strictObject({
  name: ObjectNameSchema,
  displayName: z.string().max(63).optional(),
  labels: z
    .record(z.string().regex(LABEL_KEY), z.union([z.string(), z.array(z.string())]))
    .optional(),
  annotations: z
    .record(z.string().regex(ANNOTATION_KEY, 'must be a "prefix/name" annotation key'), z.string())
    .optional(),
});

const ComparisonSchema = z.enum(['gt', 'lt', 'gte', 'lte']);

// ── SLI ───────────────────────────────────────────────────────────────────

const MetricSourceSchema = z.strictObject({
  metricSourceRef: ObjectNameSchema.optional(),
  type: z.string().min(1),
  spec: z.record(z.string(), z.unknown()),
});

const MetricSourceHolderSchema = z.strictObject({ metricSource: MetricSourceSchema });

const RatioMetricSchema = z
  .strictObject({
    counter: z.boolean(),
    good: MetricSourceHolderSchema.optional(),
    bad: MetricSourceHolderSchema.optional(),
    total: MetricSourceHolderSchema,
  })
  .refine((ratio) => (ratio.good === undefined) !== (ratio.bad === undefined), {
    message: 'exactly one of "good" and "bad" must be set',
  });

const SliSpecSchema = z
  .strictObject({
    description: DescriptionSchema.optional(),
    thresholdMetric: MetricSourceHolderSchema.optional(),
    ratioMetric: RatioMetricSchema.optional(),
  })
  .refine((spec) => (spec.thresholdMetric === undefined) !== (spec.ratioMetric === undefined), {
    message: 'exactly one of "thresholdMetric" and "ratioMetric" must be set',
  });

const SliSchema = z.strictObject({
  apiVersion: z.literal('openslo/v1'),
  kind: z.literal('SLI'),
  metadata: MetadataSchema,
  spec: SliSpecSchema,
});

// ── Service ───────────────────────────────────────────────────────────────

const ServiceSchema = z.strictObject({
  apiVersion: z.literal('openslo/v1'),
  kind: z.literal('Service'),
  metadata: MetadataSchema,
  spec: z.strictObject({ description: DescriptionSchema.optional() }),
});

// ── Alerting ──────────────────────────────────────────────────────────────

const AlertConditionSpecSchema = z.strictObject({
  description: DescriptionSchema.optional(),
  severity: z.string().min(1),
  condition: z.strictObject({
    kind: z.literal('burnrate'),
    op: ComparisonSchema,
    threshold: z.number().positive(),
    lookbackWindow: DurationSchema,
    alertAfter: DurationSchema.optional(),
  }),
});

const AlertConditionSchema = z.strictObject({
  apiVersion: z.literal('openslo/v1'),
  kind: z.literal('AlertCondition'),
  metadata: MetadataSchema,
  spec: AlertConditionSpecSchema,
});

const NotificationTargetSpecSchema = z.strictObject({
  description: DescriptionSchema.optional(),
  target: z.string().min(1),
});

const AlertNotificationTargetSchema = z.strictObject({
  apiVersion: z.literal('openslo/v1'),
  kind: z.literal('AlertNotificationTarget'),
  metadata: MetadataSchema,
  spec: NotificationTargetSpecSchema,
});

const AlertPolicySpecSchema = z.strictObject({
  description: DescriptionSchema.optional(),
  alertWhenNoData: z.boolean().optional(),
  alertWhenBreaching: z.boolean().optional(),
  alertWhenResolved: z.boolean().optional(),
  // OpenSLO v1 allows exactly one condition per policy. Multi-window burn-rate alerting
  // therefore uses one policy per window pair. See docs/reference/slo.md.
  conditions: z
    .array(
      z.union([
        z.strictObject({ conditionRef: ObjectNameSchema }),
        z.strictObject({
          kind: z.literal('AlertCondition'),
          metadata: MetadataSchema,
          spec: AlertConditionSpecSchema,
        }),
      ]),
    )
    .length(1),
  notificationTargets: z
    .array(
      z.union([
        z.strictObject({ targetRef: ObjectNameSchema }),
        z.strictObject({
          kind: z.literal('AlertNotificationTarget'),
          metadata: MetadataSchema,
          spec: NotificationTargetSpecSchema,
        }),
      ]),
    )
    .min(1),
});

const AlertPolicySchema = z.strictObject({
  apiVersion: z.literal('openslo/v1'),
  kind: z.literal('AlertPolicy'),
  metadata: MetadataSchema,
  spec: AlertPolicySpecSchema,
});

// ── SLO ───────────────────────────────────────────────────────────────────

const ObjectiveSchema = z
  .strictObject({
    displayName: z.string().optional(),
    op: ComparisonSchema.optional(),
    value: z.number().optional(),
    target: z.number().min(0).lt(1).optional(),
    targetPercent: z.number().min(0).lt(100).optional(),
    timeSliceTarget: z.number().gt(0).max(1).optional(),
    timeSliceWindow: DurationSchema.optional(),
  })
  .refine(
    (objective) => (objective.target === undefined) !== (objective.targetPercent === undefined),
    {
      message: 'exactly one of "target" and "targetPercent" must be set',
    },
  );

const TimeWindowSchema = z
  .strictObject({
    duration: DurationSchema,
    isRolling: z.boolean(),
    calendar: z
      .strictObject({
        startTime: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, 'must use "YYYY-MM-DD hh:mm:ss"'),
        timeZone: z.string().min(1),
      })
      .optional(),
  })
  .refine((window) => window.isRolling === (window.calendar === undefined), {
    message: '"calendar" must be set when "isRolling" is false and absent when it is true',
  });

const SloSchema = z.strictObject({
  apiVersion: z.literal('openslo/v1'),
  kind: z.literal('SLO'),
  metadata: MetadataSchema,
  spec: z
    .strictObject({
      description: DescriptionSchema.optional(),
      service: ObjectNameSchema,
      indicator: z.strictObject({ metadata: MetadataSchema, spec: SliSpecSchema }).optional(),
      indicatorRef: ObjectNameSchema.optional(),
      budgetingMethod: z.enum(['Occurrences', 'Timeslices', 'RatioTimeslices']),
      timeWindow: z.array(TimeWindowSchema).length(1),
      objectives: z.array(ObjectiveSchema).min(1),
      alertPolicies: z
        .array(
          z.union([
            z.strictObject({ alertPolicyRef: ObjectNameSchema }),
            z.strictObject({
              kind: z.literal('AlertPolicy'),
              metadata: MetadataSchema,
              spec: AlertPolicySpecSchema,
            }),
          ]),
        )
        .optional(),
    })
    .refine((spec) => (spec.indicator === undefined) !== (spec.indicatorRef === undefined), {
      message: 'exactly one of "indicator" and "indicatorRef" must be set',
    }),
});

// ── Documents ─────────────────────────────────────────────────────────────

/** Any OpenSLO v1 object this repo accepts, discriminated by `kind`. */
export const OpenSloObjectSchema = z.discriminatedUnion('kind', [
  ServiceSchema,
  SliSchema,
  SloSchema,
  AlertPolicySchema,
  AlertConditionSchema,
  AlertNotificationTargetSchema,
]);

/** A validated OpenSLO v1 object. */
export type OpenSloObject = z.infer<typeof OpenSloObjectSchema>;
/** A validated OpenSLO `SLO` object. */
export type Slo = z.infer<typeof SloSchema>;
/** The `spec` of an SLI, whether declared standalone or inline in an SLO. */
export type SliSpec = z.infer<typeof SliSpecSchema>;
/** One entry of an SLO's `objectives` list. */
export type Objective = z.infer<typeof ObjectiveSchema>;
/** The `spec` of an AlertCondition, whether declared standalone or inline in a policy. */
export type AlertConditionSpec = z.infer<typeof AlertConditionSpecSchema>;
/** Object metadata shared by every kind. */
export type Metadata = z.infer<typeof MetadataSchema>;
/** A comparison operator used by objectives and burn-rate conditions. */
export type Comparison = z.infer<typeof ComparisonSchema>;
