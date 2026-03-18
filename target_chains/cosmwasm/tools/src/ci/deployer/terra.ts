import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fromBech32, toHex } from "@cosmjs/encoding";
import type { Msg, WaitTxBroadcastResult, Wallet } from "@terra-money/terra.js";
import {
  isTxError,
  LCDClient,
  MnemonicKey,
  MsgInstantiateContract,
  MsgMigrateContract,
  MsgStoreCode,
  MsgUpdateContractAdmin,
} from "@terra-money/terra.js";
import { ethers } from "ethers";
import type { ContractInfo, Deployer } from "./index.js";

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
      feeDenoms: this.feeDenoms,
      msgs: [msg],
    });
    const res = await this.wallet.lcd.tx.broadcast(tx);

    if (isTxError(res)) {
    } else {
    }

    return res;
  }

  async deployArtifact(artifact: string): Promise<number> {
    const contract_bytes = readFileSync(artifact);

    const store_code = new MsgStoreCode(
      this.wallet.key.accAddress,
      contract_bytes.toString("base64"),
    );

    const rs = await this.signAndBroadcastMsg(store_code);

    var codeId: number;
    // {"key":"code_id","value":"14"}
    const ci = extractFromRawLog(rs.raw_log, "code_id");
    codeId = Number.parseInt(ci, 10);

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

    var address = "";
    // {"key":"_contract_address","value":"terra1xxx3ps3gm3wceg4g300hvggdv7ga0hmsk64srccffmfy4wvcrugqnlvt8w"}
    address = extractFromRawLog(rs.raw_log, "_contract_address");
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
    // {"key":"code_id","value":"13"}
    const resultCodeId = Number.parseInt(
      extractFromRawLog(rs.raw_log, "code_id"),
      10,
    );
    assert.strictEqual(codeId, resultCodeId);
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
      address: address ?? contract,
      admin: admin,
      codeId: code_id,
      creator: creator,
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
  return `0x${toHex(ethers.utils.zeroPad(fromBech32(human_addr).data, 32))}`;
}

// enter key of what to extract
export function extractFromRawLog(rawLog: string, key: string): string {
  const rx = new RegExp(`"${key}","value":"([^"]+)`, "gm");
  const match = rx.exec(rawLog)?.[1];
  if (!match) {
    throw new Error(`Could not extract ${key} from raw log`);
  }
  return match;
}
