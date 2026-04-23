import {
  evmChains,
  evmLazerContracts,
} from "@pythnetwork/contract-manager/utils/utils";
import * as chains from "viem/chains";

import CopyAddress from "../CopyAddress";
import { LazerDeploymentsConfig } from "./lazer-deployments-config";

type LazerDeployment = {
  chainId: string;
  networkId: number;
  name: string;
  address: string;
  explorer?: string;
};

// Chains we never want to show in the docs (e.g. internal devnets).
const HIDDEN_CHAIN_IDS = new Set<string>(["ethereal_devnet"]);

const getViemChain = (networkId: number) =>
  Object.values(chains).find((chain) => chain.id === networkId);

const humanize = (chainId: string): string =>
  chainId
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const buildDeployments = (isMainnet: boolean): LazerDeployment[] => {
  const deployments: LazerDeployment[] = [];

  for (const contract of evmLazerContracts) {
    if (HIDDEN_CHAIN_IDS.has(contract.chain)) continue;

    const chain = evmChains.find((c) => c.id === contract.chain);
    if (!chain || chain.mainnet !== isMainnet) continue;

    const viemChain = getViemChain(chain.networkId);
    const override = LazerDeploymentsConfig[String(chain.networkId)];
    const explorer =
      override?.explorer ?? viemChain?.blockExplorers?.default.url;

    deployments.push({
      address: contract.address,
      chainId: chain.id,
      name: override?.name ?? viemChain?.name ?? humanize(chain.id),
      networkId: chain.networkId,
      ...(explorer ? { explorer } : {}),
    });
  }

  return deployments.sort((a, b) => a.name.localeCompare(b.name));
};

const LazerTable = ({ isMainnet }: { isMainnet: boolean }) => {
  const deployments = buildDeployments(isMainnet);

  return (
    <table>
      <thead>
        <tr>
          <th>Network</th>
          <th>Contract Address</th>
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

export default LazerTable;
