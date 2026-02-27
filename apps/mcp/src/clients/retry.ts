const RETRY_BASE_DELAY_MS = 500;
const JITTER_MAX_MS = 200;
const MAX_RETRY_DELAY_MS = 30_000;

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function isRetryable(err: unknown): boolean {
  if (err instanceof HttpError) {
    return err.status === 429 || err.status === 503;
  }
  if (err instanceof TypeError && err.message.includes("fetch")) {
    return true; // network error
  }
  if (
    err instanceof DOMException &&
    (err.name === "AbortError" || err.name === "TimeoutError")
  ) {
    return true; // timeout
  }
  return false;
}

function getDelay(err: unknown): number {
  if (err instanceof HttpError && err.retryAfter != null) {
    return Math.min(err.retryAfter * 1000, MAX_RETRY_DELAY_MS);
  }
  return RETRY_BASE_DELAY_MS + Math.random() * JITTER_MAX_MS;
}

export function parseRetryAfter(res: Response): number | undefined {
  const header = res.headers.get("Retry-After");
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds;
  const dateMs = Date.parse(header);
  if (Number.isNaN(dateMs)) return undefined;
  return Math.max(0, (dateMs - Date.now()) / 1000);
}

export async function withSingleRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isRetryable(err)) throw err;
    const delay = getDelay(err);
    await new Promise((r) => setTimeout(r, delay));
    return fn();
  }
}
