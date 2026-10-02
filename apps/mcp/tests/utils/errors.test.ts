import { HttpError, httpErrorFromResponse } from "../../src/clients/retry.js";
import { authErrorFor, toolError } from "../../src/utils/errors.js";

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
});
