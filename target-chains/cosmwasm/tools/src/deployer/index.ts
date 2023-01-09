import { CONFIG, CONFIG_TYPE } from "./config";
import { TerraDeployer } from "./terra";
import { InjectiveDeployer } from "./injective";
import { NETWORKS } from "../network";

export interface Deployer {
  deployArtifact(artifact: string): Promise<number>;
  instantiate(
    codeId: number,
    inst_msg: string | object,
    label: string
  ): Promise<string>;
  migrate(contract: string, codeId: number): Promise<void>;
}

export class DeployerFactory {
  static create(network: NETWORKS, mnemonic: string): Deployer {
    const config = CONFIG[network];
    if (config === undefined) throw new Error("Invalid Network Name");

    switch (config.type) {
      case CONFIG_TYPE.TERRA:
        return TerraDeployer.fromHostAndMnemonic(config.host, mnemonic);

      case CONFIG_TYPE.INJECTIVE:
        return InjectiveDeployer.fromHostAndMnemonic(config.host, mnemonic);

      default:
        throw new Error("Invalid config type");
    }
  }
}
