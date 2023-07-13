import Web3 from "web3"; //TODO: decide on using web3 or ethers.js
import PythInterfaceAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json";
import { Contract } from "./base";
import { Chains, EVMChain } from "./chains";
import {
  CHAINS,
  EthereumUpgradeContractInstruction,
  DataSource,
  HexString32Bytes,
  HexString20Bytes,
} from "@pythnetwork/xc-governance-sdk";

const EXTENDED_PYTH_ABI = [
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
  ...PythInterfaceAbi,
] as any;

export class EVMContract extends Contract {
  static type = "EVMContract";

  constructor(public chain: EVMChain, public address: string) {
    super();
  }

  static fromJson(parsed: any): EVMContract {
    if (parsed.type !== EVMContract.type) throw new Error("Invalid type");
    if (!Chains[parsed.chain])
      throw new Error(`Chain ${parsed.chain} not found`);
    return new EVMContract(Chains[parsed.chain] as EVMChain, parsed.address);
  }

  getId(): string {
    return `${this.chain.getId()}_${this.address}`;
  }

  getType(): string {
    return EVMContract.type;
  }

  getContract() {
    const web3 = new Web3(this.chain.rpcUrl);
    const pythContract = new web3.eth.Contract(EXTENDED_PYTH_ABI, this.address);
    return pythContract;
  }

  async getPriceFeed(feedId: string) {
    const pythContract = this.getContract();
    const [price, conf, expo, publishTime] = await pythContract.methods
      .getPriceUnsafe(feedId)
      .call();
    return { price, conf, expo, publishTime };
  }

  async getValidTimePeriod() {
    const pythContract = this.getContract();
    const result = await pythContract.methods.getValidTimePeriod().call();
    return Number(result);
  }

  async getBaseUpdateFee() {
    const pythContract = this.getContract();
    const result = await pythContract.methods.singleUpdateFeeInWei().call();
    return { amount: result, denom: "wei" };
  }

  async getDataSources(): Promise<DataSource[]> {
    const pythContract = this.getContract();
    const result = await pythContract.methods.validDataSources().call();
    return result.map(({ chainId, emitterAddress }: any) => {
      return new DataSource(
        Number(chainId),
        new HexString32Bytes(emitterAddress)
      );
    });
  }

  async getGovernanceDataSource(): Promise<DataSource> {
    const pythContract = this.getContract();
    const [chainId, emitterAddress] = await pythContract.methods
      .governanceDataSource()
      .call();
    return new DataSource(
      Number(chainId),
      new HexString32Bytes(emitterAddress)
    );
  }

  getGovernanceUpgradePayload(address: HexString20Bytes): Buffer {
    return new EthereumUpgradeContractInstruction(
      CHAINS[this.getChain().getId() as keyof typeof CHAINS],
      address
    ).serialize();
  }

  async executeGovernanceInstruction(privateKey: string, vaa: Buffer) {
    const web3 = new Web3(this.chain.rpcUrl);
    const { address } = web3.eth.accounts.wallet.add(privateKey);
    const pythContract = new web3.eth.Contract(EXTENDED_PYTH_ABI, this.address);
    const transactionObject = pythContract.methods.executeGovernanceInstruction(
      "0x" + vaa.toString("hex")
    );
    const gasEstiamte = await transactionObject.estimateGas({
      from: address,
      gas: 100000000,
    });
    return transactionObject.send({ from: address, gas: gasEstiamte * 2 });
  }

  getChain(): EVMChain {
    return this.chain;
  }

  toJson() {
    return {
      chain: this.chain.id,
      address: this.address,
      type: EVMContract.type,
    };
  }
}
