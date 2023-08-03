import { DataSource } from "xc_admin_common";
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

export interface Price {
  price: string;
  conf: string;
  publishTime: string;
  expo: string;
}

export interface PriceFeed {
  price: Price;
  emaPrice: Price;
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
  abstract getBaseUpdateFee(): Promise<{ amount: string; denom?: string }>;

  /**
   * Returns the last governance sequence that was executed on this contract
   * this number increases based on the sequence number of the governance messages
   * that are executed on this contract
   *
   * This is used to determine which governance messages are stale and can not be executed
   */
  abstract getLastExecutedGovernanceSequence(): Promise<number>;

  /**
   * Returns the price feed for the given feed id or undefined if not found
   * @param feedId hex encoded feed id without 0x prefix
   */
  abstract getPriceFeed(feedId: string): Promise<PriceFeed | undefined>;

  /**
   * Executes the update instructions contained in the VAAs using the sender credentials
   * @param senderPrivateKey private key of the sender in hex format without 0x prefix
   * @param vaas an array of VAAs containing price update messages to execute
   */
  abstract executeUpdatePriceFeed(
    senderPrivateKey: string,
    vaas: Buffer[]
  ): Promise<any>;

  /**
   * Executes the governance instruction contained in the VAA using the sender credentials
   * @param senderPrivateKey private key of the sender in hex format without 0x prefix
   * @param vaa the VAA to execute
   */
  abstract executeGovernanceInstruction(
    senderPrivateKey: string,
    vaa: Buffer
  ): Promise<any>;

  /**
   * Returns the single data source that this contract accepts governance messages from
   */
  abstract getGovernanceDataSource(): Promise<DataSource>;
}
