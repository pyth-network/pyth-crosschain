import {
  LCDClient,
  MnemonicKey,
  Msg,
  MsgInstantiateContract,
  MsgMigrateContract,
  MsgStoreCode,
  WaitTxBroadcastResult,
  Wallet,
  isTxError,
} from "@terra-money/terra.js";
import { readFileSync } from "fs";
import { Bech32, toHex } from "@cosmjs/encoding";
import { zeroPad } from "ethers/lib/utils.js";
import assert from "assert";
import { Deployer } from ".";

export type TerraHost = {
  URL: string;
  chainID: string;
  name: string;
};

export class TerraDeployer implements Deployer {
  wallet: Wallet;
  feeDenoms: [string];

  constructor(wallet: Wallet) {
    this.wallet = wallet;
    this.feeDenoms = ["uluna"];
  }

  private async signAndBroadcastMsg(msg: Msg): Promise<WaitTxBroadcastResult> {
    const tx = await this.wallet.createAndSignTx({
      msgs: [msg],
      feeDenoms: this.feeDenoms,
    });
    const res = await this.wallet.lcd.tx.broadcast(tx);

    if (isTxError(res)) {
      console.error(`Transaction failed: ${res.raw_log}`);
    } else {
      console.log(
        `Broadcasted transaction hash: ${JSON.stringify(res.txhash)}`
      );
    }

    return res;
  }

  async deployArtifact(artifact: string): Promise<number> {
    const contract_bytes = readFileSync(artifact);
    console.log(`Storing WASM: ${artifact} (${contract_bytes.length} bytes)`);

    const store_code = new MsgStoreCode(
      this.wallet.key.accAddress,
      contract_bytes.toString("base64")
    );

    const rs = await this.signAndBroadcastMsg(store_code);

    var codeId: number;
    try {
      const ci = /"code_id","value":"([^"]+)/gm.exec(rs.raw_log)![1];
      codeId = parseInt(ci);
    } catch (e) {
      console.error(
        "Encountered an error in parsing deploy code result. Printing raw log"
      );
      console.error(rs.raw_log);
      throw e;
    }

    return codeId;
  }

  async instantiate(
    codeId: number,
    inst_msg: string | object,
    label: string
  ): Promise<string> {
    const instMsg = new MsgInstantiateContract(
      this.wallet.key.accAddress,
      this.wallet.key.accAddress,
      codeId,
      inst_msg,
      undefined,
      label
    );
    const rs = await this.signAndBroadcastMsg(instMsg);

    var address: string = "";

    try {
      address = /"_contract_address","value":"([^"]+)/gm.exec(rs.raw_log)![1];
    } catch (e) {
      console.error(
        "Encountered an error in parsing instantiation result. Printing raw log"
      );
      console.error(rs.raw_log);
      throw e;
    }

    console.log(
      `Instantiated Pyth at ${address} (${convert_terra_address_to_hex(
        address
      )})`
    );
    return address;
  }

  async migrate(contract: string, codeId: number): Promise<void> {
    const migrateMsg = new MsgMigrateContract(
      this.wallet.key.accAddress,
      contract,
      codeId,
      {
        action: "",
      }
    );

    const rs = await this.signAndBroadcastMsg(migrateMsg);

    try {
      let resultCodeId = parseInt(
        /"code_id","value":"([^"]+)/gm.exec(rs.raw_log)![1]
      );
      assert.strictEqual(codeId, resultCodeId);
    } catch (e) {
      console.error(
        "Encountered an error in parsing migration result. Printing raw log"
      );
      console.error(rs.raw_log);
      throw e;
    }
  }

  static fromHostAndMnemonic(host: TerraHost, mnemonic: string) {
    const lcd = new LCDClient(host);
    const wallet = lcd.wallet(
      new MnemonicKey({
        mnemonic,
      })
    );

    return new TerraDeployer(wallet);
  }
}

// Terra addresses are "human-readable", but for cross-chain registrations, we
// want the "canonical" version
function convert_terra_address_to_hex(human_addr: string) {
  return "0x" + toHex(zeroPad(Bech32.decode(human_addr).data, 32));
}
