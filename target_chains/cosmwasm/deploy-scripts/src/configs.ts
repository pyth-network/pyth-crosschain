import { getDefaultDeploymentConfig } from "@pythnetwork/contract-manager/core/base";
import { DeploymentType } from "./helper";

function getPythSources(deploymentType: DeploymentType) {
  const config = getDefaultDeploymentConfig(deploymentType);
  return {
    data_sources: config.dataSources.map((source) => {
      return {
        emitter: Buffer.from(source.emitterAddress, "hex").toString("base64"),
        chain_id: source.emitterChain,
      };
    }),
    governance_source: {
      emitter: Buffer.from(
        config.governanceDataSource.emitterAddress,
        "hex",
      ).toString("base64"),
      chain_id: config.governanceDataSource.emitterChain,
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
    wormhole_contract: wormholeContract,
    governance_source_index: 0,
    governance_sequence_number: 0,
    chain_id: wormholeChainId,
    valid_time_period_secs: 60,
    fee: {
      amount: "1",
      denom: feeDenom,
    },
    ...getPythSources(deploymentType),
  };
}

interface ReqWormholeConfig {
  feeDenom: string;
  wormholeChainId: number;
  deploymentType: DeploymentType;
}

export function getWormholeConfig({
  feeDenom,
  wormholeChainId,
  deploymentType,
}: ReqWormholeConfig) {
  const config = getDefaultDeploymentConfig(deploymentType).wormholeConfig;
  return {
    chain_id: wormholeChainId,
    fee_denom: feeDenom,
    gov_chain: config.governanceChainId,
    gov_address: Buffer.from(config.governanceContract, "hex").toString(
      "base64",
    ),
    guardian_set_expirity: 86400,
    initial_guardian_set: {
      addresses: config.initialGuardianSet.map((guardian) => ({
        bytes: Buffer.from(guardian, "hex").toString("base64"),
      })),
      expiration_time: 0,
    },
  };
}
