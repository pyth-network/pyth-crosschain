import {
  CHAINS,
  DataSource,
  HexString32Bytes,
  SetFeeInstruction,
} from "@pythnetwork/xc-governance-sdk";
import { Chain } from "./chains";

export abstract class Storable {
  /**
   * Returns the unique identifier for this object
   */
  abstract getId(): string;

  /**
   * Returns the type of this object. This is used to reconstruct the object and should match
   * the static field type in the class responsible for constructing this object.
   */
  abstract getType(): string;

  /**
   * Returns a JSON representation of this object. It should be possible to
   * reconstruct the object from the JSON using the fromJson method.
   */
  abstract toJson(): any;
}

export abstract class Contract extends Storable {
  /**
   * Returns the time period in seconds that stale data is considered valid for.
   */
  abstract getValidTimePeriod(): Promise<number>;

  /**
   * Returns the chain that this contract is deployed on
   */
  abstract getChain(): Chain;

  /**
   * Returns an array of data sources that this contract accepts price feed messages from
   */
  abstract getDataSources(): Promise<DataSource[]>;

  /**
   * Returns the base update fee for this contract
   * This is the required fee for updating the price feeds in the contract
   */
  abstract getBaseUpdateFee(): Promise<{ amount: string; denom: string }>;

  /**
   * Executes the governance instruction contained in the VAA using the sender credentials
   * @param sender based on the contract type, this can be a private key, a mnemonic, a wallet, etc.
   * @param vaa the VAA to execute
   */
  abstract executeGovernanceInstruction(sender: any, vaa: Buffer): Promise<any>;

  /**
   * Returns the payload for a governance SetFee instruction
   * @param fee the new fee to set
   * @param exponent the new fee exponent to set
   */
  getGovernanceSetFeePayload(fee: number, exponent: number): Buffer {
    return new SetFeeInstruction(
      CHAINS[this.getChain().getId() as keyof typeof CHAINS],
      BigInt(fee),
      BigInt(exponent)
    ).serialize();
  }

  /**
   * Returns the payload for a governance Contract Upgrade instruction
   * @param upgradeInfo based on the contract type, this can be a contract address, codeId, package digest, etc.
   */
  abstract getGovernanceUpgradePayload(upgradeInfo: any): Buffer;

  /**
   * Returns the single data source that this contract accepts governance messages from
   */
  abstract getGovernanceDataSource(): Promise<DataSource>;
}
