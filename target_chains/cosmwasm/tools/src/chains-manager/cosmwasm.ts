import {
  DirectSecp256k1HdWallet,
  DirectSecp256k1Wallet,
  EncodeObject,
  OfflineSigner,
} from "@cosmjs/proto-signing";
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
  CosmWasmClient,
  DeliverTxResponse,
  MsgExecuteContractEncodeObject,
  MsgInstantiateContractEncodeObject,
  MsgMigrateContractEncodeObject,
  MsgStoreCodeEncodeObject,
  MsgUpdateAdminEncodeObject,
  SigningCosmWasmClient,
} from "@cosmjs/cosmwasm-stargate";
import { GasPrice } from "@cosmjs/stargate";
import Long from "long";
import assert from "assert";

export class CosmwasmExecutor implements ChainExecutor {
  constructor(
    private readonly endpoint: string,
    private readonly signer: OfflineSigner,
    // example - 0.025uosmo
    private readonly gasPrice: string,
  ) {}

  /**
   * Returns a signer from a mnemonic and prefix to use for the executor
   * @param mnemonic
   * @param prefix chain address prefix (example - osmo)
   */
  static async getSignerFromMnemonic(mnemonic: string, prefix: string) {
    const directSecp256k1HdWallet = await DirectSecp256k1HdWallet.fromMnemonic(
      mnemonic,
      { prefix },
    );
    return directSecp256k1HdWallet;
  }

  /**
   * Returns a signer from a private key and prefix to use for the executor
   * @param privateKey hex encoded private key with no 0x prefix
   * @param prefix chain address prefix (example - osmo)
   */
  static async getSignerFromPrivateKey(privateKey: string, prefix: string) {
    return await DirectSecp256k1Wallet.fromKey(
      Buffer.from(privateKey, "hex"),
      prefix,
    );
  }

  async getBalance(): Promise<number> {
    const address = (await this.signer.getAccounts())[0].address;
    const cosmwasmClient = await CosmWasmClient.connect(this.endpoint);

    // We are interested only in the coin that we pay gas fees in.
    const denom = GasPrice.fromString(this.gasPrice).denom;
    const balance = await cosmwasmClient.getBalance(address, denom);

    // By default the coins have 6 decimal places in CosmWasm
    // and the denom is usually `u<chain>`.
    return Number(balance.amount) / 10 ** 6;
  }

  async getAddress(): Promise<string> {
    return (await this.signer.getAccounts())[0].address;
  }

  private async signAndBroadcastMsg(
    encodedMsgObject: EncodeObject,
  ): Promise<DeliverTxResponse> {
    const address = (await this.signer.getAccounts())[0].address;

    const cosmwasmClient = await SigningCosmWasmClient.connectWithSigner(
      this.endpoint,
      this.signer,
      {
        gasPrice: GasPrice.fromString(this.gasPrice),
      },
    );

    try {
      const txResponse = await cosmwasmClient.signAndBroadcast(
        address,
        [encodedMsgObject],
        2,
      );

      if (txResponse.code !== 0) {
        throw new Error(`Transaction failed: ${txResponse.rawLog}`);
      } else {
        console.log(
          `Broadcasted transaction hash: ${JSON.stringify(
            txResponse.transactionHash,
          )}`,
        );
      }

      return txResponse;
    } catch (e) {
      console.log(e);
      throw e;
    }
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
    req: InstantiateContractRequest,
  ): Promise<InstantiateContractResponse> {
    const { codeId, instMsg, label } = req;

    const accAddress = await this.getAddress();

    const msgInstantiateContractEncodeObject: MsgInstantiateContractEncodeObject =
      {
        typeUrl: "/cosmwasm.wasm.v1.MsgInstantiateContract",
        value: {
          sender: accAddress,
          admin: accAddress,
          codeId: BigInt(codeId),
          label,
          msg: Buffer.from(JSON.stringify(instMsg)),
          funds: [],
        },
      };

    const txResponse = await this.signAndBroadcastMsg(
      msgInstantiateContractEncodeObject,
    );

    if (txResponse.rawLog === undefined)
      throw new Error("error parsing raw logs: rawLog undefined");

    const contractAddr: string = extractFromRawLog(
      txResponse.rawLog,
      "_contract_address",
    );

    return {
      contractAddr,
      txHash: txResponse.transactionHash,
    };
  }

  async executeContract(
    req: ExecuteContractRequest,
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
      msgExecuteContractEncodeObject,
    );

    return {
      txHash: txResponse.transactionHash,
    };
  }

  async migrateContract(
    req: MigrateContractRequest,
  ): Promise<MigrateContractResponse> {
    const { newCodeId, contractAddr, migrateMsg } = req;
    const msgMigrateContractEncodeObject: MsgMigrateContractEncodeObject = {
      typeUrl: "/cosmwasm.wasm.v1.MsgMigrateContract",
      value: {
        sender: await this.getAddress(),
        contract: contractAddr,
        codeId: BigInt(newCodeId),
        msg: Buffer.from(JSON.stringify(migrateMsg)),
      },
    };

    const txResponse = await this.signAndBroadcastMsg(
      msgMigrateContractEncodeObject,
    );

    if (txResponse.rawLog === undefined)
      throw new Error("error parsing raw logs: rawLog undefined");

    let resultCodeId = parseInt(
      extractFromRawLog(txResponse.rawLog, "code_id"),
    );

    assert.strictEqual(newCodeId, resultCodeId);

    return {
      txHash: txResponse.transactionHash,
    };
  }

  async updateContractAdmin(
    req: UpdateContractAdminRequest,
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
      msgUpdateAdminEncodeObject,
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
      "Encountered an error in parsing tx result. Printing raw log",
    );
    console.error(rawLog);
    throw e;
  }
}
