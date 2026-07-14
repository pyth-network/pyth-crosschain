import {
  evmChains,
  evmLazerContracts,
  evmPriceFeedContracts,
} from "@pythnetwork/contract-manager/utils/utils";

import CopyAddress from "../CopyAddress";
import { LazerDeploymentsConfig } from "../LazerTable/lazer-deployments-config";
import { MigrationDeploymentsConfig } from "../MigrationContractsTable/deployments-config";

type UpstreamChain = {
  chainId: number;
  name: string;
  explorers?: { url: string }[];
};

type UnifiedRow = {
  chainId: string;
  name: string;
  networkId: number;
  coreAddress: string | null;
  upgradedAddress: string | null;
  proAddress: string | null;
  explorer?: string;
};

// Mirror the per-product tables: each source keeps its own hidden set so this
// page never shows a deployment its product page deliberately hides.
const HIDDEN_CORE_CHAIN_IDS = new Set<string>([
  "injective_inevm",
  "injective_inevm_testnet",
]);
const HIDDEN_LAZER_CHAIN_IDS = new Set<string>([
  "ethereal_devnet",
  "polynomial",
  "polynomial_testnet",
]);

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

const buildRows = (
  isMainnet: boolean,
  registry: Map<number, UpstreamChain>,
): UnifiedRow[] => {
  const core = new Map<string, string>();
  const upgraded = new Map<string, string>();
  const pro = new Map<string, string>();

  for (const contract of evmPriceFeedContracts) {
    if (HIDDEN_CORE_CHAIN_IDS.has(contract.chain)) continue;
    if (
      "deploymentType" in contract &&
      contract.deploymentType === "pro-compatible-production"
    ) {
      upgraded.set(contract.chain, contract.address);
    } else if (!("deploymentType" in contract)) {
      core.set(contract.chain, contract.address);
    }
  }
  for (const contract of evmLazerContracts) {
    if (HIDDEN_LAZER_CHAIN_IDS.has(contract.chain)) continue;
    pro.set(contract.chain, contract.address);
  }

  const chainIds = new Set([...core.keys(), ...upgraded.keys(), ...pro.keys()]);
  const rows: UnifiedRow[] = [];
  for (const chainId of chainIds) {
    const chain = evmChains.find((c) => c.id === chainId);
    if (!chain || chain.mainnet !== isMainnet) continue;

    const upstream = registry.get(chain.networkId);
    const override =
      MigrationDeploymentsConfig[String(chain.networkId)] ??
      LazerDeploymentsConfig[String(chain.networkId)];
    const explorer = override?.explorer ?? upstream?.explorers?.[0]?.url;

    rows.push({
      chainId,
      name: override?.name ?? upstream?.name ?? humanize(chainId),
      networkId: chain.networkId,
      coreAddress: core.get(chainId) ?? null,
      upgradedAddress: upgraded.get(chainId) ?? null,
      proAddress: pro.get(chainId) ?? null,
      ...(explorer ? { explorer } : {}),
    });
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name));
};

const renderAddress = (address: string | null, explorer?: string) => {
  if (address === null) return "—";
  return explorer ? (
    <CopyAddress
      address={address}
      maxLength={6}
      url={`${explorer.replace(/\/$/, "")}/address/${address}`}
    />
  ) : (
    <CopyAddress address={address} maxLength={6} />
  );
};

const UnifiedContractsTable = async ({ isMainnet }: { isMainnet: boolean }) => {
  const registry = await fetchChainRegistry();
  const rows = buildRows(isMainnet, registry);

  if (rows.length === 0) {
    return (
      <p>
        <em>No contracts published yet for this network type.</em>
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Network</th>
            <th>Pyth Core (current)</th>
            <th>Pyth Core (upgraded)</th>
            <th>Pyth Pro</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.chainId}>
              <td>{row.name}</td>
              <td>{renderAddress(row.coreAddress, row.explorer)}</td>
              <td>{renderAddress(row.upgradedAddress, row.explorer)}</td>
              <td>{renderAddress(row.proAddress, row.explorer)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UnifiedContractsTable;
