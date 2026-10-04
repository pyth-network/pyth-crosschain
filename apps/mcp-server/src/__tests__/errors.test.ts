/**
 * Tests for Pyth error types
 */

import { describe, it, expect } from 'vitest';
import {
  PythError,
  PythErrorCode,
  ValidationError,
  InvalidFeedIdError,
  FeedNotFoundError,
  ApiError,
  NetworkError,
  RateLimitError,
  TimeoutError,
  isPythError,
  wrapError,
} from '../types/errors.js';

describe('PythError', () => {
  it('should create error with code and message', () => {
    const error = new PythError(PythErrorCode.API_ERROR, 'Test error');
    expect(error.code).toBe(PythErrorCode.API_ERROR);
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('PythError');
    expect(error.timestamp).toBeDefined();
  });

  it('should include details when provided', () => {
    const details = { endpoint: '/test', statusCode: 500 };
    const error = new PythError(PythErrorCode.API_ERROR, 'Test error', details);
    expect(error.details).toEqual(details);
  });

  it('should serialize to JSON correctly', () => {
    const error = new PythError(PythErrorCode.API_ERROR, 'Test error', { foo: 'bar' });
    const json = error.toJSON();

    expect(json).toEqual({
      error: true,
      code: PythErrorCode.API_ERROR,
      message: 'Test error',
      details: { foo: 'bar' },
      timestamp: error.timestamp,
    });
  });
});

describe('ValidationError', () => {
  it('should create with INVALID_PARAMETER code', () => {
    const error = new ValidationError('Invalid input');
    expect(error.code).toBe(PythErrorCode.INVALID_PARAMETER);
    expect(error.name).toBe('ValidationError');
  });
});

describe('InvalidFeedIdError', () => {
  it('should include feed ID in message and details', () => {
    const error = new InvalidFeedIdError('bad-id');
    expect(error.code).toBe(PythErrorCode.INVALID_FEED_ID);
    expect(error.feedId).toBe('bad-id');
    expect(error.message).toContain('bad-id');
    expect(error.name).toBe('InvalidFeedIdError');
  });
});

describe('FeedNotFoundError', () => {
  it('should include feed ID', () => {
    const feedId = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
    const error = new FeedNotFoundError(feedId);
    expect(error.code).toBe(PythErrorCode.FEED_NOT_FOUND);
    expect(error.feedId).toBe(feedId);
  });
});

describe('ApiError', () => {
  it('should include endpoint and status code', () => {
    const error = new ApiError('/v2/price_feeds', 'Not found', 404);
    expect(error.code).toBe(PythErrorCode.API_ERROR);
    expect(error.endpoint).toBe('/v2/price_feeds');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('ApiError');
  });

  it('should work without status code', () => {
    const error = new ApiError('/test', 'Connection failed');
    expect(error.statusCode).toBeUndefined();
  });
});

describe('NetworkError', () => {
  it('should include endpoint', () => {
    const error = new NetworkError('/test');
    expect(error.code).toBe(PythErrorCode.NETWORK_ERROR);
    expect(error.endpoint).toBe('/test');
    expect(error.name).toBe('NetworkError');
  });

  it('should include cause when provided', () => {
    const cause = new Error('Connection refused');
    const error = new NetworkError('/test', cause);
    expect(error.details).toEqual({
      endpoint: '/test',
      cause: 'Connection refused',
    });
  });
});

describe('RateLimitError', () => {
  it('should include retry after', () => {
    const error = new RateLimitError(5000);
    expect(error.code).toBe(PythErrorCode.RATE_LIMITED);
    expect(error.retryAfter).toBe(5000);
    expect(error.message).toContain('5000');
    expect(error.name).toBe('RateLimitError');
  });

  it('should work without retry after', () => {
    const error = new RateLimitError();
    expect(error.retryAfter).toBeUndefined();
  });
});

describe('TimeoutError', () => {
  it('should include endpoint and timeout', () => {
    const error = new TimeoutError('/test', 30000);
    expect(error.code).toBe(PythErrorCode.TIMEOUT);
    expect(error.endpoint).toBe('/test');
    expect(error.timeoutMs).toBe(30000);
    expect(error.message).toContain('30000');
    expect(error.name).toBe('TimeoutError');
  });
});

describe('isPythError', () => {
  it('should return true for PythError instances', () => {
    const error = new PythError(PythErrorCode.API_ERROR, 'Test');
    expect(isPythError(error)).toBe(true);
  });

  it('should return true for subclasses', () => {
    expect(isPythError(new ValidationError('Test'))).toBe(true);
    expect(isPythError(new InvalidFeedIdError('bad'))).toBe(true);
    expect(isPythError(new ApiError('/test', 'error'))).toBe(true);
  });

  it('should return false for regular errors', () => {
    expect(isPythError(new Error('Test'))).toBe(false);
  });

  it('should return false for non-errors', () => {
    expect(isPythError('error')).toBe(false);
    expect(isPythError(null)).toBe(false);
    expect(isPythError(undefined)).toBe(false);
    expect(isPythError({ message: 'error' })).toBe(false);
  });
});

describe('wrapError', () => {
  it('should return PythError unchanged', () => {
    const original = new ValidationError('Test');
    const wrapped = wrapError(original);
    expect(wrapped).toBe(original);
  });

  it('should wrap regular Error', () => {
    const original = new Error('Something went wrong');
    const wrapped = wrapError(original);

    expect(wrapped).toBeInstanceOf(PythError);
    expect(wrapped.code).toBe(PythErrorCode.UNKNOWN_ERROR);
    expect(wrapped.message).toBe('Something went wrong');
    expect(wrapped.details).toHaveProperty('name', 'Error');
  });

  it('should wrap string errors', () => {
    const wrapped = wrapError('String error');
    expect(wrapped).toBeInstanceOf(PythError);
    expect(wrapped.code).toBe(PythErrorCode.UNKNOWN_ERROR);
    expect(wrapped.message).toBe('String error');
  });

  it('should wrap null/undefined', () => {
    expect(wrapError(null).message).toBe('null');
    expect(wrapError(undefined).message).toBe('undefined');
  });
});
