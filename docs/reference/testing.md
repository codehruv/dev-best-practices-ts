# Testing

## Layers

- **Unit tests** cover one unit through its public interface. They are fast (milliseconds), deterministic, and run on every change. Most tests live here.
- **Integration tests** cover real boundaries: a database, a queue, an HTTP server. They run in CI on every PR.
- **End-to-end tests** cover critical user journeys only. Keep this layer thin, because it is slow and brittle.

## Rules

- All net-new code has tests. A bug fix starts with a failing regression test.
- Tests live in a dedicated `tests/` tree, split into `unit/` and `integration/` when both exist, unless the language convention says otherwise (Go keeps `_test.go` files next to the code).
- Test behavior through the public interface, not implementation details. A refactor that preserves behavior must not break tests.
- Mock by implementing the interface. Never monkeypatch internals. If a dependency is hard to fake, inject it.
- Each test sets up its own state and does not depend on test order. Reset shared mocks before each test.
- Inject time, randomness, and I/O so tests are deterministic. Never sleep to wait for a condition.
- Use factory functions for test data (`makeUser()`), with overrides for the fields a test cares about.
- Table-driven tests for many cases of one behavior.
- Never commit skipped or focused tests.
- Treat tests as specifications. When an expected-behavior test fails, challenge the implementation and ask before weakening the assertion.

## Flaky Tests

A flaky test is a bug. Quarantine it with an issue the day it flakes, and fix or delete it within a week. A red CI that people ignore protects nothing.

## Coverage

Coverage is a signal, not a target. Review uncovered branches in changed code. Do not write assertion-free tests to raise a number.

## Beyond Examples

- **Property-based tests** for parsers, serializers, and anything with invariants (round-trips, ordering).
- **Fuzz tests** for code that parses untrusted input.
- **Benchmarks** for hot paths, tracked in CI so regressions are visible.
