import assert from "node:assert";
import type {
  DeliverTxResponse,
  MsgExecuteContractEncodeObject,
  MsgInstantiateContractEncodeObject,
  MsgMigrateContractEncodeObject,
  MsgStoreCodeEncodeObject,
  MsgUpdateAdminEncodeObject,
} from "@cosmjs/cosmwasm-stargate";
import {
  CosmWasmClient,
  SigningCosmWasmClient,
} from "@cosmjs/cosmwasm-stargate";
import type { EncodeObject, OfflineSigner } from "@cosmjs/proto-signing";
import {
  DirectSecp256k1HdWallet,
  DirectSecp256k1Wallet,
} from "@cosmjs/proto-signing";
import { GasPrice } from "@cosmjs/stargate";
import type {
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
} from "./chain-executor.js";

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
    const accounts = await this.signer.getAccounts();
    const firstAccount = accounts[0];
    if (!firstAccount) {
      throw new Error("No accounts found in signer");
    }
    const address = firstAccount.address;
    const cosmwasmClient = await CosmWasmClient.connect(this.endpoint);

    // We are interested only in the coin that we pay gas fees in.
    const denom = GasPrice.fromString(this.gasPrice).denom;
    const balance = await cosmwasmClient.getBalance(address, denom);

    // By default the coins have 6 decimal places in CosmWasm
    // and the denom is usually `u<chain>`.
    return Number(balance.amount) / 10 ** 6;
  }

  async getAddress(): Promise<string> {
    const accounts = await this.signer.getAccounts();
    const firstAccount = accounts[0];
    if (!firstAccount) {
      throw new Error("No accounts found in signer");
    }
    return firstAccount.address;
  }

  private async signAndBroadcastMsg(
    encodedMsgObject: EncodeObject,
  ): Promise<DeliverTxResponse> {
    const accounts = await this.signer.getAccounts();
    const firstAccount = accounts[0];
    if (!firstAccount) {
      throw new Error("No accounts found in signer");
    }
    const address = firstAccount.address;

    const cosmwasmClient = await SigningCosmWasmClient.connectWithSigner(
      this.endpoint,
      this.signer,
      {
        gasPrice: GasPrice.fromString(this.gasPrice),
      },
    );
    const txResponse = await cosmwasmClient.signAndBroadcast(
      address,
      [encodedMsgObject],
      2,
    );

    if (txResponse.code !== 0) {
      throw new Error(`Transaction failed: ${txResponse.rawLog}`);
    } else {
      /* no-op */
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

    const codeId = Number.parseInt(
      extractFromRawLog(txResponse.rawLog, "code_id"),
      10,
    );

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
          admin: accAddress,
          codeId: BigInt(codeId),
          funds: [],
          label,
          msg: Buffer.from(JSON.stringify(instMsg)),
          sender: accAddress,
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
      contract: contractAddr,
      funds,
      msg: Buffer.from(JSON.stringify(msg)),
      sender: await this.getAddress(),
    };

    const msgExecuteContractEncodeObject = {
      typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
      value: msgExecuteContact,
    } as MsgExecuteContractEncodeObject;

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
        codeId: BigInt(newCodeId),
        contract: contractAddr,
        msg: Buffer.from(JSON.stringify(migrateMsg)),
        sender: await this.getAddress(),
      },
    };

    const txResponse = await this.signAndBroadcastMsg(
      msgMigrateContractEncodeObject,
    );

    if (txResponse.rawLog === undefined)
      throw new Error("error parsing raw logs: rawLog undefined");

    const resultCodeId = Number.parseInt(
      extractFromRawLog(txResponse.rawLog, "code_id"),
      10,
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
        contract: contractAddr,
        newAdmin: newAdminAddr,
        sender: currAdminAddr,
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
  const rx = new RegExp(`"${key}","value":"([^"]+)`, "gm");
  return rx.exec(rawLog)?.[1] ?? "";
}
