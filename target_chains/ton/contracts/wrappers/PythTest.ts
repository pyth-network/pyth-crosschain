import {
  beginCell,
  Cell,
  contractAddress,
  ContractProvider,
  Sender,
  SendMode,
  toNano,
  Address,
} from "@ton/core";
import { BaseWrapper } from "./BaseWrapper";
import { HexString, Price } from "@pythnetwork/price-service-sdk";
import {
  createCellChain,
  parseDataSource,
  parseDataSources,
} from "@pythnetwork/pyth-ton-js";
import { DataSource } from "@pythnetwork/xc-admin-common";

export type PythTestConfig = {
  priceFeedId: HexString;
  price: Price;
  emaPrice: Price;
  singleUpdateFee: number;
  dataSources: DataSource[];
  guardianSetIndex: number;
  guardianSet: string[];
  chainId: number;
  governanceChainId: number;
  governanceContract: string;
  governanceDataSource?: DataSource;
};

export class PythTest extends BaseWrapper {
  static createFromConfig(config: PythTestConfig, code: Cell, workchain = 0) {
    const data = PythTest.getPythInitData(config);
    const init = { code, data };
    return new PythTest(contractAddress(workchain, init), init);
  }

  static getPythInitData(config: PythTestConfig): Cell {
    return BaseWrapper.createInitData(config);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await super.sendDeploy(provider, via, value);
  }

  async getPriceUnsafe(provider: ContractProvider, priceFeedId: HexString) {
    return await super.getPriceUnsafe(
      provider,
      priceFeedId,
      "test_get_price_unsafe",
    );
  }

  async getPriceNoOlderThan(
    provider: ContractProvider,
    timePeriod: number,
    priceFeedId: HexString,
  ) {
    return await super.getPriceNoOlderThan(
      provider,
      timePeriod,
      priceFeedId,
      "test_get_price_no_older_than",
    );
  }

  async getEmaPriceUnsafe(provider: ContractProvider, priceFeedId: HexString) {
    return await super.getEmaPriceUnsafe(
      provider,
      priceFeedId,
      "test_get_ema_price_unsafe",
    );
  }

  async getEmaPriceNoOlderThan(
    provider: ContractProvider,
    timePeriod: number,
    priceFeedId: HexString,
  ) {
    return await super.getEmaPriceNoOlderThan(
      provider,
      timePeriod,
      priceFeedId,
      "test_get_ema_price_no_older_than",
    );
  }

  async getUpdateFee(provider: ContractProvider, vm: Buffer) {
    return await super.getUpdateFee(provider, vm, "test_get_update_fee");
  }

  async getSingleUpdateFee(provider: ContractProvider) {
    return await super.getSingleUpdateFee(
      provider,
      "test_get_single_update_fee",
    );
  }

  async sendUpdatePriceFeeds(
    provider: ContractProvider,
    via: Sender,
    updateData: Buffer,
    updateFee: bigint,
  ) {
    await super.sendUpdatePriceFeeds(provider, via, updateData, updateFee);
  }

  async sendUpdateGuardianSet(
    provider: ContractProvider,
    via: Sender,
    vm: Buffer,
  ) {
    await super.sendUpdateGuardianSet(provider, via, vm);
  }

  async getChainId(provider: ContractProvider) {
    return await super.getChainId(provider, "test_get_chain_id");
  }

  // Add PythTest-specific methods here
  async getLastExecutedGovernanceSequence(provider: ContractProvider) {
    const result = await provider.get(
      "test_get_last_executed_governance_sequence",
      [],
    );
    return result.stack.readNumber();
  }

  async getGovernanceDataSourceIndex(provider: ContractProvider) {
    const result = await provider.get(
      "test_get_governance_data_source_index",
      [],
    );
    return result.stack.readNumber();
  }

  async getGovernanceDataSource(provider: ContractProvider) {
    const result = await provider.get("test_get_governance_data_source", []);
    return parseDataSource(result.stack.readCell());
  }

