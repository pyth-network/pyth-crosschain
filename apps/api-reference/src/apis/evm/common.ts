import { z } from "zod";

import type { ReadApi, WriteApi, NetworkInfo } from "../../components/EvmApi";
import { EvmApiType, Language } from "../../components/EvmApi";
import { singletonArray, safeFetch } from "../../zod-utils";

export const readApi = <ParameterName extends string>(
  spec: Omit<ReadApi<ParameterName>, "type">,
) => ({
  ...spec,
  type: EvmApiType.Read,
});

export const writeApi = <ParameterName extends string>(
  spec: Omit<WriteApi<ParameterName>, "type">,
) => ({
  ...spec,
  type: EvmApiType.Write,
});

export const BTCUSD =
  "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
export const ETHUSD =
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

const HERMES_URL = "https://hermes.pyth.network";

export const getLatestPriceUpdate = async (feedId: string) => {
  const url = new URL("/v2/updates/price/latest", HERMES_URL);
  url.searchParams.set("ids[]", feedId);
  return safeFetch(priceFeedSchema, url);
};

const priceFeedSchema = z.object({
  binary: z.object({
    data: singletonArray(z.string()).transform((value) => `0x${value}`),
  }),
  parsed: singletonArray(
    z.object({
      price: z.object({
        publish_time: z.number(),
      }),
    }),
  ),
});

export const solidity = <ParameterName extends string>(
  code: string | ((params: Partial<Record<ParameterName, string>>) => string),
) => ({
  language: Language.Solidity,
  dimRange: [
    { line: 0, character: 0 },
    { line: 7, character: 0 },
  ] as const,
  code: (
    network: NetworkInfo,
    params: Partial<Record<ParameterName, string>>,
  ) => `
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

// ${network.name}
address contractAddress = ${network.contractAddress}
IPyth pyth = IPyth(contractAddress);

${typeof code === "string" ? code.trim() : code(params).trim()}
  `,
});

export const ethersJS = <ParameterName extends string>(
  code: string | ((params: Partial<Record<ParameterName, string>>) => string),
) => ({
  language: Language.EthersJSV6,
  dimRange: [
    { line: 0, character: 0 },
    { line: 8, character: 0 },
  ] as const,
  code: (
    network: NetworkInfo,
    params: Partial<Record<ParameterName, string>>,
  ) => `
import { ethers } from 'ethers';
import PythAbi from '@pythnetwork/pyth-sdk-solidity/abis/IPyth.json' assert { type: 'json' };

// ${network.name}
const contractAddress = '${network.contractAddress}';
const provider = ethers.getDefaultProvider('${network.rpcUrl}');
const contract = new ethers.Contract(contractAddress, PythAbi, provider);

${typeof code === "string" ? code.trim() : code(params).trim()}
  `,
});
