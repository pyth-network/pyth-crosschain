import { getDefaultDeploymentConfig } from "@pythnetwork/contract-manager/core/base";
import type { DeploymentType } from "./helper.js";

function getPythSources(deploymentType: DeploymentType) {
  const config = getDefaultDeploymentConfig(deploymentType);
  return {
    data_sources: config.dataSources.map((source) => {
      return {
        chain_id: source.emitterChain,
        emitter: Buffer.from(source.emitterAddress, "hex").toString("base64"),
      };
    }),
    governance_source: {
      chain_id: config.governanceDataSource.emitterChain,
      emitter: Buffer.from(
        config.governanceDataSource.emitterAddress,
        "hex",
      ).toString("base64"),
    },
  };
}

export function getPythConfig({
  feeDenom,
  wormholeContract,
  wormholeChainId,
  deploymentType,
}: {
  feeDenom: string;
  wormholeContract: string;
  wormholeChainId: number;
  deploymentType: DeploymentType;
}) {
  return {
    chain_id: wormholeChainId,
    fee: {
      amount: "1",
      denom: feeDenom,
    },
    governance_sequence_number: 0,
    governance_source_index: 0,
    valid_time_period_secs: 60,
    wormhole_contract: wormholeContract,
    ...getPythSources(deploymentType),
  };
}

type ReqWormholeConfig = {
  feeDenom: string;
  wormholeChainId: number;
  deploymentType: DeploymentType;
};

export function getWormholeConfig({
  feeDenom,
  wormholeChainId,
  deploymentType,
}: ReqWormholeConfig) {
  const config = getDefaultDeploymentConfig(deploymentType).wormholeConfig;
  return {
    chain_id: wormholeChainId,
    fee_denom: feeDenom,
    gov_address: Buffer.from(config.governanceContract, "hex").toString(
      "base64",
    ),
    gov_chain: config.governanceChainId,
    guardian_set_expirity: 86_400,
    initial_guardian_set: {
      addresses: config.initialGuardianSet.map((guardian) => ({
        bytes: Buffer.from(guardian, "hex").toString("base64"),
      })),
      expiration_time: 0,
    },
  };
}
