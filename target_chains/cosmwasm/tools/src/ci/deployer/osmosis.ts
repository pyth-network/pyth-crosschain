import { getSigningOsmosisClient, cosmwasm } from "osmojs";
import { estimateOsmoFee } from "@osmonauts/utils";
import { readFileSync } from "fs";
import { DeliverTxResponse, calculateFee } from "@cosmjs/stargate";
import { wasmTypes } from "@cosmjs/cosmwasm-stargate/build/modules/wasm/messages";
import assert from "assert";

import { ContractInfo, Deployer } from ".";
import { convert_terra_address_to_hex, extractFromRawLog } from "./terra";
import { EncodeObject, DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import Long from "long";

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
    return accountData[0].address;
  }

  private async signAndBroadcast(
    msg: EncodeObject,
  ): Promise<DeliverTxResponse> {
    const signer = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic);

    const client = await getSigningOsmosisClient({
      rpcEndpoint: this.endpoint,
      signer,
      defaultTypes: wasmTypes,
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
      parseInt((parseInt(gas) * 1.3).toFixed()),
      "0.025uosmo",
    );

    const rs = await client.signAndBroadcast(address, [msg], fee);

    if (rs.code !== 0) {
      console.error(`Transaction failed: ${rs.events}`);
    } else {
      console.log(
        `Broadcasted transaction hash: ${JSON.stringify(rs.transactionHash)}`,
      );
    }

    client.disconnect();

    return rs;
  }

  async deployArtifact(artifact: string): Promise<number> {
    const contract_bytes = readFileSync(artifact);
    console.log(`Storing WASM: ${artifact} (${contract_bytes.length} bytes)`);

    const storeCode = cosmwasm.wasm.v1.MessageComposer.withTypeUrl.storeCode({
      sender: await this.getAccountAddress(),
      wasmByteCode: contract_bytes,
    });

    const rs = await this.signAndBroadcast(storeCode);
    if (rs.rawLog === undefined)
      throw new Error("error parsing raw logs: rawLog undefined");

    var codeId: number;
    try {
      // {"key":"code_id","value":"14"}
      const ci = extractFromRawLog(rs.rawLog, "code_id");
      codeId = parseInt(ci);
    } catch (e) {
      console.error(
        "Encountered an error in parsing deploy code result. Printing raw log",
      );
      console.error(rs.rawLog);
      throw e;
    }

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
        sender: accAddress,
        admin: accAddress,
        // FIXME: soon this file will be removed
        // not spending any time on this bug
        // @ts-ignore
        codeId: Long.fromNumber(codeId),
        label,
        msg: Buffer.from(JSON.stringify(inst_msg)),
        funds: [],
      });

    const rs = await this.signAndBroadcast(instMsg);
    if (rs.rawLog === undefined)
      throw new Error("error parsing raw logs: rawLog undefined");

    var address: string = "";
    try {
      // {"key":"_contract_address","value":"terra1xxx3ps3gm3wceg4g300hvggdv7ga0hmsk64srccffmfy4wvcrugqnlvt8w"}
      address = extractFromRawLog(rs.rawLog, "_contract_address");
    } catch (e) {
      console.error(
        "Encountered an error in parsing instantiation result. Printing raw log",
      );
      console.error(rs.rawLog);
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
    const migrateMsg =
      cosmwasm.wasm.v1.MessageComposer.withTypeUrl.migrateContract({
        sender: await this.getAccountAddress(),
        contract,
        // @ts-ignore
        codeId: Long.fromNumber(codeId),
        msg: Buffer.from(
          JSON.stringify({
            action: "",
          }),
        ),
      });

    const rs = await this.signAndBroadcast(migrateMsg);
    if (rs.rawLog === undefined)
      throw new Error("error parsing raw logs: rawLog undefined");

    try {
      // {"key":"code_id","value":"13"}
      let resultCodeId = parseInt(extractFromRawLog(rs.rawLog, "code_id"));
      assert.strictEqual(codeId, resultCodeId);
    } catch (e) {
      console.error(
        "Encountered an error in parsing migration result. Printing raw log",
      );
      console.error(rs.rawLog);
      throw e;
    }
  }

  async updateAdmin(newAdmin: string, contract: string): Promise<void> {
    const currAdmin = await this.getAccountAddress();
    const updateAdminMsg =
      cosmwasm.wasm.v1.MessageComposer.withTypeUrl.updateAdmin({
        sender: currAdmin,
        newAdmin,
        contract,
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
      codeId: Number(codeId),
      address: address,
      creator: creator,
      admin: admin,
      initMsg: undefined,
    };
  }

  static fromHostAndMnemonic(host: OsmosisHost, mnemonic: string) {
    return new OsmosisDeployer(host.endpoint, mnemonic);
  }
}
