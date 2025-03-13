import { DataSource } from "@pythnetwork/xc-admin-common";
import { Chain } from "./chains";

export interface TxResult {
  id: string;
  info: unknown; // chain specific info
}

export type DeploymentType = "stable" | "beta";
export type PrivateKey = string & { __type: "PrivateKey" };

function checkIsPrivateKey(key: string): asserts key is PrivateKey {
  if (Buffer.from(key, "hex").length !== 32)
    throw new Error("Invalid private key, must be 64 hex chars");
}

export function toPrivateKey(key: string): PrivateKey {
  checkIsPrivateKey(key);
  return key;
}

export function toDeploymentType(type: string): DeploymentType {
  if (type === "stable" || type === "beta") return type;
  throw new Error(`Invalid deployment type ${type}`);
}

export type KeyValueConfig = Record<string, string | number | boolean>;

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
  abstract toJson(): KeyValueConfig;
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

export abstract class PriceFeedContract extends Storable {
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
    senderPrivateKey: PrivateKey,
    vaas: Buffer[],
  ): Promise<TxResult>;

  /**
   * Executes the governance instruction contained in the VAA using the sender credentials
   * @param senderPrivateKey private key of the sender in hex format without 0x prefix
   * @param vaa the VAA to execute
   */
  abstract executeGovernanceInstruction(
    senderPrivateKey: PrivateKey,
    vaa: Buffer,
  ): Promise<TxResult>;

  /**
   * Returns the single data source that this contract accepts governance messages from
   */
  abstract getGovernanceDataSource(): Promise<DataSource>;
}

export function getDefaultDeploymentConfig(deploymentType: DeploymentType): {
  dataSources: DataSource[];
  governanceDataSource: DataSource;
  wormholeConfig: {
    governanceChainId: number;
    governanceContract: string; // 32 byte address in 64 char hex format
    initialGuardianSet: string[]; // 20 byte addresses in 40 char hex format
  };
} {
  if (deploymentType === "stable")
    return {
      dataSources: [
        {
          emitterChain: 1,
          emitterAddress:
            "6bb14509a612f01fbbc4cffeebd4bbfb492a86df717ebe92eb6df432a3f00a25",
        },
        {
          emitterChain: 26,
          emitterAddress:
            "f8cd23c2ab91237730770bbea08d61005cdda0984348f3f6eecb559638c0bba0",
        },
        {
          emitterChain: 26,
          emitterAddress:
            "e101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71",
        },
      ],
      governanceDataSource: {
        emitterChain: 1,
        emitterAddress:
          "5635979a221c34931e32620b9293a463065555ea71fe97cd6237ade875b12e9e",
      },
      wormholeConfig: {
        governanceChainId: 1,
        governanceContract:
          "0000000000000000000000000000000000000000000000000000000000000004",
        initialGuardianSet: ["58cc3ae5c097b213ce3c81979e1b9f9570746aa5"],
      },
    };
  else if (deploymentType === "beta")
    return {
      dataSources: [
        {
          emitterChain: 1,
          emitterAddress:
            "f346195ac02f37d60d4db8ffa6ef74cb1be3550047543a4a9ee9acf4d78697b0",
        },
        {
          emitterChain: 26,
          emitterAddress:
            "a27839d641b07743c0cb5f68c51f8cd31d2c0762bec00dc6fcd25433ef1ab5b6",
        },
        {
          emitterChain: 26,
          emitterAddress:
            "e101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71",
        },
      ],
      governanceDataSource: {
        emitterChain: 1,
        emitterAddress:
          "63278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c385",
      },
      wormholeConfig: {
        governanceChainId: 1,
        governanceContract:
          "0000000000000000000000000000000000000000000000000000000000000004",
        initialGuardianSet: ["13947bd48b18e53fdaeee77f3473391ac727c638"],
      },
    };
  else throw new Error(`Invalid deployment type ${deploymentType}`);
}
