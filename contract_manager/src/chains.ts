import { Storable } from "./base";
import {
  ChainName,
  CHAINS,
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
import { AptosClient } from "aptos";
import Web3 from "web3";
import {
  CosmwasmExecutor,
  CosmwasmQuerier,
  InjectiveExecutor,
} from "@pythnetwork/cosmwasm-deploy-tools";
import { Network } from "@injectivelabs/networks";

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
}

export class GlobalChain extends Chain {
  static type: string = "GlobalChain";
  constructor() {
    super("global", true, "unset");
  }
  generateGovernanceUpgradePayload(upgradeInfo: unknown): Buffer {
    throw new Error(
      "Can not create a governance message for upgrading contracts on all chains!"
    );
  }

  getType(): string {
    return GlobalChain.type;
  }

  toJson(): any {
    return {
      id: this.id,
      wormholeChainName: this.wormholeChainName,
      mainnet: this.mainnet,
      type: GlobalChain.type,
    };
  }
}

export class CosmWasmChain extends Chain {
  static type: string = "CosmWasmChain";

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

  static fromJson(parsed: any): CosmWasmChain {
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

  toJson(): any {
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

  async getExecutor(privateKey: string) {
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
}

export class SuiChain extends Chain {
  static type: string = "SuiChain";

  constructor(
    id: string,
    mainnet: boolean,
    wormholeChainName: string,
    public rpcUrl: string
  ) {
    super(id, mainnet, wormholeChainName);
  }

  static fromJson(parsed: any): SuiChain {
    if (parsed.type !== SuiChain.type) throw new Error("Invalid type");
    return new SuiChain(
      parsed.id,
      parsed.mainnet,
      parsed.wormholeChainName,
      parsed.rpcUrl
    );
  }

  toJson(): any {
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
}

export class EvmChain extends Chain {
  static type: string = "EvmChain";

  constructor(
    id: string,
    mainnet: boolean,
    wormholeChainName: string,
    private rpcUrl: string,
    private networkId: number
  ) {
    super(id, mainnet, wormholeChainName);
  }

  static fromJson(parsed: any): EvmChain {
    if (parsed.type !== EvmChain.type) throw new Error("Invalid type");
    return new EvmChain(
      parsed.id,
      parsed.mainnet,
      parsed.wormholeChainName,
      parsed.rpcUrl,
      parsed.networkId
    );
  }

  getRpcUrl(): string {
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

  toJson(): any {
    return {
      id: this.id,
      wormholeChainName: this.wormholeChainName,
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
    privateKey: string,
    abi: any,
    bytecode: string,
    deployArgs: any[]
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

  toJson(): any {
    return {
      id: this.id,
      wormholeChainName: this.wormholeChainName,
      mainnet: this.mainnet,
      rpcUrl: this.rpcUrl,
      type: AptosChain.type,
    };
  }

  static fromJson(parsed: any): AptosChain {
    if (parsed.type !== AptosChain.type) throw new Error("Invalid type");
    return new AptosChain(
      parsed.id,
      parsed.mainnet,
      parsed.wormholeChainName,
      parsed.rpcUrl
    );
  }
}
