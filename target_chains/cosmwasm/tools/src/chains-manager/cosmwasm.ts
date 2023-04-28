import { DirectSecp256k1HdWallet, EncodeObject } from "@cosmjs/proto-signing";
import {
  ChainExecutor,
  ExecuteContractRequest,
  ExecuteContractResponse,
  InstantiateContractRequest,
  InstantiateContractResponse,
  MigrateContractRequest,
  MigrateContractResponse,
  StoreCodeRequest,
  StoreCodeResponse,
  UpdateContractAdminRequest,
  UpdateContractAdminResponse,
} from "./chain-executor";
import {
  DeliverTxResponse,
  MsgExecuteContractEncodeObject,
  MsgInstantiateContractEncodeObject,
  MsgStoreCodeEncodeObject,
  SigningCosmWasmClient,
  MsgMigrateContractEncodeObject,
  MsgUpdateAdminEncodeObject,
} from "@cosmjs/cosmwasm-stargate";
import { GasPrice, calculateFee } from "@cosmjs/stargate";
import Long from "long";
import assert from "assert";

export class CosmwasmExecutor implements ChainExecutor {
  constructor(
    private readonly endpoint: string,
    private readonly mnemonic: string,
    // chain addresses prefix
    // example osmo
    private readonly prefix: string,
    // example - 0.025uosmo
    private readonly gasPrice: string
  ) {}

  private async getAddress(): Promise<string> {
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, {
      prefix: this.prefix,
    });

    const address = (await wallet.getAccounts())[0].address;

    return address;
  }

  private async signAndBroadcastMsg(
    encodedMsgObject: EncodeObject
  ): Promise<DeliverTxResponse> {
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, {
      prefix: this.prefix,
    });

    const address = (await wallet.getAccounts())[0].address;

    const cosmwasmClient = await SigningCosmWasmClient.connectWithSigner(
      this.endpoint,
      wallet,
      {
        gasPrice: GasPrice.fromString(this.gasPrice),
      }
    );

    const gasUsed = await cosmwasmClient.simulate(
      address,
      [encodedMsgObject],
      "auto"
    );

    const txResponse = await cosmwasmClient.signAndBroadcast(
      address,
      [encodedMsgObject],
      calculateFee(parseInt((gasUsed * 1.5).toFixed()), this.gasPrice)
    );

    if (txResponse.code !== 0) {
      throw new Error(`Transaction failed: ${txResponse.rawLog}`);
    } else {
      console.log(
        `Broadcasted transaction hash: ${JSON.stringify(
          txResponse.transactionHash
        )}`
      );
    }

    return txResponse;
  }

  async storeCode(req: StoreCodeRequest): Promise<StoreCodeResponse> {
    const { contractBytes } = req;
    const msgStoreCodeEncodeObject: MsgStoreCodeEncodeObject = {
      typeUrl: "/cosmwasm.wasm.v1.MsgStoreCode",
      value: {
        sender: await this.getAddress(),
        wasmByteCode: contractBytes,
      },
    };

    const txResponse = await this.signAndBroadcastMsg(msgStoreCodeEncodeObject);

    if (txResponse.rawLog === undefined)
      throw new Error("error parsing raw logs: rawLog undefined");

    const codeId = parseInt(extractFromRawLog(txResponse.rawLog, "code_id"));

    return {
      codeId,
      txHash: txResponse.transactionHash,
    };
  }

  async instantiateContract(
    req: InstantiateContractRequest
  ): Promise<InstantiateContractResponse> {
    const { codeId, instMsg, label } = req;

    const accAddress = await this.getAddress();

    const msgInstantiateContractEncodeObject: MsgInstantiateContractEncodeObject =
      {
        typeUrl: "/cosmwasm.wasm.v1.MsgInstantiateContract",
        value: {
          sender: accAddress,
          admin: accAddress,
          codeId: Long.fromNumber(codeId),
          label,
          msg: Buffer.from(JSON.stringify(instMsg)),
          funds: [],
        },
      };

    const txResponse = await this.signAndBroadcastMsg(
      msgInstantiateContractEncodeObject
    );

    if (txResponse.rawLog === undefined)
      throw new Error("error parsing raw logs: rawLog undefined");

    const contractAddr: string = extractFromRawLog(
      txResponse.rawLog,
      "_contract_address"
    );

    return {
      contractAddr,
      txHash: txResponse.transactionHash,
    };
  }

  async executeContract(
    req: ExecuteContractRequest
  ): Promise<ExecuteContractResponse> {
    const { contractAddr, funds, msg } = req;
    const msgExecuteContact = {
      sender: await this.getAddress(),
      contract: contractAddr,
      msg: Buffer.from(JSON.stringify(msg)),
      funds,
    };

    const msgExecuteContractEncodeObject: MsgExecuteContractEncodeObject = {
      typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
      value: msgExecuteContact,
    };

    const txResponse = await this.signAndBroadcastMsg(
      msgExecuteContractEncodeObject
    );

    return {
      txHash: txResponse.transactionHash,
    };
  }

  async migrateContract(
    req: MigrateContractRequest
  ): Promise<MigrateContractResponse> {
    const { newCodeId, contractAddr, migrateMsg } = req;
    const msgMigrateContractEncodeObject: MsgMigrateContractEncodeObject = {
      typeUrl: "/cosmwasm.wasm.v1.MsgMigrateContract",
      value: {
        sender: await this.getAddress(),
        contract: contractAddr,
        codeId: Long.fromNumber(newCodeId),
        msg: Buffer.from(JSON.stringify(migrateMsg)),
      },
    };

    const txResponse = await this.signAndBroadcastMsg(
      msgMigrateContractEncodeObject
    );

    if (txResponse.rawLog === undefined)
      throw new Error("error parsing raw logs: rawLog undefined");

    let resultCodeId = parseInt(
      extractFromRawLog(txResponse.rawLog, "code_id")
    );

    assert.strictEqual(newCodeId, resultCodeId);

    return {
      txHash: txResponse.transactionHash,
    };
  }

  async updateContractAdmin(
    req: UpdateContractAdminRequest
  ): Promise<UpdateContractAdminResponse> {
    const { newAdminAddr, contractAddr } = req;
    const currAdminAddr = await this.getAddress();

    const msgUpdateAdminEncodeObject: MsgUpdateAdminEncodeObject = {
      typeUrl: "/cosmwasm.wasm.v1.MsgUpdateAdmin",
      value: {
        sender: currAdminAddr,
        newAdmin: newAdminAddr,
        contract: contractAddr,
      },
    };

    const txResponse = await this.signAndBroadcastMsg(
      msgUpdateAdminEncodeObject
    );

    return {
      txHash: txResponse.transactionHash,
    };
  }
}

// enter key of what to extract
function extractFromRawLog(rawLog: string, key: string): string {
  try {
    const rx = new RegExp(`"${key}","value":"([^"]+)`, "gm");
    return rx.exec(rawLog)![1];
  } catch (e) {
    console.error(
      "Encountered an error in parsing instantiation result. Printing raw log"
    );
    console.error(rawLog);
    throw e;
  }
}
