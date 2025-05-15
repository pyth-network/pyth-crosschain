import { KeyValueConfig, PrivateKey, Storable, TxResult } from "./base";
import {
  ChainName,
  SetFee,
  CosmosUpgradeContract,
  EvmUpgradeContract,
  toChainId,
  SetDataSources,
  SetValidPeriod,
  DataSource,
  EvmSetWormholeAddress,
  UpgradeContract256Bit,
  EvmExecute,
} from "@pythnetwork/xc-admin-common";
import { AptosClient, AptosAccount, CoinClient, TxnBuilderTypes } from "aptos";
import Web3 from "web3";
import {
  CosmwasmExecutor,
  CosmwasmQuerier,
  InjectiveExecutor,
} from "@pythnetwork/cosmwasm-deploy-tools";
import { Network } from "@injectivelabs/networks";
import { IotaClient } from "@iota/iota-sdk/client";
import { SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair as IotaEd25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import { Ed25519Keypair as SuiEd25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { TokenId } from "./token";
import { BN, Provider, Wallet, WalletUnlocked } from "fuels";
import { FUEL_ETH_ASSET_ID } from "@pythnetwork/pyth-fuel-js";
import { Contract, RpcProvider, Signer, ec, shortString } from "starknet";
import {
  TonClient,
  WalletContractV4,
  ContractProvider,
  Address,
  OpenedContract,
  Sender,
} from "@ton/ton";
import { keyPairFromSeed } from "@ton/crypto";
import { PythContract } from "@pythnetwork/pyth-ton-js";
import * as nearAPI from "near-api-js";
import * as bs58 from "bs58";
import { MIST_PER_SUI } from "@mysten/sui/utils";
import { NANOS_PER_IOTA } from "@iota/iota-sdk/utils";
import * as chains from "viem/chains";

/**
 * Returns the chain rpc url with any environment variables replaced or throws an error if any are missing
 */
export function parseRpcUrl(rpcUrl: string): string {
  const envMatches = rpcUrl.match(/\$ENV_\w+/);
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
   * @param id unique id representing this chain
   * @param mainnet whether this chain is mainnet or testnet/devnet
   * @param wormholeChainName the name of the wormhole chain that this chain is associated with.
   * Note that pyth has included additional chain names and ids to the wormhole spec.
   * @param nativeToken the id of the token used to pay gas on this chain
   * @protected
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
   * @param fee the new fee to set
   * @param exponent the new fee exponent to set
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
   * @param datasources the new datasources
   */
  generateGovernanceSetDataSources(datasources: DataSource[]): Buffer {
    return new SetDataSources(this.wormholeChainName, datasources).encode();
  }

  /**
   * Returns the payload for a governance SetStalePriceThreshold instruction for contracts deployed on this chain
   * @param newValidStalePriceThreshold the new stale price threshold in seconds
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
   * @param upgradeInfo based on the contract type, this can be a contract address, codeId, package digest, etc.
   */
  abstract generateGovernanceUpgradePayload(upgradeInfo: unknown): Buffer;

  /**
   * Returns the account address associated with the given private key.
   * @param privateKey the account private key
   */
  abstract getAccountAddress(privateKey: PrivateKey): Promise<string>;

  /**
   * Returns the balance of the account associated with the given private key.
   * @param privateKey the account private key
   */
  abstract getAccountBalance(privateKey: PrivateKey): Promise<number>;
}

/**
 * A Chain object that represents all chains. This is used for governance instructions that apply to all chains.
 * For example, governance instructions to upgrade Pyth data sources.
 */
export class GlobalChain extends Chain {
  static type = "GlobalChain";
  constructor() {
    super("global", true, "unset", undefined);
  }

  generateGovernanceUpgradePayload(): Buffer {
    throw new Error(
      "Can not create a governance message for upgrading contracts on all chains!",
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getAccountAddress(_privateKey: PrivateKey): Promise<string> {
    throw new Error("Can not get account for GlobalChain.");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getAccountBalance(_privateKey: PrivateKey): Promise<number> {
    throw new Error("Can not get account balance for GlobalChain.");
  }

  getType(): string {
    return GlobalChain.type;
  }

  toJson(): KeyValueConfig {
    return {
      id: this.id,
      wormholeChainName: this.wormholeChainName,
      mainnet: this.mainnet,
      type: GlobalChain.type,
    };
  }
}

export class CosmWasmChain extends Chain {
  static type = "CosmWasmChain";

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
      parsed.wormholeChainName,
      parsed.nativeToken,
      parsed.endpoint,
      parsed.gasPrice,
      parsed.prefix,
      parsed.feeDenom,
    );
  }

  toJson(): KeyValueConfig {
    return {
      endpoint: this.endpoint,
      id: this.id,
      wormholeChainName: this.wormholeChainName,
      mainnet: this.mainnet,
      gasPrice: this.gasPrice,
      prefix: this.prefix,
      feeDenom: this.feeDenom,
      type: CosmWasmChain.type,
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
    if (this.getId().indexOf("injective") > -1) {
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
    if (executor instanceof InjectiveExecutor) {
      return executor.getAddress();
    } else {
      return await executor.getAddress();
    }
  }

  async getAccountBalance(privateKey: PrivateKey): Promise<number> {
    const executor = await this.getExecutor(privateKey);
    return await executor.getBalance();
  }
}

export class SuiChain extends Chain {
  static type = "SuiChain";

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
      parsed.wormholeChainName,
      parsed.nativeToken,
      parsed.rpcUrl,
    );
  }

  toJson(): KeyValueConfig {
    return {
      id: this.id,
      wormholeChainName: this.wormholeChainName,
      mainnet: this.mainnet,
      rpcUrl: this.rpcUrl,
      type: SuiChain.type,
    };
  }

  getType(): string {
    return SuiChain.type;
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for contracts deployed on this chain
   * @param digest hex string of the 32 byte digest for the new package without the 0x prefix
   */
  generateGovernanceUpgradePayload(digest: string): Buffer {
    return new UpgradeContract256Bit(this.wormholeChainName, digest).encode();
  }

  getProvider(): SuiClient {
    return new SuiClient({ url: this.rpcUrl });
  }

  async getAccountAddress(privateKey: PrivateKey): Promise<string> {
    const keypair = SuiEd25519Keypair.fromSecretKey(
      new Uint8Array(Buffer.from(privateKey, "hex")),
    );
    return keypair.toSuiAddress();
  }

  async getAccountBalance(privateKey: PrivateKey): Promise<number> {
    const provider = this.getProvider();
    const balance = await provider.getBalance({
      owner: await this.getAccountAddress(privateKey),
    });
    return Number(balance.totalBalance) / Number(MIST_PER_SUI);
  }
}

export class IotaChain extends Chain {
  static type = "IotaChain";

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
      parsed.wormholeChainName,
      parsed.nativeToken,
      parsed.rpcUrl,
    );
  }

  toJson(): KeyValueConfig {
    return {
      id: this.id,
      wormholeChainName: this.wormholeChainName,
      mainnet: this.mainnet,
      rpcUrl: this.rpcUrl,
      type: IotaChain.type,
    };
  }

  getType(): string {
    return IotaChain.type;
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for contracts deployed on this chain
   * @param digest hex string of the 32 byte digest for the new package without the 0x prefix
   */
  generateGovernanceUpgradePayload(digest: string): Buffer {
    return new UpgradeContract256Bit(this.wormholeChainName, digest).encode();
  }

  getProvider(): IotaClient {
    return new IotaClient({ url: this.rpcUrl });
  }

  async getAccountAddress(privateKey: PrivateKey): Promise<string> {
    const keypair = IotaEd25519Keypair.fromSecretKey(
      new Uint8Array(Buffer.from(privateKey, "hex")),
    );
    return keypair.toIotaAddress();
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
  static type = "EvmChain";

  constructor(
    id: string,
    mainnet: boolean,
    nativeToken: TokenId | undefined,
    private rpcUrl: string,
    private networkId: number,
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
      parsed.rpcUrl,
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
   * @param address hex string of the 20 byte address of the contract to upgrade to without the 0x prefix
   */
  generateGovernanceUpgradePayload(address: string): Buffer {
    return new EvmUpgradeContract(this.wormholeChainName, address).encode();
  }

  /**
   * Returns the payload for a governance action from the executor contract
   * @param executor the address of the executor contract live on this chain
   * @param callAddress the address of the contract to call
   * @param calldata the calldata to pass to the contract
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
      rpcUrl: this.rpcUrl,
      networkId: this.networkId,
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
    transactionObject: any, // eslint-disable-line @typescript-eslint/no-explicit-any
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
   * Deploys a contract on this chain
   * @param privateKey hex string of the 32 byte private key without the 0x prefix
   * @param abi the abi of the contract, can be obtained from the compiled contract json file
   * @param bytecode bytecode of the contract, can be obtained from the compiled contract json file
   * @param deployArgs arguments to pass to the constructor. Each argument must begin with 0x if it's a hex string
   * @returns the address of the deployed contract
   */
  async deploy(
    privateKey: PrivateKey,
    abi: any, // eslint-disable-line  @typescript-eslint/no-explicit-any
    bytecode: string,
    deployArgs: any[], // eslint-disable-line  @typescript-eslint/no-explicit-any
    gasMultiplier = 1,
    gasPriceMultiplier = 1,
  ): Promise<string> {
    const web3 = this.getWeb3();
    const signer = web3.eth.accounts.privateKeyToAccount(privateKey);
    web3.eth.accounts.wallet.add(signer);
    const contract = new web3.eth.Contract(abi);
    const deployTx = contract.deploy({ data: bytecode, arguments: deployArgs });
    const gas = Math.trunc((await deployTx.estimateGas()) * gasMultiplier);
    const gasPrice = Math.trunc(
      Number(await this.getGasPrice()) * gasPriceMultiplier,
    );
    const deployerBalance = await web3.eth.getBalance(signer.address);
    const gasDiff = BigInt(gas) * BigInt(gasPrice) - BigInt(deployerBalance);
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
    } catch (e) {
      // RPC errors often have useful information in the non-primary message field. Log the whole error
      // to simplify identifying the problem.
      console.log(`Error deploying contract: ${JSON.stringify(e)}`);
      throw e;
    }
  }

  async getAccountAddress(privateKey: PrivateKey): Promise<string> {
    const web3 = this.getWeb3();
    const signer = web3.eth.accounts.privateKeyToAccount(privateKey);
    return signer.address;
  }

  async getAccountBalance(privateKey: PrivateKey): Promise<number> {
    const web3 = this.getWeb3();
    const balance = await web3.eth.getBalance(
      await this.getAccountAddress(privateKey),
    );
    return Number(balance) / 10 ** 18;
  }
}

export class AptosChain extends Chain {
  static type = "AptosChain";

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
   * @param digest hex string of the 32 byte digest for the new package without the 0x prefix
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
      wormholeChainName: this.wormholeChainName,
      mainnet: this.mainnet,
      rpcUrl: this.rpcUrl,
      type: AptosChain.type,
    };
  }

  static fromJson(parsed: ChainConfig): AptosChain {
    if (parsed.type !== AptosChain.type) throw new Error("Invalid type");
    return new AptosChain(
      parsed.id,
      parsed.mainnet,
      parsed.wormholeChainName,
      parsed.nativeToken,
      parsed.rpcUrl,
    );
  }

  async getAccountAddress(privateKey: PrivateKey): Promise<string> {
    const account = new AptosAccount(
      new Uint8Array(Buffer.from(privateKey, "hex")),
    );
    return account.address().toString();
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
        maxGasAmount: BigInt(30000),
      },
    );
    return { id: result.hash, info: result };
  }
}

