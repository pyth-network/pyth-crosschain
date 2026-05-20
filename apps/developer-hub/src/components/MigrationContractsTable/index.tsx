import {
  evmChains,
  evmPriceFeedContracts,
} from "@pythnetwork/contract-manager/utils/utils";

import CopyAddress from "../CopyAddress";
import { MigrationDeploymentsConfig } from "./deployments-config";

type UpstreamChain = {
  chainId: number;
  name: string;
  explorers?: { url: string }[];
};

type MigrationDeployment = {
  chainId: string;
  networkId: number;
  name: string;
  address: string;
  explorer?: string;
};

const HIDDEN_CHAIN_IDS = new Set<string>();

const CHAIN_REGISTRY_URL = "https://chainid.network/chains.json";
const CHAIN_REGISTRY_REVALIDATE_SECONDS = 60 * 60 * 24;

const humanize = (chainId: string): string =>
  chainId
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const fetchChainRegistry = async (): Promise<Map<number, UpstreamChain>> => {
  try {
    const response = await fetch(CHAIN_REGISTRY_URL, {
      next: { revalidate: CHAIN_REGISTRY_REVALIDATE_SECONDS },
    });
    if (!response.ok) return new Map();
    const chains = (await response.json()) as UpstreamChain[];
    return new Map(chains.map((c) => [c.chainId, c]));
  } catch {
    return new Map();
  }
};

const buildDeployments = (
  isMainnet: boolean,
  registry: Map<number, UpstreamChain>,
): MigrationDeployment[] => {
  const deployments: MigrationDeployment[] = [];

  for (const contract of evmPriceFeedContracts) {
    if (
      !("deploymentType" in contract) ||
      contract.deploymentType !== "lazer-prod"
    ) {
      continue;
    }
    if (HIDDEN_CHAIN_IDS.has(contract.chain)) continue;

    const chain = evmChains.find((c) => c.id === contract.chain);
    if (!chain || chain.mainnet !== isMainnet) continue;

    const upstream = registry.get(chain.networkId);
    const override = MigrationDeploymentsConfig[String(chain.networkId)];
    const explorer = override?.explorer ?? upstream?.explorers?.[0]?.url;

    deployments.push({
      address: contract.address,
      chainId: chain.id,
      name: override?.name ?? upstream?.name ?? humanize(chain.id),
      networkId: chain.networkId,
      ...(explorer ? { explorer } : {}),
    });
  }

  return deployments.sort((a, b) => a.name.localeCompare(b.name));
};

const MigrationContractsTable = async ({
  isMainnet,
}: {
  isMainnet: boolean;
}) => {
  const registry = await fetchChainRegistry();
  const deployments = buildDeployments(isMainnet, registry);

  if (deployments.length === 0) {
    return (
      <p>
        <em>No contracts published yet for this network type.</em>
      </p>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Network</th>
          <th>Upgraded Pyth Core Contract</th>
        </tr>
      </thead>
      <tbody>
        {deployments.map((d) => (
          <tr key={d.chainId}>
            <td>{d.name}</td>
            <td>
              {d.explorer ? (
                <CopyAddress
                  address={d.address}
                  url={`${d.explorer.replace(/\/$/, "")}/address/${d.address}`}
                />
              ) : (
                <CopyAddress address={d.address} />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default MigrationContractsTable;
