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
  MsgInstantiateContract,
  PrivateKey,
  TxGrpcClient,
  TxResponse,
  Msgs,
  MsgMigrateContract,
  createTransactionForAddressAndMsg,
  createFee
} from "@injectivelabs/sdk-ts";
import {
  BigNumberInBase,
  DEFAULT_BLOCK_TIMEOUT_HEIGHT,
} from "@injectivelabs/utils";
import { Deployer } from "./deployer";
import { Tx } from '@injectivelabs/chain-api/cosmos/tx/v1beta1/tx_pb'
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

  // private async getBaseAccount(): Promise<BaseAccount> {
  //   /** Account Details **/
  //   const chainRestAuthApi = new ChainRestAuthApi(
  //     (await getNetworkInfo(this.network)).rest
  //   );
  //   const accountDetailsResponse = await chainRestAuthApi.fetchAccount(
  //     this.injectiveAddress()
  //   );
  //   return BaseAccount.fromRestApi(accountDetailsResponse);
  // }

  // private async getTimeoutHeight(): Promise<BigNumberInBase> {
  //   /** Block Details */
  //   const chainRestTendermintApi = new ChainRestTendermintApi(
  //     (await getNetworkInfo(this.network)).rest
  //   );
  //   const latestBlock = await chainRestTendermintApi.fetchLatestBlock();
  //   const latestHeight = latestBlock.header.height;

  //   return new BigNumberInBase(latestHeight).plus(DEFAULT_BLOCK_TIMEOUT_HEIGHT);
  // }

  private async signAndBroadcastMsg(msg: Msgs | MsgMigrateContract, fee = DEFAULT_STD_FEE): Promise<TxResponse> {
    // const baseAccount = await this.getBaseAccount();
    const networkInfo = getNetworkInfo(this.network);

    const { signBytes, txRaw } = await createTransactionForAddressAndMsg({
      // @ts-ignore
      message: msg,
      address: this.injectiveAddress(),
      endpoint: networkInfo.rest,
      chainId: networkInfo.chainId,
      fee,
      pubKey: this.wallet.toPublicKey().toBase64(),
    })
    // const { signBytes, txRaw } = createTransaction({
    //   pubKey: this.wallet.toPublicKey().toBase64(),
    //   chainId: networkInfo.chainId,
    //   fee: DEFAULT_STD_FEE,
    //   message: msg.toDirectSign(),
    //   sequence: baseAccount.sequence,
    //   timeoutHeight: (await this.getTimeoutHeight()).toNumber(),
    //   accountNumber: baseAccount.accountNumber,
    // });

    const sig = await this.wallet.sign(Buffer.from(signBytes));

    /** Append Signatures */
    txRaw.setSignaturesList([sig]);
    console.log(Tx.deserializeBinary(txRaw.serializeBinary()))

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

    return txResponse
  }

  async deployArtifact(artifact: string): Promise<number> {
    const contract_bytes = readFileSync(artifact);
    console.log(`Storing WASM: ${artifact} (${contract_bytes.length} bytes)`);

    console.log(this.injectiveAddress())
    const store_code = MsgStoreCode.fromJSON({
      sender: this.injectiveAddress(),
      wasmBytes: contract_bytes,
    });


    const txResponse = await this.signAndBroadcastMsg(store_code, {
      amount: [{
        amount: String(500000000 * 5000000),
        denom: 'inj',
      }],
      gas: '5000000'
    })

    var codeId: number;
    try {
      // @ts-ignore //TODO correct this
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
    inst_msg: object,
    label: string
  ): Promise<string> {

    const instantiate_msg = MsgInstantiateContract.fromJSON({
      sender: this.injectiveAddress(),
      admin: this.injectiveAddress(),
      codeId,
      label,
      msg: inst_msg,
    })

    console.log(instantiate_msg)

    const txResponse = await this.signAndBroadcastMsg(instantiate_msg)

    let address: string = ''
    try {
      // @ts-ignore // TODO: fix this
      address = /"contract_address","value":"([^"]+)/gm.exec(txResponse.raw_log)[1];
    } catch (e) {
      console.error(
        "Encountered an error in parsing instantiation result. Printing raw log"
      );
      console.error(txResponse.rawLog);
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

    const migrate_msg = MsgMigrateContract.fromJSON({
      sender: this.injectiveAddress(),
      contract,
      codeId,
      msg: {
        action: "",
      },
    })

    const txResponse = await this.signAndBroadcastMsg(migrate_msg)

    let result_code_id: string = ''
    try {
      // @ts-ignore
      resultCodeId = /"code_id","value":"([^"]+)/gm.exec(rs.raw_log)[1];
      assert.strictEqual(codeId, result_code_id);
    } catch (e) {
      console.error(
        "Encountered an error in parsing migration result. Printing raw log"
      );
      console.error(txResponse.rawLog);
      throw e;
    }
  }
}

// Terra addresses are "human-readable", but for cross-chain registrations, we
// want the "canonical" version
function convert_terra_address_to_hex(human_addr: string) {
  return "0x" + toHex(zeroPad(Bech32.decode(human_addr).data, 32));
}