export class FuelChain extends Chain {
  static type = "FuelChain";

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
    return await Provider.create(this.gqlUrl);
  }

  async getWallet(privateKey: PrivateKey): Promise<WalletUnlocked> {
    const provider = await this.getProvider();
    return Wallet.fromPrivateKey(privateKey, provider);
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for contracts deployed on this chain
   * @param digest hex string of the 32 byte digest for the new package without the 0x prefix
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
      id: this.id,
      wormholeChainName: this.wormholeChainName,
      mainnet: this.mainnet,
      gqlUrl: this.gqlUrl,
      type: FuelChain.type,
    };
  }

  static fromJson(parsed: ChainConfig): FuelChain {
    if (parsed.type !== FuelChain.type) throw new Error("Invalid type");
    return new FuelChain(
      parsed.id,
      parsed.mainnet,
      parsed.wormholeChainName,
      parsed.nativeToken,
      parsed.gqlUrl,
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
  static type = "StarknetChain";

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
      wormholeChainName: this.wormholeChainName,
      mainnet: this.mainnet,
      rpcUrl: this.rpcUrl,
      type: StarknetChain.type,
    };
  }

  static fromJson(parsed: ChainConfig): StarknetChain {
    if (parsed.type !== StarknetChain.type) throw new Error("Invalid type");
    return new StarknetChain(
      parsed.id,
      parsed.mainnet,
      parsed.wormholeChainName,
      parsed.rpcUrl,
    );
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for contracts deployed on this chain
   * @param digest hex string of the felt252 class hash of the new contract class extended to uint256 in BE
   */
  generateGovernanceUpgradePayload(digest: string): Buffer {
    return new UpgradeContract256Bit(this.wormholeChainName, digest).encode();
  }

  async getAccountAddress(privateKey: PrivateKey): Promise<string> {
    const ARGENT_CLASS_HASH =
      "0x029927c8af6bccf3f6fda035981e765a7bdbf18a2dc0d630494f8758aa908e2b";
    const ADDR_BOUND =
      0x7ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00n;

    function computeHashOnElements(elements: string[]): string {
      let hash = "0";
      for (const item of elements) {
        hash = ec.starkCurve.pedersen(hash, item);
      }
      return ec.starkCurve.pedersen(hash, elements.length);
    }

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
  static type = "TonChain";

  constructor(
    id: string,
    mainnet: boolean,
    wormholeChainName: string,
    nativeToken: TokenId | undefined,
    private rpcUrl: string,
  ) {
    super(id, mainnet, wormholeChainName, nativeToken);
  }

  async getClient(): Promise<TonClient> {
    // We are hacking rpcUrl to include the apiKey header which is a
    // header that is used to bypass rate limits on the TON network
    const [rpcUrl, apiKey] = parseRpcUrl(this.rpcUrl).split("#");

    const client = new TonClient({
      endpoint: rpcUrl,
      apiKey,
    });
    return client;
  }

  async getContract(address: string): Promise<OpenedContract<PythContract>> {
    const client = await this.getClient();
    const contract = client.open(
      PythContract.createFromAddress(Address.parse(address)),
    );
    return contract;
  }

  async getContractProvider(address: string): Promise<ContractProvider> {
    const client = await this.getClient();
    return client.provider(Address.parse(address));
  }

  async getWallet(privateKey: PrivateKey): Promise<WalletContractV4> {
    const keyPair = keyPairFromSeed(Buffer.from(privateKey, "hex"));
    return WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0,
    });
  }

  async getSender(privateKey: PrivateKey): Promise<Sender> {
    const client = await this.getClient();
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
   * @param digest hex string of the 32 byte digest for the new package without the 0x prefix
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
      wormholeChainName: this.wormholeChainName,
      mainnet: this.mainnet,
      rpcUrl: this.rpcUrl,
      type: TonChain.type,
    };
  }

  static fromJson(parsed: ChainConfig): TonChain {
    if (parsed.type !== TonChain.type) throw new Error("Invalid type");
    return new TonChain(
      parsed.id,
      parsed.mainnet,
      parsed.wormholeChainName,
      parsed.nativeToken,
      parsed.rpcUrl,
    );
  }

  async getAccountAddress(privateKey: PrivateKey): Promise<string> {
    const wallet = await this.getWallet(privateKey);
    return wallet.address.toString();
  }

  async getAccountBalance(privateKey: PrivateKey): Promise<number> {
    const wallet = await this.getWallet(privateKey);
    const provider = await this.getContractProvider(wallet.address.toString());
    const balance = await wallet.getBalance(provider);
    return Number(balance) / 10 ** 9;
  }
}

