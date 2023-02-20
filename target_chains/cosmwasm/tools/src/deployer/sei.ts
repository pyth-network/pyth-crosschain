import { ContractInfo, Deployer } from ".";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { SigningStargateClient, GasPrice } from "@cosmjs/stargate";
import { cosmwasm } from "@sei-js/proto";
import { readFileSync } from "fs";
import { EncodeObject } from "@cosmjs/proto-signing";
import { DeliverTxResponse, calculateFee } from "@cosmjs/stargate";
import { convert_terra_address_to_hex, extractFromRawLog } from "./terra";
import { Long } from "@osmonauts/helpers";
import assert from "assert";

export type SeiHost = {
  endpoint: string;
};

export class SeiDeployer implements Deployer {
  constructor(private endpoint: string, private mnemonic: string) {}

  private async getAccountAddress(): Promise<string> {
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic);
    const accounts = await wallet.getAccounts();
    console.log(accounts[0].address);
    return accounts[0].address;
  }

  private async signAndBroadcast(
    msg: EncodeObject
  ): Promise<DeliverTxResponse> {
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic);
    const client = await SigningStargateClient.connectWithSigner(
      this.endpoint,
      wallet
    );
    const address = await this.getAccountAddress();

    const gasPrice = GasPrice.fromString("0.025uosmo");
    const gasEstimation = await client.simulate(address, [msg], "estimate fee");
    const fee = calculateFee(Math.round(gasEstimation * 1.5), gasPrice);

    const rs = await client.signAndBroadcast(address, [msg], fee);

    if (rs.code !== 0) {
      console.error(`Transaction failed: ${rs.rawLog}`);
    } else {
      console.log(
        `Broadcasted transaction hash: ${JSON.stringify(rs.transactionHash)}`
      );
    }

    client.disconnect();

    return rs;
  }

  async deployArtifact(artifact: string): Promise<number> {
    const contract_bytes = readFileSync(artifact);
    console.log(`Storing WASM: ${artifact} (${contract_bytes.length} bytes)`);
    // @ts-ignore
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
        "Encountered an error in parsing deploy code result. Printing raw log"
      );
      console.error(rs.rawLog);
      throw e;
    }

    return codeId;
  }
  async instantiate(
    codeId: number,
    inst_msg: string | object,
    label: string
  ): Promise<string> {
    const accAddress = await this.getAccountAddress();
    const instMsg =
      cosmwasm.wasm.v1.MessageComposer.withTypeUrl.instantiateContract({
        sender: accAddress,
        admin: accAddress,
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
        "Encountered an error in parsing instantiation result. Printing raw log"
      );
      console.error(rs.rawLog);
      throw e;
    }

    console.log(
      `Instantiated ${label} at ${address} (${convert_terra_address_to_hex(
        address
      )})`
    );
    return address;
  }
  async migrate(contract: string, codeId: number): Promise<void> {
    const migrateMsg =
      cosmwasm.wasm.v1.MessageComposer.withTypeUrl.migrateContract({
        sender: await this.getAccountAddress(),
        contract,
        codeId: Long.fromNumber(codeId),
        msg: Buffer.from(
          JSON.stringify({
            action: "",
          })
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
        "Encountered an error in parsing migration result. Printing raw log"
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
      codeId: codeId.toNumber(),
      address: address,
      creator: creator,
      admin: admin,
      initMsg: undefined,
    };
  }

  static fromHostAndMnemonic({ endpoint }: SeiHost, mnemonic: string) {
    return new SeiDeployer(endpoint, mnemonic);
  }
}
