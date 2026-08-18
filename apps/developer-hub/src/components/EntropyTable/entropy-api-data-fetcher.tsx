import {
  evmChains,
  evmEntropyContracts,
} from "@pythnetwork/contract-manager/utils/utils";
import * as chains from "viem/chains";
import { z } from "zod";

import { EntropyDeploymentsConfig } from "./entropy-deployments-config";

const ApiChainConfigSchema = z.object({
  contract_addr: z.string(),
  default_fee: z.number(),
  gas_limit: z.number(),
  name: z.string(),
  network_id: z.number(),
  reveal_delay_blocks: z.number(),
});

type ApiChainConfig = z.infer<typeof ApiChainConfigSchema>;

export type EntropyDeployment = {
  address: string;
  delay: string;
  gasLimit: string;
  default_fee: number;
  rpc?: string;
  explorer?: string;
  nativeCurrency?: string;
};

function getChainData(network_id: number) {
  return Object.values(chains).find((chain) => chain.id === network_id);
}

const apiChainConfigToEntry = (chain: ApiChainConfig) => {
  const viemChainData = getChainData(chain.network_id);

  const configOverride = EntropyDeploymentsConfig[chain.network_id];

  const rpc = configOverride?.rpc ?? viemChainData?.rpcUrls.default.http[0];
  const explorer =
    configOverride?.explorer ?? viemChainData?.blockExplorers?.default.url;
  const nativeCurrency =
    configOverride?.nativeCurrency ?? viemChainData?.nativeCurrency.symbol;

  const deployment: EntropyDeployment = {
    address: chain.contract_addr,
    default_fee: chain.default_fee,
    delay: `${String(chain.reveal_delay_blocks)} block${
      chain.reveal_delay_blocks === 1 ? "" : "s"
    }`,
    gasLimit: String(chain.gas_limit),
    ...(rpc ? { rpc } : {}),
    ...(explorer ? { explorer } : {}),
    ...(nativeCurrency ? { nativeCurrency } : {}),
  };

  return [chain.name, deployment] as const;
};

const entropyDeploymentsSchema = z.array(ApiChainConfigSchema);

// Deployments flagged as deprecated in contract_manager stay in the store for ops
// tooling but are not advertised in the chainlist. Fortuna reports network_id 0 for
// the chains whose RPC it cannot reach, so match on the chain name as well: Fortuna
// spells it with dashes and without the `_mainnet` suffix (`sei_evm_mainnet` becomes
// `sei-evm`).
const deprecatedDeployments = evmEntropyContracts.filter(
  (contract) => contract.deprecated,
);
const DEPRECATED_NETWORK_IDS = new Set(
  deprecatedDeployments.flatMap((contract) => {
    const chain = evmChains.find(({ id }) => id === contract.chain);
    return chain ? [chain.networkId] : [];
  }),
);
const DEPRECATED_CHAIN_NAMES = new Set(
  deprecatedDeployments.map((contract) =>
    contract.chain.replace(/_mainnet$/, "").replaceAll("_", "-"),
  ),
);

const isDeprecated = (chain: ApiChainConfig) =>
  DEPRECATED_NETWORK_IDS.has(chain.network_id) ||
  DEPRECATED_CHAIN_NAMES.has(chain.name);

export async function fetchEntropyDeployments(
  url: string,
): Promise<Record<string, EntropyDeployment>> {
  const response = await fetch(url);
  const apiChains = entropyDeploymentsSchema.parse(await response.json());
  return Object.fromEntries(
    apiChains
      .filter((chain) => !isDeprecated(chain))
      .map((chain) => apiChainConfigToEntry(chain)),
  );
}
