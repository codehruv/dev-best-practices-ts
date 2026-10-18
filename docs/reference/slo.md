# Service Level Objectives

An SLO states how reliable or fast something must be, measured the way users experience it. This repo keeps every SLO as a machine-readable spec in `slo/`, validates it in `just verify`, measures the benchmarkable ones in CI, and tracks the results over time. Service-wide monitoring rules (health endpoints, instrumentation, incidents) live in [`observability.md`](observability.md).

## Vocabulary

| Term                | Meaning                                                                                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SLI** (indicator) | A measurement of user-visible behavior: the share of requests that succeed, or how long an operation takes.                                                                                              |
| **SLO** (objective) | A target for an SLI over a time window: "99.9% of requests succeed over 30 days".                                                                                                                        |
| **Error budget**    | The failure an SLO allows: 1 minus the target. A 99.9% target allows 0.1% of requests to fail.                                                                                                           |
| **Burn rate**       | How fast the budget is being spent, relative to spending it exactly over the window. A burn rate of 1 uses the whole budget by the end of the window. 14.4 uses it in about two days of a 30-day window. |
| **SLA**             | A contract with consequences for missing it. Set SLAs looser than SLOs, so the SLO warns before the SLA breaks.                                                                                          |

## Writing a Good SLO

- **Measure what users experience.** Measure at the load balancer or the client, not inside the service, so requests that never arrive still count.
- **Pick few SLIs.** Availability and latency cover most request-serving services. Add freshness or correctness only when users notice them.
- **Use percentiles, never averages.** A mean hides the slow tail that users notice. State latency as "p99 under 300 ms".
- **Set the target below 100%.** A 100% target leaves no budget for deploys, experiments, or dependency failures, and it is never met anyway. The spec rejects a target of 1.
- **Set it from data.** Start from what the system achieves today and what users tolerate, then tighten it as the system improves.
- **Write down why.** Each SLO's `description` says what the user notices when it is missed.

## The Spec Format

