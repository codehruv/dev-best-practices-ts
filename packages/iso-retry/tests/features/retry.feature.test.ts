import { fileURLToPath } from 'node:url';

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { Retrier, RetryAbortedError, RetryExhaustedError } from '@dbp/iso-retry';
import { expect } from 'vitest';

import { failingThenSucceeding, makeDependencies, makePolicy } from '../unit/fakes.js';

// An absolute path, because loadFeature resolves relative paths from a stack frame that
// top-level await does not provide.
const feature = await loadFeature(
  fileURLToPath(new URL('../../features/retry.feature', import.meta.url)),
);

/** How a run ended, captured so `Then` steps can assert on either branch. */
type Outcome = { readonly value: string } | { readonly error: unknown };

function settle(run: Promise<string>): Promise<Outcome> {
  return run.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
}

function errorOf(outcome: Outcome | undefined): unknown {
  expect(outcome).toHaveProperty('error');
  return outcome !== undefined && 'error' in outcome ? outcome.error : undefined;
}

// An operation that never succeeds. Each failure names its attempt, so a scenario can
// tell which failure an error wraps.
const alwaysFailing = (): ReturnType<typeof failingThenSucceeding<string>> =>
  failingThenSucceeding(Number.POSITIVE_INFINITY, 'unreachable');

describeFeature(feature, ({ Scenario }) => {
  Scenario('Resolve once a transient failure clears', ({ Given, And, When, Then }) => {
    const deps = makeDependencies();
    let retrier: Retrier;
    let script: ReturnType<typeof failingThenSucceeding<string>>;
    let outcome: Outcome | undefined;

    Given('a retrier that allows 4 attempts', () => {
      retrier = new Retrier(makePolicy({ maxAttempts: 4 }), deps);
    });
    And('an operation that fails 2 times and then returns "ok"', () => {
      script = failingThenSucceeding(2, 'ok');
    });
    When('the retrier runs the operation', async () => {
      outcome = await settle(retrier.run(script.operation));
    });
    Then('the run resolves with "ok"', () => {
      expect(outcome).toEqual({ value: 'ok' });
    });
    And('the operation ran 3 times', () => {
      expect(script.calls).toEqual([1, 2, 3]);
    });
  });

  Scenario('Give up after the last attempt', ({ Given, And, When, Then }) => {
    let retrier: Retrier;
    let script: ReturnType<typeof alwaysFailing>;
    let outcome: Outcome | undefined;

    Given('a retrier that allows 3 attempts', () => {
      retrier = new Retrier(makePolicy({ maxAttempts: 3 }), makeDependencies());
    });
    And('an operation that always fails', () => {
      script = alwaysFailing();
    });
    When('the retrier runs the operation', async () => {
      outcome = await settle(retrier.run(script.operation));
    });
    Then('the run fails with a RetryExhaustedError that counts 3 attempts', () => {
      const error = errorOf(outcome);
      expect(error).toBeInstanceOf(RetryExhaustedError);
      expect(error).toMatchObject({ attempts: 3 });
    });
    And("the error's cause is the failure of attempt 3", () => {
      expect(errorOf(outcome)).toMatchObject({ cause: new Error('failure 3') });
    });
  });

  Scenario('Stop when the caller aborts', ({ Given, And, When, Then }) => {
    const controller = new AbortController();
    const delayStarted = Promise.withResolvers<undefined>();
    // Waits until the abort, so the scenario controls exactly when the delay ends.
    const deps = makeDependencies({
      sleeper: {
        sleep: (_ms, signal) =>
          new Promise<void>((_resolve, reject) => {
            delayStarted.resolve(undefined);
            signal?.addEventListener('abort', () => {
              reject(new Error('aborted'));
            });
          }),
      },
    });
    let retrier: Retrier;
    let script: ReturnType<typeof alwaysFailing>;
    let outcome: Outcome | undefined;

    Given('a retrier that allows 5 attempts', () => {
      retrier = new Retrier(makePolicy({ maxAttempts: 5 }), deps);
    });
    And('an operation that always fails', () => {
      script = alwaysFailing();
    });
    When('the caller aborts during the first delay', async () => {
      const pending = settle(retrier.run(script.operation, controller.signal));
      await delayStarted.promise;
      controller.abort(new Error('Caller gave up'));
      outcome = await pending;
    });
    Then('the run fails with a RetryAbortedError', () => {
      expect(errorOf(outcome)).toBeInstanceOf(RetryAbortedError);
    });
    And('the operation ran 1 time', () => {
      expect(script.calls).toEqual([1]);
    });
  });

  Scenario('Retry only errors the predicate marks as transient', ({ Given, And, When, Then }) => {
    const validationError = Object.assign(new Error('Title is required'), {
      name: 'ValidationError',
    });
    let retrier: Retrier;
    let operation: () => Promise<string>;
    let outcome: Outcome | undefined;
    let calls = 0;

    Given('a retrier that allows 5 attempts and retries only errors named "TimeoutError"', () => {
      const policy = makePolicy({
        maxAttempts: 5,
        shouldRetry: (error) => error instanceof Error && error.name === 'TimeoutError',
      });
      retrier = new Retrier(policy, makeDependencies());
    });
    And('an operation that fails with an error named "ValidationError"', () => {
      operation = () => {
        calls += 1;
        return Promise.reject(validationError);
      };
    });
    When('the retrier runs the operation', async () => {
      outcome = await settle(retrier.run(operation));
    });
    Then('the run fails with a RetryExhaustedError that counts 1 attempt', () => {
      const error = errorOf(outcome);
      expect(error).toBeInstanceOf(RetryExhaustedError);
      expect(error).toMatchObject({ attempts: 1 });
      expect(calls).toBe(1);
    });
    And('the error\'s cause is the "ValidationError"', () => {
      expect(errorOf(outcome)).toHaveProperty('cause', validationError);
    });
  });

  Scenario('Give up before a delay would overrun the time budget', ({ Given, And, When, Then }) => {
    const deps = makeDependencies();
    let retrier: Retrier;
    let script: ReturnType<typeof alwaysFailing>;
    let outcome: Outcome | undefined;

    Given(
      'a retrier that allows 100 attempts with a 100 ms base delay and a 250 ms time budget',
      () => {
        const policy = makePolicy({ maxAttempts: 100, baseDelayMs: 100, maxElapsedMs: 250 });
        retrier = new Retrier(policy, deps);
      },
    );
    And('an operation that always fails', () => {
      script = alwaysFailing();
    });
    When('the retrier runs the operation', async () => {
      outcome = await settle(retrier.run(script.operation));
    });
    Then('the run fails with a RetryExhaustedError that counts fewer than 100 attempts', () => {
      const error = errorOf(outcome);
      expect(error).toBeInstanceOf(RetryExhaustedError);
      expect((error as RetryExhaustedError).attempts).toBeLessThan(100);
    });
    And('the fake clock never passed 250 ms', () => {
      expect(deps.clock.now()).toBeLessThanOrEqual(250);
    });
  });
});
