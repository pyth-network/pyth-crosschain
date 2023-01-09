import { readFileSync } from "fs";
import { Bech32, toHex } from "@cosmjs/encoding";
import { zeroPad } from "ethers/lib/utils.js";
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
  createTransactionForAddressAndMsg,
} from "@injectivelabs/sdk-ts";
import { Deployer } from ".";

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
    msg: Msgs | MsgMigrateContract,
    fee = DEFAULT_STD_FEE
  ): Promise<TxResponse> {
    const networkInfo = getNetworkInfo(this.network);

    const { signBytes, txRaw } = await createTransactionForAddressAndMsg({
      // @ts-ignore
      message: msg,
      address: this.injectiveAddress(),
      endpoint: networkInfo.rest,
      chainId: networkInfo.chainId,
      fee,
      pubKey: this.wallet.toPublicKey().toBase64(),
    });

    const sig = await this.wallet.sign(Buffer.from(signBytes));

    /** Append Signatures */
    txRaw.setSignaturesList([sig]);

    const txService = new TxGrpcClient(networkInfo.grpc);
    const txResponse = await txService.broadcast(txRaw);

    if (txResponse.code !== 0) {
      console.error(`Transaction failed: ${txResponse.rawLog}`);
    } else {
      console.log(
        `Broadcasted transaction hash: ${JSON.stringify(txResponse.txHash)}`
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
          // gas = 5000000 & gasPrice = 500000000
          amount: String(500000000 * 5000000),
          denom: "inj",
        },
      ],
      // DEFAULT STD FEE that we use has gas = 400000 and gasPrice = 500000000
      // But this transaction was taking gas around 3000000. Which is a lot more
      // Keeping the gasPrice same as in default std fee as seen above in amount.
      // Changing the gasLimit to 5000000
      // If similar issue arise saying gas not enough, we can increase it more.
      gas: "5000000",
    });

    var codeId: number;
    try {
      const ci = /"code_id","value":"\\"([^\\"]+)/gm.exec(
        txResponse.rawLog
      )![1];
      codeId = parseInt(ci);
    } catch (e) {
      console.error(
        "Encountered an error in parsing deploy code result. Printing raw log"
      );
      console.error(txResponse.rawLog);
      throw e;
    }

    return codeId;
  }

  async instantiate(
    codeId: number,
    inst_msg: object,
    label: string
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
      address = /"contract_address","value":"\\"([^\\"]+)/gm.exec(
        txResponse.rawLog
      )![1];
    } catch (e) {
      console.error(
        "Encountered an error in parsing instantiation result. Printing raw log"
      );
      console.error(txResponse.rawLog);
      throw e;
    }

    console.log(
      `Instantiated Pyth at ${address} (${convert_injective_address_to_hex(
        address
      )})`
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
      resultCodeId = parseInt(
        /"code_id","value":"\\"([^\\"]+)/gm.exec(txResponse.rawLog)![1]
      );
      assert.strictEqual(codeId, resultCodeId);
    } catch (e) {
      console.error(
        "Encountered an error in parsing migration result. Printing raw log"
      );
      console.error(txResponse.rawLog);
      throw e;
    }
  }

  static fromHostAndMnemonic(host: InjectiveHost, mnemonic: string) {
    const wallet = PrivateKey.fromMnemonic(mnemonic);
    return new InjectiveDeployer(host.network, wallet);
  }
}

// Injective addresses are "human-readable", but for cross-chain registrations, we
// want the "canonical" version
function convert_injective_address_to_hex(human_addr: string) {
  return "0x" + toHex(zeroPad(Bech32.decode(human_addr).data, 32));
}
