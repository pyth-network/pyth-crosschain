import {
  evmChains,
  evmPriceFeedContracts,
} from "@pythnetwork/contract-manager/utils/utils";

import CopyAddress from "../CopyAddress";
import { MigrationDeploymentsConfig } from "../MigrationContractsTable/deployments-config";

type UpstreamChain = {
  chainId: number;
  name: string;
  explorers?: { url: string }[];
};

type ChainStatus = {
  chainId: string;
  name: string;
  networkId: number;
  currentAddress: string;
  upgradedAddress: string | null;
  explorer?: string;
};

const HIDDEN_CHAIN_IDS = new Set<string>();
const CHAIN_REGISTRY_URL = "https://chainid.network/chains.json";
const CHAIN_REGISTRY_REVALIDATE_SECONDS = 60 * 60 * 24;

const humanize = (chainId: string): string =>
  chainId
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
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

const buildStatuses = (
  isMainnet: boolean,
  registry: Map<number, UpstreamChain>,
): ChainStatus[] => {
  const current = new Map<string, string>();
  const upgraded = new Map<string, string>();

  for (const contract of evmPriceFeedContracts) {
    if (HIDDEN_CHAIN_IDS.has(contract.chain)) continue;
    if (
      "deploymentType" in contract &&
      contract.deploymentType === "pro-compatible-production"
    ) {
      upgraded.set(contract.chain, contract.address);
    } else if (!("deploymentType" in contract)) {
      current.set(contract.chain, contract.address);
    }
  }

  const statuses: ChainStatus[] = [];
  for (const [chainId, currentAddress] of current.entries()) {
    const chain = evmChains.find((c) => c.id === chainId);
    if (!chain || chain.mainnet !== isMainnet) continue;

    const upstream = registry.get(chain.networkId);
    const override = MigrationDeploymentsConfig[String(chain.networkId)];
    const explorer = override?.explorer ?? upstream?.explorers?.[0]?.url;

    statuses.push({
      chainId,
      name: override?.name ?? upstream?.name ?? humanize(chainId),
      networkId: chain.networkId,
      currentAddress,
      upgradedAddress: upgraded.get(chainId) ?? null,
      ...(explorer ? { explorer } : {}),
    });
  }

  return statuses.sort((a, b) => a.name.localeCompare(b.name));
};

const renderAddress = (address: string, explorer?: string) =>
  explorer ? (
    <CopyAddress
      address={address}
      maxLength={6}
      url={`${explorer.replace(/\/$/, "")}/address/${address}`}
    />
  ) : (
    <CopyAddress address={address} maxLength={6} />
  );

const EvmContractsStatusTable = async ({
  isMainnet,
}: {
  isMainnet: boolean;
}) => {
  const registry = await fetchChainRegistry();
  const statuses = buildStatuses(isMainnet, registry);

  if (statuses.length === 0) {
    return (
      <p>
        <em>No contracts published yet for this network type.</em>
      </p>
    );
  }

  return (
    <>
      <div className="flex gap-4 text-sm my-2">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block w-3 h-3 rounded-sm border bg-green-50 dark:bg-green-950/30"
          />
          Upgraded
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block w-3 h-3 rounded-sm border bg-red-50 dark:bg-red-950/30"
          />
          Will be dropped
        </span>
      </div>
      <div className="overflow-x-auto">
        <table>
          <thead>
          <tr>
            <th>Network</th>
            <th>Current Address</th>
            <th>Upgraded Address</th>
          </tr>
        </thead>
        <tbody>
          {statuses.map((s) => {
            const isUpgraded = s.upgradedAddress !== null;
            const bgClass = isUpgraded
              ? "bg-green-50 dark:bg-green-950/30"
              : "bg-red-50 dark:bg-red-950/30";
            return (
              <tr key={s.chainId} className={bgClass}>
                <td>{s.name}</td>
                <td>{renderAddress(s.currentAddress, s.explorer)}</td>
                <td>
                  {isUpgraded && s.upgradedAddress !== null
                    ? renderAddress(s.upgradedAddress, s.explorer)
                    : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
};

export default EvmContractsStatusTable;
