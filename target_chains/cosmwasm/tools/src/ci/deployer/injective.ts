import { readFileSync } from "fs";
import { toHex, fromBech32 } from "@cosmjs/encoding";
import { ethers } from "ethers";
import assert from "assert";
import { getNetworkInfo, Network } from "@injectivelabs/networks";
import {
  DEFAULT_STD_FEE,
  MsgStoreCode,
  MsgInstantiateContract,
  PrivateKey,
  TxGrpcClient,
  TxResponse,
  Msgs,
  MsgMigrateContract,
  MsgUpdateAdmin,
  createTransactionForAddressAndMsg,
  ChainGrpcWasmApi,
} from "@injectivelabs/sdk-ts";
import { ContractInfo, Deployer } from ".";

export type InjectiveHost = {
  network: Network;
};

export class InjectiveDeployer implements Deployer {
  network: Network;
  wallet: PrivateKey;

  constructor(network: Network, wallet: PrivateKey) {
    this.network = network;
    this.wallet = wallet;
  }

  private injectiveAddress(): string {
    return this.wallet.toBech32();
  }

  private async signAndBroadcastMsg(
    msg: Msgs,
    fee: {
      amount: {
        amount: string;
        denom: string;
      }[];
      gas: string;
    } = DEFAULT_STD_FEE,
  ): Promise<TxResponse> {
    const networkInfo = getNetworkInfo(this.network);

    const { signBytes, txRaw } = await createTransactionForAddressAndMsg({
      message: msg,
      address: this.injectiveAddress(),
      endpoint: networkInfo.rest,
      chainId: networkInfo.chainId,
      fee,
      pubKey: this.wallet.toPublicKey().toBase64(),
    });

    const sig = await this.wallet.sign(Buffer.from(signBytes));

    /** Append Signatures */
    txRaw.signatures = txRaw.signatures.concat(sig);

    const txService = new TxGrpcClient(networkInfo.grpc);
    const txResponse = await txService.broadcast(txRaw);

    if (txResponse.code !== 0) {
      console.error(`Transaction failed: ${txResponse.rawLog}`);
    } else {
      console.log(
        `Broadcasted transaction hash: ${JSON.stringify(txResponse.txHash)}`,
      );
    }

    return txResponse;
  }

  async deployArtifact(artifact: string): Promise<number> {
    const contract_bytes = readFileSync(artifact);
    console.log(`Storing WASM: ${artifact} (${contract_bytes.length} bytes)`);

    const store_code = MsgStoreCode.fromJSON({
      sender: this.injectiveAddress(),
      wasmBytes: contract_bytes,
    });

    const txResponse = await this.signAndBroadcastMsg(store_code, {
      amount: [
        {
          // gas = 5000000 & gasPrice = 160000000
          amount: String(160000000 * 5000000),
          denom: "inj",
        },
      ],
      // DEFAULT STD FEE that we use has gas = 400000 and gasPrice = 160000000
      // But this transaction was taking gas around 3000000. Which is a lot more
      // Keeping the gasPrice same as in default std fee as seen above in amount.
      // Changing the gasLimit to 5000000
      // If similar issue arise saying gas not enough, we can increase it more.
      gas: "5000000",
    });

    var codeId: number;
    try {
      // {"key":"code_id","value":"\"14\""}
      const ci = extractFromRawLog(txResponse.rawLog, "code_id");
      codeId = parseInt(ci);
    } catch (e) {
      console.error(
        "Encountered an error in parsing deploy code result. Printing raw log",
      );
      console.error(txResponse.rawLog);
      throw e;
    }

    return codeId;
  }

  async instantiate(
    codeId: number,
    inst_msg: object,
    label: string,
  ): Promise<string> {
    const instantiate_msg = MsgInstantiateContract.fromJSON({
      sender: this.injectiveAddress(),
      admin: this.injectiveAddress(),
      codeId,
      label,
      msg: inst_msg,
    });

    const txResponse = await this.signAndBroadcastMsg(instantiate_msg);

    let address: string = "";
    try {
      address = extractFromRawLog(txResponse.rawLog, "contract_address");
    } catch (e) {
      console.error(
        "Encountered an error in parsing instantiation result. Printing raw log",
      );
      console.error(txResponse.rawLog);
      throw e;
    }

    console.log(
      `Instantiated Pyth at ${address} (${convert_injective_address_to_hex(
        address,
      )})`,
    );

    return address;
  }

  async migrate(contract: string, codeId: number): Promise<void> {
    const migrate_msg = MsgMigrateContract.fromJSON({
      sender: this.injectiveAddress(),
      contract,
      codeId,
      msg: {
        action: "",
      },
    });

    const txResponse = await this.signAndBroadcastMsg(migrate_msg);

    let resultCodeId: number;
    try {
      resultCodeId = parseInt(extractFromRawLog(txResponse.rawLog, "code_id"));
      assert.strictEqual(codeId, resultCodeId);
    } catch (e) {
      console.error(
        "Encountered an error in parsing migration result. Printing raw log",
      );
      console.error(txResponse.rawLog);
      throw e;
    }
  }

  async updateAdmin(newAdmin: string, contract: string): Promise<void> {
    const currAdmin = this.injectiveAddress();

    const updateAdminMsg = new MsgUpdateAdmin({
      sender: currAdmin,
      newAdmin,
      contract,
    });

    await this.signAndBroadcastMsg(updateAdminMsg);
  }

  async getContractInfo(contract: string): Promise<ContractInfo> {
    const { grpc } = getNetworkInfo(this.network);
    const api = new ChainGrpcWasmApi(grpc);
    const contractInfo = await api.fetchContractInfo(contract);

    if (contractInfo === undefined)
      throw new Error("error fetching contract info");

    const { codeId, creator, admin } = contractInfo;

    return {
      codeId,
      address: contract,
      creator: creator,
      admin: admin,
      initMsg: undefined,
    };
  }

  static fromHostAndMnemonic(host: InjectiveHost, mnemonic: string) {
    const wallet = PrivateKey.fromMnemonic(mnemonic);
    return new InjectiveDeployer(host.network, wallet);
  }
}

// Injective addresses are "human-readable", but for cross-chain registrations, we
// want the "canonical" version
function convert_injective_address_to_hex(human_addr: string) {
  return "0x" + toHex(ethers.utils.zeroPad(fromBech32(human_addr).data, 32));
}

// enter key of what to extract
function extractFromRawLog(rawLog: string, key: string): string {
  const rx = new RegExp(`"${key}","value":"\\\\"([^\\\\"]+)`, "gm");
  return rx.exec(rawLog)![1];
}
