import { describe, expect, it } from "vitest";
import {
  AptosChain,
  CosmWasmChain,
  EvmChain,
  FuelChain,
  IotaChain,
  NearChain,
  SuiChain,
  SvmChain,
  TonChain,
} from "../src/core/chains";

type ChainFactory = {
  fromJson: (parsed: Record<string, unknown>) => {
    getNativeToken: () => string | undefined;
    toJson: () => Record<string, unknown>;
  };
};

describe("Chain Serialization Contract Symmetry", () => {
  const chainTestCases = [
    {
      cls: CosmWasmChain,
      name: "CosmWasmChain",
      sample: {
        endpoint: "http://localhost",
        feeDenom: "uosmo",
        gasPrice: "0.025",
        id: "osmosis",
        mainnet: true,
        nativeToken: "OSMO",
        prefix: "osmo",
        type: CosmWasmChain.type,
        wormholeChainName: "osmosis",
      },
    },
    {
      cls: SuiChain,
      name: "SuiChain",
      sample: {
        endpointType: "json-rpc",
        id: "sui",
        mainnet: true,
        nativeToken: "SUI",
        rpcUrl: "http://localhost",
        type: SuiChain.type,
        wormholeChainName: "sui",
      },
    },
    {
      cls: IotaChain,
      name: "IotaChain",
      sample: {
        endpointType: "json-rpc",
        id: "iota",
        mainnet: true,
        nativeToken: "IOTA",
        rpcUrl: "http://localhost",
        type: IotaChain.type,
        wormholeChainName: "iota",
      },
    },
    {
      cls: SvmChain,
      name: "SvmChain",
      sample: {
        id: "solana",
        mainnet: true,
        nativeToken: "SOL",
        rpcUrl: "http://localhost",
        type: SvmChain.type,
        wormholeChainName: "solana",
      },
    },
    {
      cls: EvmChain,
      name: "EvmChain",
      sample: {
        id: "ethereum",
        mainnet: true,
        nativeToken: "ETH",
        networkId: 1,
        rpcUrl: "http://localhost",
        type: EvmChain.type,
      },
    },
    {
      cls: AptosChain,
      name: "AptosChain",
      sample: {
        id: "aptos",
        mainnet: true,
        nativeToken: "APT",
        rpcUrl: "http://localhost",
        type: AptosChain.type,
        wormholeChainName: "aptos",
      },
    },
    {
      cls: FuelChain,
      name: "FuelChain",
      sample: {
        gqlUrl: "http://localhost",
        id: "fuel",
        mainnet: true,
        nativeToken: "ETH",
        type: FuelChain.type,
        wormholeChainName: "fuel_mainnet",
      },
    },
    {
      cls: TonChain,
      name: "TonChain",
      sample: {
        id: "ton",
        mainnet: true,
        nativeToken: "TON",
        networkId: "0x1",
        rpcUrl: "http://localhost",
        type: TonChain.type,
        wormholeChainName: "ton_mainnet",
      },
    },
    {
      cls: NearChain,
      name: "NearChain",
      sample: {
        id: "near",
        mainnet: true,
        nativeToken: "NEAR",
        networkId: "mainnet",
        rpcUrl: "http://localhost",
        type: NearChain.type,
        wormholeChainName: "near",
      },
    },
  ];

  for (const { name, cls, sample } of chainTestCases) {
    it(`should preserve nativeToken in ${name} through fromJson -> toJson -> fromJson`, () => {
      const factory = cls as unknown as ChainFactory;
      const chain = factory.fromJson(sample);
      expect(chain.getNativeToken()).toEqual(sample.nativeToken);

      const json = chain.toJson();
      expect(json.nativeToken).toEqual(sample.nativeToken);

      const roundTripChain = factory.fromJson(json);
      expect(roundTripChain.getNativeToken()).toEqual(sample.nativeToken);
    });
  }
});
