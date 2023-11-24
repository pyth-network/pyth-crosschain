import { KeyValueConfig, PrivateKey, Storable } from "./base";
import {
  ChainName,
  SetFee,
  CosmosUpgradeContract,
  EvmUpgradeContract,
  SuiAuthorizeUpgradeContract,
  AptosAuthorizeUpgradeContract,
  toChainId,
  SetDataSources,
  SetValidPeriod,
  DataSource,
  EvmSetWormholeAddress,
} from "xc_admin_common";
import { AptosClient, AptosAccount, CoinClient } from "aptos";
import Web3 from "web3";
import {
  CosmwasmExecutor,
  CosmwasmQuerier,
  InjectiveExecutor,
} from "@pythnetwork/cosmwasm-deploy-tools";
import { Network } from "@injectivelabs/networks";
import {
  Connection,
  Ed25519Keypair,
  JsonRpcProvider,
  RawSigner,
} from "@mysten/sui.js";

export type ChainConfig = Record<string, string> & {
  mainnet: boolean;
  id: string;
};
export abstract class Chain extends Storable {
  public wormholeChainName: ChainName;

  /**
   * Creates a new Chain object
   * @param id unique id representing this chain
   * @param mainnet whether this chain is mainnet or testnet/devnet
   * @param wormholeChainName the name of the wormhole chain that this chain is associated with.
   * Note that pyth has included additional chain names and ids to the wormhole spec.
   * @protected
   */
  protected constructor(
    protected id: string,
    protected mainnet: boolean,
    wormholeChainName: string
  ) {
    super();
    this.wormholeChainName = wormholeChainName as ChainName;
    if (toChainId(this.wormholeChainName) === undefined)
      throw new Error(
        `Invalid chain name ${wormholeChainName}. Try rebuilding xc_admin_common package`
      );
  }

  getId(): string {
    return this.id;
  }

  isMainnet(): boolean {
    return this.mainnet;
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
    super("global", true, "unset");
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
    public endpoint: string,
    public gasPrice: string,
    public prefix: string,
    public feeDenom: string
  ) {
    super(id, mainnet, wormholeChainName);
  }

  static fromJson(parsed: ChainConfig): CosmWasmChain {
    if (parsed.type !== CosmWasmChain.type) throw new Error("Invalid type");
    return new CosmWasmChain(
      parsed.id,
      parsed.mainnet,
      parsed.wormholeChainName,
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
    public rpcUrl: string
  ) {
    super(id, mainnet, wormholeChainName);
  }

  static fromJson(parsed: ChainConfig): SuiChain {
    if (parsed.type !== SuiChain.type) throw new Error("Invalid type");
    return new SuiChain(
      parsed.id,
      parsed.mainnet,
      parsed.wormholeChainName,
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
    return new SuiAuthorizeUpgradeContract(
      this.wormholeChainName,
      digest
    ).encode();
  }

  getProvider(): JsonRpcProvider {
    return new JsonRpcProvider(new Connection({ fullnode: this.rpcUrl }));
  }

  async getAccountAddress(privateKey: PrivateKey): Promise<string> {
    const provider = this.getProvider();
    const keypair = Ed25519Keypair.fromSecretKey(
      Buffer.from(privateKey, "hex")
    );
    const wallet = new RawSigner(keypair, provider);
    return await wallet.getAddress();
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
    private rpcUrl: string,
    private networkId: number
  ) {
    // On EVM networks we use the chain id as the wormhole chain name
    super(id, mainnet, id);
  }

  static fromJson(parsed: ChainConfig & { networkId: number }): EvmChain {
    if (parsed.type !== EvmChain.type) throw new Error("Invalid type");
    return new EvmChain(
      parsed.id,
      parsed.mainnet,
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

  /**
   * Deploys a contract on this chain
   * @param privateKey hex string of the 32 byte private key without the 0x prefix
   * @param abi the abi of the contract, can be obtained from the compiled contract json file
   * @param bytecode bytecode of the contract, can be obtained from the compiled contract json file
   * @param deployArgs arguments to pass to the constructor
   * @returns the address of the deployed contract
   */
  async deploy(
    privateKey: PrivateKey,
    abi: any, // eslint-disable-line  @typescript-eslint/no-explicit-any
    bytecode: string,
    deployArgs: any[] // eslint-disable-line  @typescript-eslint/no-explicit-any
  ): Promise<string> {
    const web3 = new Web3(this.getRpcUrl());
    const signer = web3.eth.accounts.privateKeyToAccount(privateKey);
    web3.eth.accounts.wallet.add(signer);
    const contract = new web3.eth.Contract(abi);
    const deployTx = contract.deploy({ data: bytecode, arguments: deployArgs });
    const gas = await deployTx.estimateGas();
    const gasPrice = await this.getGasPrice();
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

    const deployedContract = await deployTx.send({
      from: signer.address,
      gas,
      gasPrice,
    });
    return deployedContract.options.address;
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
    public rpcUrl: string
  ) {
    super(id, mainnet, wormholeChainName);
  }

  getClient(): AptosClient {
    return new AptosClient(this.rpcUrl);
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for contracts deployed on this chain
   * @param digest hex string of the 32 byte digest for the new package without the 0x prefix
   */
  generateGovernanceUpgradePayload(digest: string): Buffer {
    return new AptosAuthorizeUpgradeContract(
      this.wormholeChainName,
      digest
    ).encode();
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
}

/** NEAR **/
export class NearChain extends Chain {
  static type = "NearChain";

  constructor(
    id: string,
    mainnet: boolean,
    wormholeChainName: string,
    public rpcUrl: string
  ) {
    super(id, mainnet, wormholeChainName);
  }

  /**
   * Returns the payload for a governance contract upgrade instruction for contracts deployed on this chain
   * @param digest hex string of the 32 byte sha256 digest for the new code without the 0x prefix
   */
  generateGovernanceUpgradePayload(digest: string): Buffer {
    return new NearAuthorizeUpgradeContract(
      this.wormholeChainName,
      digest
    ).encode();
  }

  getType(): string {
    return NearChain.type;
  }

  toJson(): KeyValueConfig {
    return {
      id: this.id,
      wormholeChainName: this.wormholeChainName,
      mainnet: this.mainnet,
      rpcUrl: this.rpcUrl,
      type: NearChain.type,
    };
  }

  static fromJson(parsed: ChainConfig): NearChain {
    if (parsed.type !== NearChain.type) throw new Error("Invalid type");
    return new NearChain(
      parsed.id,
      parsed.mainnet,
      parsed.wormholeChainName,
      parsed.rpcUrl
    );
  }
}
