# Why full jitter

When a dependency fails, every client that called it fails at about the same moment. If
every client then waits the same fixed delay, they all retry at the same moment too, and
the recovering dependency takes the whole load again. Exponential backoff alone does not
fix this: the waves get further apart, but each wave still arrives at once.

Jitter spreads each wave out. `@dbp/retry` uses _full jitter_: the delay before retry `n`
is a uniform random pick between 0 and `min(maxDelayMs, baseDelayMs * 2^(n-1))`. The
window still doubles, so a client backs off from a dependency that stays down, but clients
land anywhere in the window instead of on its edge.

In the AWS analysis
[Exponential Backoff and Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/),
full jitter and decorrelated jitter both beat plain backoff by a wide margin, and full
jitter does the least total work. It is also stateless: each delay depends only on the
retry number, so there is no previous delay to carry between attempts.

The trade-off is that a single retry can happen almost immediately, because 0 is inside
the window. When a retry must never come sooner than some floor, enforce the floor in the
operation, not in the backoff.

## Why the random source can be `Math.random`

Jitter needs spread, not unpredictability. Nobody gains anything by predicting when a
client retries, so a cryptographic random source would cost speed and buy nothing.
