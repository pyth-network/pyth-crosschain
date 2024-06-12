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
} from "@pythnetwork/xc-admin-common";
import { AptosClient, AptosAccount, CoinClient, TxnBuilderTypes } from "aptos";
import Web3 from "web3";
import {
  CosmwasmExecutor,
  CosmwasmQuerier,
  InjectiveExecutor,
} from "@pythnetwork/cosmwasm-deploy-tools";
import { Network } from "@injectivelabs/networks";
import { SuiClient } from "@mysten/sui.js/client";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { TokenId } from "./token";
import { BN, Provider, Wallet } from "fuels";

const FUEL_ETH_ASSET_ID =
  "0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07";

export type ChainConfig = Record<string, string> & {
  mainnet: boolean;
  id: string;
  nativeToken: TokenId;
};
export abstract class Chain extends Storable {
  public wormholeChainName: ChainName;

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
    protected nativeToken: TokenId | undefined
  ) {
    super();
    this.wormholeChainName = wormholeChainName as ChainName;
    if (toChainId(this.wormholeChainName) === undefined)
      throw new Error(
        `Invalid chain name ${wormholeChainName}.
        Try rebuilding @pythnetwork/xc-admin-common: pnpm exec lerna run build --scope @pythnetwork/xc-admin-common`
      );
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
      BigInt(exponent)
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
    newValidStalePriceThreshold: bigint
  ): Buffer {
    return new SetValidPeriod(
      this.wormholeChainName,
      newValidStalePriceThreshold
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
      "Can not create a governance message for upgrading contracts on all chains!"
    );
  }

  async getAccountAddress(_privateKey: PrivateKey): Promise<string> {
    throw new Error("Can not get account for GlobalChain.");
  }

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
    public feeDenom: string
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
      parsed.feeDenom
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
    privateKey: PrivateKey
  ): Promise<CosmwasmExecutor | InjectiveExecutor> {
    if (this.getId().indexOf("injective") > -1) {
      return InjectiveExecutor.fromPrivateKey(
        this.isMainnet() ? Network.Mainnet : Network.Testnet,
        privateKey
      );
    }
    return new CosmwasmExecutor(
      this.endpoint,
      await CosmwasmExecutor.getSignerFromPrivateKey(privateKey, this.prefix),
      this.gasPrice + this.feeDenom
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
    public rpcUrl: string
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
      parsed.rpcUrl
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
    const keypair = Ed25519Keypair.fromSecretKey(
      Buffer.from(privateKey, "hex")
    );
    return keypair.toSuiAddress();
  }

  async getAccountBalance(privateKey: PrivateKey): Promise<number> {
    const provider = this.getProvider();
    const balance = await provider.getBalance({
      owner: await this.getAccountAddress(privateKey),
    });
    return Number(balance.totalBalance) / 10 ** 9;
  }
}

export class EvmChain extends Chain {
  static type = "EvmChain";

  constructor(
    id: string,
    mainnet: boolean,
    nativeToken: TokenId | undefined,
    private rpcUrl: string,
    private networkId: number
  ) {
    // On EVM networks we use the chain id as the wormhole chain name
    super(id, mainnet, id, nativeToken);
  }

  static fromJson(parsed: ChainConfig & { networkId: number }): EvmChain {
    if (parsed.type !== EvmChain.type) throw new Error("Invalid type");
    return new EvmChain(
      parsed.id,
      parsed.mainnet,
      parsed.nativeToken,
      parsed.rpcUrl,
      parsed.networkId
    );
  }

