import { readFileSync } from "fs";
import { Bech32, toHex } from "@cosmjs/encoding";
import { zeroPad } from "ethers/lib/utils.js";
// @ts-ignore
import assert from "assert";
import { getNetworkInfo, Network } from "@injectivelabs/networks";
import {
  BaseAccount,
  ChainRestAuthApi,
  ChainRestTendermintApi,
  createTransaction,
  DEFAULT_STD_FEE,
  MsgStoreCode,
  PrivateKey,
  TxGrpcClient,
} from "@injectivelabs/sdk-ts";
import {
  BigNumberInBase,
  DEFAULT_BLOCK_TIMEOUT_HEIGHT,
} from "@injectivelabs/utils";
import { Deployer } from "./deployer";

export class InjectiveDeployer extends Deployer {
  network: Network;
  wallet: PrivateKey;

  constructor(network: Network, wallet: PrivateKey) {
    super();

    this.network = network;
    this.wallet = wallet;
  }

  private injectiveAddress(): string {
    return this.wallet.toBech32();
  }

  private async getBaseAccount(): Promise<BaseAccount> {
    /** Account Details **/
    const chainRestAuthApi = new ChainRestAuthApi(
      (await getNetworkInfo(this.network)).rest
    );
    const accountDetailsResponse = await chainRestAuthApi.fetchAccount(
      this.injectiveAddress()
    );
    return BaseAccount.fromRestApi(accountDetailsResponse);
  }

  private async getTimeoutHeight(): Promise<BigNumberInBase> {
    /** Block Details */
    const chainRestTendermintApi = new ChainRestTendermintApi(
      (await getNetworkInfo(this.network)).rest
    );
    const latestBlock = await chainRestTendermintApi.fetchLatestBlock();
    const latestHeight = latestBlock.header.height;

    return new BigNumberInBase(latestHeight).plus(DEFAULT_BLOCK_TIMEOUT_HEIGHT);
  }

  async deployArtifact(artifact: string): Promise<number> {
    const contract_bytes = readFileSync(artifact);
    console.log(`Storing WASM: ${artifact} (${contract_bytes.length} bytes)`);

    const store_code = MsgStoreCode.fromJSON({
      sender: this.injectiveAddress(),
      wasmBytes: contract_bytes.toString("base64"),
    });

    const baseAccount = await this.getBaseAccount();
    const networkInfo = await getNetworkInfo(this.network);

    const { signBytes, txRaw } = createTransaction({
      pubKey: this.injectiveAddress(),
      chainId: networkInfo.chainId,
      fee: DEFAULT_STD_FEE,
      message: store_code.toDirectSign(),
      sequence: baseAccount.sequence,
      timeoutHeight: (await this.getTimeoutHeight()).toNumber(),
      accountNumber: baseAccount.accountNumber,
    });

    const sig = await this.wallet.sign(Buffer.from(signBytes));

    /** Append Signatures */
    txRaw.setSignaturesList([sig]);

    var codeId: number;
    const txService = new TxGrpcClient(networkInfo.grpc);
    const txResponse = await txService.broadcast(txRaw);
    console.log("txResponse", txResponse);

    if (txResponse.code !== 0) {
      console.log(`Transaction failed: ${txResponse.rawLog}`);
    } else {
      console.log(
        `Broadcasted transaction hash: ${JSON.stringify(txResponse.txHash)}`
      );
    }

    try {
      // @ts-ignore
      const ci = /"code_id","value":"([^"]+)/gm.exec(txResponse.rawLog)[1];
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
    inst_msg: string | object,
    label: string
  ): Promise<string> {
    throw new Error("Not implemented");
    /*
    var address: string = "";
    await this.wallet
      .createAndSignTx({
        msgs: [
          new MsgInstantiateContract(
            this.wallet.key.accAddress,
            this.wallet.key.accAddress,
            codeId,
            inst_msg,
            undefined,
            label
          ),
        ],
      })
      .then((tx) => this.wallet.lcd.tx.broadcast(tx))
      .then((rs) => {
        try {
          // @ts-ignore
          address = /"contract_address","value":"([^"]+)/gm.exec(rs.raw_log)[1];
        } catch (e) {
          console.error(
            "Encountered an error in parsing instantiation result. Printing raw log"
          );
          console.error(rs.raw_log);
          throw e;
        }
      });
    console.log(
      `Instantiated Pyth at ${address} (${convert_terra_address_to_hex(
        address
      )})`
    );
    return address;
     */
  }

  async migrate(contract: string, codeId: number): Promise<void> {
    throw new Error("Not implemented");

    /*
    const tx = await this.wallet.createAndSignTx({
      msgs: [
        new MsgMigrateContract(this.wallet.key.accAddress, contract, codeId, {
          action: "",
        }),
      ],
      feeDenoms: this.feeDenoms,
    });

    const rs = await this.wallet.lcd.tx.broadcast(tx);
    var resultCodeId: number;
    try {
      // @ts-ignore
      resultCodeId = /"code_id","value":"([^"]+)/gm.exec(rs.raw_log)[1];
      assert.strictEqual(codeId, resultCodeId);
    } catch (e) {
      console.error(
        "Encountered an error in parsing migration result. Printing raw log"
      );
      console.error(rs.raw_log);
      throw e;
    }
     */
  }
}

// Terra addresses are "human-readable", but for cross-chain registrations, we
// want the "canonical" version
function convert_terra_address_to_hex(human_addr: string) {
  return "0x" + toHex(zeroPad(Bech32.decode(human_addr).data, 32));
}
