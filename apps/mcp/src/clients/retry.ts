const RETRY_BASE_DELAY_MS = 500;
const JITTER_MAX_MS = 200;
const MAX_RETRY_DELAY_MS = 30_000;
const NETWORK_ERROR_PATTERN = /fetch|network|ECONNREFUSED|ENOTFOUND/i;

const MAX_DETAIL_CHARS = 500;

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfter?: number,
    /** Upstream response body text, e.g. the reason for a 403. */
    public readonly detail?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Build an HttpError from a non-OK response, keeping the upstream body text. */
export async function httpErrorFromResponse(
  res: Response,
  message: string,
): Promise<HttpError> {
  const body = await res.text().catch(() => "");
  const detail = body.trim().slice(0, MAX_DETAIL_CHARS) || undefined;
  return new HttpError(res.status, message, parseRetryAfter(res), detail);
}

function isRetryable(err: unknown): boolean {
  if (err instanceof HttpError) {
    return err.status === 429 || err.status === 503;
  }
  if (err instanceof TypeError && NETWORK_ERROR_PATTERN.test(err.message)) {
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
