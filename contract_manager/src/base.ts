import { DataSource, HexString32Bytes } from "@pythnetwork/xc-governance-sdk";

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
   * Returns an array of data sources that this contract accepts price feed messages from
   */
  abstract getDataSources(): Promise<DataSource[]>;

  /**
   * Returns the base update fee for this contract
   * This is the required fee for updating the price feeds in the contract
   */
  abstract getBaseUpdateFee(): Promise<any>;

  /**
   * Returns the single data source that this contract accepts governance messages from
   */
  abstract getGovernanceDataSource(): Promise<DataSource>;
}
