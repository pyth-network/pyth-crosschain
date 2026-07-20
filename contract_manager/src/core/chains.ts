/** biome-ignore-all lint/style/noProcessEnv: utils used through CLI */
/** biome-ignore-all lint/suspicious/noConsole: utils used through CLI */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  access,
  cp,
  mkdtemp,
  readFile,
  readlink,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import nodePath from "node:path";

import { Network } from "@injectivelabs/networks";
import type { IotaTransactionBlockResponse } from "@iota/iota-sdk/client";
import { IotaClient } from "@iota/iota-sdk/client";
import { Ed25519Keypair as IotaEd25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import { Transaction as IotaTransaction } from "@iota/iota-sdk/transactions";
import { IOTA_CLOCK_OBJECT_ID, NANOS_PER_IOTA } from "@iota/iota-sdk/utils";
import * as toml from "@ltd/j-toml";
import * as suiBytecode from "@mysten/move-bytecode-template";
import type { ClientWithCoreApi, SuiClientTypes } from "@mysten/sui/client";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair as SuiEd25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction as SuiTransaction } from "@mysten/sui/transactions";
import { MIST_PER_SUI, SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import {
  CosmwasmExecutor,
  CosmwasmQuerier,
  InjectiveExecutor,
} from "@pythnetwork/cosmwasm-deploy-tools";
import { FUEL_ETH_ASSET_ID } from "@pythnetwork/pyth-fuel-js";
import type {
  CardanoNetwork,
  ReadClient,
} from "@pythnetwork/pyth-lazer-cardano-js";
import { createReadClient } from "@pythnetwork/pyth-lazer-cardano-js";
import { getStructFields } from "@pythnetwork/pyth-sui-js";
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
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import {
  BASE_FEE,
  Horizon as StellarHorizon,
  Keypair as StellarKeypair,
  Operation as StellarOperation,
  TransactionBuilder as StellarTransactionBuilder,
  rpc as stellarRpc,
} from "@stellar/stellar-sdk";
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

/**
 * Sui transport selector. `json-rpc` is the legacy default; `grpc` migrates to
 * the transport Sui Foundation is replacing JSON-RPC with — the public
 * JSON-RPC endpoints are turned off in July 2026 and removed entirely by
 * mid-Oct 2026. Mirrors the price pusher's dual-protocol support.
 */
export type SuiEndpointType = "json-rpc" | "grpc";

/**
 * Both the `@mysten/sui` v2 JSON-RPC client (`SuiJsonRpcClient`) and the
 * experimental gRPC client (`SuiGrpcClient`) expose the unified `.core` API.
 * The chain reads and writes exclusively through `.core` so the same code
 * works over either transport.
 */
function createSuiProvider(
  endpointType: SuiEndpointType,
  mainnet: boolean,
  url: string,
): ClientWithCoreApi {
  const network = mainnet ? "mainnet" : "testnet";
  switch (endpointType) {
    case "grpc": {
      return new SuiGrpcClient({ baseUrl: url, network });
    }
    case "json-rpc": {
      return new SuiJsonRpcClient({ network, url });
    }
  }
}

/**
 * Unwrap the executed (or simulated) transaction from the `.core` result union.
 * Both transports return a `Transaction` / `FailedTransaction` tagged union
 * rather than throwing on on-chain failure, so callers must inspect the status.
 */
export function getExecutedTransaction<T>(
  result:
    | { $kind: "Transaction"; Transaction: T }
    | { $kind: "FailedTransaction"; FailedTransaction: T },
): T {
  return result.$kind === "Transaction"
    ? result.Transaction
    : result.FailedTransaction;
}

/**
 * Sign and execute a transaction over the transport-agnostic `.core` API,
 * setting the gas budget to 2x the simulated cost. Works over both the
 * JSON-RPC and gRPC clients. Throws if the simulation or the on-chain
 * execution fails, and waits for the transaction to be available before
 * returning.
 *
 * @param provider - the Sui client (JSON-RPC or gRPC)
 * @param tx - the transaction
 * @param keypair - the keypair
 */
export async function executeSuiTransaction(
  provider: ClientWithCoreApi,
  tx: SuiTransaction,
  keypair: SuiEd25519Keypair,
): Promise<SuiClientTypes.Transaction<{ effects: true; objectTypes: true }>> {
  tx.setSender(keypair.toSuiAddress());
  const simulation = getExecutedTransaction(
    await provider.core.simulateTransaction({
      include: { effects: true },
      transaction: await tx.build({ client: provider }),
    }),
  );
  if (simulation.effects.status.error) {
    throw new Error(
      `Transaction simulation failed: ${JSON.stringify(
        simulation.effects.status.error,
      )}`,
    );
  }
  const { computationCost, storageCost } = simulation.effects.gasUsed;
  tx.setGasBudget((BigInt(computationCost) + BigInt(storageCost)) * BigInt(2));

  const executed = getExecutedTransaction(
    await provider.core.signAndExecuteTransaction({
      include: { effects: true, objectTypes: true },
      signer: keypair,
      transaction: tx,
    }),
  );
  // The `.core` API returns a `FailedTransaction` for on-chain execution
  // failures rather than throwing, so check the status explicitly.
  if (executed.effects.status.error) {
    throw new Error(
      `Transaction ${executed.digest} failed on-chain: ${JSON.stringify(
        executed.effects.status.error,
      )}`,
    );
  }

  await provider.core.waitForTransaction({ digest: executed.digest });
  return executed;
}

export class SuiChain extends Chain {
  static override type = "SuiChain";

  constructor(
    id: string,
    mainnet: boolean,
    wormholeChainName: string,
    nativeToken: TokenId | undefined,
    public rpcUrl: string,
    public endpointType: SuiEndpointType = "json-rpc",
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
      (parsed.endpointType as SuiEndpointType | undefined) ?? "json-rpc",
    );
  }

  toJson(): KeyValueConfig {
    return {
      endpointType: this.endpointType,
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

  getProvider(): ClientWithCoreApi {
    return createSuiProvider(this.endpointType, this.mainnet, this.rpcUrl);
  }

  getAccountAddress(privateKey: PrivateKey): Promise<string> {
    const keypair = SuiEd25519Keypair.fromSecretKey(
      new Uint8Array(Buffer.from(privateKey, "hex")),
    );
    return Promise.resolve(keypair.toSuiAddress());
  }

  async getAccountBalance(privateKey: PrivateKey): Promise<number> {
    const provider = this.getProvider();
    const { balance } = await provider.core.getBalance({
      owner: await this.getAccountAddress(privateKey),
    });
    return Number(balance.balance) / Number(MIST_PER_SUI);
  }

  async getCliEnv(): Promise<string> {
    const { stdout } = await execFileAsync("sui", ["client", "active-env"]);
    return stdout.trim();
  }

  async buildPackage(path: string): Promise<MovePackage> {
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
        "--build-env",
        activeEnv,
      ],
      { encoding: "utf8" },
    );
    try {
      return JSON.parse(result.stdout) as MovePackage;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`${result.stdout}\n${result.stderr}`);
      }
      throw error;
    }
  }

  async publishPackage(
    { modules, dependencies }: MovePackage,
    signer: SuiEd25519Keypair,
  ): Promise<{ packageId: string; upgradeCapId: string }> {
    const tx = new SuiTransaction();
    const upgrade_cap = tx.publish({ dependencies, modules });
    tx.transferObjects([upgrade_cap], signer.toSuiAddress());

    const executed = await this.executeTransaction(tx, signer);

    const packageId = this.findPublishedPackageId(executed);
    const upgradeCapId = this.findCreatedObjectId(
      executed,
      "::package::UpgradeCap",
    );
    if (!packageId) {
      throw new Error("Could not find package ID in transaction results");
    }
    if (!upgradeCapId) {
      throw new Error("Could not find UpgradeCap ID in transaction results");
    }
    return { packageId, upgradeCapId };
  }

  async publishLazerPackage(
    pkg: MovePackage,
    meta: MoveLazerMeta,
    signer: SuiEd25519Keypair,
  ) {
    this.verifyLazerMeta(pkg, meta);
    return await this.publishPackage(pkg, signer);
  }

  async updateLazerMeta(packagePath: string, meta: MoveLazerMeta) {
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
    { modules }: MovePackage,
    { version, receiver_chain_id }: MoveLazerMeta,
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

    const executed = await this.executeTransaction(tx, signer);

    const stateId = this.findCreatedObjectId(executed, "::state::State");
    if (!stateId) {
      throw new Error("Could not find State ID in transcation results");
    }

    return { stateId };
  }

  async getUpgradeCapPackage(upgradeCapId: string) {
    const client = this.getProvider();
    const fields = await this.getObjectFields(client, upgradeCapId);
    if (typeof fields.package !== "string") {
      throw new TypeError("Could not find package string in UpgradeCap object");
    }
    return fields.package;
  }

  /**
   * Receive package info from a state object following
   * `{ .., upgrade_cap: UpgradeCap }` convention.
   */
  async getStatePackageInfo(
    client: ClientWithCoreApi,
    stateId: string,
  ): Promise<{
    package: string;
    version: string;
  }> {
    const state = await this.getObjectFields(client, stateId);
    if (state.upgrade_cap === undefined) {
      throw new Error("Missing 'upgrade_cap' in state object");
    }
    const upgradeCap = getStructFields(state.upgrade_cap);
    if (typeof upgradeCap.package !== "string") {
      throw new Error("Could not find 'package' string in UpgradeCap");
    }
    if (typeof upgradeCap.version !== "string") {
      throw new Error("Could not find 'version' number in UpgradeCap");
    }
    return {
      package: upgradeCap.package,
      version: upgradeCap.version,
    };
  }

  async getStateGovernanceInfo(client: ClientWithCoreApi, stateId: string) {
    const state = await this.getObjectFields(client, stateId);
    if (state.governance === undefined) {
      throw new Error("Missing 'governance' in state object");
    }
    const governance = getStructFields(state.governance);
    if (typeof governance.seen_sequence !== "string") {
      throw new Error("Could not find 'seen_sequence' BigInt in Governance");
    }
    return { seen_sequence: BigInt(governance.seen_sequence) };
  }

  /**
   * Reads an object's Move struct fields through the transport-agnostic `.core`
   * API. `getStructFields` normalises the JSON shape, which differs between the
   * JSON-RPC (`{ type, fields }`) and gRPC (flattened) transports.
   */
  private async getObjectFields(
    client: ClientWithCoreApi,
    objectId: string,
  ): Promise<Record<string, unknown>> {
    const { object } = await client.core.getObject({
      include: { json: true },
      objectId,
    });
    if (!object.json) {
      throw new Error(`Failed to get object content for ${objectId}`);
    }
    return getStructFields(object.json);
  }

  /** The published package id from a `.core` execution's effects. */
  private findPublishedPackageId(
    executed: SuiClientTypes.Transaction<{
      effects: true;
      objectTypes: true;
    }>,
  ): string | undefined {
    return executed.effects.changedObjects.find(
      (obj) => obj.outputState === "PackageWrite",
    )?.objectId;
  }

  /**
   * The id of a newly-created object whose Move type ends with `typeSuffix`
   * (e.g. `::package::UpgradeCap`). Matching the suffix rather than the full
   * type avoids depending on how the transport normalises the package address.
   */
  private findCreatedObjectId(
    executed: SuiClientTypes.Transaction<{
      effects: true;
      objectTypes: true;
    }>,
    typeSuffix: string,
  ): string | undefined {
    return executed.effects.changedObjects.find(
      (obj) =>
        obj.idOperation === "Created" &&
        executed.objectTypes[obj.objectId]?.endsWith(typeSuffix),
    )?.objectId;
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
    pkg: MovePackage;
    meta: MoveLazerMeta;
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
   * Sets the gas budget to 2x the simulated gas cost.
   *
   * @param tx - the transaction
   * @param keypair - the keypair
   */
  executeTransaction(
    tx: SuiTransaction,
    keypair: SuiEd25519Keypair,
  ): Promise<SuiClientTypes.Transaction<{ effects: true; objectTypes: true }>> {
    return executeSuiTransaction(this.getProvider(), tx, keypair);
  }

  explorerUrl(type: "object" | "address" | "txblock", id: string): string {
    return `https://explorer.polymedia.app/${type}/${id}?network=${
      this.isMainnet() ? "mainnet" : "testnet"
    }`;
  }
}

