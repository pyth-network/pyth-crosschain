import {
  LCDClient,
  MnemonicKey,
  Msg,
  MsgInstantiateContract,
  MsgMigrateContract,
  MsgStoreCode,
  MsgUpdateContractAdmin,
  WaitTxBroadcastResult,
  Wallet,
  isTxError,
} from "@terra-money/terra.js";
import { readFileSync } from "fs";
import { fromBech32, toHex } from "@cosmjs/encoding";
import { ethers } from "ethers";
import assert from "assert";
import { ContractInfo, Deployer } from ".";

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
        `Broadcasted transaction hash: ${JSON.stringify(res.txhash)}`,
      );
    }

    return res;
  }

  async deployArtifact(artifact: string): Promise<number> {
    const contract_bytes = readFileSync(artifact);
    console.log(`Storing WASM: ${artifact} (${contract_bytes.length} bytes)`);

    const store_code = new MsgStoreCode(
      this.wallet.key.accAddress,
      contract_bytes.toString("base64"),
    );

    const rs = await this.signAndBroadcastMsg(store_code);

    var codeId: number;
    try {
      // {"key":"code_id","value":"14"}
      const ci = extractFromRawLog(rs.raw_log, "code_id");
      codeId = parseInt(ci);
    } catch (e) {
      console.error(
        "Encountered an error in parsing deploy code result. Printing raw log",
      );
      console.error(rs.raw_log);
      throw e;
    }

    return codeId;
  }

  async instantiate(
    codeId: number,
    inst_msg: string | object,
    label: string,
  ): Promise<string> {
    const instMsg = new MsgInstantiateContract(
      this.wallet.key.accAddress,
      this.wallet.key.accAddress,
      codeId,
      inst_msg,
      undefined,
      label,
    );
    const rs = await this.signAndBroadcastMsg(instMsg);

    var address: string = "";

    try {
      // {"key":"_contract_address","value":"terra1xxx3ps3gm3wceg4g300hvggdv7ga0hmsk64srccffmfy4wvcrugqnlvt8w"}
      address = extractFromRawLog(rs.raw_log, "_contract_address");
    } catch (e) {
      console.error(
        "Encountered an error in parsing instantiation result. Printing raw log",
      );
      console.error(rs.raw_log);
      throw e;
    }

    console.log(
      `Instantiated ${label} at ${address} (${convert_terra_address_to_hex(
        address,
      )})`,
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
      },
    );

    const rs = await this.signAndBroadcastMsg(migrateMsg);
    try {
      // {"key":"code_id","value":"13"}
      let resultCodeId = parseInt(extractFromRawLog(rs.raw_log, "code_id"));
      assert.strictEqual(codeId, resultCodeId);
    } catch (e) {
      console.error(
        "Encountered an error in parsing migration result. Printing raw log",
      );
      console.error(rs.raw_log);
      throw e;
    }
  }

  /**
   * update Admin assumes that the deployer instance is the owner of this contract
   * and may result in error if this isn't the case
   */
  async updateAdmin(newAdmin: string, contract: string): Promise<void> {
    const currAdmin = this.wallet.key.accAddress;
    const updateAdminMsg = new MsgUpdateContractAdmin(
      currAdmin,
      newAdmin,
      contract,
    );

    await this.signAndBroadcastMsg(updateAdminMsg);
  }

  async getContractInfo(contract: string): Promise<ContractInfo> {
    const { code_id, address, creator, admin, init_msg } =
      await this.wallet.lcd.wasm.contractInfo(contract);

    return {
      codeId: code_id,
      address: address ?? contract,
      creator: creator,
      admin: admin,
      initMsg: init_msg,
    };
  }

  static fromHostAndMnemonic(host: TerraHost, mnemonic: string) {
    const lcd = new LCDClient(host);
    const wallet = lcd.wallet(
      new MnemonicKey({
        mnemonic,
      }),
    );

    return new TerraDeployer(wallet);
  }
}

// Terra addresses are "human-readable", but for cross-chain registrations, we
// want the "canonical" version
export function convert_terra_address_to_hex(human_addr: string) {
  return "0x" + toHex(ethers.utils.zeroPad(fromBech32(human_addr).data, 32));
}

// enter key of what to extract
export function extractFromRawLog(rawLog: string, key: string): string {
  const rx = new RegExp(`"${key}","value":"([^"]+)`, "gm");
  return rx.exec(rawLog)![1];
}
