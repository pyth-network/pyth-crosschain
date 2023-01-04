import {
  MsgInstantiateContract,
  MsgMigrateContract,
  MsgStoreCode,
  Wallet,
} from "@terra-money/terra.js";
import { readFileSync } from "fs";
import { Bech32, toHex } from "@cosmjs/encoding";
import { zeroPad } from "ethers/lib/utils.js";
// @ts-ignore
import assert from "assert";
import { Deployer } from "./deployer";

export class TerraDeployer extends Deployer {
  wallet: Wallet;
  feeDenoms: [string];

  constructor(wallet: Wallet) {
    super();

    this.wallet = wallet;
    this.feeDenoms = ["uluna"];
  }

  async deployArtifact(artifact: string): Promise<number> {
    const contract_bytes = readFileSync(artifact);
    console.log(`Storing WASM: ${artifact} (${contract_bytes.length} bytes)`);

    const store_code = new MsgStoreCode(
      this.wallet.key.accAddress,
      contract_bytes.toString("base64")
    );

    const tx = await this.wallet.createAndSignTx({
      msgs: [store_code],
      feeDenoms: this.feeDenoms,
    });

    const rs = await this.wallet.lcd.tx.broadcast(tx);

    var codeId: number;
    try {
      // @ts-ignore
      const ci = /"code_id","value":"([^"]+)/gm.exec(rs.raw_log)[1];
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
  }

  async migrate(contract: string, codeId: number): Promise<void> {
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
  }
}

// Terra addresses are "human-readable", but for cross-chain registrations, we
// want the "canonical" version
function convert_terra_address_to_hex(human_addr: string) {
  return "0x" + toHex(zeroPad(Bech32.decode(human_addr).data, 32));
}