export type MovePackage = {
  modules: string[];
  dependencies: string[];
  digest: number[];
};

export type MoveLazerMeta = {
  version: string;
  receiver_chain_id: number;
};

export type IotaWormholeInitConfig = {
  governanceChain: number;
  governanceEmitter: Buffer;
  initialGuardians: number[][];
  guardianSetSecondsToLive: number;
};

type TomlTable = ReturnType<typeof toml.parse>;
type TomlReadonlyTable = Parameters<typeof toml.stringify>[0];

/**
 * IOTA transport selector, kept symmetric with {@link SuiEndpointType} so the
 * chain config schema is consistent across the two Move chains. The IOTA SDK
 * (`@iota/iota-sdk`) does not yet ship a gRPC client, so only `json-rpc` is
 * functional today; the `grpc` variant exists so configs are ready the moment
 * IOTA's fork adds one.
 */
export type IotaEndpointType = "json-rpc" | "grpc";

export class IotaChain extends Chain {
  static override type = "IotaChain";

  constructor(
    id: string,
    mainnet: boolean,
    wormholeChainName: string,
    nativeToken: TokenId | undefined,
    public rpcUrl: string,
    public endpointType: IotaEndpointType = "json-rpc",
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
      (parsed.endpointType as IotaEndpointType | undefined) ?? "json-rpc",
    );
  }

  toJson(): KeyValueConfig {
    return {
      endpointType: this.endpointType,
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

  static getMoveStructFields(
    value: unknown,
    description: string,
  ): Record<string, unknown> {
    if (typeof value !== "object" || value === null || !("fields" in value)) {
      throw new Error(`Could not find fields in ${description}`);
    }
    const { fields } = value;
    if (
      typeof fields !== "object" ||
      fields === null ||
      Array.isArray(fields)
    ) {
      throw new Error(`Invalid fields in ${description}`);
    }
    return fields as Record<string, unknown>;
  }

  static bytesFromMoveField(value: unknown, description: string): Buffer {
    if (typeof value === "string") {
      return Buffer.from(value, "base64");
    }
    if (
      Array.isArray(value) &&
      value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
    ) {
      return Buffer.from(value);
    }
    throw new Error(`Invalid byte vector in ${description}`);
  }

  static bytesFromHex(
    value: string,
    byteLength: number,
    description: string,
  ): Buffer {
    const normalized = value.replace(/^0x/i, "");
    if (
      normalized.length !== byteLength * 2 ||
      !/^[0-9a-f]+$/i.test(normalized)
    ) {
      throw new Error(
        `${description} must be exactly ${byteLength.toString()} bytes of hex`,
      );
    }
    return Buffer.from(normalized, "hex");
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

  /** Returns the payload for a trusted Lazer signer update. */
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

  getProvider(): IotaClient {
    if (this.endpointType === "grpc") {
      throw new Error(
        "gRPC is not supported for IOTA yet: @iota/iota-sdk does not ship a gRPC client. Use endpointType 'json-rpc'.",
      );
    }
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

  async getCliEnv(): Promise<string> {
    const { stdout } = await execFileAsync("iota", ["client", "active-env"]);
    return stdout.trim();
  }

  static async setPackageAddress(path: string, address: string) {
    const manifestPath = nodePath.join(path, "Move.toml");
    const manifest = toml.parse(await readFile(manifestPath, "utf8"), {
      x: { literal: true, order: true, comment: true },
    });

    const packageName = (manifest.package as TomlTable | undefined)?.name?.toString();
    if (!packageName) {
      throw new Error("expected [package].name in Move.toml");
    }
    (manifest.package as TomlTable)["published-at"] = toml.basic(address);
    (manifest.addresses as TomlTable)[packageName] = toml.basic(address);

    if (manifest["dev-addresses"] && packageName in (manifest["dev-addresses"] as TomlTable)) {
      delete (manifest["dev-addresses"] as TomlTable)[packageName];
      if (Object.keys(manifest["dev-addresses"] as TomlTable).length === 0) {
        delete manifest["dev-addresses"];
      }
    }

    const updatedManifest = toml.stringify(manifest as TomlReadonlyTable, { newline: "\n" });
    await writeFile(manifestPath, updatedManifest.trimStart());
  }

  async buildPackage(path: string): Promise<MovePackage> {
    const activeEnv = await this.getCliEnv();
    if (`iota_${activeEnv}` !== this.getId()) {
      throw new Error(
        `IOTA CLI is currently set to ${activeEnv}. Switch to correct environment and try again.`,
      );
    }

    const result = await execFileAsync(
      "iota",
      ["move", "build", "--dump-bytecode-as-base64", "--path", path],
      { encoding: "utf8" },
    );
    try {
      return JSON.parse(result.stdout) as MovePackage;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`${result.stdout}\n${result.stderr}`);
      }
      throw error;
    }
  }

  async buildWormholePackage(path: string): Promise<MovePackage> {
    const temporaryRoot = await mkdtemp(
      nodePath.join(tmpdir(), "iota-wormhole-"),
    );
    const temporaryPackage = nodePath.join(temporaryRoot, "wormhole");
    try {
      await cp(path, temporaryPackage, {
        filter: (source) =>
          !["build", "Move.lock"].includes(nodePath.basename(source)),
        recursive: true,
      });
      await IotaChain.setPackageAddress(temporaryPackage, "0x0");
      return await this.buildPackage(temporaryPackage);
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true });
    }
  }

  async publishPackage(
    { modules, dependencies }: MovePackage,
    signer: IotaEd25519Keypair,
  ): Promise<{ packageId: string; upgradeCapId: string }> {
    const tx = new IotaTransaction();
    const [upgradeCap] = tx.publish({ dependencies, modules });
    if (!upgradeCap) {
      throw new Error("IOTA publish did not return an UpgradeCap");
    }
    tx.transferObjects([upgradeCap], signer.toIotaAddress());

    const executed = await this.executeTransaction(tx, signer);
    const packageId = executed.objectChanges?.find(
      (change) => change.type === "published",
    )?.packageId;
    const upgradeCapChange = executed.objectChanges?.find(
      (change) =>
        change.type === "created" &&
        change.objectType.endsWith("::package::UpgradeCap"),
    );
    const upgradeCapId =
      upgradeCapChange?.type === "created"
        ? upgradeCapChange.objectId
        : undefined;
    if (!packageId) {
      throw new Error("Could not find package ID in transaction results");
    }
    if (!upgradeCapId) {
      throw new Error("Could not find UpgradeCap ID in transaction results");
    }
    return { packageId, upgradeCapId };
  }

  async publishWormholePackage(
    { modules, dependencies }: MovePackage,
    signer: IotaEd25519Keypair,
  ): Promise<{
    packageId: string;
    upgradeCapId: string;
    deployerCapId: string;
    digest: string;
  }> {
    const tx = new IotaTransaction();
    const [upgradeCap] = tx.publish({ dependencies, modules });
    if (!upgradeCap) {
      throw new Error("IOTA Wormhole publish did not return an UpgradeCap");
    }
    tx.transferObjects([upgradeCap], signer.toIotaAddress());

    const executed = await this.executeTransaction(tx, signer);
    const publishedChanges =
      executed.objectChanges?.filter((change) => change.type === "published") ??
      [];
    if (publishedChanges.length !== 1) {
      throw new Error(
        `Expected one published IOTA Wormhole package, found ${publishedChanges.length.toString()}`,
      );
    }
    const packageId = publishedChanges[0]?.packageId;
    const upgradeCapChange = executed.objectChanges?.find(
      (change) =>
        change.type === "created" &&
        change.objectType.endsWith("::package::UpgradeCap"),
    );
    const deployerCapChange = executed.objectChanges?.find(
      (change) =>
        change.type === "created" &&
        change.objectType.endsWith("::setup::DeployerCap"),
    );
    if (!packageId) {
      throw new Error(
        "Could not find Wormhole package ID in transaction results",
      );
    }
    if (!upgradeCapChange || upgradeCapChange.type !== "created") {
      throw new Error(
        "Could not find Wormhole UpgradeCap ID in transaction results",
      );
    }
    if (!deployerCapChange || deployerCapChange.type !== "created") {
      throw new Error(
        "Could not find Wormhole DeployerCap ID in transaction results",
      );
    }
    if (!deployerCapChange.objectType.startsWith(`${packageId}::`)) {
      throw new Error(
        `Wormhole DeployerCap belongs to unexpected package ${deployerCapChange.objectType}`,
      );
    }
    return {
      deployerCapId: deployerCapChange.objectId,
      digest: executed.digest,
      packageId,
      upgradeCapId: upgradeCapChange.objectId,
    };
  }

  async publishLazerPackage(
    pkg: MovePackage,
    meta: MoveLazerMeta,
    signer: IotaEd25519Keypair,
  ) {
    this.verifyLazerMeta(pkg, meta);
    return await this.publishPackage(pkg, signer);
  }

  async updateLazerMeta(packagePath: string, meta: MoveLazerMeta) {
    const manifestFileName = `Move.${this.wormholeChainName.replace(/^iota_sui_/, "")}.toml`;
    const manifestPath = nodePath.resolve(packagePath, manifestFileName);
    await access(manifestPath);
    const activeManifestPath = nodePath.resolve(packagePath, "Move.toml");
    let activeManifest: string | undefined;
    try {
      activeManifest = await readlink(activeManifestPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
    if (activeManifest !== manifestFileName) {
      if (activeManifest !== undefined) {
        await unlink(activeManifestPath);
      }
      await symlink(manifestFileName, activeManifestPath);
    }

    const templatePath = nodePath.resolve(
      packagePath,
      "sources/meta.move.mustache",
    );
    const template = await readFile(templatePath, { encoding: "utf8" });
    const outputPath = nodePath.resolve(packagePath, "sources/meta.move");
    const output = micromustache.render(template, meta);
    await writeFile(outputPath, output, { encoding: "utf8" });
  }

  /** Inspects the compiled `pyth_lazer::meta` module metadata. */
  verifyLazerMeta(
    { modules }: MovePackage,
    { version, receiver_chain_id }: MoveLazerMeta,
  ) {
    let foundMeta = false;
    let foundVersion = false;
    let foundReceiverChainId = false;

    for (const bytes of modules) {
      const {
        self_module_handle_idx,
        module_handles,
        identifiers,
        function_handles,
        function_defs,
      } = suiBytecode.deserialize(Buffer.from(bytes, "base64"));
      const name = identifiers[module_handles[self_module_handle_idx].name];
      if (name !== "meta") continue;

      foundMeta = true;
      for (const def of function_defs) {
        const funName = identifiers[function_handles[def.function].name];
        if (funName === "version") {
          foundVersion = true;
          assert.deepEqual(
            def.code.code,
            [{ LdU64: BigInt(version) }, "Ret"],
            "IOTA Lazer meta version does not match",
          );
        } else if (funName === "receiver_chain_id") {
          foundReceiverChainId = true;
          assert.deepEqual(
            def.code.code,
            [{ LdU16: receiver_chain_id }, "Ret"],
            "IOTA Lazer meta receiver_chain_id does not match",
          );
        }
      }
    }

    if (!foundMeta) {
      throw new Error("Could not find IOTA Lazer meta module");
    }
    if (!foundVersion) {
      throw new Error("Could not find IOTA Lazer meta version function");
    }
    if (!foundReceiverChainId) {
      throw new Error(
        "Could not find IOTA Lazer meta receiver_chain_id function",
      );
    }
  }

  async initWormholeContract({
    packageId,
    upgradeCapId,
    deployerCapId,
    config,
    signer,
  }: {
    packageId: string;
    upgradeCapId: string;
    deployerCapId: string;
    config: IotaWormholeInitConfig;
    signer: IotaEd25519Keypair;
  }): Promise<{ stateId: string; digest: string }> {
    const tx = new IotaTransaction();
    tx.moveCall({
      arguments: [
        tx.object(deployerCapId),
        tx.object(upgradeCapId),
        tx.pure.u16(config.governanceChain),
        tx.pure.vector("u8", config.governanceEmitter),
        tx.pure.u32(0),
        tx.pure.vector("vector<u8>", config.initialGuardians),
        tx.pure.u32(config.guardianSetSecondsToLive),
        tx.pure.u64(0n),
      ],
      target: `${packageId}::setup::complete`,
    });

    const executed = await this.executeTransaction(tx, signer);
    const stateChange = executed.objectChanges?.find(
      (change) =>
        change.type === "created" &&
        change.objectType === `${packageId}::state::State`,
    );
    if (!stateChange || stateChange.type !== "created") {
      throw new Error(
        "Could not find Wormhole State ID in transaction results",
      );
    }
    const deployerCapDeleted = executed.objectChanges?.some(
      (change) =>
        change.type === "deleted" && change.objectId === deployerCapId,
    );
    if (!deployerCapDeleted) {
      throw new Error("Wormhole setup did not consume its DeployerCap");
    }
    return { digest: executed.digest, stateId: stateChange.objectId };
  }

  async updateWormholeGuardianSet({
    stateId,
    vaa,
    signer,
  }: {
    stateId: string;
    vaa: Uint8Array;
    signer: IotaEd25519Keypair;
  }): Promise<string> {
    const client = this.getProvider();
    const { package: packageId } = await this.getStatePackageInfo(
      client,
      stateId,
    );
    const tx = new IotaTransaction();
    const [verifiedVaa] = tx.moveCall({
      arguments: [
        tx.object(stateId),
        tx.pure.vector("u8", vaa),
        tx.object(IOTA_CLOCK_OBJECT_ID),
      ],
      target: `${packageId}::vaa::parse_and_verify`,
    });
    if (!verifiedVaa) {
      throw new Error("IOTA Wormhole VAA verification returned no value");
    }
    const [decreeTicket] = tx.moveCall({
      arguments: [tx.object(stateId)],
      target: `${packageId}::update_guardian_set::authorize_governance`,
    });
    if (!decreeTicket) {
      throw new Error("IOTA Wormhole governance returned no decree ticket");
    }
    const [decreeReceipt] = tx.moveCall({
      arguments: [tx.object(stateId), verifiedVaa, decreeTicket],
      target: `${packageId}::governance_message::verify_vaa`,
      typeArguments: [`${packageId}::update_guardian_set::GovernanceWitness`],
    });
    if (!decreeReceipt) {
      throw new Error("IOTA Wormhole governance returned no decree receipt");
    }
    tx.moveCall({
      arguments: [
        tx.object(stateId),
        decreeReceipt,
        tx.object(IOTA_CLOCK_OBJECT_ID),
      ],
      target: `${packageId}::update_guardian_set::update_guardian_set`,
    });

    const { digest } = await this.executeTransaction(tx, signer);
    return digest;
  }

  async initLazerContract(
    packageId: string,
    upgradeCapId: string,
    { emitterChain, emitterAddress }: DataSource,
    signer: IotaEd25519Keypair,
  ): Promise<{ stateId: string }> {
    const tx = new IotaTransaction();
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

    const executed = await this.executeTransaction(tx, signer);
    const stateChange = executed.objectChanges?.find(
      (change) =>
        change.type === "created" &&
        change.objectType.endsWith("::state::State"),
    );
    const stateId =
      stateChange?.type === "created" ? stateChange.objectId : undefined;
    if (!stateId) {
      throw new Error("Could not find State ID in transaction results");
    }
    return { stateId };
  }

  async getUpgradeCapPackage(upgradeCapId: string): Promise<string> {
    const fields = await this.getObjectFields(this.getProvider(), upgradeCapId);
    if (typeof fields.package !== "string") {
      throw new TypeError("Could not find package string in UpgradeCap object");
    }
    return fields.package;
  }

  async getStatePackageInfo(
    client: IotaClient,
    stateId: string,
  ): Promise<{ package: string; version: string }> {
    const state = await this.getObjectFields(client, stateId);
    const upgradeCap = IotaChain.getMoveStructFields(
      state.upgrade_cap,
      "state UpgradeCap",
    );
    if (typeof upgradeCap.package !== "string") {
      throw new Error("Could not find 'package' string in UpgradeCap");
    }
    if (typeof upgradeCap.version !== "string") {
      throw new Error("Could not find 'version' number in UpgradeCap");
    }
    return {
      package: upgradeCap.package,
      version: upgradeCap.version,
    };
  }

  async getStateGovernanceInfo(client: IotaClient, stateId: string) {
    const state = await this.getObjectFields(client, stateId);
    const governance = IotaChain.getMoveStructFields(
      state.governance,
      "state Governance",
    );
    if (typeof governance.seen_sequence !== "string") {
      throw new Error("Could not find 'seen_sequence' BigInt in Governance");
    }
    return { seen_sequence: BigInt(governance.seen_sequence) };
  }

  private async getObjectFields(
    client: IotaClient,
    objectId: string,
  ): Promise<Record<string, unknown>> {
    const result = await client.getObject({
      id: objectId,
      options: { showContent: true },
    });
    if (
      !result.data?.content ||
      result.data.content.dataType !== "moveObject"
    ) {
      throw new Error(`Failed to get object content for ${objectId}`);
    }
    return result.data.content.fields as Record<string, unknown>;
  }

  async updateTrustedSigner({
    stateId,
    wormholeStateId,
    vaa,
    signer,
  }: {
    stateId: string;
    wormholeStateId: string;
    vaa: Uint8Array;
    signer: IotaEd25519Keypair;
  }): Promise<string> {
    const client = this.getProvider();
    const tx = new IotaTransaction();
    const { package: wormholeId } = await this.getStatePackageInfo(
      client,
      wormholeStateId,
    );
    const { package: packageId } = await this.getStatePackageInfo(
      client,
      stateId,
    );

    const [verifiedVaa] = tx.moveCall({
      arguments: [
        tx.object(wormholeStateId),
        tx.pure.vector("u8", vaa),
        tx.object(IOTA_CLOCK_OBJECT_ID),
      ],
      target: `${wormholeId}::vaa::parse_and_verify`,
    });
    if (!verifiedVaa) {
      throw new Error("IOTA Wormhole VAA verification returned no value");
    }
    tx.moveCall({
      arguments: [tx.object(stateId), verifiedVaa],
      target: `${packageId}::actions::update_trusted_signer`,
    });

    const { digest } = await this.executeTransaction(tx, signer);
    return digest;
  }

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
    pkg: MovePackage;
    meta: MoveLazerMeta;
    vaa: Uint8Array;
    signer: IotaEd25519Keypair;
  }): Promise<string> {
    this.verifyLazerMeta(pkg, meta);

    const client = this.getProvider();
    const tx = new IotaTransaction();
    const { package: wormholeId } = await this.getStatePackageInfo(
      client,
      wormholeStateId,
    );
    const { package: packageId } = await this.getStatePackageInfo(
      client,
      stateId,
    );

    const [verifiedVaa] = tx.moveCall({
      arguments: [
        tx.object(wormholeStateId),
        tx.pure.vector("u8", vaa),
        tx.object(IOTA_CLOCK_OBJECT_ID),
      ],
      target: `${wormholeId}::vaa::parse_and_verify`,
    });
    if (!verifiedVaa) {
      throw new Error("IOTA Wormhole VAA verification returned no value");
    }
    const [ticket] = tx.moveCall({
      arguments: [tx.object(stateId), verifiedVaa],
      target: `${packageId}::actions::upgrade`,
    });
    if (!ticket) {
      throw new Error("IOTA Lazer upgrade returned no ticket");
    }
    const [receipt] = tx.upgrade({
      dependencies: pkg.dependencies,
      modules: pkg.modules,
      package: packageId,
      ticket,
    });
    if (!receipt) {
      throw new Error("IOTA package upgrade returned no receipt");
    }
    tx.moveCall({
      arguments: [tx.object(stateId), receipt],
      target: `${packageId}::actions::commit_upgrade`,
    });

    const { digest } = await this.executeTransaction(tx, signer);
    return digest;
  }

  async executeTransaction(
    tx: IotaTransaction,
    keypair: IotaEd25519Keypair,
  ): Promise<IotaTransactionBlockResponse> {
    const provider = this.getProvider();
    tx.setSender(keypair.toIotaAddress());
    const dryRun = await provider.dryRunTransactionBlock({
      transactionBlock: await tx.build({ client: provider }),
    });
    if (dryRun.effects.status.status === "failure") {
      throw new Error(
        `Transaction dry run failed: ${dryRun.effects.status.error ?? "unknown error"}`,
      );
    }
    tx.setGasBudget(BigInt(dryRun.input.gasData.budget) * 2n);

    const executed = await provider.signAndExecuteTransaction({
      options: { showEffects: true, showObjectChanges: true },
      signer: keypair,
      transaction: tx,
    });
    if (executed.effects?.status.status === "failure") {
      throw new Error(
        `Transaction ${executed.digest} failed on-chain: ${executed.effects.status.error ?? "unknown error"}`,
      );
    }
    return executed;
  }

  async waitForTransaction(digest: string): Promise<void> {
    await this.getProvider().waitForTransaction({ digest });
  }

  explorerUrl(type: "object" | "address" | "txblock", id: string): string {
    return `https://explorer.iota.org/${type}/${id}?network=${
      this.isMainnet() ? "mainnet" : "testnet"
    }`;
  }
}

