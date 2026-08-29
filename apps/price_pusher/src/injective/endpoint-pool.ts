import type { Logger } from "pino";

/**
 * Round-robin cursor over a non-empty list of gRPC endpoints. Each call site
 * rents the current endpoint, and the cursor advances when an attempt fails
 * (see `withEndpointFailover`). The cursor is shared across every gRPC API
 * helper inside a single pusher instance so that a bad endpoint affects the
 * whole pusher, not just one method.
 */
export class EndpointPool {
  private currentIndex = 0;

  constructor(
    private readonly endpoints: readonly string[],
    private readonly logger: Logger,
  ) {
    if (endpoints.length === 0) {
      throw new Error("EndpointPool requires at least one endpoint");
    }
  }

  current(): string {
    // Non-null asserted: the constructor guarantees length >= 1 and `rotate`
    // always wraps the index modulo `endpoints.length`.

    return this.endpoints[this.currentIndex]!;
  }

  rotate(reason: unknown): string {
    if (this.endpoints.length === 1) {
      return this.current();
    }
    const failed = this.current();
    this.currentIndex = (this.currentIndex + 1) % this.endpoints.length;
    this.logger.warn(
      { failedEndpoint: failed, nextEndpoint: this.current(), err: reason },
      "gRPC endpoint failed — rotating to next endpoint",
    );
    return this.current();
  }

  size(): number {
    return this.endpoints.length;
  }
}

/**
 * Try `fn` against the current endpoint; on failure, rotate to the next
 * endpoint and retry. Walks through every endpoint at most once before
 * re-throwing the last error.
 */
export async function withEndpointFailover<T>(
  pool: EndpointPool,
  fn: (endpoint: string) => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < pool.size(); attempt++) {
    const endpoint = pool.current();
    try {
      return await fn(endpoint);
    } catch (error) {
      lastError = error;
      pool.rotate(error);
    }
  }
  throw lastError;
}
