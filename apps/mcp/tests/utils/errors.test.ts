import { toolError } from "../../src/utils/errors.js";

describe("toolError", () => {
  it("creates MCP tool error format", () => {
    const result = toolError("Something went wrong");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Something went wrong");
  });
});