export class NearChain extends Chain {
  static type = "NearChain";

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
      parsed.wormholeChainName,
      parsed.nativeToken,
      parsed.rpcUrl,
      parsed.networkId,
    );
  }

  getType(): string {
    return NearChain.type;
  }

  toJson(): KeyValueConfig {
    return {
      id: this.id,
      wormholeChainName: this.wormholeChainName,
      mainnet: this.mainnet,
      type: NearChain.type,
      rpcUrl: this.rpcUrl,
      networkId: this.networkId,
    };
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for contracts deployed on this chain
   * @param codeHash hex string of the 32 byte code hash for the new contract without the 0x prefix
   */
  generateGovernanceUpgradePayload(codeHash: string): Buffer {
    return new UpgradeContract256Bit(this.wormholeChainName, codeHash).encode();
  }

  async getAccountAddress(privateKey: PrivateKey): Promise<string> {
    return Buffer.from(
      SuiEd25519Keypair.fromSecretKey(
        new Uint8Array(Buffer.from(privateKey, "hex")),
      )
        .getPublicKey()
        .toRawBytes(),
    ).toString("hex");
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
    if (typeof senderPrivateKey !== "undefined") {
      const key = bs58.encode(
        new Uint8Array(Buffer.from(senderPrivateKey, "hex")),
      );
      const keyPair = nearAPI.KeyPair.fromString(key);
      const address = await this.getAccountAddress(senderPrivateKey);
      await keyStore.setKey(this.networkId, address, keyPair);
    }
    const connectionConfig = {
      networkId: this.networkId,
      keyStore,
      nodeUrl: this.rpcUrl,
    };
    const nearConnection = await nearAPI.connect(connectionConfig);
    return await nearConnection.account(accountId);
  }
}