  async sendExecuteGovernanceAction(
    provider: ContractProvider,
    via: Sender,
    governanceAction: Buffer,
  ) {
    const messageBody = beginCell()
      .storeUint(3, 32) // OP_EXECUTE_GOVERNANCE_ACTION
      .storeRef(createCellChain(governanceAction))
      .endCell();

    await provider.internal(via, {
      value: toNano("0.1"),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody,
    });
  }

  async sendUpgradeContract(
    provider: ContractProvider,
    via: Sender,
    newCode: Cell,
  ) {
    const messageBody = beginCell()
      .storeUint(4, 32) // OP_UPGRADE_CONTRACT
      .storeRef(newCode)
      .endCell();

    await provider.internal(via, {
      value: toNano("0.1"),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody,
    });
  }

  async getIsValidDataSource(
    provider: ContractProvider,
    dataSource: DataSource,
  ) {
    const result = await provider.get("test_get_is_valid_data_source", [
      {
        type: "cell",
        cell: beginCell()
          .storeUint(dataSource.emitterChain, 16)
          .storeUint(BigInt("0x" + dataSource.emitterAddress), 256)
          .endCell(),
      },
    ]);
    return result.stack.readBoolean();
  }

  async getDataSources(provider: ContractProvider) {
    const result = await provider.get("test_get_data_sources", []);
    return parseDataSources(result.stack.readCell());
  }

  private createPriceFeedMessage(
    op: number,
    updateData: Buffer,
    priceIds: HexString[],
    time1: number,
    time2: number,
    targetAddress: Address,
    customPayload: Buffer,
  ): Cell {
    // Create a buffer for price IDs: 1 byte length + (32 bytes per ID)
    const priceIdsBuffer = Buffer.alloc(1 + priceIds.length * 32);
    priceIdsBuffer.writeUint8(priceIds.length, 0);

    // Write each price ID as a 32-byte value
    priceIds.forEach((id, index) => {
      // Remove '0x' prefix if present and pad to 64 hex chars (32 bytes)
      const hexId = id.replace("0x", "").padStart(64, "0");
      Buffer.from(hexId, "hex").copy(priceIdsBuffer, 1 + index * 32);
    });

    return beginCell()
      .storeUint(op, 32)
      .storeRef(createCellChain(updateData))
      .storeRef(createCellChain(priceIdsBuffer))
      .storeUint(time1, 64)
      .storeUint(time2, 64)
      .storeAddress(targetAddress)
      .storeRef(createCellChain(customPayload))
      .endCell();
  }

  async sendParsePriceFeedUpdates(
    provider: ContractProvider,
    via: Sender,
    updateData: Buffer,
    updateFee: bigint,
    priceIds: HexString[],
    minPublishTime: number,
    maxPublishTime: number,
    targetAddress: Address,
    customPayload: Buffer,
  ) {
    const messageCell = this.createPriceFeedMessage(
      5, // OP_PARSE_PRICE_FEED_UPDATES
      updateData,
      priceIds,
      minPublishTime,
      maxPublishTime,
      targetAddress,
      customPayload,
    );

    await provider.internal(via, {
      value: updateFee,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageCell,
    });
  }

  async sendParseUniquePriceFeedUpdates(
    provider: ContractProvider,
    via: Sender,
    updateData: Buffer,
    updateFee: bigint,
    priceIds: HexString[],
    publishTime: number,
    maxStaleness: number,
    targetAddress: Address,
    customPayload: Buffer,
  ) {
    const messageCell = this.createPriceFeedMessage(
      6, // OP_PARSE_UNIQUE_PRICE_FEED_UPDATES
      updateData,
      priceIds,
      publishTime,
      maxStaleness,
      targetAddress,
      customPayload,
    );

    await provider.internal(via, {
      value: updateFee,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageCell,
    });
  }

  async getNewFunction(provider: ContractProvider) {
    const result = await provider.get("test_new_function", []);
    return result.stack.readNumber();
  }
}
