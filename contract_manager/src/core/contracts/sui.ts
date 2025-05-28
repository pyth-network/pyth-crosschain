import { Chain, SuiChain } from "../chains";
import { DataSource } from "@pythnetwork/xc-admin-common";
import { WormholeContract } from "./wormhole";
import { PriceFeedContract, PrivateKey, TxResult } from "../base";
import { SuiPythClient } from "@pythnetwork/pyth-sui-js";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { uint8ArrayToBCS } from "@certusone/wormhole-sdk/lib/cjs/sui";

type ObjectId = string;

export class SuiPriceFeedContract extends PriceFeedContract {
  static type = "SuiPriceFeedContract";
  private client: SuiPythClient;

  /**
   * Given the ids of the pyth state and wormhole state, create a new SuiPriceFeedContract
   * The package ids are derived based on the state ids
   *
   * @param chain the chain which this contract is deployed on
   * @param stateId id of the pyth state for the deployed contract
   * @param wormholeStateId id of the wormhole state for the wormhole contract that pyth binds to
   */
  constructor(
    public chain: SuiChain,
    public stateId: string,
    public wormholeStateId: string,
  ) {
    super();
    this.client = new SuiPythClient(
      this.getProvider(),
      this.stateId,
      this.wormholeStateId,
    );
  }

  static fromJson(
    chain: Chain,
    parsed: { type: string; stateId: string; wormholeStateId: string },
  ): SuiPriceFeedContract {
    if (parsed.type !== SuiPriceFeedContract.type)
      throw new Error("Invalid type");
    if (!(chain instanceof SuiChain))
      throw new Error(`Wrong chain type ${chain}`);
    return new SuiPriceFeedContract(
      chain,
      parsed.stateId,
      parsed.wormholeStateId,
    );
  }

  getType(): string {
    return SuiPriceFeedContract.type;
  }

  getChain(): SuiChain {
    return this.chain;
  }

  toJson() {
    return {
      chain: this.chain.getId(),
      stateId: this.stateId,
      wormholeStateId: this.wormholeStateId,
      type: SuiPriceFeedContract.type,
    };
  }

  /**
   * Given a objectId, returns the id for the package that the object belongs to.
   * @param objectId
   */
  async getPackageId(objectId: ObjectId): Promise<ObjectId> {
    return this.client.getPackageId(objectId);
  }

  async getPythPackageId(): Promise<ObjectId> {
    return await this.getPackageId(this.stateId);
  }

  async getWormholePackageId(): Promise<ObjectId> {
    return await this.getPackageId(this.wormholeStateId);
  }

  getId(): string {
    return `${this.chain.getId()}_${this.stateId}`;
  }

  private async parsePrice(priceInfo: {
    type: string;
    fields: {
      expo: { fields: { magnitude: string; negative: boolean } };
      price: { fields: { magnitude: string; negative: boolean } };
      conf: string;
      timestamp: string;
    };
  }) {
    let expo = priceInfo.fields.expo.fields.magnitude;
    if (priceInfo.fields.expo.fields.negative) expo = "-" + expo;
    let price = priceInfo.fields.price.fields.magnitude;
    if (priceInfo.fields.price.fields.negative) price = "-" + price;
    return {
      conf: priceInfo.fields.conf,
      publishTime: priceInfo.fields.timestamp,
      expo,
      price,
    };
  }

  async getPriceFeed(feedId: string) {
    const provider = this.getProvider();
    const priceInfoObjectId = await this.client.getPriceFeedObjectId(feedId);
    if (!priceInfoObjectId) return undefined;
    const priceInfo = await provider.getObject({
      id: priceInfoObjectId,
      options: { showContent: true },
    });
    if (!priceInfo.data || !priceInfo.data.content) {
      throw new Error(
        `Price feed ID ${priceInfoObjectId} in price table but object not found!!`,
      );
    }
    if (priceInfo.data.content.dataType !== "moveObject") {
      throw new Error(
        `Expected ${priceInfoObjectId} to be a moveObject (PriceInfoObject)`,
      );
    }
    return {
      emaPrice: await this.parsePrice(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        priceInfo.data.content.fields.price_info.fields.price_feed.fields
          .ema_price,
      ),
      price: await this.parsePrice(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        priceInfo.data.content.fields.price_info.fields.price_feed.fields.price,
      ),
    };
  }

