import Web3 from "web3";
import PythInterfaceAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json";
import { Contract, PrivateKey } from "../base";
import { Chain, EvmChain } from "../chains";
import { DataSource } from "xc_admin_common";
import { WormholeContract } from "./wormhole";

// Just to make sure tx gas limit is enough
const GAS_ESTIMATE_MULTIPLIER = 2;
const EXTENDED_PYTH_ABI = [
  {
    inputs: [],
    name: "wormhole",
    outputs: [
      {
        internalType: "contract IWormhole",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "governanceDataSource",
    outputs: [
      {
        components: [
          {
            internalType: "uint16",
            name: "chainId",
            type: "uint16",
          },
          {
            internalType: "bytes32",
            name: "emitterAddress",
            type: "bytes32",
          },
        ],
        internalType: "struct PythInternalStructs.DataSource",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "encodedVM",
        type: "bytes",
      },
    ],
    name: "executeGovernanceInstruction",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "version",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [],
    name: "singleUpdateFeeInWei",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "validDataSources",
    outputs: [
      {
        components: [
          {
            internalType: "uint16",
            name: "chainId",
            type: "uint16",
          },
          {
            internalType: "bytes32",
            name: "emitterAddress",
            type: "bytes32",
          },
        ],
        internalType: "struct PythInternalStructs.DataSource[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
    constant: true,
  },
  {
    inputs: [],
    name: "lastExecutedGovernanceSequence",
    outputs: [
      {
        internalType: "uint64",
        name: "",
        type: "uint64",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "id",
        type: "bytes32",
      },
    ],
    name: "priceFeedExists",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  ...PythInterfaceAbi,
] as any; // eslint-disable-line  @typescript-eslint/no-explicit-any

const WORMHOLE_ABI = [
  {
    inputs: [],
    name: "getCurrentGuardianSetIndex",
    outputs: [
      {
        internalType: "uint32",
        name: "",
        type: "uint32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "chainId",
    outputs: [
      {
        internalType: "uint16",
        name: "",
        type: "uint16",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint32",
        name: "index",
        type: "uint32",
      },
    ],
    name: "getGuardianSet",
    outputs: [
      {
        components: [
          {
            internalType: "address[]",
            name: "keys",
            type: "address[]",
          },
          {
            internalType: "uint32",
            name: "expirationTime",
            type: "uint32",
          },
        ],
        internalType: "struct Structs.GuardianSet",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "_vm",
        type: "bytes",
      },
    ],
    name: "submitNewGuardianSet",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "messageFee",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as any; // eslint-disable-line  @typescript-eslint/no-explicit-any
export class WormholeEvmContract extends WormholeContract {
  constructor(public chain: EvmChain, public address: string) {
    super();
  }
  getContract() {
    const web3 = new Web3(this.chain.getRpcUrl());
    return new web3.eth.Contract(WORMHOLE_ABI, this.address);
  }

  async getCurrentGuardianSetIndex(): Promise<number> {
    const wormholeContract = this.getContract();
    return Number(
      await wormholeContract.methods.getCurrentGuardianSetIndex().call()
    );
  }

  async getChainId(): Promise<number> {
    const wormholeContract = this.getContract();
    return Number(await wormholeContract.methods.chainId().call());
  }

  /**
   * Returns an array of guardian addresses used for VAA verification in this contract
   */
  async getGuardianSet(): Promise<string[]> {
    const wormholeContract = this.getContract();
    const currentIndex = await this.getCurrentGuardianSetIndex();
    const [currentSet] = await wormholeContract.methods
      .getGuardianSet(currentIndex)
      .call();
    return currentSet;
  }

  async upgradeGuardianSets(senderPrivateKey: PrivateKey, vaa: Buffer) {
    const web3 = new Web3(this.chain.getRpcUrl());
    const { address } = web3.eth.accounts.wallet.add(senderPrivateKey);
    const wormholeContract = new web3.eth.Contract(WORMHOLE_ABI, this.address);
    const transactionObject = wormholeContract.methods.submitNewGuardianSet(
      "0x" + vaa.toString("hex")
    );
    const gasEstiamte = await transactionObject.estimateGas({
      from: address,
      gas: 100000000,
    });
    const result = await transactionObject.send({
      from: address,
      gas: gasEstiamte * GAS_ESTIMATE_MULTIPLIER,
      gasPrice: await this.chain.getGasPrice(),
    });
    return { id: result.transactionHash, info: result };
  }
}

export class EvmContract extends Contract {
  static type = "EvmContract";

  constructor(public chain: EvmChain, public address: string) {
    super();
  }

  static fromJson(
    chain: Chain,
    parsed: { type: string; address: string }
  ): EvmContract {
    if (parsed.type !== EvmContract.type) throw new Error("Invalid type");
    if (!(chain instanceof EvmChain))
      throw new Error(`Wrong chain type ${chain}`);
    return new EvmContract(chain, parsed.address);
  }

  getId(): string {
    return `${this.chain.getId()}_${this.address}`;
  }

  getType(): string {
    return EvmContract.type;
  }

  async getVersion(): Promise<string> {
    const pythContract = this.getContract();
    const result = await pythContract.methods.version().call();
    return result;
  }

  getContract() {
    const web3 = new Web3(this.chain.getRpcUrl());
    const pythContract = new web3.eth.Contract(EXTENDED_PYTH_ABI, this.address);
    return pythContract;
  }

  /**
   * Returns the bytecode of the contract in hex format
   */
  async getCode(): Promise<string> {
    // TODO: handle proxy contracts
    const web3 = new Web3(this.chain.getRpcUrl());
    return web3.eth.getCode(this.address);
  }

  async getImplementationAddress(): Promise<string> {
    const web3 = new Web3(this.chain.getRpcUrl());
    // bytes32(uint256(keccak256('eip1967.proxy.implementation')) - 1) according to EIP-1967
    const storagePosition =
      "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    let address = await web3.eth.getStorageAt(this.address, storagePosition);
    address = "0x" + address.slice(26);
    return address;
  }

  /**
   * Returns the keccak256 digest of the contract bytecode after replacing any occurrences of the contract addr in
   * the bytecode with 0.The bytecode stores the deployment address as an immutable variable.
   * This behavior is inherited from OpenZeppelin's implementation of UUPSUpgradeable contract.
   * You can read more about verification with immutable variables here:
   * https://docs.sourcify.dev/docs/immutables/
   * This function can be used to verify that the contract code is the same on all chains and matches
   * with the deployedCode property generated by truffle builds
   */
  async getCodeDigestWithoutAddress(): Promise<string> {
    const code = await this.getCode();
    const strippedCode = code.replaceAll(
      this.address.toLowerCase().replace("0x", ""),
      "0000000000000000000000000000000000000000"
    );
    return Web3.utils.keccak256(strippedCode);
  }

  async getTotalFee(): Promise<bigint> {
    const web3 = new Web3(this.chain.getRpcUrl());
    return BigInt(await web3.eth.getBalance(this.address));
  }

  async getLastExecutedGovernanceSequence() {
    const pythContract = await this.getContract();
    return Number(
      await pythContract.methods.lastExecutedGovernanceSequence().call()
    );
  }

  async getPriceFeed(feedId: string) {
    const pythContract = this.getContract();
    const feed = "0x" + feedId;
    const exists = await pythContract.methods.priceFeedExists(feed).call();
    if (!exists) {
      return undefined;
    }
    const [price, conf, expo, publishTime] = await pythContract.methods
      .getPriceUnsafe(feed)
      .call();

    const [emaPrice, emaConf, emaExpo, emaPublishTime] =
      await pythContract.methods.getEmaPriceUnsafe(feed).call();
    return {
      price: { price, conf, expo, publishTime },
      emaPrice: {
        price: emaPrice,
        conf: emaConf,
        expo: emaExpo,
        publishTime: emaPublishTime,
      },
    };
  }

  async getValidTimePeriod() {
    const pythContract = this.getContract();
    const result = await pythContract.methods.getValidTimePeriod().call();
    return Number(result);
  }

  /**
   * Returns the wormhole contract which is being used for VAA verification
   */
  async getWormholeContract(): Promise<WormholeEvmContract> {
    const pythContract = this.getContract();
    const address = await pythContract.methods.wormhole().call();
    return new WormholeEvmContract(this.chain, address);
  }

  async getBaseUpdateFee() {
    const pythContract = this.getContract();
    const result = await pythContract.methods.singleUpdateFeeInWei().call();
    return { amount: result };
  }

  async getDataSources(): Promise<DataSource[]> {
    const pythContract = this.getContract();
    const result = await pythContract.methods.validDataSources().call();
    return result.map(
      ({
        chainId,
        emitterAddress,
      }: {
        chainId: string;
        emitterAddress: string;
      }) => {
        return {
          emitterChain: Number(chainId),
          emitterAddress: emitterAddress.replace("0x", ""),
        };
      }
    );
  }

  async getGovernanceDataSource(): Promise<DataSource> {
    const pythContract = this.getContract();
    const [chainId, emitterAddress] = await pythContract.methods
      .governanceDataSource()
      .call();
    return {
      emitterChain: Number(chainId),
      emitterAddress: emitterAddress.replace("0x", ""),
    };
  }

  async executeUpdatePriceFeed(senderPrivateKey: PrivateKey, vaas: Buffer[]) {
    const web3 = new Web3(this.chain.getRpcUrl());
    const { address } = web3.eth.accounts.wallet.add(senderPrivateKey);
    const pythContract = new web3.eth.Contract(EXTENDED_PYTH_ABI, this.address);
    const priceFeedUpdateData = vaas.map((vaa) => "0x" + vaa.toString("hex"));
    const updateFee = await pythContract.methods
      .getUpdateFee(priceFeedUpdateData)
      .call();
    const transactionObject =
      pythContract.methods.updatePriceFeeds(priceFeedUpdateData);
    const gasEstiamte = await transactionObject.estimateGas({
      from: address,
      gas: 100000000,
      value: updateFee,
    });
    const result = await transactionObject.send({
      from: address,
      value: updateFee,
      gas: gasEstiamte * GAS_ESTIMATE_MULTIPLIER,
      gasPrice: await this.chain.getGasPrice(),
    });
    return { id: result.transactionHash, info: result };
  }

  async executeGovernanceInstruction(
    senderPrivateKey: PrivateKey,
    vaa: Buffer
  ) {
    const web3 = new Web3(this.chain.getRpcUrl());
    const { address } = web3.eth.accounts.wallet.add(senderPrivateKey);
    const pythContract = new web3.eth.Contract(EXTENDED_PYTH_ABI, this.address);
    const transactionObject = pythContract.methods.executeGovernanceInstruction(
      "0x" + vaa.toString("hex")
    );
    const gasEstiamte = await transactionObject.estimateGas({
      from: address,
      gas: 100000000,
    });
    const result = await transactionObject.send({
      from: address,
      gas: gasEstiamte * GAS_ESTIMATE_MULTIPLIER,
      gasPrice: await this.chain.getGasPrice(),
    });
    return { id: result.transactionHash, info: result };
  }

  getChain(): EvmChain {
    return this.chain;
  }

  toJson() {
    return {
      chain: this.chain.getId(),
      address: this.address,
      type: EvmContract.type,
    };
  }
}