  /**
   * Returns the chain rpc url with any environment variables replaced or throws an error if any are missing
   */
  getRpcUrl(): string {
    const envMatches = this.rpcUrl.match(/\$ENV_\w+/);
    if (envMatches) {
      for (const envMatch of envMatches) {
        const envName = envMatch.replace("$ENV_", "");
        const envValue = process.env[envName];
        if (!envValue) {
          throw new Error(
            `Missing env variable ${envName} required for chain ${this.id} rpc: ${this.rpcUrl}`
          );
        }
        this.rpcUrl = this.rpcUrl.replace(envMatch, envValue);
      }
    }
    return this.rpcUrl;
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for contracts deployed on this chain
   * @param address hex string of the 20 byte address of the contract to upgrade to without the 0x prefix
   */
  generateGovernanceUpgradePayload(address: string): Buffer {
    return new EvmUpgradeContract(this.wormholeChainName, address).encode();
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
    const web3 = new Web3(this.getRpcUrl());
    let gasPrice = await web3.eth.getGasPrice();
    // some testnets have inaccuarte gas prices that leads to transactions not being mined, we double it since it's free!
    if (!this.isMainnet()) {
      gasPrice = (BigInt(gasPrice) * 2n).toString();
    }
    return gasPrice;
  }

  async estiamteAndSendTransaction(
    transactionObject: any,
    txParams: { from?: string; value?: string }
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
    gasPriceMultiplier = 1
  ): Promise<string> {
    const web3 = new Web3(this.getRpcUrl());
    const signer = web3.eth.accounts.privateKeyToAccount(privateKey);
    web3.eth.accounts.wallet.add(signer);
    const contract = new web3.eth.Contract(abi);
    const deployTx = contract.deploy({ data: bytecode, arguments: deployArgs });
    const gas = (await deployTx.estimateGas()) * gasMultiplier;
    const gasPrice = Number(await this.getGasPrice()) * gasPriceMultiplier;
    const deployerBalance = await web3.eth.getBalance(signer.address);
    const gasDiff = BigInt(gas) * BigInt(gasPrice) - BigInt(deployerBalance);
    if (gasDiff > 0n) {
      throw new Error(
        `Insufficient funds to deploy contract. Need ${gas} (gas) * ${gasPrice} (gasPrice)= ${
          BigInt(gas) * BigInt(gasPrice)
        } wei, but only have ${deployerBalance} wei. We need ${
          Number(gasDiff) / 10 ** 18
        } ETH more.`
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
    const web3 = new Web3(this.getRpcUrl());
    const signer = web3.eth.accounts.privateKeyToAccount(privateKey);
    return signer.address;
  }

  async getAccountBalance(privateKey: PrivateKey): Promise<number> {
    const web3 = new Web3(this.getRpcUrl());
    const balance = await web3.eth.getBalance(
      await this.getAccountAddress(privateKey)
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
    public rpcUrl: string
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
      parsed.rpcUrl
    );
  }

  async getAccountAddress(privateKey: PrivateKey): Promise<string> {
    const account = new AptosAccount(
      new Uint8Array(Buffer.from(privateKey, "hex"))
    );
    return account.address().toString();
  }

  async getAccountBalance(privateKey: PrivateKey): Promise<number> {
    const client = this.getClient();
    const account = new AptosAccount(
      new Uint8Array(Buffer.from(privateKey, "hex"))
    );
    const coinClient = new CoinClient(client);
    return Number(await coinClient.checkBalance(account)) / 10 ** 8;
  }

  async sendTransaction(
    senderPrivateKey: PrivateKey,
    txPayload: TxnBuilderTypes.TransactionPayloadEntryFunction
  ): Promise<TxResult> {
    const client = this.getClient();
    const sender = new AptosAccount(
      new Uint8Array(Buffer.from(senderPrivateKey, "hex"))
    );
    const result = await client.generateSignSubmitWaitForTransaction(
      sender,
      txPayload,
      {
        maxGasAmount: BigInt(30000),
      }
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
    public gqlUrl: string
  ) {
    super(id, mainnet, wormholeChainName, nativeToken);
  }

  async getProvider(): Promise<Provider> {
    return await Provider.create(this.gqlUrl);
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for contracts deployed on this chain
   * @param digest hex string of the 32 byte digest for the new package without the 0x prefix
   */
  generateGovernanceUpgradePayload(digest: string): Buffer {
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
      parsed.gqlUrl
    );
  }

  async getAccountAddress(privateKey: PrivateKey): Promise<string> {
    const provider = await this.getProvider();
    const wallet = Wallet.fromPrivateKey(privateKey, provider);
    return wallet.address.toString();
  }

  async getAccountBalance(privateKey: PrivateKey): Promise<number> {
    const provider = await this.getProvider();
    const wallet = Wallet.fromPrivateKey(privateKey, provider);
    const balance: BN = await wallet.getBalance(FUEL_ETH_ASSET_ID);
    return Number(balance) / 10 ** 9;
  }

  // async sendTransaction(
  //   senderPrivateKey: PrivateKey,
  //   txPayload: TxnBuilderTypes.TransactionPayloadEntryFunction
  // ): Promise<TxResult> {
  //   const client = this.getClient();
  //   const sender = new AptosAccount(
  //     new Uint8Array(Buffer.from(senderPrivateKey, "hex"))
  //   );
  //   const result = await client.generateSignSubmitWaitForTransaction(
  //     sender,
  //     txPayload,
  //     {
  //       maxGasAmount: BigInt(30000),
  //     }
  //   );
  //   return { id: result.hash, info: result };
  // }
}
