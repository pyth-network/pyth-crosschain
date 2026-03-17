import assert from "node:assert";
import { readFileSync } from "node:fs";
import { wasmTypes } from "@cosmjs/cosmwasm-stargate";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import type { DeliverTxResponse } from "@cosmjs/stargate";
import { calculateFee } from "@cosmjs/stargate";
import { estimateOsmoFee } from "@osmonauts/utils";
import Long from "long";
import { cosmwasm, getSigningOsmosisClient } from "osmojs";
import type { ContractInfo, Deployer } from "./index.js";
import { extractFromRawLog } from "./terra.js";

export type OsmosisHost = {
  endpoint: string;
};

export class OsmosisDeployer implements Deployer {
  constructor(
    private endpoint: string,
    private mnemonic: string,
  ) {}

  private async getAccountAddress(): Promise<string> {
    const signer = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic);
    const accountData = await signer.getAccounts();
    return accountData[0]?.address ?? "";
  }

  private async signAndBroadcast(
    msg: EncodeObject,
  ): Promise<DeliverTxResponse> {
    const signer = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic);

    const client = await getSigningOsmosisClient({
      defaultTypes: wasmTypes,
      rpcEndpoint: this.endpoint,
      signer,
    });

    const address = await this.getAccountAddress();
    const { gas } = await estimateOsmoFee(
      client,
      address,
      [msg],
      "estimate fee",
    );

    // libraries output more gas than simulated by multiplying with a constant
    // osmojs multiplies by 1.3
    // which seems to be not enough
    // hence again multiplying by 1.3
    const fee = calculateFee(
      Number.parseInt((Number.parseInt(gas) * 1.3).toFixed(0)),
      "0.025uosmo",
    );

    const rs = await client.signAndBroadcast(address, [msg], fee);

    if (rs.code !== 0) {
    } else {
    }

    client.disconnect();

    return rs;
  }

  async deployArtifact(artifact: string): Promise<number> {
    const contract_bytes = readFileSync(artifact);

    const storeCode = cosmwasm.wasm.v1.MessageComposer.withTypeUrl.storeCode({
      sender: await this.getAccountAddress(),
      wasmByteCode: contract_bytes,
    });

    const rs = await this.signAndBroadcast(storeCode);
    if (rs.rawLog === undefined)
      throw new Error("error parsing raw logs: rawLog undefined");

    var codeId: number;
    // {"key":"code_id","value":"14"}
    const ci = extractFromRawLog(rs.rawLog, "code_id");
    codeId = Number.parseInt(ci);

    return codeId;
  }

  async instantiate(
    codeId: number,
    inst_msg: string | object,
    label: string,
  ): Promise<string> {
    const accAddress = await this.getAccountAddress();
    const instMsg =
      cosmwasm.wasm.v1.MessageComposer.withTypeUrl.instantiateContract({
        admin: accAddress,
        // FIXME: soon this file will be removed
        // not spending any time on this bug
        // @ts-ignore
        codeId: Long.fromNumber(codeId),
        funds: [],
        label,
        msg: Buffer.from(JSON.stringify(inst_msg)),
        sender: accAddress,
      });

    const rs = await this.signAndBroadcast(instMsg);
    if (rs.rawLog === undefined)
      throw new Error("error parsing raw logs: rawLog undefined");

    var address = "";
    // {"key":"_contract_address","value":"terra1xxx3ps3gm3wceg4g300hvggdv7ga0hmsk64srccffmfy4wvcrugqnlvt8w"}
    address = extractFromRawLog(rs.rawLog, "_contract_address");
    return address;
  }

  async migrate(contract: string, codeId: number): Promise<void> {
    const migrateMsg =
      cosmwasm.wasm.v1.MessageComposer.withTypeUrl.migrateContract({
        // @ts-ignore
        codeId: Long.fromNumber(codeId),
        contract,
        msg: Buffer.from(
          JSON.stringify({
            action: "",
          }),
        ),
        sender: await this.getAccountAddress(),
      });

    const rs = await this.signAndBroadcast(migrateMsg);
    if (rs.rawLog === undefined)
      throw new Error("error parsing raw logs: rawLog undefined");
    // {"key":"code_id","value":"13"}
    const resultCodeId = Number.parseInt(
      extractFromRawLog(rs.rawLog, "code_id"),
    );
    assert.strictEqual(codeId, resultCodeId);
  }

  async updateAdmin(newAdmin: string, contract: string): Promise<void> {
    const currAdmin = await this.getAccountAddress();
    const updateAdminMsg =
      cosmwasm.wasm.v1.MessageComposer.withTypeUrl.updateAdmin({
        contract,
        newAdmin,
        sender: currAdmin,
      });

    const rs = await this.signAndBroadcast(updateAdminMsg);
    if (rs.rawLog === undefined)
      throw new Error("error parsing raw logs: rawLog undefined");
  }

  async getContractInfo(contract: string): Promise<ContractInfo> {
    const { createRPCQueryClient } = cosmwasm.ClientFactory;
    const client = await createRPCQueryClient({ rpcEndpoint: this.endpoint });
    const { address, contractInfo } =
      await client.cosmwasm.wasm.v1.contractInfo({ address: contract });

    if (contractInfo === undefined)
      throw new Error("error fetching contract info");

    const { codeId, creator, admin } = contractInfo;

    return {
      address: address,
      admin: admin,
      codeId: Number(codeId),
      creator: creator,
      initMsg: undefined,
    };
  }

  static fromHostAndMnemonic(host: OsmosisHost, mnemonic: string) {
    return new OsmosisDeployer(host.endpoint, mnemonic);
  }
}
