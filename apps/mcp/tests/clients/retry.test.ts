import { HttpError, withSingleRetry } from "../../src/clients/retry.js";

describe("withSingleRetry", () => {
  it("returns result on first success", async () => {
    const result = await withSingleRetry(() => Promise.resolve("ok"));
    expect(result).toBe("ok");
  });

  it("retries on 503 and succeeds on second try", async () => {
    let attempts = 0;
    const result = await withSingleRetry(() => {
      attempts++;
      if (attempts === 1) throw new HttpError(503, "Service unavailable");
      return Promise.resolve("ok");
    });
    expect(result).toBe("ok");
    expect(attempts).toBe(2);
  });

  it("retries on 429 and succeeds on second try", async () => {
    let attempts = 0;
    const result = await withSingleRetry(() => {
      attempts++;
      if (attempts === 1) throw new HttpError(429, "Too many requests");
      return Promise.resolve("ok");
    });
    expect(result).toBe("ok");
    expect(attempts).toBe(2);
  });

  it("does not retry on 400", async () => {
    let attempts = 0;
    await expect(
      withSingleRetry(() => {
        attempts++;
        throw new HttpError(400, "Bad request");
      }),
    ).rejects.toThrow("Bad request");
    expect(attempts).toBe(1);
  });

  it("does not retry on 403", async () => {
    let attempts = 0;
    await expect(
      withSingleRetry(() => {
        attempts++;
        throw new HttpError(403, "Forbidden");
      }),
    ).rejects.toThrow("Forbidden");
    expect(attempts).toBe(1);
  });

  it("does not retry on 404", async () => {
    let attempts = 0;
    await expect(
      withSingleRetry(() => {
        attempts++;
        throw new HttpError(404, "Not found");
      }),
    ).rejects.toThrow("Not found");
    expect(attempts).toBe(1);
  });

  it("retries on TimeoutError", async () => {
    let attempts = 0;
    const result = await withSingleRetry(() => {
      attempts++;
      if (attempts === 1)
        throw new DOMException("Signal timed out", "TimeoutError");
      return Promise.resolve("ok");
    });
    expect(result).toBe("ok");
    expect(attempts).toBe(2);
  });

  it("fails after max retries (1 retry = 2 total attempts)", async () => {
    let attempts = 0;
    await expect(
      withSingleRetry(() => {
        attempts++;
        throw new HttpError(503, "Service unavailable");
      }),
    ).rejects.toThrow("Service unavailable");
    expect(attempts).toBe(2);
  });
});
