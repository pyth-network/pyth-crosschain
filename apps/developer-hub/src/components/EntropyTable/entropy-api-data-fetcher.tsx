import * as chains from "viem/chains";
import { z } from "zod";

import { EntropyDeploymentsConfig } from "./entropy-deployments-config";

const ApiChainConfigSchema = z.object({
  name: z.string(),
  network_id: z.number(),
  contract_addr: z.string(),
  reveal_delay_blocks: z.number(),
  gas_limit: z.number(),
  default_fee: z.number(),
});

type ApiChainConfig = z.infer<typeof ApiChainConfigSchema>;

const entropyDeploymentsSchema = z.array(ApiChainConfigSchema);

export type EntropyDeployment = {
  address: string;
  delay: string;
  gasLimit: string;
  default_fee: number;
  rpc?: string;
  explorer?: string;
  nativeCurrency?: string;
};

const getChainData = (network_id: number) => {
  return Object.values(chains).find((chain) => chain.id === network_id);
};

const transformChainData = (
  chain: ApiChainConfig,
): [string, EntropyDeployment] => {
  const viemChainData = getChainData(chain.network_id);

  const configOverride = EntropyDeploymentsConfig[chain.network_id];

  const rpc = configOverride?.rpc ?? viemChainData?.rpcUrls.default.http[0];
  const explorer =
    configOverride?.explorer ?? viemChainData?.blockExplorers?.default.url;
  const nativeCurrency =
    configOverride?.nativeCurrency ?? viemChainData?.nativeCurrency.symbol;

  const deployment: EntropyDeployment = {
    address: chain.contract_addr,
    delay: `${String(chain.reveal_delay_blocks)} block${
      chain.reveal_delay_blocks === 1 ? "" : "s"
    }`,
    gasLimit: String(chain.gas_limit),
    default_fee: chain.default_fee,
    ...(rpc ? { rpc } : {}),
    ...(explorer ? { explorer } : {}),
    ...(nativeCurrency ? { nativeCurrency } : {}),
  };

  return [chain.name, deployment];
};

export const fetchEntropyDeployments = async (
  url: string,
): Promise<Record<string, EntropyDeployment>> => {
  try {
    const response = await fetch(url);
    const apiData = entropyDeploymentsSchema.parse(await response.json());

    return Object.fromEntries(apiData.map((item) => transformChainData(item)));
  } catch (error_) {
    throw new Error(String(error_));
  }
};
