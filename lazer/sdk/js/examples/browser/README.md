# Lazer SDK Browser/Worker Example

This example validates that the SDK works in browsers (including Web Workers) and that authentication uses the ACCESS_TOKEN query parameter path.

Contents:
- index.html: launches a Web Worker and displays logs
- worker.js: runs the SDK in a Worker, wraps WebSocket to log the actual URL used
- isomorphic-ws.js: shim that provides globalThis.WebSocket to the SDK
- ttlcache.js, ts-log.js: lightweight shims used by the built ESM

Requirements:
- Node 18+ or Python 3 (any static file server works)
- The SDK built as ESM

Build the SDK (from repo root):
- pnpm --filter @pythnetwork/pyth-lazer-sdk run build:esm

Serve this folder over HTTP (pick one):
- Python 3:
  cd lazer/sdk/js/examples/browser
  python3 -m http.server 8000
- Node (npx):
  cd lazer/sdk/js/examples/browser
  npx http-server -p 8000
- Node (alternative):
  cd lazer/sdk/js/examples/browser
  npx serve -l 8000 .

Run:
- Open the served index.html in your browser
- Enter your Lazer URL and ACCESS_TOKEN in the input fields (no defaults are provided)
- Optionally, you can prefill via query params ?url=...&token=...
- Click "Start Worker Test"

Expected:
- "Worker env -> isNode: false, hasWebSocket: true"
- "Worker WebSocket URL: wss://.../v1/stream?ACCESS_TOKEN=..."
- "Worker connected" and messages for a few seconds

Notes:
- The Worker wraps WebSocket to postMessage the URL so you can verify the ACCESS_TOKEN query param is present.
- ResilientWebSocket is unchanged. All auth logic is centralized in websocket-pool.ts:
  - Browser/Worker: ACCESS_TOKEN in URL query
  - Node: Authorization: Bearer header
