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

// Caldera's inEVM rollup is superseded by Injective's native EVM
// (injective_evm, chain ID 1776). Hide the inEVM rows so users land on the
// supported deployment.
const HIDDEN_CHAIN_IDS = new Set<string>([
  "injective_inevm",
  "injective_inevm_testnet",
]);
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

const partitionStatuses = (statuses: ChainStatus[]) => {
  const upgraded: ChainStatus[] = [];
  const dropped: ChainStatus[] = [];
  for (const s of statuses) {
    if (s.upgradedAddress !== null) upgraded.push(s);
    else dropped.push(s);
  }
  return { upgraded, dropped };
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

  const { upgraded, dropped } = partitionStatuses(statuses);

  const renderRow = (s: ChainStatus, droppedSection: boolean) => (
    <tr
      key={s.chainId}
      className={
        droppedSection
          ? "bg-red-100/70 dark:bg-red-950/40"
          : "bg-green-100/60 dark:bg-green-950/30"
      }
    >
      <td>{s.name}</td>
      <td>{renderAddress(s.currentAddress, s.explorer)}</td>
      <td>
        {s.upgradedAddress !== null
          ? renderAddress(s.upgradedAddress, s.explorer)
          : "—"}
      </td>
    </tr>
  );

  return (
    <>
      <div className="flex flex-wrap gap-4 text-sm my-3 font-medium">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block w-4 h-4 rounded-sm border bg-green-100/60 dark:bg-green-950/30"
          />
          Upgraded ({upgraded.length})
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block w-4 h-4 rounded-sm border bg-red-100/70 dark:bg-red-950/40"
          />
          Not upgraded ({dropped.length})
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
            {upgraded.map((s) => renderRow(s, false))}
            {dropped.length > 0 && (
              <tr className="bg-red-200/80 dark:bg-red-900/60">
                <td
                  colSpan={3}
                  className="text-center font-semibold py-3 text-red-900 dark:text-red-100 border-y-2 border-red-300 dark:border-red-700"
                >
                  Chains not in the upgrade ({dropped.length})
                </td>
              </tr>
            )}
            {dropped.map((s) => renderRow(s, true))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default EvmContractsStatusTable;