  /**
   * Given a signed VAA, execute the migration instruction on the pyth contract.
   * The payload of the VAA can be obtained from the `getUpgradePackagePayload` method.
   * @param vaa
   * @param keypair used to sign the transaction
   */
  async executeMigrateInstruction(vaa: Buffer, keypair: Ed25519Keypair) {
    const tx = new Transaction();
    const packageId = await this.getPythPackageId();
    const verificationReceipt = await this.getVaaVerificationReceipt(
      tx,
      packageId,
      vaa,
    );

    tx.moveCall({
      target: `${packageId}::migrate::migrate`,
      arguments: [tx.object(this.stateId), verificationReceipt],
    });

    return this.executeTransaction(tx, keypair);
  }

  async executeUpdatePriceFeed(): Promise<TxResult> {
    // We need the feed ids to be able to execute the transaction
    // it may be possible to get them from the VAA but in batch transactions,
    // it is also possible to hava fewer feeds that user wants to update compared to
    // what exists in the VAA.
    throw new Error("Use executeUpdatePriceFeedWithFeeds instead");
  }

  async executeUpdatePriceFeedWithFeeds(
    senderPrivateKey: string,
    vaas: Buffer[],
    feedIds: string[],
  ): Promise<TxResult> {
    const tx = new Transaction();
    await this.client.updatePriceFeeds(tx, vaas, feedIds);
    const keypair = Ed25519Keypair.fromSecretKey(
      new Uint8Array(Buffer.from(senderPrivateKey, "hex")),
    );
    const result = await this.executeTransaction(tx, keypair);
    return { id: result.digest, info: result };
  }
  async executeCreatePriceFeed(
    senderPrivateKey: string,
    vaas: Buffer[],
  ): Promise<TxResult> {
    const tx = new Transaction();
    await this.client.createPriceFeed(tx, vaas);
    const keypair = Ed25519Keypair.fromSecretKey(
      new Uint8Array(Buffer.from(senderPrivateKey, "hex")),
    );

    const result = await this.executeTransaction(tx, keypair);
    return { id: result.digest, info: result };
  }

  async executeGovernanceInstruction(
    senderPrivateKey: PrivateKey,
    vaa: Buffer,
  ): Promise<TxResult> {
    const keypair = Ed25519Keypair.fromSecretKey(
      new Uint8Array(Buffer.from(senderPrivateKey, "hex")),
    );
    const tx = new Transaction();
    const packageId = await this.getPythPackageId();
    const verificationReceipt = await this.getVaaVerificationReceipt(
      tx,
      packageId,
      vaa,
    );

    tx.moveCall({
      target: `${packageId}::governance::execute_governance_instruction`,
      arguments: [tx.object(this.stateId), verificationReceipt],
    });

    const result = await this.executeTransaction(tx, keypair);
    return { id: result.digest, info: result };
  }

  async executeUpgradeInstruction(
    vaa: Buffer,
    keypair: Ed25519Keypair,
    modules: number[][],
    dependencies: string[],
  ) {
    const tx = new Transaction();
    const packageId = await this.getPythPackageId();
    const verificationReceipt = await this.getVaaVerificationReceipt(
      tx,
      packageId,
      vaa,
    );

    const [upgradeTicket] = tx.moveCall({
      target: `${packageId}::contract_upgrade::authorize_upgrade`,
      arguments: [tx.object(this.stateId), verificationReceipt],
    });

    const [upgradeReceipt] = tx.upgrade({
      modules,
      dependencies,
      package: packageId,
      ticket: upgradeTicket,
    });

    tx.moveCall({
      target: `${packageId}::contract_upgrade::commit_upgrade`,
      arguments: [tx.object(this.stateId), upgradeReceipt],
    });
    const result = await this.executeTransaction(tx, keypair);
    return { id: result.digest, info: result };
  }

