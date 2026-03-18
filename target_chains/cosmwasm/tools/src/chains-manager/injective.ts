import assert from "node:assert";
import type { Network } from "@injectivelabs/networks";
import { getNetworkEndpoints, getNetworkInfo } from "@injectivelabs/networks";
import type { Msgs, TxResponse } from "@injectivelabs/sdk-ts";
import {
  ChainGrpcAuthApi,
  ChainGrpcBankApi,
  createTransactionFromMsg,
  MsgExecuteContract,
  MsgInstantiateContract,
  MsgMigrateContract,
  MsgStoreCode,
  MsgUpdateAdmin,
  PrivateKey,
  TxGrpcClient,
} from "@injectivelabs/sdk-ts";
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

const DEFAULT_GAS_PRICE = 160_000_000;

export class InjectiveExecutor implements ChainExecutor {
  private readonly gasMultiplier = 2;
  private readonly gasPrice = DEFAULT_GAS_PRICE;

  constructor(
    private readonly network: Network,
    private readonly wallet: PrivateKey,
  ) {}

  static fromMnemonic(network: Network, mnemonic: string) {
    const wallet = PrivateKey.fromMnemonic(mnemonic);
    return new InjectiveExecutor(network, wallet);
  }

  static fromPrivateKey(network: Network, privateKey: string) {
    const wallet = PrivateKey.fromHex(privateKey);
    return new InjectiveExecutor(network, wallet);
  }

  getAddress(): string {
    return this.wallet.toBech32();
  }

  async getBalance(): Promise<number> {
    const endpoints = getNetworkEndpoints(this.network);

    const chainGrpcAuthApi = new ChainGrpcBankApi(endpoints.grpc);

    const balance = await chainGrpcAuthApi.fetchBalance({
      accountAddress: this.getAddress(),
      denom: "inj",
    });

    return Number(balance.amount) / 10 ** 18;
  }

  private async signAndBroadcastMsg(msg: Msgs): Promise<TxResponse> {
    const networkInfo = getNetworkInfo(this.network);
    const endpoints = getNetworkEndpoints(this.network);

    const chainGrpcAuthApi = new ChainGrpcAuthApi(endpoints.grpc);
    const account = await chainGrpcAuthApi.fetchAccount(this.getAddress());
    const { txRaw: simulateTxRaw } = createTransactionFromMsg({
      accountNumber: account.baseAccount.accountNumber,
      chainId: networkInfo.chainId,
      message: msg,
      pubKey: this.wallet.toPublicKey().toBase64(),
      sequence: account.baseAccount.sequence,
    });

    const txService = new TxGrpcClient(endpoints.grpc);
    // simulation
    const {
      gasInfo: { gasUsed },
    } = await txService.simulate(simulateTxRaw);

    // simulation returns us the approximate gas used
    // gas passed with the transaction should be more than that
    // in order for it to be successfully executed
    // this multiplier takes care of that
    const fee = {
      amount: [
        {
          amount: (gasUsed * this.gasPrice * this.gasMultiplier).toFixed(0),
          denom: "inj",
        },
      ],
      gas: (gasUsed * this.gasMultiplier).toFixed(0),
    };

    const { signBytes, txRaw } = createTransactionFromMsg({
      accountNumber: account.baseAccount.accountNumber,
      chainId: networkInfo.chainId,
      fee,
      message: msg,
      pubKey: this.wallet.toPublicKey().toBase64(),
      sequence: account.baseAccount.sequence,
    });

    const sig = await this.wallet.sign(Buffer.from(signBytes));

    /** Append Signatures */
    txRaw.signatures = txRaw.signatures.concat(sig);

    const txResponse = await txService.broadcast(txRaw);

    if (txResponse.code !== 0) {
      throw new Error(`Transaction failed: ${txResponse.rawLog}`);
    } else {
    }

    return txResponse;
  }

  async storeCode(req: StoreCodeRequest): Promise<StoreCodeResponse> {
    const { contractBytes } = req;
    const store_code = MsgStoreCode.fromJSON({
      sender: this.getAddress(),
      wasmBytes: contractBytes,
    });

    const txResponse = await this.signAndBroadcastMsg(store_code);

    const codeId: number = Number.parseInt(
      extractFromRawLog(txResponse.rawLog, "code_id"),
      10,
    );

    return {
      codeId,
      txHash: txResponse.txHash,
    };
  }

  async instantiateContract(
    req: InstantiateContractRequest,
  ): Promise<InstantiateContractResponse> {
    const { codeId, instMsg, label } = req;
    const instantiateMsg = MsgInstantiateContract.fromJSON({
      admin: this.getAddress(),
      codeId,
      label,
      msg: instMsg,
      sender: this.getAddress(),
    });

    const txResponse = await this.signAndBroadcastMsg(instantiateMsg);

    const contractAddr: string = extractFromRawLog(
      txResponse.rawLog,
      "contract_address",
    );

    return {
      contractAddr,
      txHash: txResponse.txHash,
    };
  }

  async executeContract(
    req: ExecuteContractRequest,
  ): Promise<ExecuteContractResponse> {
    const { contractAddr, msg, funds } = req;

    const executeMsg = MsgExecuteContract.fromJSON({
      contractAddress: contractAddr,
      funds,
      msg,
      sender: this.getAddress(),
    } as MsgExecuteContract["params"]);

    const txResponse = await this.signAndBroadcastMsg(executeMsg);

    return {
      txHash: txResponse.txHash,
    };
  }

  async migrateContract(
    req: MigrateContractRequest,
  ): Promise<MigrateContractResponse> {
    const { newCodeId, contractAddr, migrateMsg } = req;
    const migrate_msg = MsgMigrateContract.fromJSON({
      codeId: newCodeId,
      contract: contractAddr,
      msg: migrateMsg ?? {
        action: "",
      },
      sender: this.getAddress(),
    });

    const txResponse = await this.signAndBroadcastMsg(migrate_msg);

    const resultCodeId: number = Number.parseInt(
      extractFromRawLog(txResponse.rawLog, "code_id"),
      10,
    );
    assert.strictEqual(newCodeId, resultCodeId);

    return {
      txHash: txResponse.txHash,
    };
  }

  async updateContractAdmin(
    req: UpdateContractAdminRequest,
  ): Promise<UpdateContractAdminResponse> {
    const { newAdminAddr, contractAddr } = req;
    const currAdminAddr = this.getAddress();

    const updateAdminMsg = new MsgUpdateAdmin({
      contract: contractAddr,
      newAdmin: newAdminAddr,
      sender: currAdminAddr,
    });

    const txResponse = await this.signAndBroadcastMsg(updateAdminMsg);

    return {
      txHash: txResponse.txHash,
    };
  }
}

// enter key of what to extract
function extractFromRawLog(rawLog: string, key: string): string {
  const rx = new RegExp(`"${key}","value":"\\\\"([^\\\\"]+)`, "gm");
  return rx.exec(rawLog)?.[1] ?? "";
}
