# SLO: <Service Name>

- **Owner:** <team or person>
- **Status:** Draft | Agreed | Under review
- **Spec:** `slo/<service>.openslo.yaml`
- **Last reviewed:** YYYY-MM-DD

The spec file is the source of truth for targets and windows. This document records why they are what they are, and who acts on them. See [`../reference/slo.md`](../reference/slo.md).

## Service

What the service does, who its users are, and what they notice when it degrades.

## Indicators

| SLI          | What is measured | Where it is measured | Good event | Valid event |
| ------------ | ---------------- | -------------------- | ---------- | ----------- |
| Availability |                  |                      |            |             |
| Latency      |                  |                      |            |             |

## Objectives

| SLO | Target | Window | Budgeting method | Rationale |
| --- | ------ | ------ | ---------------- | --------- |
|     |        |        |                  |           |

Rationale: the current achieved level, what users tolerate, and any dependency that bounds the target.

## Error Budget

What the budget means in concrete terms (for example, "about 43 minutes of full outage per 30 days").

## Alerting

| Tier   | Burn rate | Windows  | Severity | Notifies | Runbook |
| ------ | --------- | -------- | -------- | -------- | ------- |
| Fast   | 14.4      | 1h / 5m  | page     |          |         |
| Medium | 6         | 6h / 30m | page     |          |         |
| Slow   | 1         | 3d / 6h  | ticket   |          |         |

## Error Budget Policy

Who decides, and what changes, when the budget is low or exhausted. Start from the repo default in [`../reference/slo.md`](../reference/slo.md#error-budget-policy) and record any deviation and its reason here.

## Dependencies

Services this one depends on, their SLOs, and how a miss in each affects this SLO.

## Review History

| Date | Change | Reason |
| ---- | ------ | ------ |
