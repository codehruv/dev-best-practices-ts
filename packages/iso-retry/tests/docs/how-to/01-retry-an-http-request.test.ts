/**
 * Retry an HTTP request when it fails for a reason a retry can fix: a network error, a
 * timeout (408), a rate limit (429), or a server error (5xx). Fail fast on everything
 * else, such as 400 or 404, because sending the same request again returns the same answer.
 *
 * The samples call a local test server at `baseUrl`. Its `/flaky` route answers 503 twice,
 * then 200. Its `/missing` route always answers 404.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { Retrier, RetryExhaustedError } from '@dbp/iso-retry';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// #region client
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

class HttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

// fetch rejects with a TypeError when the network fails before any response arrives.
function isRetryable(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof HttpError && RETRYABLE_STATUSES.has(error.status))
  );
}

const retrier = new Retrier({
  maxAttempts: 4,
  baseDelayMs: 10,
  maxDelayMs: 200,
  shouldRetry: isRetryable,
});

async function getJson(url: string): Promise<unknown> {
  return retrier.run(async (_attempt, signal) => {
    const response = await fetch(url, { signal: signal ?? null });
    if (!response.ok) {
      throw new HttpError(response.status);
    }
    const body: unknown = await response.json();
    return body;
  });
}
// #endregion client

let server: Server;
let baseUrl = '';
let flakyRequests = 0;

beforeAll(async () => {
  server = createServer((request, response) => {
    if (request.url === '/flaky') {
      flakyRequests += 1;
      response.statusCode = flakyRequests <= 2 ? 503 : 200;
      response.end(JSON.stringify({ ok: flakyRequests > 2 }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'not found' }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('Retry an HTTP request', () => {
  /**
   * The server answers 503 twice while it recovers. `getJson` retries both, and the third
   * request returns the body.
   */
  it('Retry while the server recovers', async () => {
    // #region recover
    const body = await getJson(`${baseUrl}/flaky`);
    // #endregion recover

    expect(body).toEqual({ ok: true });
    expect(flakyRequests).toBe(3);
  });

  /**
   * A 404 fails `isRetryable`, so the retrier stops after the first attempt. The thrown
   * `RetryExhaustedError` reports 1 attempt, and its `cause` is the `HttpError`.
   */
  it('Fail fast on a status a retry cannot fix', async () => {
    // #region fail-fast
    const error = await getJson(`${baseUrl}/missing`).catch((caught: unknown) => caught);
    // #endregion fail-fast

    expect(error).toBeInstanceOf(RetryExhaustedError);
    expect(error).toMatchObject({ attempts: 1, cause: { status: 404 } });
  });
});
