import { Chain, FuelChain } from "../chains";
import { WormholeContract } from "./wormhole";
import FuelContractAbi from "../../../target_chains/fuel/contracts/pyth-contract/out/release/pyth-contract-abi.json";
import { Account, Contract, Wallet, arrayify } from "fuels";
import { PrivateKey, TxResult } from "../base";

export class FuelWormholeContract extends WormholeContract {
  static type = "FuelWormholeContract";

  getId(): string {
    return `${this.chain.getId()}_${this.address}`;
  }

  getType(): string {
    return FuelWormholeContract.type;
  }

  toJson() {
    return {
      chain: this.chain.getId(),
      address: this.address,
      type: FuelWormholeContract.type,
    };
  }

  static fromJson(
    chain: Chain,
    parsed: {
      type: string;
      address: string;
    }
  ): FuelWormholeContract {
    if (parsed.type !== FuelWormholeContract.type)
      throw new Error("Invalid type");
    if (!(chain instanceof FuelChain))
      throw new Error(`Wrong chain type ${chain}`);
    return new FuelWormholeContract(chain, parsed.address);
  }

  constructor(public chain: FuelChain, public address: string) {
    super();
  }

  async getContract(wallet?: Wallet): Promise<Contract> {
    const provider = await this.chain.getProvider();

    return new Contract(
      this.address,
      FuelContractAbi,
      wallet ? (wallet as Account) : provider
    );
  }

  async getCurrentGuardianSetIndex(): Promise<number> {
    const contract = await this.getContract();
    const guardianSetIndex = (
      await contract.functions.current_guardian_set_index().get()
    ).value;
    return guardianSetIndex;
  }

  async getChainId(): Promise<number> {
    const contract = await this.getContract();
    const chainId = (await contract.functions.chain_id().get()).value;
    return chainId;
  }

  async getGuardianSet(): Promise<string[]> {
    const contract = await this.getContract();
    const guardianSetIndex = await this.getCurrentGuardianSetIndex();
    console.log("Guardian Set Index:", guardianSetIndex);
    const guardianSet = (
      await contract.functions.guardian_set(guardianSetIndex).get()
    ).value;
    return guardianSet;
  }

  async upgradeGuardianSets(
    senderPrivateKey: PrivateKey,
    vaa: Buffer
  ): Promise<TxResult> {
    const wallet = await this.chain.getWallet(senderPrivateKey);
    const contract = await this.getContract(wallet);
    const tx = await contract.functions
      .submit_new_guardian_set(arrayify(vaa))
      .call(); // you might get `Error updating Guardianset for fuel_testnet_{address} TypeError: response.body.getReader is not a function` but the tx could still be successful, this could be due to fuel-ts bug
    return { id: tx.transactionId, info: tx.transactionResponse };
  }
}
