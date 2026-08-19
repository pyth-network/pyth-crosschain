/**
 * @jest-environment node
 */
import { fetchEntropyDeployments } from "./entropy-api-data-fetcher";

const apiChain = (name: string, network_id: number) => ({
  contract_addr: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
  default_fee: 1,
  gas_limit: 500_000,
  name,
  network_id,
  reveal_delay_blocks: 1,
});

const mockApi = (chains: ReturnType<typeof apiChain>[]) => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve(chains),
  }) as unknown as typeof fetch;
};

describe("fetchEntropyDeployments", () => {
  it("keeps chains without a deprecated deployment", async () => {
    mockApi([apiChain("base", 8453), apiChain("kaia", 8217)]);

    expect(
      Object.keys(await fetchEntropyDeployments("https://example.com")),
    ).toEqual(["base", "kaia"]);
  });

  it("drops deprecated deployments matched by network id", async () => {
    mockApi([apiChain("base", 8453), apiChain("sei-evm", 1329)]);

    expect(
      Object.keys(await fetchEntropyDeployments("https://example.com")),
    ).toEqual(["base"]);
  });

  it("keeps etherlink, which reports no network id but is not deprecated", async () => {
    mockApi([apiChain("base", 8453), apiChain("etherlink-testnet", 0)]);

    expect(
      Object.keys(await fetchEntropyDeployments("https://example.com")),
    ).toEqual(["base", "etherlink-testnet"]);
  });

  it("drops deprecated deployments the API reports without a network id", async () => {
    mockApi([apiChain("base", 8453), apiChain("taiko", 0)]);

    expect(
      Object.keys(await fetchEntropyDeployments("https://example.com")),
    ).toEqual(["base"]);
  });
});
