import {
  beginCell,
  Cell,
  contractAddress,
  ContractProvider,
  Sender,
  SendMode,
  toNano,
} from "@ton/core";
import { BaseWrapper } from "./BaseWrapper";
import { HexString, Price } from "@pythnetwork/price-service-sdk";
import { createCellChain } from "@pythnetwork/pyth-ton-js";
import { DataSource } from "@pythnetwork/xc-admin-common";

export type PythTestConfig = {
  priceFeedId: HexString;
  timePeriod: number;
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
      "test_get_price_unsafe"
    );
  }

  async getPriceNoOlderThan(
    provider: ContractProvider,
    timePeriod: number,
    priceFeedId: HexString
  ) {
    return await super.getPriceNoOlderThan(
      provider,
      timePeriod,
      priceFeedId,
      "test_get_price_no_older_than"
    );
  }

  async getEmaPriceUnsafe(provider: ContractProvider, priceFeedId: HexString) {
    return await super.getEmaPriceUnsafe(
      provider,
      priceFeedId,
      "test_get_ema_price_unsafe"
    );
  }

  async getEmaPriceNoOlderThan(
    provider: ContractProvider,
    timePeriod: number,
    priceFeedId: HexString
  ) {
    return await super.getEmaPriceNoOlderThan(
      provider,
      timePeriod,
      priceFeedId,
      "test_get_ema_price_no_older_than"
    );
  }

  async getUpdateFee(provider: ContractProvider, vm: Buffer) {
    return await super.getUpdateFee(provider, vm, "test_get_update_fee");
  }

  async getSingleUpdateFee(provider: ContractProvider) {
    return await super.getSingleUpdateFee(
      provider,
      "test_get_single_update_fee"
    );
  }

  async sendUpdatePriceFeeds(
    provider: ContractProvider,
    via: Sender,
    updateData: Buffer,
    updateFee: bigint
  ) {
    await super.sendUpdatePriceFeeds(provider, via, updateData, updateFee);
  }

  async sendUpdateGuardianSet(
    provider: ContractProvider,
    via: Sender,
    vm: Buffer
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
      []
    );
    return result.stack.readNumber();
  }

  async getGovernanceDataSourceIndex(provider: ContractProvider) {
    const result = await provider.get(
      "test_get_governance_data_source_index",
      []
    );
    return result.stack.readNumber();
  }

  async getGovernanceDataSource(provider: ContractProvider) {
    const result = await provider.get("test_get_governance_data_source", []);
    return result.stack.readCell();
  }

  async sendExecuteGovernanceAction(
    provider: ContractProvider,
    via: Sender,
    governanceAction: Buffer
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
    newCode: Cell
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
    dataSource: DataSource
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

  async getNewFunction(provider: ContractProvider) {
    const result = await provider.get("test_new_function", []);
    return result.stack.readNumber();
  }
}
