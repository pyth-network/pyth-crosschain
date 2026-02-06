/**
 * Tests for MCP prompts
 */

import { describe, it, expect } from 'vitest';
import { handleGetPrompt } from '../prompts/handlers.js';
import { PROMPT_DEFINITIONS, getPromptDefinition } from '../prompts/definitions.js';

describe('Prompt Definitions', () => {
  it('should have all required prompts defined', () => {
    const requiredPrompts = [
      'analyze_price_feed',
      'compare_assets',
      'market_overview',
      'volatility_report',
      'price_deviation_check',
    ];

    for (const promptName of requiredPrompts) {
      const prompt = getPromptDefinition(promptName);
      expect(prompt, `Prompt ${promptName} should exist`).toBeDefined();
    }
  });

  it('should have descriptions on all prompts', () => {
    for (const prompt of PROMPT_DEFINITIONS) {
      expect(prompt.description, `Prompt ${prompt.name} should have description`).toBeDefined();
      expect(prompt.description.length).toBeGreaterThan(10);
    }
  });

  it('should have arguments defined', () => {
    for (const prompt of PROMPT_DEFINITIONS) {
      expect(prompt.arguments, `Prompt ${prompt.name} should have arguments`).toBeDefined();
      expect(Array.isArray(prompt.arguments)).toBe(true);
    }
  });

  it('should have required arguments marked', () => {
    const analyzePrompt = getPromptDefinition('analyze_price_feed');
    expect(analyzePrompt?.arguments?.find(arg => arg.name === 'symbol')?.required).toBe(true);
  });
});

describe('Prompt Handlers', () => {
  describe('analyze_price_feed', () => {
    it('should return valid prompt result', () => {
      const result = handleGetPrompt('analyze_price_feed', { symbol: 'BTC' });

      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('messages');
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
    });

    it('should include symbol in prompt text', () => {
      const result = handleGetPrompt('analyze_price_feed', { symbol: 'ETH' });

      const content = result.messages[0].content;
      expect(content.type).toBe('text');
      expect(content.text).toContain('ETH');
    });

    it('should include tool usage instructions', () => {
      const result = handleGetPrompt('analyze_price_feed', { symbol: 'BTC' });

      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain('get_price_feeds');
      expect(text).toContain('get_latest_price');
      expect(text).toContain('get_twap');
    });

    it('should use default symbol if not provided', () => {
      const result = handleGetPrompt('analyze_price_feed', {});

      expect(result.description).toContain('BTC');
    });
  });

  describe('compare_assets', () => {
    it('should return valid prompt for multiple assets', () => {
      const result = handleGetPrompt('compare_assets', { symbols: 'BTC,ETH,SOL' });

      expect(result.description).toContain('BTC');
      expect(result.description).toContain('ETH');
      expect(result.description).toContain('SOL');
    });

    it('should include comparison table instructions', () => {
      const result = handleGetPrompt('compare_assets', { symbols: 'BTC,ETH' });

      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain('Comparison Table');
      expect(text).toContain('Asset');
      expect(text).toContain('Price');
    });
  });

  describe('market_overview', () => {
    it('should return valid prompt for category', () => {
      const result = handleGetPrompt('market_overview', { category: 'crypto' });

      expect(result.description).toContain('crypto');
      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain('CRYPTO');
    });

    it('should include market report structure', () => {
      const result = handleGetPrompt('market_overview', { category: 'crypto' });

      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain('Market Overview');
      expect(text).toContain('Top Performers');
      expect(text).toContain('Underperformers');
    });
  });

  describe('volatility_report', () => {
    it('should return valid prompt with window parameter', () => {
      const result = handleGetPrompt('volatility_report', { symbol: 'BTC', window: '300' });

      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain('BTC');
      expect(text).toContain('300');
    });

    it('should include volatility metrics structure', () => {
      const result = handleGetPrompt('volatility_report', { symbol: 'ETH' });

      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain('Volatility Report');
      expect(text).toContain('Confidence Analysis');
      expect(text).toContain('TWAP Divergence');
      expect(text).toContain('Risk Assessment');
    });

    it('should use default window if not provided', () => {
      const result = handleGetPrompt('volatility_report', { symbol: 'BTC' });

      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain('300'); // default window
    });
  });

  describe('price_deviation_check', () => {
    it('should return valid prompt', () => {
      const result = handleGetPrompt('price_deviation_check', { base_asset: 'BTC' });

      expect(result.description).toContain('BTC');
      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain('BTC');
    });

    it('should include deviation analysis structure', () => {
      const result = handleGetPrompt('price_deviation_check', { base_asset: 'ETH' });

      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain('Price Deviation Check');
      expect(text).toContain('Stablecoin Health');
      expect(text).toContain('USDC');
      expect(text).toContain('USDT');
    });

    it('should include anomaly detection guidance', () => {
      const result = handleGetPrompt('price_deviation_check', { base_asset: 'BTC' });

      const text = (result.messages[0].content as { text: string }).text;
      expect(text).toContain('Anomaly Detection');
      expect(text).toContain('depeg');
    });
  });

  describe('Unknown prompt', () => {
    it('should throw for unknown prompt', () => {
      expect(() => handleGetPrompt('nonexistent_prompt', {})).toThrow('Unknown prompt');
    });
  });
});