Specs use [OpenSLO v1](https://openslo.com), a vendor-neutral YAML standard, so they port to a real monitoring backend unchanged. Each `slo/*.openslo.yaml` file holds several YAML documents: one `Service`, its `SLI`s, `SLO`s, and the alerting objects they reference.

`packages/slo` validates a subset of OpenSLO v1 with Zod schemas built from the official field rules. The subset leaves out composite SLOs, `DataSource` objects, and `raw` ratio metrics, so the validator rejects them instead of accepting fields nothing evaluates. Beyond the schema, `slo validate` checks:

- every reference (`service`, `indicatorRef`, `alertPolicyRef`, `conditionRef`, `targetRef`) points at a defined object, and names are unique within each kind,
- threshold indicators have `op` and `value`, and ratio indicators do not,
- `timeSliceWindow` and `timeSliceTarget` appear exactly when the budgeting method needs them,
- burn-rate conditions follow the multi-window rule below,
- benchmark sources are complete and use a comparison that rewards getting faster.

Two repo-specific annotations extend OpenSLO without breaking it:

| Annotation                                | On               | Meaning                                                                                       |
| ----------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------- |
| `dev-best-practices/short-window`         | `AlertCondition` | The short window of a multi-window burn-rate alert. Must be exactly 1/12 of `lookbackWindow`. |
| `dev-best-practices/regression-threshold` | `SLO`            | Fractional slowdown against the baseline that fails `just slo`. Default `0.2` (20%).          |

## Two Kinds of SLO

### Service SLOs

A service SLO is measured by production monitoring. Its SLI's `metricSource` names a backend (`type: Prometheus`) and a query. `slo/example-api.openslo.yaml` is the reference: an availability SLO (ratio of non-5xx requests, 99.9% over 30 days) and a latency SLO (p99 under 300 ms in 99% of one-minute slices). Copy it when you add a service.

### Benchmark SLOs

A benchmark SLO is a performance budget for library code, measured by a Vitest benchmark. Its SLI's `metricSource` has `type: vitest-bench` and this `spec`:

| Field       | Meaning                                                                          |
| ----------- | -------------------------------------------------------------------------------- |
| `package`   | Directory under `packages/` whose `.slo/bench.json` holds the results.           |
| `benchmark` | `<file> > <describe> > <bench>`, exactly as Vitest names the benchmark.          |
| `batchSize` | Operations per benchmark iteration. Must match the loop count in the bench file. |
| `unit`      | `ns`, `us`, or `ms` per operation for latency, `ops/s` for throughput.           |

An objective `op: lte, value: V, target: T` reads "a fraction T of operations take at most V". Target 0.99 checks the p99, 0.5 checks the median. Latency objectives must use `lt` or `lte`, and throughput objectives must use `gt` or `gte`, so no objective rewards getting slower. `timeWindow` is nominal for benchmark SLOs, because each run is evaluated on its own. OpenSLO still requires one.

`slo/retry.openslo.yaml` defines the SLOs for `@dbp/retry`, measured by `packages/retry/tests/bench/retry.bench.ts`.

## How a Benchmark Maps to an Objective

1. `vitest bench` writes each benchmark's iteration-time distribution to `packages/<name>/.slo/bench.json`: min, median, p75, p99, p99.5, p99.9, and max.
2. `slo check` divides iteration times by `batchSize` and converts them to the SLI's unit.
3. **Pass or fail** compares the quantile at the objective's target to its value. Targets of 0.5, 0.75, 0.99, 0.995, and 0.999 read a reported quantile exactly. Other targets interpolate linearly between the two nearest quantiles.
4. **Budget left** estimates the share of operations that miss the threshold and divides it by the share the target allows (1 - T). 100% means no operation missed. "Exhausted" means more missed than the target allows. Vitest does not export raw samples, so the miss share comes from linear interpolation between the reported quantiles. Between p99.9 and the maximum, that overstates misses, so the estimate errs toward caution.
5. **Median vs baseline** compares the median per-operation time to the baseline recorded on the same machine class (platform, architecture, CPU model, Node major version).

## Noise Control

Benchmark timings vary with machine load, CPU frequency, and garbage collection. The setup keeps that variation from failing healthy changes:

| Technique                     | Where                                            | Why                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Batched iterations            | bench files                                      | One call takes tens of nanoseconds, close to timer resolution. Batching 100 to 1,000 calls per iteration makes each sample long enough to time accurately. |
| Warmup                        | bench options (`warmupTime`, `warmupIterations`) | The JIT reaches optimized code before measurement starts.                                                                                                  |
| One second of samples         | bench options (`time`)                           | Thousands of iterations per benchmark keep the p99 estimate stable.                                                                                        |
| One package at a time         | `just bench`                                     | Benchmarks never compete with each other for CPU.                                                                                                          |
| Percentiles, not means        | `slo check`                                      | One garbage-collection pause moves the mean. It barely moves a percentile.                                                                                 |
| Objectives with 5-8x headroom | `slo/*.openslo.yaml`                             | A slower CI runner passes, and only a real regression of that size fails.                                                                                  |
| Baseline on the median        | `slo/baselines/`                                 | The median of thousands of iterations moves a few percent under load, while p99 can triple. That makes a 20% regression threshold safe.                    |
| Same-machine baselines        | `slo/baselines/`                                 | Timings compare only within one machine class. On other machines the comparison reports `n/a` instead of failing.                                          |
| Re-measure once on a miss     | `just slo`                                       | A burst of background load fails one run. A real regression fails both.                                                                                    |
| Noise warning                 | `slo check`                                      | A relative margin of error above 5% prints a warning to re-run on an idle machine.                                                                         |

Absolute objectives catch large regressions everywhere, including CI. The baseline catches smaller regressions (20% by default) on the machine that recorded it. The CI history catches gradual drift.

## Commands

| Command             | What it does                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `just slo-validate` | Validates every spec without running benchmarks. The `@dbp/slo` unit tests also validate the committed specs, so `just verify` covers this.                   |
| `just slo`          | Runs every package's benchmarks, then checks each benchmark SLO. Exit 1 means a missed objective or a regression, exit 2 means a bad spec or missing results. |
| `just slo-baseline` | Runs the benchmarks and records them as this machine's baseline in `slo/baselines/<spec>.json`. Run it on an idle machine and commit the file.                |
| `just bench`        | Runs the benchmarks only.                                                                                                                                     |

`just slo` stays out of `just verify`, because timings depend on what else the machine is doing.

## Tracking Over Time

`.github/workflows/slo.yaml` runs on every pull request and every push to `main`:

1. **Measure** runs `just slo` with read-only permissions, writes the result table to the job summary, and uploads the benchmark reports as an artifact. It fails on a missed absolute objective.
2. **Record history** runs only on pushes to `main`. It is the only job with write access. It appends the results to the `gh-pages` branch with [github-action-benchmark](https://github.com/benchmark-action/github-action-benchmark), which renders trend charts under `/slo`. It fails when a result is 2x worse than the previous `main` run and warns at 1.5x.
3. **Compare with main** runs on pull requests. It compares the PR's results to `main`'s history without writing anything. Until the first push to `main` creates `gh-pages`, it reports that no history exists.

The history lives on `gh-pages` rather than in a cache or committed file. Caches expire, and committed history would add a commit to `main` for every merge. Enable GitHub Pages on the `gh-pages` branch to browse the charts.

The CI thresholds sit far above the 20% baseline threshold, because shared runners vary by about 30% between runs. The local baseline is the precise instrument. CI history is the coarse, always-on one.

## Adding an SLO

1. **Pick the SLI.** For library code, write a benchmark in `packages/<name>/tests/bench/*.bench.ts` that batches the operation, and add a `bench` script plus the `benchmark` block in `vitest.config.ts` (see `packages/retry`). For a service, write the monitoring query.
2. **Declare it.** Add an `SLI` and an `SLO` to the package's `slo/<name>.openslo.yaml`, creating the file and its `Service` if needed. Explain in each `description` what the user notices when it is missed.
3. **Set the objective from data.** Run `just slo`, read the measured value, and set the objective with 5-8x headroom for benchmark SLOs. For service SLOs, start from the current achieved level.
4. **Record the baseline.** Run `just slo-baseline` on an idle machine and commit `slo/baselines/<name>.json`.
5. **Alert on it** (service SLOs). Reference the burn-rate alert policies, or define new ones following the multi-window rule.
6. **Document it.** For a user-facing service, fill in [`../templates/slo.md`](../templates/slo.md) with the rationale and the error budget policy owners.

## Burn-Rate Alerting

Alert on the error budget's burn rate, not on raw error counts or resource usage. A burn-rate alert fires in proportion to user impact: fast for an outage, slowly for a gradual degradation, and never for noise the budget absorbs.

Each tier pairs a long window with a short window one-twelfth its length, following the [Google SRE Workbook](https://sre.google/workbook/alerting-on-slos/). The long window proves the burn is significant. The short window proves it is still happening, so the alert resets within minutes of recovery instead of hours. For a 30-day SLO:

| Tier   | Burn rate | Long window | Short window | Budget spent when it fires | Severity |
| ------ | --------- | ----------- | ------------ | -------------------------- | -------- |
| Fast   | 14.4      | 1h          | 5m           | 2%                         | page     |
| Medium | 6         | 6h          | 30m          | 5%                         | page     |
| Slow   | 1         | 3d          | 6h           | 10%                        | ticket   |

OpenSLO v1 allows one condition per `AlertPolicy`, so each tier is its own policy. The condition's `lookbackWindow` holds the long window, and the `dev-best-practices/short-window` annotation holds the short one. The validator enforces the 1/12 ratio. A backend fires the alert only when the burn rate exceeds the threshold over both windows.

Every alert names a runbook that says what to check and what to do ([`observability.md`](observability.md)).

## Error Budget Policy

The error budget turns reliability into a decision rule instead of a debate. When an SLO's budget for the current window is:

- **Healthy (more than 25% left):** ship features at full speed. The budget pays for deploys, experiments, and planned maintenance.
- **Low (25% or less left):** prioritize reliability work for that service. Risky launches need the owner's sign-off.
- **Exhausted:** freeze feature releases for that service, except security fixes and changes that improve reliability, until the budget recovers within the window. The team's top priority becomes the causes of the burn, tracked as postmortem action items ([`../templates/postmortem.md`](../templates/postmortem.md)).
- **Exhausted by a single incident:** write a postmortem regardless of severity.
- **Repeatedly exhausted:** revisit the SLO itself. Either the system needs investment, or the target exceeds what users need.

For benchmark SLOs, the policy is simpler: a missed objective fails CI and blocks the merge. A regression against the baseline also fails `just slo`. Fix it, or, if the slowdown is an intended trade-off, re-record the baseline in the same PR and say why in its description.

Owners review every service SLO each quarter: whether the target still matches what users need, and whether the budget was spent on the right things.
