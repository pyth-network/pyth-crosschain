import Web3 from "web3"; //TODO: decide on using web3 or ethers.js
import PythInterfaceAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json";
import { Contract } from "./base";
import { Chain, EVMChain } from "./chains";
import { DataSource } from "xc_admin_common";

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
  ...PythInterfaceAbi,
] as any;

export class EVMContract extends Contract {
  static type = "EVMContract";

  constructor(public chain: EVMChain, public address: string) {
    super();
  }

  static fromJson(chain: Chain, parsed: any): EVMContract {
    if (parsed.type !== EVMContract.type) throw new Error("Invalid type");
    if (!(chain instanceof EVMChain))
      throw new Error(`Wrong chain type ${chain}`);
    return new EVMContract(chain, parsed.address);
  }

  getId(): string {
    return `${this.chain.getId()}_${this.address}`;
  }

  getType(): string {
    return EVMContract.type;
  }

  async getVersion(): Promise<string> {
    const pythContract = this.getContract();
    const result = await pythContract.methods.version().call();
    return result;
  }

  static async deploy(
    chain: EVMChain,
    privateKey: string,
    abi: any,
    bytecode: string
  ): Promise<EVMContract> {
    const web3 = new Web3(chain.getRpcUrl());
    const signer = web3.eth.accounts.privateKeyToAccount(privateKey);
    web3.eth.accounts.wallet.add(signer);
    const contract = new web3.eth.Contract(abi);
    contract.options.data = bytecode;
    const deployTx = contract.deploy({ data: "" });
    const gas = await deployTx.estimateGas();
    let gasPrice = await web3.eth.getGasPrice();

    if (!chain.isMainnet()) {
      gasPrice = (BigInt(gasPrice) * 2n).toString();
    }
    const deployedContract = await deployTx.send({
      from: signer.address,
      gas,
      gasPrice,
    });
    return new EVMContract(chain, deployedContract.options.address);
  }

  getContract() {
    const web3 = new Web3(this.chain.getRpcUrl());
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
