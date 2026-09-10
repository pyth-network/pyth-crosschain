# Pyth MCP Code Mode Adoption Plan

## Decision

Adopt Code Mode and host on Cloudflare Workers by default.

This is the shortest path to:
- Stable `search` + `execute` tool surface as APIs evolve
- Strong token security via server-side injection
- Full observability with low operational overhead

## Why This Direction

- Code Mode keeps MCP tool count fixed while backend APIs grow.
- Server-side token injection avoids passing `access_token` in model-visible calls.
- Cloudflare execution sandboxing is production-ready for generated code workloads.
- Cloudflare access controls and centralized logging align with security requirements.

## Architecture (Target)

- Expose Code Mode tools:
  - `search`
  - `execute`
- Keep existing traditional tools as fallback during rollout.
- Route `get_latest_price` through a wrapper that injects a server-managed token.
- Never expose the token in tool schema, prompt context, or user-provided arguments.

## Hosting Recommendation

Primary:
- Cloudflare Workers + Dynamic Worker Loader

Fallback (only if Cloudflare is not allowed):
- Kubernetes + Node + `isolated-vm` + OpenTelemetry

## Security Requirements

- Use one server-managed Pyth Pro token from a secret manager.
- Inject token only inside execution boundary.
- Block outbound network from generated code except approved tool proxy path.
- Enforce per-request timeouts and rate limits.
- Redact secrets from all logs and error payloads.

## Observability Requirements

- Traces:
  - MCP request span
  - code execution span
  - upstream API spans
- Metrics:
  - execution latency (p50/p95/p99)
  - sandbox timeout/error rates
  - upstream error rates
  - tool calls per execution
  - response size
- Structured logs:
  - `requestId`, `sessionId`, `clientName`, `toolsCalled`, `executionTimeMs`
- Dashboards:
  - reliability
  - security events
  - Code Mode adoption and efficiency

## Rollout Plan

1. Add feature flag: `ENABLE_CODE_MODE`.
2. Implement `search` and `execute` with token-injecting wrapper.
3. Add tests for:
   - token injection
   - sandbox timeout/network blocking
   - multi-step one-roundtrip execution
4. Launch internal beta with fallback tools enabled.
5. Make Code Mode default after stability and observability targets are met.

## Exit Criteria for Default-On

- No token leakage in request/response/log pipelines.
- Sandbox timeout and error rates within SLO.
- Code Mode handles majority of complex multi-step queries.
- Traditional fallback remains available for client compatibility.
