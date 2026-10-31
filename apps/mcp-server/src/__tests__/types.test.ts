/**
 * Tests for Pyth type definitions and utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  PriceFeedSchema,
  PriceUpdateResponseSchema,
  TwapResponseSchema,
  priceToDecimal,
  formatPrice,
  isValidFeedId,
  normalizeFeedId,
} from '../types/pyth.js';

describe('Type Schemas', () => {
  describe('PriceFeedSchema', () => {
    it('should validate a valid price feed', () => {
      const validFeed = {
        id: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
        attributes: {
          asset_type: 'crypto',
          base: 'BTC',
          description: 'BTC/USD',
          generic_symbol: 'BTCUSD',
          quote_currency: 'USD',
          symbol: 'Crypto.BTC/USD',
        },
      };

      const result = PriceFeedSchema.safeParse(validFeed);
      expect(result.success).toBe(true);
    });

    it('should reject invalid feed ID format', () => {
      const invalidFeed = {
        id: 'invalid-id',
        attributes: {
          asset_type: 'crypto',
          base: 'BTC',
          description: 'BTC/USD',
          generic_symbol: 'BTCUSD',
          quote_currency: 'USD',
          symbol: 'Crypto.BTC/USD',
        },
      };

      const result = PriceFeedSchema.safeParse(invalidFeed);
      expect(result.success).toBe(false);
    });

    it('should accept feed ID without 0x prefix (API flexibility)', () => {
      // The Pyth API sometimes returns IDs without the 0x prefix
      const feedWithoutPrefix = {
        id: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
        attributes: {
          asset_type: 'crypto',
          base: 'BTC',
          description: 'BTC/USD',
          generic_symbol: 'BTCUSD',
          quote_currency: 'USD',
          symbol: 'Crypto.BTC/USD',
        },
      };

      const result = PriceFeedSchema.safeParse(feedWithoutPrefix);
      expect(result.success).toBe(true);
    });
  });

  describe('PriceUpdateResponseSchema', () => {
    it('should validate a valid price update response', () => {
      const validResponse = {
        binary: {
          encoding: 'hex',
          data: ['0x1234'],
        },
        parsed: [
          {
            id: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
            price: {
              price: '4235678900000',
              conf: '123456000',
              expo: -8,
              publish_time: 1704067200,
            },
            ema_price: {
              price: '4230000000000',
              conf: '100000000',
              expo: -8,
              publish_time: 1704067200,
            },
          },
        ],
      };

      const result = PriceUpdateResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should validate response with only parsed data', () => {
      const response = {
        parsed: [
          {
            id: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
            price: {
              price: '100000000',
              conf: '1000000',
              expo: -8,
              publish_time: 1704067200,
            },
            ema_price: {
              price: '99000000',
              conf: '900000',
              expo: -8,
              publish_time: 1704067200,
            },
          },
        ],
      };

      const result = PriceUpdateResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('TwapResponseSchema', () => {
    it('should validate a valid TWAP response', () => {
      const validResponse = {
        parsed: [
          {
            id: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
            twap: {
              price: '4235000000000',
              conf: '100000000',
              expo: -8,
              publish_time: 1704067200,
            },
            start_time: 1704067140,
            end_time: 1704067200,
          },
        ],
      };

      const result = TwapResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });
  });
});

describe('Utility Functions', () => {
  describe('priceToDecimal', () => {
    it('should convert price with negative exponent', () => {
      // 4235678900000 * 10^-8 = 42356.789
      const result = priceToDecimal('4235678900000', -8);
      expect(result).toBeCloseTo(42356.789, 3);
    });

    it('should handle zero exponent', () => {
      const result = priceToDecimal('100', 0);
      expect(result).toBe(100);
    });

    it('should handle positive exponent', () => {
      const result = priceToDecimal('5', 2);
      expect(result).toBe(500);
    });

    it('should handle small prices', () => {
      // 1 * 10^-8 = 0.00000001
      const result = priceToDecimal('1', -8);
      expect(result).toBeCloseTo(0.00000001, 10);
    });
  });

  describe('formatPrice', () => {
    it('should format price with appropriate decimals', () => {
      const result = formatPrice('4235678900000', -8);
      expect(result).toBe('42356.78900000');
    });

    it('should respect custom decimal places', () => {
      const result = formatPrice('4235678900000', -8, 2);
      expect(result).toBe('42356.79');
    });

    it('should format whole numbers correctly', () => {
      const result = formatPrice('100', 0);
      expect(result).toBe('100');
    });
  });

  describe('isValidFeedId', () => {
    it('should validate correct feed ID', () => {
      const validId = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
      expect(isValidFeedId(validId)).toBe(true);
    });

    it('should reject ID without 0x prefix', () => {
      const invalidId = 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
      expect(isValidFeedId(invalidId)).toBe(false);
    });

    it('should reject ID with wrong length', () => {
      const shortId = '0xe62df6c8b4a85fe1a67db44dc12de5db';
      expect(isValidFeedId(shortId)).toBe(false);
    });

    it('should reject ID with invalid characters', () => {
      const invalidId = '0xg62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
      expect(isValidFeedId(invalidId)).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidFeedId('')).toBe(false);
    });
  });

  describe('normalizeFeedId', () => {
    it('should add 0x prefix if missing', () => {
      const id = 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
      const result = normalizeFeedId(id);
      expect(result).toBe('0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43');
    });

    it('should lowercase uppercase IDs', () => {
      const id = '0xE62DF6C8B4A85FE1A67DB44DC12DE5DB330F7AC66B72DC658AFEDF0F4A415B43';
      const result = normalizeFeedId(id);
      expect(result).toBe('0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43');
    });

    it('should not double-prefix', () => {
      const id = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
      const result = normalizeFeedId(id);
      expect(result).toBe(id);
    });
  });
});
