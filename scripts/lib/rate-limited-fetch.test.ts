// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimitedFetcher } from "./rate-limited-fetch";

/** Build a minimal Response with the given status + headers. */
function res(status: number, headers: Record<string, string> = {}): Response {
  return new Response(status === 200 ? "ok" : null, { status, headers });
}

/** Stub global fetch with a queue of responses, recording call timestamps. */
function stubFetch(queue: Response[]): { calls: number[] } {
  const calls: number[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      calls.push(Date.now());
      const next = queue.shift();
      if (!next) throw new Error("fetch queue exhausted");
      return next;
    }),
  );
  return { calls };
}

describe("RateLimitedFetcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("passes successful responses through without waiting", async () => {
    const { calls } = stubFetch([res(200)]);
    const fetcher = new RateLimitedFetcher({ quiet: true });

    const t0 = Date.now();
    const response = await fetcher.fetch("https://example.test/api");

    expect(response.status).toBe(200);
    expect(calls).toEqual([t0]);
  });

  it("backs off exponentially on 5xx and caps at maxBackoffMs", async () => {
    const { calls } = stubFetch([res(503), res(503), res(503), res(200)]);
    const fetcher = new RateLimitedFetcher({
      quiet: true,
      initialBackoffMs: 2_000,
      maxBackoffMs: 5_000,
    });

    const t0 = Date.now();
    const promise = fetcher.fetch("https://example.test/api");
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(response.status).toBe(200);
    // Backoff sequence: 2s, 4s, then 8s capped to 5s.
    expect(calls.map((t) => t - t0)).toEqual([0, 2_000, 6_000, 11_000]);
  });

  it("honors Retry-After seconds on 429", async () => {
    const { calls } = stubFetch([res(429, { "Retry-After": "7" }), res(200)]);
    const fetcher = new RateLimitedFetcher({ quiet: true });

    const t0 = Date.now();
    const promise = fetcher.fetch("https://example.test/api");
    await vi.runAllTimersAsync();
    await promise;

    expect(calls.map((t) => t - t0)).toEqual([0, 7_000]);
  });

  it("falls back to 1s wait on 429 without headers", async () => {
    const { calls } = stubFetch([res(429), res(200)]);
    const fetcher = new RateLimitedFetcher({ quiet: true });

    const t0 = Date.now();
    const promise = fetcher.fetch("https://example.test/api");
    await vi.runAllTimersAsync();
    await promise;

    expect(calls.map((t) => t - t0)).toEqual([0, 1_000]);
  });

  it("waits for RateLimit-Reset when server reports 0 remaining", async () => {
    const { calls } = stubFetch([
      res(200, { "RateLimit-Remaining": "0", "RateLimit-Reset": "30" }),
      res(200, { "RateLimit-Remaining": "99" }),
    ]);
    const fetcher = new RateLimitedFetcher({ quiet: true, bufferMs: 100 });

    const t0 = Date.now();
    await fetcher.fetch("https://example.test/api");

    const promise = fetcher.fetch("https://example.test/api");
    await vi.runAllTimersAsync();
    await promise;

    // Reset is "seconds from now" + bufferMs.
    expect(calls.map((t) => t - t0)).toEqual([0, 30_100]);
  });

  it("enforces the local sliding window", async () => {
    const { calls } = stubFetch([res(200), res(200), res(200)]);
    const fetcher = new RateLimitedFetcher({
      quiet: true,
      maxRequestsPerWindow: 2,
      windowMs: 60_000,
      bufferMs: 100,
    });

    const t0 = Date.now();
    await fetcher.fetch("https://example.test/api");
    await fetcher.fetch("https://example.test/api");

    const promise = fetcher.fetch("https://example.test/api");
    await vi.runAllTimersAsync();
    await promise;

    // Third request waits until the oldest timestamp leaves the window.
    expect(calls.map((t) => t - t0)).toEqual([0, 0, 60_100]);
  });

  it("throws after maxRetries consecutive 429s", async () => {
    stubFetch([
      res(429, { "Retry-After": "1" }),
      res(429, { "Retry-After": "1" }),
      res(429, { "Retry-After": "1" }),
    ]);
    const fetcher = new RateLimitedFetcher({ quiet: true, maxRetries: 2 });

    const promise = fetcher.fetch("https://example.test/api");
    const assertion = expect(promise).rejects.toThrow(
      "Rate limit exceeded after 2 retries",
    );
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("throws after maxRetries consecutive 5xx", async () => {
    stubFetch([res(503), res(503), res(503)]);
    const fetcher = new RateLimitedFetcher({
      quiet: true,
      maxRetries: 2,
      initialBackoffMs: 10,
    });

    const promise = fetcher.fetch("https://example.test/api");
    const assertion = expect(promise).rejects.toThrow(/Server error 503/);
    await vi.runAllTimersAsync();
    await assertion;
  });
});
