#!/usr/bin/env node
/**
 * Pyth Network MCP Server
 * Official Model Context Protocol server for Pyth Network oracle data
 *
 * @packageDocumentation
 */

import { runServer } from './server.js';

// Run the server
runServer().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
