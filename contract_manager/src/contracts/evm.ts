import Web3 from "web3"; //TODO: decide on using web3 or ethers.js
import PythInterfaceAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json";
import { Contract } from "../base";
import { Chain, EvmChain } from "../chains";
import { DataSource } from "xc_admin_common";

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
] as any;

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
] as any;
export class WormholeEvmContract {
  constructor(public chain: EvmChain, public address: string) {}
  getContract() {
    const web3 = new Web3(this.chain.getRpcUrl());
    return new web3.eth.Contract(WORMHOLE_ABI, this.address);
  }

  /**
   * Returns an array of guardian addresses used for VAA verification in this contract
   */
  async getGuardianSet(): Promise<string[]> {
    const wormholeContract = this.getContract();
    const currentIndex = await wormholeContract.methods
      .getCurrentGuardianSetIndex()
      .call();
    const [currentSet] = await wormholeContract.methods
      .getGuardianSet(currentIndex)
      .call();
    return currentSet;
  }
}

export class EvmContract extends Contract {
  static type = "EvmContract";

  constructor(public chain: EvmChain, public address: string) {
    super();
  }

  static fromJson(chain: Chain, parsed: any): EvmContract {
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

  static async deploy(
    chain: EvmChain,
    privateKey: string,
    abi: any,
    bytecode: string
  ): Promise<EvmContract> {
    const web3 = new Web3(chain.getRpcUrl());
    const signer = web3.eth.accounts.privateKeyToAccount(privateKey);
    web3.eth.accounts.wallet.add(signer);
    const contract = new web3.eth.Contract(abi);
    const deployTx = contract.deploy({ data: bytecode });
    const gas = await deployTx.estimateGas();
    const gasPrice = await chain.getGasPrice();
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
    return new EvmContract(chain, deployedContract.options.address);
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

  /**
   * Returns the keccak256 digest of the contract bytecode after replacing any occurences of the contract addr in the bytecode with 0
   * This is used to verify that the contract code is the same on all chains
   */
  async getCodeDigestWithoutAddress(): Promise<string> {
    const code = await this.getCode();
    const strippedCode = code.replaceAll(
      this.address.toLowerCase().replace("0x", ""),
      "0000000000000000000000000000000000000000"
    );
    return Web3.utils.keccak256(strippedCode);
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

  async executeUpdatePriceFeed(senderPrivateKey: string, vaas: Buffer[]) {
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
    return transactionObject.send({
      from: address,
      value: updateFee,
      gas: gasEstiamte * GAS_ESTIMATE_MULTIPLIER,
      gasPrice: await this.chain.getGasPrice(),
    });
  }

  async executeGovernanceInstruction(senderPrivateKey: string, vaa: Buffer) {
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
    return transactionObject.send({
      from: address,
      gas: gasEstiamte * GAS_ESTIMATE_MULTIPLIER,
      gasPrice: await this.chain.getGasPrice(),
    });
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
