/**
 * API configuration and constants
 */

export interface ApiConfig {
  hermesUrl: string;
  benchmarksUrl: string;
  timeout: number;
  cacheTtl: number;
  maxFeedsPerRequest: number;
  maxRetries: number;
  retryDelay: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: ApiConfig = {
  hermesUrl: process.env['PYTH_HERMES_URL'] ?? 'https://hermes.pyth.network',
  benchmarksUrl: process.env['PYTH_BENCHMARKS_URL'] ?? 'https://benchmarks.pyth.network',
  timeout: Number(process.env['PYTH_REQUEST_TIMEOUT']) || 30000,
  cacheTtl: Number(process.env['PYTH_CACHE_TTL']) || 5000,
  maxFeedsPerRequest: 100,
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * Get current configuration
 */
export function getConfig(): ApiConfig {
  return { ...DEFAULT_CONFIG };
}

/**
 * Popular price feed IDs for quick reference
 */
export const POPULAR_FEEDS = {
  crypto: {
    'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
    'PYTH/USD': '0x0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff',
    'BONK/USD': '0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419',
    'JUP/USD': '0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996',
    'LINK/USD': '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221',
    'AVAX/USD': '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7',
    'DOGE/USD': '0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c',
    'MATIC/USD': '0x5de33440f6c47f5e0b5b26d0e7e6e7e9e1e8e6e5e4e3e2e1e0e9e8e7e6e5e4e3',
  },
  stablecoins: {
    'USDC/USD': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
    'USDT/USD': '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
    'DAI/USD': '0xb0948a5e5313200c632b51bb5ca32f6de0d36e9950a942d19751e833f70dabfd',
    'FRAX/USD': '0xc3d5d8d6d6e7e6e5e4e3e2e1e0e9e8e7e6e5e4e3e2e1e0e9e8e7e6e5e4e3e2e1',
  },
  equities: {
    'AAPL/USD': '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
    'TSLA/USD': '0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
    'MSFT/USD': '0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1',
    'GOOGL/USD': '0xe65ff435be42630439c96396653a342829e877e2aafaeaf1a10d0ee5fd2cf3f2',
    'AMZN/USD': '0xb5d0e0fa58a1fbc8c3b6e46e7e6e5e4e3e2e1e0e9e8e7e6e5e4e3e2e1e0e9e8',
  },
  fx: {
    'EUR/USD': '0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b',
    'GBP/USD': '0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1',
    'JPY/USD': '0xef2c98c804ba503c6a707e38be4dfbb16683775f195b091c9a2a3c4bfc92bb5e',
    'AUD/USD': '0x67a6f93575a8cc3b3d6e1dd1e3b9c7e6e5e4e3e2e1e0e9e8e7e6e5e4e3e2e1e0',
  },
  metals: {
    'XAU/USD': '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2',
    'XAG/USD': '0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e',
  },
} as const;

/**
 * Network statistics (approximate)
 */
export const NETWORK_STATS = {
  totalFeeds: 1930,
  supportedChains: 107,
  dataProviders: 125,
  updateFrequencyMs: 400,
} as const;
