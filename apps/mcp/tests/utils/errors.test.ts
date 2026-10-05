import { HttpError, httpErrorFromResponse } from "../../src/clients/retry.js";
import {
  authErrorFor,
  rejectionErrorFor,
  toolError,
} from "../../src/utils/errors.js";

describe("toolError", () => {
  it("creates MCP tool error format", () => {
    const result = toolError("Something went wrong");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Something went wrong");
  });
});

describe("authErrorFor", () => {
  it("maps 401 to the invalid-token message", () => {
    const mapped = authErrorFor(new HttpError(401, "unauthorized"));
    expect(mapped?.errorType).toBe("auth");
    expect(mapped?.message).toContain("invalid or expired");
  });

  it("maps 403 to the not-entitled message including the upstream detail", () => {
    const mapped = authErrorFor(
      new HttpError(403, "forbidden", undefined, "Not entitled: feed 3063"),
    );
    expect(mapped?.errorType).toBe("not_entitled");
    expect(mapped?.message).toContain("Not entitled: feed 3063");
    expect(mapped?.message).toContain("not entitled to this feed");
  });

  it("handles a 403 without an upstream body", () => {
    const mapped = authErrorFor(new HttpError(403, "forbidden"));
    expect(mapped?.message).toContain("Pyth Pro denied access (403).");
  });

  it("returns undefined for other errors", () => {
    expect(authErrorFor(new HttpError(500, "boom"))).toBeUndefined();
    expect(authErrorFor(new Error("boom"))).toBeUndefined();
  });

  it("reports the Router's 403 'Unknown feed' as not found, not as an entitlement problem", () => {
    // Verified live: the Router answers 403 "Unknown feed: 4000000".
    const mapped = authErrorFor(
      new HttpError(403, "forbidden", undefined, "Unknown feed: 4000000"),
    );
    expect(mapped?.errorType).toBe("not_found");
    expect(mapped?.message).toContain("Unknown feed: 4000000");
    expect(mapped?.message).not.toContain("not entitled");
  });
});

describe("rejectionErrorFor", () => {
  it("carries Pyth's reason for a 400 and never says to try again", () => {
    const mapped = rejectionErrorFor(
      new HttpError(
        400,
        "bad",
        undefined,
        "Price feed id 112 is not available for channel real_time",
      ),
      "Check min_channel.",
    );
    expect(mapped?.errorType).toBe("validation");
    expect(mapped?.message).toBe(
      "Pyth Pro rejected the request (400): Price feed id 112 is not available for channel real_time. Check min_channel.",
    );
    expect(mapped?.message).not.toMatch(/try again/i);
  });

  it("maps a 404 to not_found, with or without a body", () => {
    expect(rejectionErrorFor(new HttpError(404, "nf"), "Hint.")).toEqual({
      errorType: "not_found",
      message: "Pyth Pro rejected the request (404). Hint.",
    });
  });

  it("ignores other statuses and non-HTTP errors", () => {
    expect(rejectionErrorFor(new HttpError(500, "x"), "")).toBeUndefined();
    expect(rejectionErrorFor(new HttpError(403, "x"), "")).toBeUndefined();
    expect(rejectionErrorFor(new Error("x"), "")).toBeUndefined();
  });
});

describe("httpErrorFromResponse", () => {
  it("keeps the trimmed upstream body as detail", async () => {
    const err = await httpErrorFromResponse(
      new Response("  Not entitled: feed 3063  ", { status: 403 }),
      "History API returned 403",
    );
    expect(err.status).toBe(403);
    expect(err.message).toBe("History API returned 403");
    expect(err.detail).toBe("Not entitled: feed 3063");
  });

  it("caps long bodies at 500 characters", async () => {
    const err = await httpErrorFromResponse(
      new Response("x".repeat(2000), { status: 500 }),
      "boom",
    );
    expect(err.detail).toHaveLength(500);
  });

  it("leaves detail undefined for an empty body", async () => {
    const err = await httpErrorFromResponse(
      new Response(null, { status: 401 }),
      "unauthorized",
    );
    expect(err.detail).toBeUndefined();
  });

  it("stops reading a large body after the first few KB", async () => {
    const chunk = new TextEncoder().encode("x".repeat(1024));
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += chunk.byteLength;
        if (pulled > 10 * 1024 * 1024) controller.close();
        else controller.enqueue(chunk);
      },
    });
    const err = await httpErrorFromResponse(
      new Response(body, { status: 502 }),
      "boom",
    );
    expect(err.detail).toHaveLength(500);
    expect(pulled).toBeLessThan(64 * 1024);
  });
});