  /**
   * Utility function to get the verification receipt object for a VAA that can be
   * used to authorize a governance instruction.
   * @param tx
   * @param packageId pyth package id
   * @param vaa
   * @private
   */
  async getVaaVerificationReceipt(
    tx: Transaction,
    packageId: string,
    vaa: Buffer,
  ) {
    const wormholePackageId = await this.getWormholePackageId();

    const [verifiedVAA] = tx.moveCall({
      target: `${wormholePackageId}::vaa::parse_and_verify`,
      arguments: [
        tx.object(this.wormholeStateId),
        tx.pure.arguments(Array.from(vaa)),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    const [verificationReceipt] = tx.moveCall({
      target: `${packageId}::governance::verify_vaa`,
      arguments: [tx.object(this.stateId), verifiedVAA],
    });
    return verificationReceipt;
  }

  /**
   * Given a transaction block and a keypair, sign and execute it
   * Sets the gas budget to 2x the estimated gas cost
   * @param tx
   * @param keypair
   * @private
   */
  private async executeTransaction(tx: Transaction, keypair: Ed25519Keypair) {
    const provider = this.getProvider();
    tx.setSender(keypair.toSuiAddress());
    const dryRun = await provider.dryRunTransactionBlock({
      transactionBlock: await tx.build({ client: provider }),
    });
    tx.setGasBudget(BigInt(dryRun.input.gasData.budget.toString()) * BigInt(2));
    return provider.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });
  }

  async getValidTimePeriod() {
    const fields = await this.getStateFields();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return Number(fields.stale_price_threshold);
  }

  async getDataSources(): Promise<DataSource[]> {
    const provider = this.getProvider();
    const result = await provider.getDynamicFieldObject({
      parentId: this.stateId,
      name: {
        type: "vector<u8>",
        value: "data_sources",
      },
    });
    if (!result.data || !result.data.content) {
      throw new Error(
        "Data Sources not found, contract may not be initialized",
      );
    }
    if (result.data.content.dataType !== "moveObject") {
      throw new Error("Data Sources type mismatch");
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return result.data.content.fields.value.fields.keys.map(
      ({
        fields,
      }: {
        fields: {
          emitter_address: { fields: { value: { fields: { data: string } } } };
          emitter_chain: string;
        };
      }) => {
        return {
          emitterChain: Number(fields.emitter_chain),
          emitterAddress: Buffer.from(
            fields.emitter_address.fields.value.fields.data,
          ).toString("hex"),
        };
      },
    );
  }

  async getGovernanceDataSource(): Promise<DataSource> {
    const fields = await this.getStateFields();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const governanceFields = fields.governance_data_source.fields;
    const chainId = governanceFields.emitter_chain;
    const emitterAddress =
      governanceFields.emitter_address.fields.value.fields.data;
    return {
      emitterChain: Number(chainId),
      emitterAddress: Buffer.from(emitterAddress).toString("hex"),
    };
  }

  async getBaseUpdateFee() {
    const fields = await this.getStateFields();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return { amount: fields.base_update_fee };
  }

  async getLastExecutedGovernanceSequence() {
    const fields = await this.getStateFields();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return Number(fields.last_executed_governance_sequence);
  }

  getProvider() {
    return this.chain.getProvider();
  }

  private async getStateFields() {
    const provider = this.getProvider();
    const result = await provider.getObject({
      id: this.stateId,
      options: { showContent: true },
    });
    if (
      !result.data ||
      !result.data.content ||
      result.data.content.dataType !== "moveObject"
    )
      throw new Error("Unable to fetch pyth state object");
    return result.data.content.fields;
  }
}

export class SuiWormholeContract extends WormholeContract {
  public static type = "SuiWormholeContract";
  private client: SuiPythClient;

  getId(): string {
    return `${this.chain.getId()}_${this.stateId}`;
  }

  getType(): string {
    return SuiWormholeContract.type;
  }

  toJson() {
    return {
      chain: this.chain.getId(),
      stateId: this.stateId,
      type: SuiWormholeContract.type,
    };
  }

  static fromJson(
    chain: Chain,
    parsed: {
      type: string;
      stateId: string;
    },
  ): SuiWormholeContract {
    if (parsed.type !== SuiWormholeContract.type)
      throw new Error("Invalid type");
    if (!(chain instanceof SuiChain))
      throw new Error(`Wrong chain type ${chain}`);
    return new SuiWormholeContract(chain, parsed.stateId);
  }

  constructor(
    public chain: SuiChain,
    public stateId: string,
  ) {
    super();
    this.client = new SuiPythClient(
      this.chain.getProvider(),
      // HACK:
      // We're using the SuiPythClient to work with the Wormhole contract
      // so there is no Pyth contract here, passing empty string to type-
      // check.
      "",
      this.stateId,
    );
  }

  async getCurrentGuardianSetIndex(): Promise<number> {
    const data = await this.getStateFields();
    return Number(data.guardian_set_index);
  }

  // There doesn't seem to be a way to get a value out of any function call
  // via a Sui transaction due to the linear nature of the language, this is
  // enforced at the TransactionBlock level by only allowing you to receive
  // receipts.
  async getChainId(): Promise<number> {
    return this.chain.getWormholeChainId();
  }

  // NOTE: There's no way to getChain() on the main interface, should update
  // that interface.
  public getChain(): SuiChain {
    return this.chain;
  }

  async getGuardianSet(): Promise<string[]> {
    const data = await this.getStateFields();
    const guardian_sets = data.guardian_sets;
    return guardian_sets;
  }

  async upgradeGuardianSets(
    senderPrivateKey: PrivateKey,
    vaa: Buffer,
  ): Promise<TxResult> {
    const tx = new Transaction();
    const coreObjectId = this.stateId;
    const corePackageId = await this.client.getWormholePackageId();
    const [verifiedVaa] = tx.moveCall({
      target: `${corePackageId}::vaa::parse_and_verify`,
      arguments: [
        tx.object(coreObjectId),
        tx.pure(uint8ArrayToBCS(new Uint8Array(vaa))),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    const [decreeTicket] = tx.moveCall({
      target: `${corePackageId}::update_guardian_set::authorize_governance`,
      arguments: [tx.object(coreObjectId)],
    });

    const [decreeReceipt] = tx.moveCall({
      target: `${corePackageId}::governance_message::verify_vaa`,
      arguments: [tx.object(coreObjectId), verifiedVaa, decreeTicket],
      typeArguments: [
        `${corePackageId}::update_guardian_set::GovernanceWitness`,
      ],
    });

    tx.moveCall({
      target: `${corePackageId}::update_guardian_set::update_guardian_set`,
      arguments: [
        tx.object(coreObjectId),
        decreeReceipt,
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    const keypair = Ed25519Keypair.fromSecretKey(
      new Uint8Array(Buffer.from(senderPrivateKey, "hex")),
    );
    const result = await this.executeTransaction(tx, keypair);
    return { id: result.digest, info: result };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getStateFields(): Promise<any> {
    const provider = this.chain.getProvider();
    const result = await provider.getObject({
      id: this.stateId,
      options: { showContent: true },
    });
    if (
      !result.data ||
      !result.data.content ||
      result.data.content.dataType !== "moveObject"
    )
      throw new Error("Unable to fetch pyth state object");
    return result.data.content.fields;
  }

  /**
   * Given a transaction block and a keypair, sign and execute it
   * Sets the gas budget to 2x the estimated gas cost
   * @param tx
   * @param keypair
   * @private
   */
  private async executeTransaction(tx: Transaction, keypair: Ed25519Keypair) {
    const provider = this.chain.getProvider();
    tx.setSender(keypair.toSuiAddress());
    const dryRun = await provider.dryRunTransactionBlock({
      transactionBlock: await tx.build({ client: provider }),
    });
    tx.setGasBudget(BigInt(dryRun.input.gasData.budget.toString()) * BigInt(2));
    return provider.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });
  }
}
