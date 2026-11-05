import { HermesClient } from "../hermes-client.js";

const ENDPOINT = "https://hermes.example.com";

const sentHeaders = (fetchMock: jest.SpyInstance): Headers => {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
  return new Headers(init?.headers);
};

describe("HermesClient headers", () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.resolve(Response.json([])));
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it("sends config headers given as a Headers instance", async () => {
    const client = new HermesClient(ENDPOINT, {
      headers: new Headers({ "x-api-key": "config-key" }),
    });

    await client.getPriceFeeds();

    expect(sentHeaders(fetchMock).get("x-api-key")).toBe("config-key");
  });

  it("sends config headers given as name/value pairs", async () => {
    const client = new HermesClient(ENDPOINT, {
      headers: [["x-api-key", "config-key"]],
    });

    await client.getPriceFeeds();

    const headers = sentHeaders(fetchMock);
    expect(headers.get("x-api-key")).toBe("config-key");
    expect(headers.has("0")).toBe(false);
  });

  it("sends fetchOptions headers given as a Headers instance", async () => {
    const client = new HermesClient(ENDPOINT);

    await client.getPriceFeeds({
      fetchOptions: { headers: new Headers({ "x-request-id": "abc" }) },
    });

    expect(sentHeaders(fetchMock).get("x-request-id")).toBe("abc");
  });

  it("lets later headers override earlier ones regardless of case", async () => {
    const client = new HermesClient(ENDPOINT, {
      accessToken: "token",
      headers: { authorization: "Bearer config" },
    });

    await client.getPriceFeeds({
      fetchOptions: { headers: { "X-Custom": "request" } },
    });

    const headers = sentHeaders(fetchMock);
    expect(headers.get("authorization")).toBe("Bearer config");
    expect(headers.get("x-custom")).toBe("request");
  });
});
