/** biome-ignore-all lint/style/noProcessEnv: utils used through CLI */
/** biome-ignore-all lint/suspicious/noConsole: utils used through CLI */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import nodePath from "node:path";

import { Network } from "@injectivelabs/networks";
import { IotaClient } from "@iota/iota-sdk/client";
import { Ed25519Keypair as IotaEd25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import { NANOS_PER_IOTA } from "@iota/iota-sdk/utils";
import * as suiBytecode from "@mysten/move-bytecode-template";
import type {
  MoveStruct as SuiMoveStruct,
  MoveValue as SuiMoveValue,
  SuiTransactionBlockResponseOptions,
} from "@mysten/sui/client";
import { SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair as SuiEd25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction as SuiTransaction } from "@mysten/sui/transactions";
import {
  MIST_PER_SUI,
  SUI_CLOCK_OBJECT_ID,
  SUI_FRAMEWORK_ADDRESS,
} from "@mysten/sui/utils";
import {
  CosmwasmExecutor,
  CosmwasmQuerier,
  InjectiveExecutor,
} from "@pythnetwork/cosmwasm-deploy-tools";
import { FUEL_ETH_ASSET_ID } from "@pythnetwork/pyth-fuel-js";
import { PythContract } from "@pythnetwork/pyth-ton-js";
import type { ChainName, DataSource } from "@pythnetwork/xc-admin-common";
import {
  CosmosUpgradeContract,
  EvmExecute,
  EvmSetWormholeAddress,
  EvmUpgradeContract,
  SetDataSources,
  SetFee,
  SetValidPeriod,
  toChainId,
  UpdateTrustedSigner264Bit,
  UpgradeContract256Bit,
  UpgradeSuiLazerContract,
} from "@pythnetwork/xc-admin-common";
import { keyPairFromSeed } from "@ton/crypto";
import type { ContractProvider, OpenedContract, Sender } from "@ton/ton";
import { Address, TonClient, WalletContractV4 } from "@ton/ton";
import type { TxnBuilderTypes } from "aptos";
import { AptosAccount, AptosClient, CoinClient } from "aptos";
import * as bs58 from "bs58";
import type { BN, WalletUnlocked } from "fuels";
import { Provider, Wallet } from "fuels";
import * as micromustache from "micromustache";
import * as nearAPI from "near-api-js";
import { Contract, ec, RpcProvider, Signer, shortString } from "starknet";
import * as chains from "viem/chains";
import Web3 from "web3";

import { execFileAsync } from "../utils/exec-file-async";
import { hasProperty } from "../utils/utils";
import type { KeyValueConfig, PrivateKey, TxResult } from "./base";
import { Storable } from "./base";
import type { TokenId } from "./token";

function computeHashOnElements(elements: string[]): string {
  let hash = "0";
  for (const item of elements) {
    hash = ec.starkCurve.pedersen(hash, item);
  }
  return ec.starkCurve.pedersen(hash, elements.length);
}

/**
 * Returns the chain rpc url with any environment variables replaced or throws an error if any are missing
 */
export function parseRpcUrl(rpcUrl: string): string {
  const envMatches = /\$ENV_\w+/.exec(rpcUrl);
  if (envMatches) {
    for (const envMatch of envMatches) {
      const envName = envMatch.replace("$ENV_", "");
      const envValue = process.env[envName];
      if (!envValue) {
        throw new Error(
          `Missing env variable ${envName} required for this RPC: ${rpcUrl}`,
        );
      }
      rpcUrl = rpcUrl.replace(envMatch, envValue);
    }
  }
  return rpcUrl;
}

export type ChainConfig = Record<string, string> & {
  mainnet: boolean;
  id: string;
  nativeToken: TokenId;
};
export abstract class Chain extends Storable {
  public wormholeChainName: ChainName;
  static type: string;

  /**
   * Creates a new Chain object
   * @param id - unique id representing this chain
   * @param mainnet - whether this chain is mainnet or testnet/devnet
   * @param wormholeChainName - the name of the wormhole chain that this chain is associated with.
   * Note that pyth has included additional chain names and ids to the wormhole spec.
   * @param nativeToken - the id of the token used to pay gas on this chain
   */
  protected constructor(
    protected id: string,
    protected mainnet: boolean,
    wormholeChainName: string,
    protected nativeToken: TokenId | undefined,
  ) {
    super();
    this.wormholeChainName = wormholeChainName as ChainName;
    if (toChainId(this.wormholeChainName) === undefined)
      throw new Error(`Invalid chain name ${wormholeChainName}.`);
  }

  public getWormholeChainId(): number {
    return toChainId(this.wormholeChainName);
  }

  getId(): string {
    return this.id;
  }

  isMainnet(): boolean {
    return this.mainnet;
  }

  public getNativeToken(): TokenId | undefined {
    return this.nativeToken;
  }

  /**
   * Returns the payload for a governance SetFee instruction for contracts deployed on this chain
   * @param fee - the new fee to set
   * @param exponent - the new fee exponent to set
   */
  generateGovernanceSetFeePayload(fee: number, exponent: number): Buffer {
    return new SetFee(
      this.wormholeChainName,
      BigInt(fee),
      BigInt(exponent),
    ).encode();
  }

  /**
   * Returns the payload for a governance SetDataSources instruction for contracts deployed on this chain
   * @param datasources - the new datasources
   */
  generateGovernanceSetDataSources(datasources: DataSource[]): Buffer {
    return new SetDataSources(this.wormholeChainName, datasources).encode();
  }

  /**
   * Returns the payload for a governance SetStalePriceThreshold instruction for contracts deployed on this chain
   * @param newValidStalePriceThreshold - the new stale price threshold in seconds
   */
  generateGovernanceSetStalePriceThreshold(
    newValidStalePriceThreshold: bigint,
  ): Buffer {
    return new SetValidPeriod(
      this.wormholeChainName,
      newValidStalePriceThreshold,
    ).encode();
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for contracts deployed on this chain
   * @param upgradeInfo - based on the contract type, this can be a contract address, codeId, package digest, etc.
   */
  abstract generateGovernanceUpgradePayload(upgradeInfo: unknown): Buffer;

  /**
   * Returns the account address associated with the given private key.
   * @param privateKey - the account private key
   */
  abstract getAccountAddress(privateKey: PrivateKey): Promise<string>;

  /**
   * Returns the balance of the account associated with the given private key.
   * @param privateKey - the account private key
   */
  abstract getAccountBalance(privateKey: PrivateKey): Promise<number>;
}

/**
 * A Chain object that represents all chains. This is used for governance instructions that apply to all chains.
 * For example, governance instructions to upgrade Pyth data sources.
 */
export class GlobalChain extends Chain {
  static override type = "GlobalChain";
  constructor() {
    super("global", true, "unset", undefined);
  }

  generateGovernanceUpgradePayload(): Buffer {
    throw new Error(
      "Can not create a governance message for upgrading contracts on all chains!",
    );
  }

  getAccountAddress(_privateKey: PrivateKey): Promise<string> {
    throw new Error("Can not get account for GlobalChain.");
  }

  getAccountBalance(_privateKey: PrivateKey): Promise<number> {
    throw new Error("Can not get account balance for GlobalChain.");
  }

  getType(): string {
    return GlobalChain.type;
  }

  toJson(): KeyValueConfig {
    return {
      id: this.id,
      mainnet: this.mainnet,
      type: GlobalChain.type,
      wormholeChainName: this.wormholeChainName,
    };
  }
}

export class CosmWasmChain extends Chain {
  static override type = "CosmWasmChain";

  constructor(
    id: string,
    mainnet: boolean,
    wormholeChainName: string,
    nativeToken: TokenId | undefined,
    public endpoint: string,
    public gasPrice: string,
    public prefix: string,
    public feeDenom: string,
  ) {
    super(id, mainnet, wormholeChainName, nativeToken);
  }

  static fromJson(parsed: ChainConfig): CosmWasmChain {
    if (parsed.type !== CosmWasmChain.type) throw new Error("Invalid type");
    return new CosmWasmChain(
      parsed.id,
      parsed.mainnet,
      parsed.wormholeChainName ?? "",
      parsed.nativeToken,
      parsed.endpoint ?? "",
      parsed.gasPrice ?? "",
      parsed.prefix ?? "",
      parsed.feeDenom ?? "",
    );
  }

  toJson(): KeyValueConfig {
    return {
      endpoint: this.endpoint,
      feeDenom: this.feeDenom,
      gasPrice: this.gasPrice,
      id: this.id,
      mainnet: this.mainnet,
      prefix: this.prefix,
      type: CosmWasmChain.type,
      wormholeChainName: this.wormholeChainName,
    };
  }

  getType(): string {
    return CosmWasmChain.type;
  }

  async getCode(codeId: number): Promise<Buffer> {
    const chainQuerier = await CosmwasmQuerier.connect(this.endpoint);
    return await chainQuerier.getCode({ codeId });
  }

  generateGovernanceUpgradePayload(codeId: bigint): Buffer {
    return new CosmosUpgradeContract(this.wormholeChainName, codeId).encode();
  }

  async getExecutor(
    privateKey: PrivateKey,
  ): Promise<CosmwasmExecutor | InjectiveExecutor> {
    if (this.getId().includes("injective")) {
      return InjectiveExecutor.fromPrivateKey(
        this.isMainnet() ? Network.Mainnet : Network.Testnet,
        privateKey,
      );
    }
    return new CosmwasmExecutor(
      this.endpoint,
      await CosmwasmExecutor.getSignerFromPrivateKey(privateKey, this.prefix),
      this.gasPrice + this.feeDenom,
    );
  }

  async getAccountAddress(privateKey: PrivateKey): Promise<string> {
    const executor = await this.getExecutor(privateKey);
    return executor instanceof InjectiveExecutor
      ? executor.getAddress()
      : await executor.getAddress();
  }

  async getAccountBalance(privateKey: PrivateKey): Promise<number> {
    const executor = await this.getExecutor(privateKey);
    return await executor.getBalance();
  }
}

export class SuiChain extends Chain {
  static override type = "SuiChain";

  constructor(
    id: string,
    mainnet: boolean,
    wormholeChainName: string,
    nativeToken: TokenId | undefined,
    public rpcUrl: string,
  ) {
    super(id, mainnet, wormholeChainName, nativeToken);
  }

  static fromJson(parsed: ChainConfig): SuiChain {
    if (parsed.type !== SuiChain.type) throw new Error("Invalid type");
    return new SuiChain(
      parsed.id,
      parsed.mainnet,
      parsed.wormholeChainName ?? "",
      parsed.nativeToken,
      parsed.rpcUrl ?? "",
    );
  }

  toJson(): KeyValueConfig {
    return {
      id: this.id,
      mainnet: this.mainnet,
      rpcUrl: this.rpcUrl,
      type: SuiChain.type,
      wormholeChainName: this.wormholeChainName,
    };
  }

  getType(): string {
    return SuiChain.type;
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for contracts deployed on this chain
   * @param digest - hex string of the 32 byte digest for the new package without the 0x prefix
   */
  generateGovernanceUpgradePayload(digest: string): Buffer {
    return new UpgradeContract256Bit(this.wormholeChainName, digest).encode();
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for Lazer
   * contracts deployed on this chain.
   *
   * @param digest - hex string of the 32 byte digest for the new package
   * without the 0x prefix
   */
  generateGovernanceUpgradeLazerPayload(
    version: bigint,
    digest: string,
  ): Buffer {
    return new UpgradeSuiLazerContract(
      this.wormholeChainName,
      version,
      digest,
    ).encode();
  }

  /**
   * Returns the payload for a governance update of a trusted signer for Lazer
   * contracts deployed on this chain.
   *
   * @param publicKey - trusted signer public key
   * @param expiresAt - timestamp of key expiration in seconds
   */
  generateGovernanceUpdateTrustedSignerPayload(
    publicKey: string,
    expiresAt: bigint,
  ): Buffer {
    return new UpdateTrustedSigner264Bit(
      this.wormholeChainName,
      publicKey,
      expiresAt,
    ).encode();
  }

  getProvider(): SuiClient {
    return new SuiClient({ url: this.rpcUrl });
  }

  getAccountAddress(privateKey: PrivateKey): Promise<string> {
    const keypair = SuiEd25519Keypair.fromSecretKey(
      new Uint8Array(Buffer.from(privateKey, "hex")),
    );
    return Promise.resolve(keypair.toSuiAddress());
  }

  async getAccountBalance(privateKey: PrivateKey): Promise<number> {
    const provider = this.getProvider();
    const balance = await provider.getBalance({
      owner: await this.getAccountAddress(privateKey),
    });
    return Number(balance.totalBalance) / Number(MIST_PER_SUI);
  }

  async getCliEnv(): Promise<string> {
    const { stdout } = await execFileAsync("sui", ["client", "active-env"]);
    return stdout.trim();
  }

  async buildPackage(path: string): Promise<SuiPackage> {
    const activeEnv = await this.getCliEnv();
    if (`sui_${activeEnv}` !== this.getId()) {
      throw new Error(
        `Sui CLI is currently set to ${activeEnv}. Switch to correct environment and try again.`,
      );
    }

    const result = await execFileAsync(
      "sui",
      [
        "move",
        "build",
        "--dump-bytecode-as-base64",
        "--path",
        path,
        "--environment",
        activeEnv,
      ],
      { encoding: "utf8" },
    );
    try {
      return JSON.parse(result.stdout) as SuiPackage;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`${result.stdout}\n${result.stderr}`);
      }
      throw error;
    }
  }

  async publishPackage(
    { modules, dependencies }: SuiPackage,
    signer: SuiEd25519Keypair,
  ): Promise<{ packageId: string; upgradeCapId: string }> {
    const tx = new SuiTransaction();
    const upgrade_cap = tx.publish({ dependencies, modules });
    tx.transferObjects([upgrade_cap], signer.toSuiAddress());

    const { digest, objectChanges } = await this.executeTransaction(
      tx,
      signer,
      { showObjectChanges: true },
    );
    await this.getProvider().waitForTransaction({ digest });

    let packageId: string | undefined;
    let upgradeCapId: string | undefined;
    for (const change of objectChanges ?? []) {
      if (change.type === "published") {
        packageId = change.packageId;
      } else if (
        change.type === "created" &&
        change.objectType === `${SUI_FRAMEWORK_ADDRESS}::package::UpgradeCap`
      ) {
        upgradeCapId = change.objectId;
      }
    }
    if (!packageId) {
      throw new Error("Could not find package ID in transaction results");
    }
    if (!upgradeCapId) {
      throw new Error("Could not find UpgradeCap ID in transaction results");
    }
    return { packageId, upgradeCapId };
  }

  async publishLazerPackage(
    pkg: SuiPackage,
    meta: SuiLazerMeta,
    signer: SuiEd25519Keypair,
  ) {
    this.verifyLazerMeta(pkg, meta);
    return await this.publishPackage(pkg, signer);
  }

  async updateLazerMeta(packagePath: string, meta: SuiLazerMeta) {
    const templatePath = nodePath.resolve(
      packagePath,
      "sources/meta.move.mustache",
    );
    const template = await readFile(templatePath, { encoding: "utf8" });
    const outputPath = nodePath.resolve(packagePath, "sources/meta.move");
    const output = micromustache.render(template, meta);
    await writeFile(outputPath, output, { encoding: "utf8" });
  }

  /**
   * Inspects `pyth_lazer::meta` module bytecode to ensure that metadata are
   * set correctly.
   */
  verifyLazerMeta(
    { modules }: SuiPackage,
    { version, receiver_chain_id }: SuiLazerMeta,
  ) {
    for (const bytes of modules) {
      const {
        self_module_handle_idx,
        module_handles,
        identifiers,
        function_handles,
        function_defs,
      } = suiBytecode.deserialize(Buffer.from(bytes, "base64"));
      const name = identifiers[module_handles[self_module_handle_idx].name];
      if (name === "meta") {
        for (const def of function_defs) {
          const funName = identifiers[function_handles[def.function].name];
          if (funName === "version") {
            assert.deepEqual(def.code.code, [
              { LdU64: BigInt(version) },
              "Ret",
            ]);
          } else if (funName === "receiver_chain_id") {
            assert.deepEqual(def.code.code, [
              { LdU16: receiver_chain_id },
              "Ret",
            ]);
          }
        }
      }
    }
  }

  async initLazerContract(
    packageId: string,
    upgradeCapId: string,
    { emitterChain, emitterAddress }: DataSource,
    signer: SuiEd25519Keypair,
  ): Promise<{ stateId: string }> {
    const tx = new SuiTransaction();
    tx.moveCall({
      arguments: [
        tx.object(upgradeCapId),
        tx.pure.u16(emitterChain),
        tx.pure.vector(
          "u8",
          Buffer.from(emitterAddress.replace(/^0x/, ""), "hex"),
        ),
      ],
      target: `${packageId}::actions::init_lazer`,
    });

    const { objectChanges } = await this.executeTransaction(tx, signer, {
      showObjectChanges: true,
    });

    let stateId: string | undefined;
    for (const change of objectChanges ?? []) {
      if (
        change.type === "created" &&
        change.objectType === `${packageId}::state::State`
      ) {
        stateId = change.objectId;
      }
    }

    if (!stateId) {
      throw new Error("Could not find State ID in transcation results");
    }

    return { stateId };
  }

  async getUpgradeCapPackage(upgradeCapId: string) {
    const client = this.getProvider();
    const { data, error } = await client.getObject({
      id: upgradeCapId,
      options: { showContent: true },
    });
    if (!data?.content || error) {
      throw new Error(
        `Failed to get UpgradeCap: ${error?.code ?? "undefined"}`,
      );
    }
    if (data.content.dataType !== "moveObject") {
      throw new Error("Supplied ID does not have a valid UpgradeCap object");
    }

    const upgradeCap = data.content;
    if (
      !this.hasStructField(upgradeCap, "package") ||
      typeof upgradeCap.fields.package !== "string"
    ) {
      throw new TypeError("Could not find package string in UpgradeCap object");
    }
    return upgradeCap.fields.package;
  }

  /**
   * Receive package info from a state object following
   * `{ .., upgrade_cap: UpgradeCap }` convention.
   */
  async getStatePackageInfo(
    client: SuiClient,
    stateId: string,
  ): Promise<{
    package: string;
    version: string;
  }> {
    const state = await this.getStateObject(client, stateId);

    if (!this.hasStructField(state, "upgrade_cap")) {
      throw new Error("Missing 'upgrade_cap' in state object");
    }
    const upgradeCap = state.fields.upgrade_cap;
    if (
      !this.hasStructField(upgradeCap, "package") ||
      typeof upgradeCap.fields.package !== "string"
    ) {
      throw new Error("Could not find 'package' string in UpgradeCap");
    }
    if (
      !this.hasStructField(upgradeCap, "version") ||
      typeof upgradeCap.fields.version !== "string"
    ) {
      throw new Error("Could not find 'version' number in UpgradeCap");
    }
    return {
      package: upgradeCap.fields.package,
      version: upgradeCap.fields.version,
    };
  }

  async getStateGovernanceInfo(client: SuiClient, stateId: string) {
    const state = await this.getStateObject(client, stateId);

    if (!this.hasStructField(state, "governance")) {
      throw new Error("Missing 'governance' in state object");
    }
    const governance = state.fields.governance;
    if (
      !this.hasStructField(governance, "seen_sequence") ||
      typeof governance.fields.seen_sequence !== "string"
    ) {
      throw new Error("Could not find 'seen_sequence' BigInt in Governance");
    }
    return { seen_sequence: BigInt(governance.fields.seen_sequence) };
  }

  private async getStateObject(
    client: SuiClient,
    stateId: string,
  ): Promise<SuiMoveStruct> {
    const { data: stateObject, error } = await client.getObject({
      id: stateId,
      options: { showContent: true },
    });
    if (!stateObject?.content || error) {
      throw new Error(
        `Failed to get state object: ${error?.code ?? "undefined"}`,
      );
    }
    if (stateObject.content.dataType !== "moveObject") {
      throw new Error(
        `State must be an object, got: ${stateObject.content.dataType}`,
      );
    }

    return stateObject.content;
  }

  private hasStructField<const F extends string>(
    value: SuiMoveValue,
    name: F,
  ): value is { fields: Record<F, SuiMoveValue> } {
    return hasProperty(value, "fields") && hasProperty(value.fields, name);
  }

  /**
   * Executes `pyth_lazer::actions::update_trusted_signer` using signed VAA.
   *
   * @returns transaction digest
   */
  async updateTrustedSigner({
    stateId,
    wormholeStateId,
    vaa,
    signer,
  }: {
    stateId: string;
    wormholeStateId: string;
    vaa: Uint8Array;
    signer: SuiEd25519Keypair;
  }) {
    const client = this.getProvider();
    const tx = new SuiTransaction();
    const { package: wormholeId } = await this.getStatePackageInfo(
      client,
      wormholeStateId,
    );
    const { package: packageId } = await this.getStatePackageInfo(
      client,
      stateId,
    );

    const verifiedVaa = tx.moveCall({
      arguments: [
        tx.object(wormholeStateId),
        tx.pure.vector("u8", vaa),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
      target: `${wormholeId}::vaa::parse_and_verify`,
    });

    tx.moveCall({
      arguments: [tx.object(stateId), verifiedVaa],
      target: `${packageId}::actions::update_trusted_signer`,
    });

    const { digest } = await this.executeTransaction(tx, signer);
    return digest;
  }

  /**
   * Executes `pyth_lazer::actions::{upgrade, commit_upgrade}` using signed VAA.
   *
   * @returns transaction digest
   */
  async upgradeLazerContract({
    stateId,
    wormholeStateId,
    pkg,
    meta,
    vaa,
    signer,
  }: {
    stateId: string;
    wormholeStateId: string;
    pkg: SuiPackage;
    meta: SuiLazerMeta;
    vaa: Uint8Array;
    signer: SuiEd25519Keypair;
  }) {
    this.verifyLazerMeta(pkg, meta);

    const client = this.getProvider();
    const tx = new SuiTransaction();
    const { package: wormholeId } = await this.getStatePackageInfo(
      client,
      wormholeStateId,
    );
    const { package: packageId } = await this.getStatePackageInfo(
      client,
      stateId,
    );

    const verifiedVaa = tx.moveCall({
      arguments: [
        tx.object(wormholeStateId),
        tx.pure.vector("u8", vaa),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
      target: `${wormholeId}::vaa::parse_and_verify`,
    });

    const ticket = tx.moveCall({
      arguments: [tx.object(stateId), verifiedVaa],
      target: `${packageId}::actions::upgrade`,
    });
    const receipt = tx.upgrade({
      dependencies: pkg.dependencies,
      modules: pkg.modules,
      package: packageId,
      ticket,
    });
    tx.moveCall({
      arguments: [tx.object(stateId), receipt],
      target: `${packageId}::actions::commit_upgrade`,
    });

    const { digest } = await this.executeTransaction(tx, signer);
    return digest;
  }

  /**
   * Given a transaction block and a keypair, sign and execute it.
   * Sets the gas budget to 2x the estimated gas cost.
   *
   * @param tx - the transaction
   * @param keypair - the keypair
   * @param options - transaction response options
   */
  async executeTransaction(
    tx: SuiTransaction,
    keypair: SuiEd25519Keypair,
    options?: SuiTransactionBlockResponseOptions,
  ) {
    const provider = this.getProvider();

    tx.setSender(keypair.toSuiAddress());
    const dryRun = await provider.dryRunTransactionBlock({
      transactionBlock: await tx.build({ client: provider }),
    });
    tx.setGasBudget(BigInt(dryRun.input.gasData.budget.toString()) * BigInt(2));

    const res = await provider.signAndExecuteTransaction({
      options,
      signer: keypair,
      transaction: tx,
    });

    await provider.waitForTransaction({ digest: res.digest });
    return res;
  }

  explorerUrl(type: "object" | "address" | "txblock", id: string): string {
    return `https://explorer.polymedia.app/${type}/${id}?network=${
      this.isMainnet() ? "mainnet" : "testnet"
    }`;
  }
}

export type SuiPackage = {
  modules: string[];
  dependencies: string[];
  digest: number[];
};

export type SuiLazerMeta = {
  version: string;
  receiver_chain_id: number;
};

export class IotaChain extends Chain {
  static override type = "IotaChain";

  constructor(
    id: string,
    mainnet: boolean,
    wormholeChainName: string,
    nativeToken: TokenId | undefined,
    public rpcUrl: string,
  ) {
    super(id, mainnet, wormholeChainName, nativeToken);
  }

  static fromJson(parsed: ChainConfig): IotaChain {
    if (parsed.type !== IotaChain.type) throw new Error("Invalid type");
    return new IotaChain(
      parsed.id,
      parsed.mainnet,
      parsed.wormholeChainName ?? "",
      parsed.nativeToken,
      parsed.rpcUrl ?? "",
    );
  }

  toJson(): KeyValueConfig {
    return {
      id: this.id,
      mainnet: this.mainnet,
      rpcUrl: this.rpcUrl,
      type: IotaChain.type,
      wormholeChainName: this.wormholeChainName,
    };
  }

  getType(): string {
    return IotaChain.type;
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for contracts deployed on this chain
   * @param digest - hex string of the 32 byte digest for the new package without the 0x prefix
   */
  generateGovernanceUpgradePayload(digest: string): Buffer {
    return new UpgradeContract256Bit(this.wormholeChainName, digest).encode();
  }

  getProvider(): IotaClient {
    return new IotaClient({ url: this.rpcUrl });
  }

  getAccountAddress(privateKey: PrivateKey): Promise<string> {
    const keypair = IotaEd25519Keypair.fromSecretKey(
      new Uint8Array(Buffer.from(privateKey, "hex")),
    );
    return Promise.resolve(keypair.toIotaAddress());
  }

  async getAccountBalance(privateKey: PrivateKey): Promise<number> {
    const provider = this.getProvider();
    const balance = await provider.getBalance({
      owner: await this.getAccountAddress(privateKey),
    });
    return Number(balance.totalBalance) / Number(NANOS_PER_IOTA);
  }
}

export class EvmChain extends Chain {
  static override type = "EvmChain";

  constructor(
    id: string,
    mainnet: boolean,
    nativeToken: TokenId | undefined,
    public rpcUrl: string,
    public networkId: number,
  ) {
    // On EVM networks we use the chain id as the wormhole chain name
    super(id, mainnet, id, nativeToken);
  }

  static fromJson(parsed: ChainConfig & { networkId: number }): EvmChain {
    if (parsed.type !== EvmChain.type) throw new Error("Invalid type");
    if (parsed.nativeToken === undefined) {
      for (const chain of Object.values(chains)) {
        if (chain.id === parsed.networkId) {
          parsed.nativeToken = chain.nativeCurrency.symbol;
        }
      }
    }
    return new EvmChain(
      parsed.id,
      parsed.mainnet,
      parsed.nativeToken,
      parsed.rpcUrl ?? "",
      parsed.networkId,
    );
  }

  /**
   * Returns a web3 provider for this chain
   */
  getWeb3(): Web3 {
    return new Web3(parseRpcUrl(this.rpcUrl));
  }

  getViemDefaultWeb3(): Web3 {
    for (const chain of Object.values(chains)) {
      if (chain.id === this.networkId) {
        return new Web3(chain.rpcUrls.default.http[0]);
      }
    }
    throw new Error(`Chain with id ${this.networkId} not found in Viem`);
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for contracts deployed on this chain
   * @param address - hex string of the 20 byte address of the contract to upgrade to without the 0x prefix
   */
  generateGovernanceUpgradePayload(address: string): Buffer {
    return new EvmUpgradeContract(this.wormholeChainName, address).encode();
  }

  /**
   * Returns the payload for a governance action from the executor contract
   * @param executor - the address of the executor contract live on this chain
   * @param callAddress - the address of the contract to call
   * @param calldata - the calldata to pass to the contract
   * @returns the payload for the governance action
   */
  generateExecutorPayload(
    executor: string,
    callAddress: string,
    calldata: string,
  ): Buffer {
    return new EvmExecute(
      this.wormholeChainName,
      executor.replace("0x", ""),
      callAddress.replace("0x", ""),
      0n,
      Buffer.from(calldata.replace("0x", ""), "hex"),
    ).encode();
  }

  generateGovernanceSetWormholeAddressPayload(address: string): Buffer {
    return new EvmSetWormholeAddress(this.wormholeChainName, address).encode();
  }

  toJson(): KeyValueConfig {
    return {
      id: this.id,
      mainnet: this.mainnet,
      networkId: this.networkId,
      rpcUrl: this.rpcUrl,
      type: EvmChain.type,
    };
  }

  getType(): string {
    return EvmChain.type;
  }

  async getGasPrice() {
    const web3 = this.getWeb3();
    let gasPrice = await web3.eth.getGasPrice();
    // some testnets have inaccuarte gas prices that leads to transactions not being mined, we double it since it's free!
    if (!this.isMainnet()) {
      gasPrice = (BigInt(gasPrice) * 2n).toString();
    }
    return gasPrice;
  }

  async estiamteAndSendTransaction(
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    transactionObject: any,
    txParams: { from?: string; value?: string },
  ) {
    const GAS_ESTIMATE_MULTIPLIER = 2;
    const gasEstimate = await transactionObject.estimateGas(txParams);
    // Some networks like Filecoin do not support the normal transaction type and need a type 2 transaction.
    // To send a type 2 transaction, remove the ``gasPrice`` field.
    return transactionObject.send({
      gas: gasEstimate * GAS_ESTIMATE_MULTIPLIER,
      gasPrice: Number(await this.getGasPrice()),
      ...txParams,
    });
  }

  /**
   * Gets the balance for Tempo network using TIP-20 balanceOf instead of eth_getBalance
   * Tempo has no native gas token and uses TIP-20 tokens (pathUSD) for fees
   * @param address - the address to check balance for
   * @returns the balance in wei (as bigint)
   */
  private async getBalanceForTempo(address: string): Promise<bigint> {
    const PATHUSD_ADDRESS = "0x20c0000000000000000000000000000000000000";
    const ERC20_BALANCE_OF_ABI = [
      {
        constant: true,
        inputs: [{ name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        type: "function",
      },
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    ] as any;

    const web3 = this.getWeb3();
    const contract = new web3.eth.Contract(
      ERC20_BALANCE_OF_ABI,
      PATHUSD_ADDRESS,
    );
    const balance = await contract.methods.balanceOf(address).call();
    return BigInt(balance);
  }

  /**
   * Deploys a contract on this chain
   * @param privateKey - hex string of the 32 byte private key without the 0x prefix
   * @param abi - the abi of the contract, can be obtained from the compiled contract json file
   * @param bytecode - bytecode of the contract, can be obtained from the compiled contract json file
   * @param deployArgs - arguments to pass to the constructor. Each argument must begin with 0x if it's a hex string
   * @returns the address of the deployed contract
   */
  async deploy(
    privateKey: PrivateKey,
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    abi: any,
    bytecode: string,
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    deployArgs: any[],
    gasMultiplier = 1,
    gasPriceMultiplier = 1,
  ): Promise<string> {
    const web3 = this.getWeb3();
    const signer = web3.eth.accounts.privateKeyToAccount(privateKey);
    web3.eth.accounts.wallet.add(signer);
    const contract = new web3.eth.Contract(abi);
    const deployTx = contract.deploy({ arguments: deployArgs, data: bytecode });
    const gas = Math.trunc(
      (await deployTx.estimateGas({ from: signer.address })) * gasMultiplier,
    );
    const gasPrice = Math.trunc(
      Number(await this.getGasPrice()) * gasPriceMultiplier,
    );

    // Tempo testnet (networkId 42431) has no native gas token, use TIP-20 balanceOf instead
    const deployerBalance =
      this.networkId === 42_431 || this.networkId === 4217
        ? await this.getBalanceForTempo(signer.address)
        : BigInt(await web3.eth.getBalance(signer.address));
    // Comment it when you are interactive with Tempo testnet or mainnet
    const gasDiff = BigInt(gas) * BigInt(gasPrice) - deployerBalance;
    if (gasDiff > 0n) {
      throw new Error(
        `Insufficient funds to deploy contract. Need ${gas} (gas) * ${gasPrice} (gasPrice)= ${
          BigInt(gas) * BigInt(gasPrice)
        } wei, but only have ${deployerBalance} wei. We need ${
          Number(gasDiff) / 10 ** 18
        } ETH more.`,
      );
    }

    try {
      const deployedContract = await deployTx.send({
        from: signer.address,
        gas,
        gasPrice: gasPrice.toString(),
      });
      return deployedContract.options.address;
    } catch (error) {
      // RPC errors often have useful information in the non-primary message field. Log the whole error
      // to simplify identifying the problem.
      console.log(`Error deploying contract: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  getAccountAddress(privateKey: PrivateKey): Promise<string> {
    const web3 = this.getWeb3();
    const signer = web3.eth.accounts.privateKeyToAccount(privateKey);
    return Promise.resolve(signer.address);
  }

  async getAccountBalance(privateKey: PrivateKey): Promise<number> {
    const address = await this.getAccountAddress(privateKey);

    // Tempo testnet (networkId 42431) has no native gas token, use TIP-20 balanceOf instead
    if (this.networkId === 42_431) {
      const balance = await this.getBalanceForTempo(address);
      return Number(balance) / 10 ** 18;
    }

    const web3 = this.getWeb3();
    const balance = await web3.eth.getBalance(address);
    return Number(balance) / 10 ** 18;
  }
}

export class AptosChain extends Chain {
  static override type = "AptosChain";

  constructor(
    id: string,
    mainnet: boolean,
    wormholeChainName: string,
    nativeToken: TokenId | undefined,
    public rpcUrl: string,
  ) {
    super(id, mainnet, wormholeChainName, nativeToken);
  }

  getClient(): AptosClient {
    return new AptosClient(this.rpcUrl);
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for contracts deployed on this chain
   * @param digest - hex string of the 32 byte digest for the new package without the 0x prefix
   */
  generateGovernanceUpgradePayload(digest: string): Buffer {
    return new UpgradeContract256Bit(this.wormholeChainName, digest).encode();
  }

  getType(): string {
    return AptosChain.type;
  }

  toJson(): KeyValueConfig {
    return {
      id: this.id,
      mainnet: this.mainnet,
      rpcUrl: this.rpcUrl,
      type: AptosChain.type,
      wormholeChainName: this.wormholeChainName,
    };
  }

  static fromJson(parsed: ChainConfig): AptosChain {
    if (parsed.type !== AptosChain.type) throw new Error("Invalid type");
    return new AptosChain(
      parsed.id,
      parsed.mainnet,
      parsed.wormholeChainName ?? "",
      parsed.nativeToken,
      parsed.rpcUrl ?? "",
    );
  }

  getAccountAddress(privateKey: PrivateKey): Promise<string> {
    const account = new AptosAccount(
      new Uint8Array(Buffer.from(privateKey, "hex")),
    );
    return Promise.resolve(account.address().toString());
  }

  async getAccountBalance(privateKey: PrivateKey): Promise<number> {
    const client = this.getClient();
    const account = new AptosAccount(
      new Uint8Array(Buffer.from(privateKey, "hex")),
    );
    const coinClient = new CoinClient(client);
    return Number(await coinClient.checkBalance(account)) / 10 ** 8;
  }

  async sendTransaction(
    senderPrivateKey: PrivateKey,
    txPayload: TxnBuilderTypes.TransactionPayloadEntryFunction,
  ): Promise<TxResult> {
    const client = this.getClient();
    const sender = new AptosAccount(
      new Uint8Array(Buffer.from(senderPrivateKey, "hex")),
    );
    const result = await client.generateSignSubmitWaitForTransaction(
      sender,
      txPayload,
      {
        maxGasAmount: BigInt(30_000),
      },
    );
    return { id: result.hash, info: result };
  }
}

export class FuelChain extends Chain {
  static override type = "FuelChain";

  constructor(
    id: string,
    mainnet: boolean,
    wormholeChainName: string,
    nativeToken: TokenId | undefined,
    public gqlUrl: string,
  ) {
    super(id, mainnet, wormholeChainName, nativeToken);
  }

  async getProvider(): Promise<Provider> {
    // @ts-expect-error - TODO: The typing does NOT indicate a create() function exists, so this is likely to blow up at runtime
    return await Provider.create(this.gqlUrl);
  }

  async getWallet(privateKey: PrivateKey): Promise<WalletUnlocked> {
    const provider = await this.getProvider();
    return Wallet.fromPrivateKey(privateKey, provider);
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for contracts deployed on this chain
   * @param digest - hex string of the 32 byte digest for the new package without the 0x prefix
   */
  generateGovernanceUpgradePayload(digest: string): Buffer {
    // This might throw an error because the Fuel contract doesn't support upgrades yet (blocked on Fuel releasing Upgradeability standard)
    return new UpgradeContract256Bit(this.wormholeChainName, digest).encode();
  }

  getType(): string {
    return FuelChain.type;
  }

  toJson(): KeyValueConfig {
    return {
      gqlUrl: this.gqlUrl,
      id: this.id,
      mainnet: this.mainnet,
      type: FuelChain.type,
      wormholeChainName: this.wormholeChainName,
    };
  }

  static fromJson(parsed: ChainConfig): FuelChain {
    if (parsed.type !== FuelChain.type) throw new Error("Invalid type");
    return new FuelChain(
      parsed.id,
      parsed.mainnet,
      parsed.wormholeChainName ?? "",
      parsed.nativeToken,
      parsed.gqlUrl ?? "",
    );
  }

  async getAccountAddress(privateKey: PrivateKey): Promise<string> {
    const wallet = await this.getWallet(privateKey);
    return wallet.address.toString();
  }

  async getAccountBalance(privateKey: PrivateKey): Promise<number> {
    const wallet = await this.getWallet(privateKey);
    const balance: BN = await wallet.getBalance(FUEL_ETH_ASSET_ID);
    return Number(balance) / 10 ** 9;
  }
}

export class StarknetChain extends Chain {
  static override type = "StarknetChain";

  constructor(
    id: string,
    mainnet: boolean,
    wormholeChainName: string,
    public rpcUrl: string,
  ) {
    super(id, mainnet, wormholeChainName, undefined);
  }

  getType(): string {
    return StarknetChain.type;
  }

  toJson(): KeyValueConfig {
    return {
      id: this.id,
      mainnet: this.mainnet,
      rpcUrl: this.rpcUrl,
      type: StarknetChain.type,
      wormholeChainName: this.wormholeChainName,
    };
  }

  static fromJson(parsed: ChainConfig): StarknetChain {
    if (parsed.type !== StarknetChain.type) throw new Error("Invalid type");
    return new StarknetChain(
      parsed.id,
      parsed.mainnet,
      parsed.wormholeChainName ?? "",
      parsed.rpcUrl ?? "",
    );
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for contracts deployed on this chain
   * @param digest - hex string of the felt252 class hash of the new contract class extended to uint256 in BE
   */
  generateGovernanceUpgradePayload(digest: string): Buffer {
    return new UpgradeContract256Bit(this.wormholeChainName, digest).encode();
  }

  async getAccountAddress(privateKey: PrivateKey): Promise<string> {
    const ARGENT_CLASS_HASH =
      "0x029927c8af6bccf3f6fda035981e765a7bdbf18a2dc0d630494f8758aa908e2b";
    const ADDR_BOUND =
      0x7_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_ff_00n;

    const publicKey = await new Signer("0x" + privateKey).getPubKey();

    const value = computeHashOnElements([
      shortString.encodeShortString("STARKNET_CONTRACT_ADDRESS"),
      "0",
      publicKey,
      ARGENT_CLASS_HASH,
      computeHashOnElements([publicKey, "0"]),
    ]);
    return (BigInt(value) % ADDR_BOUND).toString(16).padStart(64, "0");
  }

  async getAccountBalance(privateKey: PrivateKey): Promise<number> {
    const ETH =
      "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";

    const address = await this.getAccountAddress(privateKey);
    const provider = this.getProvider();
    const tokenClassData = await provider.getClassAt(ETH);
    const tokenContract = new Contract(tokenClassData.abi, ETH, provider);
    const decimals = await tokenContract.decimals();
    const amount = await tokenContract.balanceOf("0x" + address);
    return Number(amount) / Number(10n ** decimals);
  }

  getProvider(): RpcProvider {
    return new RpcProvider({ nodeUrl: this.rpcUrl });
  }
}

export class TonChain extends Chain {
  static override type = "TonChain";

  constructor(
    id: string,
    mainnet: boolean,
    wormholeChainName: string,
    nativeToken: TokenId | undefined,
    private rpcUrl: string,
  ) {
    super(id, mainnet, wormholeChainName, nativeToken);
  }

  getClient(): TonClient {
    // We are hacking rpcUrl to include the apiKey header which is a
    // header that is used to bypass rate limits on the TON network
    const [rpcUrl = "", apiKey = ""] = parseRpcUrl(this.rpcUrl).split("#");

    const client = new TonClient({
      apiKey,
      endpoint: rpcUrl,
    });
    return client;
  }

  getContract(address: string): OpenedContract<PythContract> {
    const client = this.getClient();
    const contract = client.open(
      PythContract.createFromAddress(Address.parse(address)),
    );
    return contract;
  }

  getContractProvider(address: string): ContractProvider {
    const client = this.getClient();
    return client.provider(Address.parse(address));
  }

  getWallet(privateKey: PrivateKey): WalletContractV4 {
    const keyPair = keyPairFromSeed(Buffer.from(privateKey, "hex"));
    return WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0,
    });
  }

  getSender(privateKey: PrivateKey): Sender {
    const client = this.getClient();
    const keyPair = keyPairFromSeed(Buffer.from(privateKey, "hex"));
    const wallet = WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0,
    });
    const provider = client.open(wallet);
    return provider.sender(keyPair.secretKey);
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for contracts deployed on this chain
   * @param digest - hex string of the 32 byte digest for the new package without the 0x prefix
   */
  generateGovernanceUpgradePayload(digest: string): Buffer {
    return new UpgradeContract256Bit(this.wormholeChainName, digest).encode();
  }

  getType(): string {
    return TonChain.type;
  }

  toJson(): KeyValueConfig {
    return {
      id: this.id,
      mainnet: this.mainnet,
      rpcUrl: this.rpcUrl,
      type: TonChain.type,
      wormholeChainName: this.wormholeChainName,
    };
  }

  static fromJson(parsed: ChainConfig): TonChain {
    if (parsed.type !== TonChain.type) throw new Error("Invalid type");
    return new TonChain(
      parsed.id,
      parsed.mainnet,
      parsed.wormholeChainName ?? "",
      parsed.nativeToken,
      parsed.rpcUrl ?? "",
    );
  }

  getAccountAddress(privateKey: PrivateKey): Promise<string> {
    const wallet = this.getWallet(privateKey);
    return Promise.resolve(wallet.address.toString());
  }

  async getAccountBalance(privateKey: PrivateKey): Promise<number> {
    const wallet = this.getWallet(privateKey);
    const provider = this.getContractProvider(wallet.address.toString());
    const balance = await wallet.getBalance(provider);
    return Number(balance) / 10 ** 9;
  }
}

export class NearChain extends Chain {
  static override type = "NearChain";

  constructor(
    id: string,
    mainnet: boolean,
    wormholeChainName: string,
    nativeToken: TokenId | undefined,
    private rpcUrl: string,
    private networkId: string,
  ) {
    super(id, mainnet, wormholeChainName, nativeToken);
  }

  static fromJson(parsed: ChainConfig): NearChain {
    if (parsed.type !== NearChain.type) throw new Error("Invalid type");
    return new NearChain(
      parsed.id,
      parsed.mainnet,
      parsed.wormholeChainName ?? "",
      parsed.nativeToken,
      parsed.rpcUrl ?? "",
      parsed.networkId ?? "",
    );
  }

  getType(): string {
    return NearChain.type;
  }

  toJson(): KeyValueConfig {
    return {
      id: this.id,
      mainnet: this.mainnet,
      networkId: this.networkId,
      rpcUrl: this.rpcUrl,
      type: NearChain.type,
      wormholeChainName: this.wormholeChainName,
    };
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for contracts deployed on this chain
   * @param codeHash - hex string of the 32 byte code hash for the new contract without the 0x prefix
   */
  generateGovernanceUpgradePayload(codeHash: string): Buffer {
    return new UpgradeContract256Bit(this.wormholeChainName, codeHash).encode();
  }

  getAccountAddress(privateKey: PrivateKey): Promise<string> {
    return Promise.resolve(
      Buffer.from(
        SuiEd25519Keypair.fromSecretKey(
          new Uint8Array(Buffer.from(privateKey, "hex")),
        )
          .getPublicKey()
          .toRawBytes(),
      ).toString("hex"),
    );
  }

  async getAccountBalance(privateKey: PrivateKey): Promise<number> {
    const accountId = await this.getAccountAddress(privateKey);
    const account = await this.getNearAccount(accountId);
    const balance = await account.getAccountBalance();
    return Number(balance.available) / 1e24;
  }

  async getNearAccount(
    accountId: string,
    senderPrivateKey?: PrivateKey,
  ): Promise<nearAPI.Account> {
    const keyStore = new nearAPI.keyStores.InMemoryKeyStore();
    if (senderPrivateKey !== undefined) {
      const key = bs58.encode(
        new Uint8Array(Buffer.from(senderPrivateKey, "hex")),
      );
      const keyPair = nearAPI.KeyPair.fromString(key);
      const address = await this.getAccountAddress(senderPrivateKey);
      await keyStore.setKey(this.networkId, address, keyPair);
    }
    const connectionConfig = {
      keyStore,
      networkId: this.networkId,
      nodeUrl: this.rpcUrl,
    };
    const nearConnection = await nearAPI.connect(connectionConfig);
    return await nearConnection.account(accountId);
  }
}
