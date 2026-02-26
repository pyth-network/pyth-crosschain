/**
 * Pyth MCP Server error types
 * Structured errors for actionable debugging
 */

/**
 * Error codes for Pyth MCP operations
 */
export enum PythErrorCode {
  // Validation errors
  INVALID_FEED_ID = 'INVALID_FEED_ID',
  INVALID_TIMESTAMP = 'INVALID_TIMESTAMP',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  TOO_MANY_FEEDS = 'TOO_MANY_FEEDS',

  // API errors
  FEED_NOT_FOUND = 'FEED_NOT_FOUND',
  TIMESTAMP_OUT_OF_RANGE = 'TIMESTAMP_OUT_OF_RANGE',
  RATE_LIMITED = 'RATE_LIMITED',
  API_ERROR = 'API_ERROR',

  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',

  // Internal errors
  PARSE_ERROR = 'PARSE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Base error class for Pyth MCP operations
 */
export class PythError extends Error {
  public readonly code: PythErrorCode;
  public readonly details?: unknown;
  public readonly timestamp: number;

  constructor(code: PythErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'PythError';
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PythError);
    }
  }

  /**
   * Convert to JSON-serializable format for MCP responses
   */
  toJSON(): Record<string, unknown> {
    return {
      error: true,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Error for invalid input parameters
 */
export class ValidationError extends PythError {
  constructor(message: string, details?: unknown) {
    super(PythErrorCode.INVALID_PARAMETER, message, details);
    this.name = 'ValidationError';
  }
}

/**
 * Error for invalid feed IDs
 */
export class InvalidFeedIdError extends PythError {
  public readonly feedId: string;

  constructor(feedId: string) {
    super(
      PythErrorCode.INVALID_FEED_ID,
      `Invalid price feed ID: ${feedId}. Expected 64-character hex string with 0x prefix.`,
      { feedId }
    );
    this.name = 'InvalidFeedIdError';
    this.feedId = feedId;
  }
}

/**
 * Error for feed not found
 */
export class FeedNotFoundError extends PythError {
  public readonly feedId: string;

  constructor(feedId: string) {
    super(PythErrorCode.FEED_NOT_FOUND, `Price feed not found: ${feedId}`, { feedId });
    this.name = 'FeedNotFoundError';
    this.feedId = feedId;
  }
}

/**
 * Error for API failures
 */
export class ApiError extends PythError {
  public readonly statusCode: number | undefined;
  public readonly endpoint: string;

  constructor(endpoint: string, message: string, statusCode?: number, details?: unknown) {
    super(PythErrorCode.API_ERROR, `API error at ${endpoint}: ${message}`, {
      statusCode,
      endpoint,
      ...((details as object) ?? {}),
    });
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.endpoint = endpoint;
  }
}

/**
 * Error for network issues
 */
export class NetworkError extends PythError {
  public readonly endpoint: string;

  constructor(endpoint: string, cause?: Error) {
    super(PythErrorCode.NETWORK_ERROR, `Network error connecting to ${endpoint}`, {
      endpoint,
      cause: cause?.message,
    });
    this.name = 'NetworkError';
    this.endpoint = endpoint;
  }
}

/**
 * Error for rate limiting
 */
export class RateLimitError extends PythError {
  public readonly retryAfter: number | undefined;

  constructor(retryAfter?: number) {
    super(
      PythErrorCode.RATE_LIMITED,
      `Rate limited${retryAfter ? `. Retry after ${retryAfter}ms` : ''}`,
      { retryAfter }
    );
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Error for timeout
 */
export class TimeoutError extends PythError {
  public readonly endpoint: string;
  public readonly timeoutMs: number;

  constructor(endpoint: string, timeoutMs: number) {
    super(PythErrorCode.TIMEOUT, `Request to ${endpoint} timed out after ${timeoutMs}ms`, {
      endpoint,
      timeoutMs,
    });
    this.name = 'TimeoutError';
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Check if an error is a PythError
 */
export function isPythError(error: unknown): error is PythError {
  return error instanceof PythError;
}

/**
 * Wrap unknown errors in PythError
 */
export function wrapError(error: unknown): PythError {
  if (isPythError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new PythError(PythErrorCode.UNKNOWN_ERROR, error.message, {
      name: error.name,
      stack: error.stack,
    });
  }

  return new PythError(PythErrorCode.UNKNOWN_ERROR, String(error));
}
