import { CONFIG_TYPE, type NetworkConfig } from "./config.js";
import { TerraDeployer } from "./terra.js";
import { InjectiveDeployer } from "./injective.js";
import { OsmosisDeployer } from "./osmosis.js";

export type ContractInfo = {
  codeId: number;
  address: string;
  creator: string;
  admin: string | undefined;
  initMsg: any;
};

export interface Deployer {
  deployArtifact(artifact: string): Promise<number>;
  instantiate(
    codeId: number,
    inst_msg: string | object,
    label: string,
  ): Promise<string>;
  migrate(contract: string, codeId: number): Promise<void>;
  updateAdmin(newAdmin: string, contract: string): Promise<void>;
  getContractInfo(contract: string): Promise<ContractInfo>;
}

export class DeployerFactory {
  static create(config: NetworkConfig, mnemonic: string): Deployer {
    switch (config.type) {
      case CONFIG_TYPE.TERRA:
        return TerraDeployer.fromHostAndMnemonic(config.host, mnemonic);

      case CONFIG_TYPE.INJECTIVE:
        // @ts-expect-error - TODO: slight typing differences
        return InjectiveDeployer.fromHostAndMnemonic(config.host, mnemonic);

      case CONFIG_TYPE.OSMOSIS:
        return OsmosisDeployer.fromHostAndMnemonic(config.host, mnemonic);

      default:
        throw new Error("Invalid config type");
    }
  }
}
