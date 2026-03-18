import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fromBech32, toHex } from "@cosmjs/encoding";
import type { Network } from "@injectivelabs/networks";
import { getNetworkInfo } from "@injectivelabs/networks";
import type { ContractInfo, Msgs, TxResponse } from "@injectivelabs/sdk-ts";
import {
  ChainGrpcWasmApi,
  createTransactionForAddressAndMsg,
  DEFAULT_STD_FEE,
  MsgInstantiateContract,
  MsgMigrateContract,
  MsgStoreCode,
  MsgUpdateAdmin,
  PrivateKey,
  TxGrpcClient,
} from "@injectivelabs/sdk-ts";
import { ethers } from "ethers";
import type { Deployer } from "./index.js";

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
      address: this.injectiveAddress(),
      chainId: networkInfo.chainId,
      endpoint: networkInfo.rest,
      fee,
      message: msg,
      pubKey: this.wallet.toPublicKey().toBase64(),
    });

    const sig = await this.wallet.sign(Buffer.from(signBytes));

    /** Append Signatures */
    txRaw.signatures = txRaw.signatures.concat(sig);

    const txService = new TxGrpcClient(networkInfo.grpc);
    const txResponse = await txService.broadcast(txRaw);

    return txResponse;
  }

  async deployArtifact(artifact: string): Promise<number> {
    const contract_bytes = readFileSync(artifact);

    const store_code = MsgStoreCode.fromJSON({
      sender: this.injectiveAddress(),
      wasmBytes: contract_bytes,
    });

    const txResponse = await this.signAndBroadcastMsg(store_code, {
      amount: [
        {
          // gas = 5000000 & gasPrice = 160000000
          amount: String(160_000_000 * 5_000_000),
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
    // {"key":"code_id","value":"\"14\""}
    const ci = extractFromRawLog(txResponse.rawLog, "code_id");
    codeId = Number.parseInt(ci, 10);

    return codeId;
  }

  async instantiate(
    codeId: number,
    inst_msg: object,
    label: string,
  ): Promise<string> {
    const instantiate_msg = MsgInstantiateContract.fromJSON({
      admin: this.injectiveAddress(),
      codeId,
      label,
      msg: inst_msg,
      sender: this.injectiveAddress(),
    });

    const txResponse = await this.signAndBroadcastMsg(instantiate_msg);

    let address = "";
    address = extractFromRawLog(txResponse.rawLog, "contract_address");

    return address;
  }

  async migrate(contract: string, codeId: number): Promise<void> {
    const migrate_msg = MsgMigrateContract.fromJSON({
      codeId,
      contract,
      msg: {
        action: "",
      },
      sender: this.injectiveAddress(),
    });

    const txResponse = await this.signAndBroadcastMsg(migrate_msg);

    const resultCodeId = Number.parseInt(
      extractFromRawLog(txResponse.rawLog, "code_id"),
      10,
    );
    assert.strictEqual(codeId, resultCodeId);
  }

  async updateAdmin(newAdmin: string, contract: string): Promise<void> {
    const currAdmin = this.injectiveAddress();

    const updateAdminMsg = new MsgUpdateAdmin({
      contract,
      newAdmin,
      sender: currAdmin,
    });

    await this.signAndBroadcastMsg(updateAdminMsg);
  }

  // @ts-expect-error - TODO: slight typing differences in return types
  async getContractInfo(contract: string): Promise<ContractInfo> {
    const { grpc } = getNetworkInfo(this.network);
    const api = new ChainGrpcWasmApi(grpc);
    const contractInfo = await api.fetchContractInfo(contract);

    if (contractInfo === undefined)
      throw new Error("error fetching contract info");

    const { codeId, creator, admin } = contractInfo;

    return {
      address: contract,
      admin: admin,
      codeId,
      creator: creator,
      initMsg: undefined,
    } as unknown as ContractInfo;
  }

  static fromHostAndMnemonic(host: InjectiveHost, mnemonic: string) {
    const wallet = PrivateKey.fromMnemonic(mnemonic);
    return new InjectiveDeployer(host.network, wallet);
  }
}

// Injective addresses are "human-readable", but for cross-chain registrations, we
// want the "canonical" version
export function convertInjectiveAddressToHex(human_addr: string) {
  return `0x${toHex(ethers.utils.zeroPad(fromBech32(human_addr).data, 32))}`;
}

// enter key of what to extract
function extractFromRawLog(rawLog: string, key: string): string {
  const rx = new RegExp(`"${key}","value":"\\\\"([^\\\\"]+)`, "gm");
  // biome-ignore lint/style/noNonNullAssertion: legacy assertion
  // biome-ignore lint/suspicious/noNonNullAssertedOptionalChain: legacy assertion
  return rx.exec(rawLog)?.[1]!;
}
