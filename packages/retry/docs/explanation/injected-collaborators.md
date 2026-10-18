# Why time, sleep, and randomness are injected

`Retrier` never reads the clock, sets a timer, or calls `Math.random` directly. It asks
the `Clock`, `Sleeper`, and `Random` passed to its constructor, and falls back to
`defaultDependencies` when you pass none.

Retry logic is all about time, and time makes tests slow and flaky:

- **Real delays make tests slow.** A test of five attempts with exponential backoff can
  wait for seconds. Multiply that by every retry path in a codebase.
- **Real clocks make tests flaky.** A budget check such as `maxElapsedMs` depends on how
  long each step took, which varies with machine load.
- **Real randomness makes assertions vague.** With live jitter, a test can only say "the
  delay was somewhere in the window".

With injected collaborators, a test passes a fake clock that only advances when the fake
sleeper sleeps, and a random source pinned to one value. The test then runs instantly and
asserts exact delays. [Test code that retries](../how-to/test-code-that-retries.md) shows
the fakes.

Global fake timers, such as Vitest's `vi.useFakeTimers()`, solve part of this, but they
patch the whole process. They also freeze timers the code under test does not own, such
as a database driver's keep-alive. Constructor injection fakes exactly the retrier's time
and nothing else.

The same design keeps the package free of hidden global state: two retriers with different
clocks can run side by side.
