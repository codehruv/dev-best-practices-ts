# Observability

## Every Service

- Exposes a liveness endpoint (`/healthz`), a readiness endpoint (`/readyz`), and metrics (`/metrics`).
- Instruments every endpoint: request count, latency histogram, and status code.
- Instruments every external call (database, cache, queue, HTTP): latency, errors, and count.
- Emits business events as metrics, not only as logs.
- Propagates trace context (W3C `traceparent`) across every hop. Use OpenTelemetry.

## Logging

- Structured JSON only.
- A short, static, sentence-case message. Every dynamic value is a `snake_case` field: `log.info("Order placed", { order_id, item_count })`. Static messages group and search cleanly.
- Request, trace, and span IDs are injected automatically from context. Never pass them by hand.
- Pass caught errors as an `error` field so the logger records the type and stack.
- Bind module context once with a child logger.
- Levels: `error` for actionable failures, `warn` for recoverable anomalies, `info` for operational milestones, `debug` for development diagnostics.
- Never log secrets, tokens, credentials, authorization headers, or PII.

## Service Level Objectives

- Every user-facing service defines SLOs for availability and latency, measured from the user's side.
- Alert on symptoms (SLO burn rate), not causes (CPU usage).
- Every alert links to a runbook that says what to check and what to do.

## Incidents

- Declare incidents early. A severity scale decides who gets paged.
- Every significant incident gets a blameless postmortem from [`../templates/postmortem.md`](../templates/postmortem.md), with action items tracked to completion.
