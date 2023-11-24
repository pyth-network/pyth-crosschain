import { Contract, PriceFeed, PrivateKey, TxResult } from "../base";
import { ApiError, AptosAccount, BCS, TxnBuilderTypes } from "aptos";
import { connect, KeyPair, keyStores, Contract } from "near-api-js";
import { DataSource } from "xc_admin_common";

export class NearContract extends Contract {
  static type = "NearContract";

  /**
   * Given the ids of the pyth state and wormhole state, create a new NearContract
   * The package ids are derived based on the state ids
   *
   * @param chain the chain which this contract is deployed on
   * @param stateId id of the pyth state for the deployed contract
   * @param wormholeStateId id of the wormhole state for the wormhole contract that pyth binds to
   */
  constructor(
    public chain: NearChain,
    public stateId: string,
    public wormholeStateId: string
  ) {
    super();
  }

  static fromJson(
    chain: Chain,
    parsed: { type: string; stateId: string; wormholeStateId: string }
  ): NearContract {
    if (parsed.type !== NearContract.type) throw new Error("Invalid type");
    if (!(chain instanceof NearChain))
      throw new Error(`Wrong chain type ${chain}`);
    return new NearContract(chain, parsed.stateId, parsed.wormholeStateId);
  }

  // TODO: Where should I implement the wallet details?
  async executeGovernanceInstruction(
    senderPrivateKey: PrivateKey,
    vaa: Buffer
  ) {
    // VAA as Hex-Encoded String
    const hex = vaa.toString("hex");

    const conn = await connect({
      networkId: "testnet",
      keyStore: new keyStores.InMemoryKeyStore(),
      nodeUrl: "https://rpc.testnet.near.org",
    });

    const account = conn.account();
    const contract = new Contract(
      account,
      "pyth.testnet",
      { changeMethods: ["execute_governance_instruction"] }
    );
    
     return await contract.execute_governance_instruction({
      gas: "300000000000000",
      args: { vaa: hex },
      amount: "0",
    );
  }

  getChain(): NearChain {
    return this.chain;
  }

  toJson() {
    return {
      chain: this.chain.getId(),
      stateId: this.stateId,
      wormholeStateId: this.wormholeStateId,
      type: NearContract.type,
    };
  }
}