export class SvmChain extends Chain {
  static override type = "SvmChain";

  constructor(
    id: string,
    mainnet: boolean,
    wormholeChainName: string,
    nativeToken: TokenId | undefined,
    public rpcUrl: string,
  ) {
    super(id, mainnet, wormholeChainName, nativeToken);
  }

  static fromJson(parsed: ChainConfig): SvmChain {
    if (parsed.type !== SvmChain.type) throw new Error("Invalid type");
    if (parsed.wormholeChainName === undefined) {
      throw new Error("wormholeChainName is required");
    }
    if (parsed.rpcUrl === undefined) {
      throw new Error("rpcUrl is required");
    }
    return new SvmChain(
      parsed.id,
      parsed.mainnet,
      parsed.wormholeChainName,
      parsed.nativeToken,
      parsed.rpcUrl,
    );
  }

  toJson(): KeyValueConfig {
    return {
      id: this.id,
      mainnet: this.mainnet,
      rpcUrl: this.rpcUrl,
      type: SvmChain.type,
      wormholeChainName: this.wormholeChainName,
    };
  }

  getType(): string {
    return SvmChain.type;
  }

  generateGovernanceUpgradePayload(_programId: string): Buffer {
    throw new Error("Not implemented");
  }

  getConnection(): Connection {
    return new Connection(parseRpcUrl(this.rpcUrl), "confirmed");
  }

