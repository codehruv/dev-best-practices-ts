Feature: Retry transient failures
  `Retrier` runs an async operation and runs it again after a failure, waiting a
  capped, jittered, exponentially growing delay between attempts. These scenarios
  are the acceptance criteria of the package. Each one runs as a test, with a fake
  clock and sleeper so no scenario waits for real time.

  @REQ-001
  Scenario: Resolve once a transient failure clears
    Given a retrier that allows 4 attempts
    And an operation that fails 2 times and then returns "ok"
    When the retrier runs the operation
    Then the run resolves with "ok"
    And the operation ran 3 times

  @REQ-002
  Scenario: Give up after the last attempt
    Given a retrier that allows 3 attempts
    And an operation that always fails
    When the retrier runs the operation
    Then the run fails with a RetryExhaustedError that counts 3 attempts
    And the error's cause is the failure of attempt 3

  @REQ-003
  Scenario: Stop when the caller aborts
    Given a retrier that allows 5 attempts
    And an operation that always fails
    When the caller aborts during the first delay
    Then the run fails with a RetryAbortedError
    And the operation ran 1 time

  @REQ-004
  Scenario: Retry only errors the predicate marks as transient
    Given a retrier that allows 5 attempts and retries only errors named "TimeoutError"
    And an operation that fails with an error named "ValidationError"
    When the retrier runs the operation
    Then the run fails with a RetryExhaustedError that counts 1 attempt
    And the error's cause is the "ValidationError"

  @REQ-005
  Scenario: Give up before a delay would overrun the time budget
    Given a retrier that allows 100 attempts with a 100 ms base delay and a 250 ms time budget
    And an operation that always fails
    When the retrier runs the operation
    Then the run fails with a RetryExhaustedError that counts fewer than 100 attempts
    And the fake clock never passed 250 ms