  getAccountAddress(privateKey: PrivateKey): Promise<string> {
    const keypair = Keypair.fromSecretKey(
      new Uint8Array(Buffer.from(privateKey, "hex")),
    );
    return Promise.resolve(keypair.publicKey.toBase58());
  }

  async getAccountBalance(privateKey: PrivateKey): Promise<number> {
    const connection = this.getConnection();
    const address = await this.getAccountAddress(privateKey);
    const balance = await connection.getBalance(new PublicKey(address));
    return balance / LAMPORTS_PER_SOL;
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
    // biome-ignore lint/suspicious/noExplicitAny: untyped Sui transaction/bytecode shapes
    transactionObject: any,
    txParams: { from?: string; value?: string },
    gasPriceMultiplier = 1,
  ) {
    const GAS_ESTIMATE_MULTIPLIER = 2;
    const gasEstimate = await transactionObject.estimateGas(txParams);
    // Some networks like Filecoin do not support the normal transaction type and need a type 2 transaction.
    // To send a type 2 transaction, remove the ``gasPrice`` field.
    return transactionObject.send({
      gas: gasEstimate * GAS_ESTIMATE_MULTIPLIER,
      gasPrice: Math.trunc(
        Number(await this.getGasPrice()) * gasPriceMultiplier,
      ),
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
      // biome-ignore lint/suspicious/noExplicitAny: untyped Sui transaction/bytecode shapes
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
    // biome-ignore lint/suspicious/noExplicitAny: untyped Sui transaction/bytecode shapes
    abi: any,
    bytecode: string,
    // biome-ignore lint/suspicious/noExplicitAny: untyped Sui transaction/bytecode shapes
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

  getProvider(): Provider {
    return new Provider(this.gqlUrl);
  }

  getWallet(privateKey: PrivateKey): WalletUnlocked {
    return Wallet.fromPrivateKey(privateKey, this.getProvider());
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

  getAccountAddress(privateKey: PrivateKey): Promise<string> {
    const wallet = this.getWallet(privateKey);
    return Promise.resolve(wallet.address.toString());
  }

  async getAccountBalance(privateKey: PrivateKey): Promise<number> {
    const wallet = this.getWallet(privateKey);
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

export class StellarChain extends Chain {
  static override type = "StellarChain";

  /**
   * @param rpcUrl - Soroban RPC endpoint (e.g. https://soroban-testnet.stellar.org)
   * @param networkPassphrase - Stellar network passphrase, e.g.
   *   "Test SDF Network ; September 2015" for testnet
   * @param horizonUrl - Horizon endpoint, used only to read account balances
   */
  constructor(
    id: string,
    mainnet: boolean,
    wormholeChainName: string,
    nativeToken: TokenId | undefined,
    public rpcUrl: string,
    public networkPassphrase: string,
    public horizonUrl: string,
  ) {
    super(id, mainnet, wormholeChainName, nativeToken);
  }

  static fromJson(parsed: ChainConfig): StellarChain {
    if (parsed.type !== StellarChain.type) throw new Error("Invalid type");
    return new StellarChain(
      parsed.id,
      parsed.mainnet,
      parsed.wormholeChainName ?? "",
      parsed.nativeToken,
      parsed.rpcUrl ?? "",
      parsed.networkPassphrase ?? "",
      parsed.horizonUrl ?? "",
    );
  }

  toJson(): KeyValueConfig {
    return {
      horizonUrl: this.horizonUrl,
      id: this.id,
      mainnet: this.mainnet,
      networkPassphrase: this.networkPassphrase,
      rpcUrl: this.rpcUrl,
      type: StellarChain.type,
      wormholeChainName: this.wormholeChainName,
    };
  }

  getType(): string {
    return StellarChain.type;
  }

  getProvider(): stellarRpc.Server {
    return new stellarRpc.Server(this.rpcUrl, {
      allowHttp: this.rpcUrl.startsWith("http://"),
    });
  }

  /**
   * Stellar contract upgrades are governance actions dispatched through the
   * wormhole executor, which needs the executor and target contract ids. Build
   * them with the per-contract methods instead.
   */
  generateGovernanceUpgradePayload(): Buffer {
    throw new Error(
      "Use StellarLazerContract.generateUpgradeVerifierPayload / " +
        "StellarExecutorContract.generateUpgradeExecutorPayload — Stellar " +
        "upgrades require contract ids.",
    );
  }

  getAccountAddress(privateKey: PrivateKey): Promise<string> {
    const keypair = StellarKeypair.fromRawEd25519Seed(
      Buffer.from(privateKey, "hex"),
    );
    return Promise.resolve(keypair.publicKey());
  }

  async getAccountBalance(privateKey: PrivateKey): Promise<number> {
    const address = await this.getAccountAddress(privateKey);
    const server = new StellarHorizon.Server(this.horizonUrl, {
      allowHttp: this.horizonUrl.startsWith("http://"),
    });
    const account = await server.loadAccount(address);
    const native = account.balances.find(
      (balance) => balance.asset_type === "native",
    );
    return native ? Number(native.balance) : 0;
  }

  /**
   * Upload a contract WASM blob to the network so it can later be referenced by
   * hash (e.g. as the target of a governance `UpgradeExecutor`/`upgrade` action)
   * and return its hash, hex without `0x`.
   *
   * The on-chain WASM hash is the SHA-256 of the blob, so it is computed locally
   * from `wasm` and returned regardless of how the ledger reports the upload —
   * uploading the same bytes twice is idempotent and yields the same hash.
   *
   * @param wasm - the WASM blob to upload
   * @param senderPrivateKey - 32-byte ed25519 seed of the account that pays for
   *   and signs the upload, hex without `0x`
   */
  async uploadContractWasm(
    wasm: Buffer,
    senderPrivateKey: PrivateKey,
  ): Promise<string> {
    const server = this.getProvider();
    const keypair = StellarKeypair.fromRawEd25519Seed(
      Buffer.from(senderPrivateKey, "hex"),
    );
    const account = await server.getAccount(keypair.publicKey());

    const tx = new StellarTransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(StellarOperation.uploadContractWasm({ wasm }))
      .setTimeout(30)
      .build();

    const prepared = await server.prepareTransaction(tx);
    prepared.sign(keypair);

    const sent = await server.sendTransaction(prepared);
    if (sent.status === "ERROR") {
      throw new Error(
        `Failed to upload WASM: ${JSON.stringify(sent.errorResult)}`,
      );
    }
    const result = await server.pollTransaction(sent.hash);
    if (result.status !== stellarRpc.Api.GetTransactionStatus.SUCCESS) {
      throw new Error(`WASM upload transaction ${sent.hash} failed`);
    }

    return createHash("sha256").update(wasm).digest("hex");
  }
}

/**
 * A Cardano network hosting a Lazer deployment (see {@link CardanoLazerContract}).
 *
 * Cardano is UTxO-based with Aiken validators; all reads go through the Evolution
 * SDK read client exposed by {@link getProvider}, mirroring how
 * {@link StellarChain.getProvider} hands back its SDK client. Governance is
 * Wormhole-VAA based and dispatched out-of-band (the VAA is submitted as redeemer
 * data in a Cardano transaction), so this chain class only needs read access.
 */
export class CardanoChain extends Chain {
  static override type = "CardanoChain";

  /**
   * @param network - Evolution SDK network preset this deployment lives on
   */
  constructor(
    id: string,
    mainnet: boolean,
    wormholeChainName: string,
    nativeToken: TokenId | undefined,
    public network: CardanoNetwork,
  ) {
    super(id, mainnet, wormholeChainName, nativeToken);
  }

  static fromJson(parsed: ChainConfig): CardanoChain {
    if (parsed.type !== CardanoChain.type) throw new Error("Invalid type");
    return new CardanoChain(
      parsed.id,
      parsed.mainnet,
      parsed.wormholeChainName ?? "",
      parsed.nativeToken,
      parsed.network as CardanoNetwork,
    );
  }

  toJson(): KeyValueConfig {
    return {
      id: this.id,
      mainnet: this.mainnet,
      network: this.network,
      type: CardanoChain.type,
      wormholeChainName: this.wormholeChainName,
    };
  }

  getType(): string {
    return CardanoChain.type;
  }

  getProvider(): ReadClient {
    // Reads go through Koios, which is tokenless at a low rate limit — enough
    // for the audit. KOIOS_TOKEN only raises that limit and need not be set in
    // practice; it's picked up from the environment here if present.
    return createReadClient(this.network, process.env.KOIOS_TOKEN);
  }

  /**
   * Cardano governance upgrades are Wormhole VAA actions targeting a specific
   * deployment, so build them with {@link CardanoLazerContract} instead.
   */
  generateGovernanceUpgradePayload(): Buffer {
    throw new Error(
      "Use CardanoLazerContract.generateUpgradeSpendScriptPayload / " +
        "generateUpgradeWithdrawScriptPayload — Cardano upgrades require a policy id.",
    );
  }

  getAccountAddress(): Promise<string> {
    throw new Error(
      "Cardano accounts are derived from a mnemonic wallet, not a hex private " +
        "key; signing is handled by @pythnetwork/pyth-lazer-cardano-cli.",
    );
  }

  getAccountBalance(): Promise<number> {
    throw new Error(
      "Cardano accounts are derived from a mnemonic wallet, not a hex private " +
        "key; signing is handled by @pythnetwork/pyth-lazer-cardano-cli.",
    );
  }
}
